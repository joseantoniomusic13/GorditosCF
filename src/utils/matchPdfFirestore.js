import { db } from "../firebase";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy
} from "firebase/firestore";

// Tamaño de fragmento: 400.000 caracteres base64 (~300 KB binarios).
// Es 100% seguro contra el límite estricto de 1 MB por documento en Firestore.
const CHUNK_SIZE = 400000;

/**
 * Convierte un File a Data URL (base64)
 */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Guarda un PDF importado del PC directamente en Cloud Firestore
 * fragmentado en la subcolección 'pdf_acta'.
 * No requiere Firebase Storage.
 */
export async function saveMatchPdfToFirestore(matchId, file, onProgress = () => {}) {
  onProgress(10);
  const dataUrl = await fileToDataUrl(file);
  onProgress(30);

  // Dividir el string Base64 en fragmentos seguros
  const chunks = [];
  for (let i = 0; i < dataUrl.length; i += CHUNK_SIZE) {
    chunks.push(dataUrl.slice(i, i + CHUNK_SIZE));
  }

  const subColRef = collection(db, "partidos", matchId, "pdf_acta");

  // 1. Limpiar fragmentos anteriores si existían
  const existingSnap = await getDocs(subColRef);
  for (const d of existingSnap.docs) {
    await deleteDoc(d.ref);
  }
  onProgress(50);

  // 2. Guardar los nuevos fragmentos secuencialmente
  for (let idx = 0; idx < chunks.length; idx++) {
    const chunkRef = doc(db, "partidos", matchId, "pdf_acta", String(idx));
    await setDoc(chunkRef, {
      chunkIndex: idx,
      data: chunks[idx]
    });
    const progress = 50 + Math.round(((idx + 1) / chunks.length) * 40);
    onProgress(progress);
  }

  // 3. Actualizar metadatos en el documento principal del partido
  const matchRef = doc(db, "partidos", matchId);
  const fechaSubida = new Date().toISOString();
  const metadata = {
    hasPdfActa: true,
    actaPdfNombre: file.name,
    actaPdfSize: file.size,
    actaPdfFecha: fechaSubida,
    totalPdfChunks: chunks.length,
    actaPdfUrl: null // Limpiamos URL externa si la había
  };

  await updateDoc(matchRef, metadata);
  onProgress(100);

  return { dataUrl, metadata };
}

/**
 * Descarga y reconstruye el Blob del PDF desde los fragmentos de Firestore
 */
export async function loadMatchPdfBlob(matchId) {
  const subColRef = collection(db, "partidos", matchId, "pdf_acta");
  const q = query(subColRef, orderBy("chunkIndex", "asc"));
  const snap = await getDocs(q);

  if (snap.empty) {
    throw new Error("No se encontraron datos del acta en la base de datos.");
  }

  const fullDataUrl = snap.docs.map(d => d.data().data).join("");
  const res = await fetch(fullDataUrl);
  return await res.blob();
}

/**
 * Elimina por completo el PDF de Firestore (fragmentos y metadatos)
 */
export async function deleteMatchPdfFromFirestore(matchId) {
  const subColRef = collection(db, "partidos", matchId, "pdf_acta");
  const snap = await getDocs(subColRef);
  for (const d of snap.docs) {
    await deleteDoc(d.ref);
  }

  const matchRef = doc(db, "partidos", matchId);
  await updateDoc(matchRef, {
    hasPdfActa: false,
    actaPdfNombre: null,
    actaPdfSize: null,
    actaPdfFecha: null,
    actaPdfUrl: null,
    totalPdfChunks: 0
  });
}

/**
 * Guarda una URL externa (ej. enlace de Google Drive o web federativa)
 */
export async function saveExternalMatchPdfUrl(matchId, url, nombre = "Enlace Acta") {
  // Limpiar cualquier fragmento previo
  const subColRef = collection(db, "partidos", matchId, "pdf_acta");
  const snap = await getDocs(subColRef);
  for (const d of snap.docs) {
    await deleteDoc(d.ref);
  }

  const matchRef = doc(db, "partidos", matchId);
  await updateDoc(matchRef, {
    hasPdfActa: false,
    actaPdfUrl: url.trim(),
    actaPdfNombre: nombre,
    actaPdfFecha: new Date().toISOString(),
    totalPdfChunks: 0
  });
}

/**
 * Abre o descarga un Blob PDF en el navegador de manera segura
 */
export function openOrDownloadPdf(blob, fileName = "Acta_Partido.pdf") {
  const blobUrl = URL.createObjectURL(blob);
  const win = window.open(blobUrl, "_blank");

  // Si el navegador bloqueó la apertura emergente, forzar descarga como archivo
  if (!win || win.closed || typeof win.closed === "undefined") {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
