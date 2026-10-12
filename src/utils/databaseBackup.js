import { db } from "../firebase";
import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  writeBatch
} from "firebase/firestore";
import JSZip from "jszip";

/**
 * Gestor de escritura en lotes (batch) para Firestore.
 * Firestore tiene un límite estricto de 500 operaciones por lote.
 * Este gestor agrupa hasta 400 operaciones y hace commit automáticamente.
 */
class BatchWriter {
  constructor(firestoreDb, maxOps = 400) {
    this.db = firestoreDb;
    this.maxOps = maxOps;
    this.batch = writeBatch(this.db);
    this.opCount = 0;
    this.totalCommitted = 0;
  }

  async set(docRef, data, options = {}) {
    this.batch.set(docRef, data, options);
    this.opCount++;
    if (this.opCount >= this.maxOps) {
      await this.commit();
    }
  }

  async delete(docRef) {
    this.batch.delete(docRef);
    this.opCount++;
    if (this.opCount >= this.maxOps) {
      await this.commit();
    }
  }

  async commit() {
    if (this.opCount > 0) {
      await this.batch.commit();
      this.totalCommitted += this.opCount;
      this.batch = writeBatch(this.db);
      this.opCount = 0;
    }
  }
}

/**
 * Genera y descarga una copia de seguridad íntegra de la base de datos Firestore.
 * Incluye:
 * - Jugadores (con fotos en Base64, historial de lesiones y estadísticas)
 * - Partidos (alineaciones, actas, estadísticas, sustituciones)
 * - Subcolecciones pdf_acta de cada partido (fragmentos en Base64 del acta oficial)
 * - Entrenamientos (asistencias, faltas y justificaciones)
 * - Configuración global (temporada activa)
 *
 * @param {Function} onProgress - Callback (progreso: { percent, label })
 * @returns {Promise<{ fileName: string, summary: Object }>}
 */
export async function createDatabaseBackup(onProgress = () => {}) {
  try {
    onProgress({ percent: 5, label: "Iniciando copia de seguridad..." });

    // 1. Obtener jugadores
    onProgress({ percent: 15, label: "Leyendo plantilla de jugadores y fotos..." });
    const jugadoresSnap = await getDocs(collection(db, "jugadores"));
    const jugadores = jugadoresSnap.docs.map(d => ({
      ...d.data(),
      id: d.id
    }));

    // 2. Obtener partidos y sus fragmentos PDF
    onProgress({ percent: 30, label: "Leyendo partidos y resultados..." });
    const partidosSnap = await getDocs(collection(db, "partidos"));
    const partidos = [];
    let totalPdfChunks = 0;
    let totalPartidosConPdf = 0;

    const totalPartidosCount = partidosSnap.docs.length;
    for (let i = 0; i < totalPartidosCount; i++) {
      const matchDoc = partidosSnap.docs[i];
      const matchData = matchDoc.data();
      const matchId = matchDoc.id;

      let pdfChunks = [];
      // Si el partido contiene acta PDF en Firestore
      if (matchData.hasPdfActa || matchData.totalPdfChunks > 0 || matchData.actaPdfNombre) {
        onProgress({
          percent: 30 + Math.round(((i + 1) / Math.max(1, totalPartidosCount)) * 35),
          label: `Extrayendo actas oficiales PDF (${i + 1}/${totalPartidosCount}: vs ${matchData.rival || "Rival"})...`
        });

        try {
          const chunksSnap = await getDocs(collection(db, "partidos", matchId, "pdf_acta"));
          pdfChunks = chunksSnap.docs.map(c => ({
            id: c.id,
            chunkIndex: c.data().chunkIndex,
            data: c.data().data
          }));
          if (pdfChunks.length > 0) {
            totalPdfChunks += pdfChunks.length;
            totalPartidosConPdf++;
          }
        } catch (err) {
          console.warn(`Aviso al extraer fragmentos PDF del partido ${matchId}:`, err);
        }
      }

      partidos.push({
        ...matchData,
        id: matchId,
        pdfActaChunks: pdfChunks
      });
    }

    // 3. Obtener entrenamientos
    onProgress({ percent: 70, label: "Leyendo entrenamientos y control de asistencia..." });
    const entrenosSnap = await getDocs(collection(db, "entrenamientos"));
    const entrenamientos = entrenosSnap.docs.map(d => ({
      ...d.data(),
      id: d.id
    }));

    // 4. Obtener configuraciones
    onProgress({ percent: 85, label: "Leyendo configuración de temporada..." });
    const configSnap = await getDocs(collection(db, "config"));
    const configList = configSnap.docs.map(d => ({
      ...d.data(),
      id: d.id
    }));

    // 5. Estructurar el objeto de Backup
    const now = new Date();
    const summary = {
      totalJugadores: jugadores.length,
      totalPartidos: partidos.length,
      totalPartidosConPdf,
      totalPdfChunks,
      totalEntrenamientos: entrenamientos.length,
      totalConfig: configList.length,
      fechaLegible: now.toLocaleString("es-ES")
    };

    const backupPayload = {
      version: 1,
      app: "C.D. Gorditos C.F",
      appId: "gorditoscf-firestore-backup",
      exportedAt: now.toISOString(),
      summary,
      data: {
        jugadores,
        partidos,
        entrenamientos,
        config: configList
      }
    };

    // 6. Generar archivo JSON y forzar descarga
    onProgress({ percent: 95, label: "Empaquetando archivo de copia de seguridad..." });
    const jsonString = JSON.stringify(backupPayload, null, 2);
    const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });

    const pad = (n) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}h${pad(now.getMinutes())}m`;
    const fileName = `GorditosCF_Backup_Firestore_${dateStr}.json`;

    const downloadUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(downloadUrl);

    onProgress({ percent: 100, label: "¡Copia de seguridad descargada con éxito!" });
    return { fileName, summary, backupPayload };
  } catch (error) {
    console.error("Error al exportar copia de seguridad de Firestore:", error);
    throw new Error("Error al generar copia de seguridad: " + error.message);
  }
}

/**
 * Lee y valida un archivo de copia de seguridad (soporta tanto .json como .zip que contenga .json).
 *
 * @param {File} file - Archivo subido por el usuario
 * @returns {Promise<{ valid: boolean, summary: Object, backupData: Object }>}
 */
export async function parseAndValidateBackupFile(file) {
  let jsonString = "";

  if (file.name.toLowerCase().endsWith(".zip")) {
    const zip = await JSZip.loadAsync(file);
    const jsonEntryName = Object.keys(zip.files).find(name => name.toLowerCase().endsWith(".json"));
    if (!jsonEntryName) {
      throw new Error("El archivo ZIP no contiene ningún archivo de copia de seguridad (.json).");
    }
    jsonString = await zip.files[jsonEntryName].async("string");
  } else {
    jsonString = await file.text();
  }

  let parsed = null;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error("El archivo no tiene un formato JSON válido.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Estructura de copia de seguridad no válida.");
  }

  // Comprobar identificador de la aplicación
  const isGorditosBackup =
    parsed.appId === "gorditoscf-firestore-backup" ||
    parsed.app === "C.D. Gorditos C.F" ||
    (parsed.data && (parsed.data.jugadores || parsed.data.partidos));

  if (!isGorditosBackup) {
    throw new Error("El archivo seleccionado no es una copia de seguridad reconocida de C.D. Gorditos C.F.");
  }

  if (!parsed.data || typeof parsed.data !== "object") {
    throw new Error("La copia de seguridad no contiene la sección de datos requerida.");
  }

  const jugadores = Array.isArray(parsed.data.jugadores) ? parsed.data.jugadores : [];
  const partidos = Array.isArray(parsed.data.partidos) ? parsed.data.partidos : [];
  const entrenamientos = Array.isArray(parsed.data.entrenamientos) ? parsed.data.entrenamientos : [];
  const configList = Array.isArray(parsed.data.config) ? parsed.data.config : [];

  let totalPdfChunks = 0;
  let totalPartidosConPdf = 0;
  partidos.forEach(p => {
    if (Array.isArray(p.pdfActaChunks) && p.pdfActaChunks.length > 0) {
      totalPdfChunks += p.pdfActaChunks.length;
      totalPartidosConPdf++;
    } else if (p.hasPdfActa) {
      totalPartidosConPdf++;
    }
  });

  const summary = {
    exportedAt: parsed.exportedAt || null,
    totalJugadores: jugadores.length,
    totalPartidos: partidos.length,
    totalPartidosConPdf,
    totalPdfChunks,
    totalEntrenamientos: entrenamientos.length,
    totalConfig: configList.length,
    version: parsed.version || 1
  };

  return {
    valid: true,
    summary,
    backupData: parsed
  };
}

/**
 * Restaura la base de datos Firestore a partir del objeto de copia de seguridad.
 * Conserva intactos todos los IDs originales para mantener la integridad relacional de
 * actas, estadísticas, asignaciones tácticas, ausencias y fragmentos de PDF.
 *
 * @param {Object} backupData - Datos validados de la copia de seguridad
 * @param {Object} options - { clearExisting: boolean }
 * @param {Function} onProgress - Callback (progreso: { percent, label })
 * @returns {Promise<{ success: boolean, restoredCounts: Object }>}
 */
export async function restoreDatabaseBackup(backupData, options = { clearExisting: false }, onProgress = () => {}) {
  try {
    const { data } = backupData;
    const jugadores = Array.isArray(data.jugadores) ? data.jugadores : [];
    const partidos = Array.isArray(data.partidos) ? data.partidos : [];
    const entrenamientos = Array.isArray(data.entrenamientos) ? data.entrenamientos : [];
    const configList = Array.isArray(data.config) ? data.config : [];

    const batchWriter = new BatchWriter(db, 350);

    // 1. Limpieza opcional de colecciones actuales (Modo Restauración Limpia)
    if (options.clearExisting) {
      onProgress({ percent: 5, label: "Borrando partidos y actas PDF actuales..." });
      const curPartidosSnap = await getDocs(collection(db, "partidos"));
      for (const pDoc of curPartidosSnap.docs) {
        // Borrar fragmentos de subcolección pdf_acta
        const chunksSnap = await getDocs(collection(db, "partidos", pDoc.id, "pdf_acta"));
        for (const cDoc of chunksSnap.docs) {
          await batchWriter.delete(cDoc.ref);
        }
        await batchWriter.delete(pDoc.ref);
      }
      await batchWriter.commit();

      onProgress({ percent: 15, label: "Borrando jugadores actuales..." });
      const curJugadoresSnap = await getDocs(collection(db, "jugadores"));
      for (const jDoc of curJugadoresSnap.docs) {
        await batchWriter.delete(jDoc.ref);
      }
      await batchWriter.commit();

      onProgress({ percent: 22, label: "Borrando entrenamientos actuales..." });
      const curEntrenosSnap = await getDocs(collection(db, "entrenamientos"));
      for (const eDoc of curEntrenosSnap.docs) {
        await batchWriter.delete(eDoc.ref);
      }
      await batchWriter.commit();
    }

    // 2. Restaurar Jugadores
    onProgress({ percent: 30, label: `Restaurando plantilla (${jugadores.length} jugadores)...` });
    for (let i = 0; i < jugadores.length; i++) {
      const player = jugadores[i];
      if (!player.id) continue;
      const playerRef = doc(db, "jugadores", player.id);
      await batchWriter.set(playerRef, player, { merge: true });
    }
    await batchWriter.commit();

    // 3. Restaurar Partidos y sus fragmentos PDF
    onProgress({ percent: 55, label: `Restaurando ${partidos.length} partidos y actas PDF...` });
    let totalPdfChunksRestored = 0;

    for (let i = 0; i < partidos.length; i++) {
      const match = partidos[i];
      if (!match.id) continue;

      // Separamos los fragmentos de la subcolección para que no se guarden dentro del documento del partido
      const { pdfActaChunks, ...matchDocData } = match;

      const matchRef = doc(db, "partidos", match.id);
      await batchWriter.set(matchRef, matchDocData, { merge: true });

      // Si tiene fragmentos PDF, restaurarlos en la subcolección `pdf_acta`
      if (Array.isArray(pdfActaChunks) && pdfActaChunks.length > 0) {
        for (let j = 0; j < pdfActaChunks.length; j++) {
          const chunk = pdfActaChunks[j];
          const resolvedIndex = chunk.chunkIndex !== undefined && chunk.chunkIndex !== null ? chunk.chunkIndex : j;
          const chunkId = String(chunk.id || resolvedIndex);
          const chunkRef = doc(db, "partidos", match.id, "pdf_acta", chunkId);
          await batchWriter.set(chunkRef, {
            chunkIndex: Number(resolvedIndex),
            data: chunk.data
          });
          totalPdfChunksRestored++;
        }
      }

      const matchPercent = 55 + Math.round(((i + 1) / Math.max(1, partidos.length)) * 25);
      onProgress({
        percent: matchPercent,
        label: `Restaurando partido ${i + 1}/${partidos.length} (${match.rival || "Rival"})...`
      });
    }
    await batchWriter.commit();

    // 4. Restaurar Entrenamientos
    onProgress({ percent: 85, label: `Restaurando ${entrenamientos.length} sesiones de entrenamiento...` });
    for (let i = 0; i < entrenamientos.length; i++) {
      const entreno = entrenamientos[i];
      if (!entreno.id) continue;
      const entrenoRef = doc(db, "entrenamientos", entreno.id);
      await batchWriter.set(entrenoRef, entreno, { merge: true });
    }
    await batchWriter.commit();

    // 5. Restaurar Configuración de Temporada
    onProgress({ percent: 95, label: "Restaurando configuración del sistema..." });
    for (let i = 0; i < configList.length; i++) {
      const cfg = configList[i];
      if (!cfg.id) continue;
      const cfgRef = doc(db, "config", cfg.id);
      await batchWriter.set(cfgRef, cfg, { merge: true });
    }
    await batchWriter.commit();

    onProgress({ percent: 100, label: "¡Base de datos restaurada correctamente!" });

    return {
      success: true,
      restoredCounts: {
        jugadores: jugadores.length,
        partidos: partidos.length,
        pdfChunks: totalPdfChunksRestored,
        entrenamientos: entrenamientos.length,
        config: configList.length
      }
    };
  } catch (error) {
    console.error("Error durante la restauración de la base de datos:", error);
    throw new Error("Fallo en la restauración: " + error.message);
  }
}
