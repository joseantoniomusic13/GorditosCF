import React, { useState, useEffect, useRef } from "react";
import { db, auth } from "../firebase";
import { signOut } from "firebase/auth";
import { loadMatchPdfBlob, openOrDownloadPdf } from "../utils/matchPdfFirestore";
import {
  collection,
  doc,
  updateDoc,
  increment,
  onSnapshot,
  deleteDoc,
  addDoc,
  setDoc,
  getDocs,
  query,
  orderBy
} from "firebase/firestore";
import {
  LogOut,
  Plus,
  Users,
  Calendar,
  Search,
  Trash2,
  CalendarDays,
  CheckCircle,
  HelpCircle,
  FileText,
  UserCheck,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ClipboardList,
  Eye,
  Pencil,
  X,
  RefreshCw,
  BarChart2,
  Sparkles,
  Trophy,
  TrendingUp,
  Target,
  Zap,
  MapPin,
  Archive,
  Download
} from "lucide-react";
import AddPlayerForm from "./AddPlayerForm";
import ActaPartido from "./ActaPartido";
import EditPlayerModal from "./EditPlayerModal";
import EditInjuryModal from "./EditInjuryModal";
import AltaPlayerModal from "./AltaPlayerModal";
import { LOGO_BASE64 } from "../logoBase64";
import { exportSeasonZip } from "../utils/seasonBackupZip";

const calcularEdad = (fechaNac) => {
  if (!fechaNac) return "N/A";
  const birthDate = new Date(fechaNac);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

export default function AdminPanel({ adminUser, onViewPublic, onLogout }) {
  const [activeTab, setActiveTab] = useState("jugadores"); // "jugadores", "partidos", "entrenamientos"
  const [expandedPlayerId, setExpandedPlayerId] = useState(null); // ID del jugador expandido en el acordeón
  const [showModPanel, setShowModPanel] = useState(false); // Panel de modificaciones colapsable
  const [jugadores, setJugadores] = useState([]);
  const [partidos, setPartidos] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingPlayer, setEditingPlayer] = useState(null); // Jugador que se está editando
  const [recalculandoStats, setRecalculandoStats] = useState(false);
  const [editingInjury, setEditingInjury] = useState(null); // { player, injury }
  const [toast, setToast] = useState(null); // { message, type }
  const [confirmDialog, setConfirmDialog] = useState(null); // { title, message, onConfirm, confirmText, cancelText }
  const [altaPlayer, setAltaPlayer] = useState(null); // player

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Estados para entrenamientos
  const [entrenamientos, setEntrenamientos] = useState([]);
  const [showAddTraining, setShowAddTraining] = useState(false);
  const [trainingDate, setTrainingDate] = useState("");
  const [trainingLugar, setTrainingLugar] = useState("");
  const [trainingNotes, setTrainingNotes] = useState("");
  const [absentPlayerIds, setAbsentPlayerIds] = useState([]); // IDs de jugadores ausentes
  const [editingTrainingId, setEditingTrainingId] = useState(null);
  const [trainingError, setTrainingError] = useState("");
  const [savingTraining, setSavingTraining] = useState(false);
  const [showTrainingHistory, setShowTrainingHistory] = useState(false);
  const [showExportTrainingModal, setShowExportTrainingModal] = useState(false);
  const [confirmDeleteTraining, setConfirmDeleteTraining] = useState(null);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [showHelpModal, setShowHelpModal] = useState(false);
  // Motivos de ausencia por jugador { [playerId]: string }
  const [absentPlayerReasons, setAbsentPlayerReasons] = useState({});
  // Modal de motivo de ausencia { player, currentReason }
  const [absenceModal, setAbsenceModal] = useState(null);
  const [absenceReasonInput, setAbsenceReasonInput] = useState("");

  // ── Configuración de Temporada ──────────────────────────────────────────
  const [temporadaConfig, setTemporadaConfig] = useState(null); // { nombre, fechaInicio, creadaAt }
  // Modal Nueva Temporada
  const [showNuevaTemporadaModal, setShowNuevaTemporadaModal] = useState(false);
  const [nuevaTemporadaNombre, setNuevaTemporadaNombre] = useState("");
  const [nuevaTemporadaFechaInicio, setNuevaTemporadaFechaInicio] = useState("");
  const [iniciandoTemporada, setIniciandoTemporada] = useState(false);
  const nuevaTemporadaFechaRef = useRef(null);

  // Estados para ZIP de temporada
  const [descargandoZip, setDescargandoZip] = useState(false);
  const [zipProgress, setZipProgress] = useState(null); // { current, total, percent, label }
  const [autoDownloadZipOnSeasonReset, setAutoDownloadZipOnSeasonReset] = useState(true);
  const [rival, setRival] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [condicion, setCondicion] = useState("local"); // "local" o "visitante"
  const [tipoPartido, setTipoPartido] = useState("Liga"); // "Liga", "Copa", "Amistoso", "Pretemporada", "Playoff"
  const [jornada, setJornada] = useState(""); // Solo para Liga
  const [matchError, setMatchError] = useState("");
  
  // Estado para el acta de partido
  const [actaMatch, setActaMatch] = useState(null);

  // Refs para abrir calendarios
  const matchDateInputRef = useRef(null);
  const trainingDateInputRef = useRef(null);

  // Resetear panel de modificaciones al cambiar de jugador expandido
  useEffect(() => {
    setShowModPanel(false);
  }, [expandedPlayerId]);

  // Resetear historial de entrenamientos al cambiar de pestaña
  useEffect(() => {
    setShowTrainingHistory(false);
  }, [activeTab]);

  // Escuchar jugadores en tiempo real
  useEffect(() => {
    const q = query(collection(db, "jugadores"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pList = [];
      snapshot.forEach((doc) => {
        pList.push({ id: doc.id, ...doc.data() });
      });
      setJugadores(pList);
      setLoading(false);
    }, (error) => {
      console.error("Error cargando jugadores: ", error);
    });
    return () => unsubscribe();
  }, []);

  // Escuchar partidos en tiempo real
  useEffect(() => {
    const q = query(collection(db, "partidos"), orderBy("fecha", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mList = [];
      snapshot.forEach((doc) => {
        mList.push({ id: doc.id, ...doc.data() });
      });
      setPartidos(mList);
    }, (error) => {
      console.error("Error cargando partidos: ", error);
    });
    return () => unsubscribe();
  }, []);

  // Escuchar entrenamientos en tiempo real
  useEffect(() => {
    const q = query(collection(db, "entrenamientos"), orderBy("fecha", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tList = [];
      snapshot.forEach((doc) => {
        tList.push({ id: doc.id, ...doc.data() });
      });
      setEntrenamientos(tList);
    }, (error) => {
      console.error("Error cargando entrenamientos: ", error);
    });
    return () => unsubscribe();
  }, []);

  // Escuchar configuración de temporada en tiempo real
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "config", "temporada"), (snapshot) => {
      if (snapshot.exists()) {
        setTemporadaConfig(snapshot.data());
      } else {
        setTemporadaConfig(null);
      }
    }, (error) => {
      console.error("Error cargando config de temporada: ", error);
    });
    return () => unsubscribe();
  }, []);

  // Limpieza automática única de entrenamientos legacy de martes, jueves y viernes
  useEffect(() => {
    const cleanedFlag = localStorage.getItem("gorditos_clean_mar_jue_vie_v4");
    if (cleanedFlag || entrenamientos.length === 0 || jugadores.length === 0) return;

    const legacySessions = entrenamientos.filter(t => {
      if (!t.fecha) return false;
      const d = new Date(t.fecha + "T00:00:00");
      const day = d.getDay(); // 2: Martes, 4: Jueves, 5: Viernes
      return day === 2 || day === 4 || day === 5;
    });

    if (legacySessions.length > 0) {
      localStorage.setItem("gorditos_clean_mar_jue_vie_v4", "true");
      (async () => {
        try {
          for (const s of legacySessions) {
            await deleteDoc(doc(db, "entrenamientos", s.id));
          }
          const remainingTrainings = entrenamientos.filter(t => !legacySessions.some(ls => ls.id === t.id));
          for (const player of jugadores) {
            const count = remainingTrainings.filter(t => t.faltas && t.faltas.includes(player.id)).length;
            if (player.faltasEntrenamiento !== count) {
              await updateDoc(doc(db, "jugadores", player.id), {
                faltasEntrenamiento: count
              });
            }
          }
          showToast(`Eliminados ${legacySessions.length} entrenamientos de martes, jueves y viernes del historial y calendario.`, "success");
        } catch (err) {
          console.error("Error eliminando sesiones de martes, jueves y viernes:", err);
        }
      })();
    } else {
      localStorage.setItem("gorditos_clean_mar_jue_vie_v4", "true");
    }
  }, [entrenamientos, jugadores]);
  const handleSaveTraining = async (e) => {
    e.preventDefault();
    if (!trainingDate) {
      setTrainingError("Por favor, selecciona una fecha.");
      return;
    }
    setSavingTraining(true);
    setTrainingError("");
    try {
      const trainingData = {
        fecha: trainingDate,
        lugar: trainingLugar.trim(),
        notas: trainingNotes.trim(),
        faltas: absentPlayerIds,
        ausencias: absentPlayerIds.reduce((acc, id) => {
          acc[id] = absentPlayerReasons[id] || "";
          return acc;
        }, {})
      };

      if (editingTrainingId) {
        // Modo Edición: Calcular diferencia de faltas
        const oldTraining = entrenamientos.find(t => t.id === editingTrainingId);
        const oldFaltas = oldTraining ? (oldTraining.faltas || []) : [];
        
        const added = absentPlayerIds.filter(id => !oldFaltas.includes(id));
        const removed = oldFaltas.filter(id => !absentPlayerIds.includes(id));

        for (const playerId of added) {
          await updateDoc(doc(db, "jugadores", playerId), {
            faltasEntrenamiento: increment(1)
          });
        }
        for (const playerId of removed) {
          const player = jugadores.find(j => j.id === playerId);
          const currentFaltas = player?.faltasEntrenamiento || 0;
          const decVal = currentFaltas > 0 ? -1 : 0;
          if (decVal !== 0) {
            await updateDoc(doc(db, "jugadores", playerId), {
              faltasEntrenamiento: increment(decVal)
            });
          }
        }

        await updateDoc(doc(db, "entrenamientos", editingTrainingId), trainingData);
      } else {
        // Modo Nuevo: Guardar sesión e incrementar faltas
        await addDoc(collection(db, "entrenamientos"), trainingData);
        for (const playerId of absentPlayerIds) {
          await updateDoc(doc(db, "jugadores", playerId), {
            faltasEntrenamiento: increment(1)
          });
        }
      }

      // Limpiar formulario
      setTrainingDate("");
      setTrainingLugar("");
      setTrainingNotes("");
      setAbsentPlayerIds([]);
      setAbsentPlayerReasons({});
      setEditingTrainingId(null);
      setShowAddTraining(false);
    } catch (err) {
      console.error("Error guardando entrenamiento:", err);
      setTrainingError("Error al guardar el entrenamiento.");
    } finally {
      setSavingTraining(false);
    }
  };

  const handleEditTraining = (training) => {
    setEditingTrainingId(training.id);
    setTrainingDate(training.fecha);
    setTrainingLugar(training.lugar || "");
    setTrainingNotes(training.notas || "");
    setAbsentPlayerIds(training.faltas || []);
    setAbsentPlayerReasons(training.ausencias || {});
    setShowAddTraining(true);
  };

  const handleDeleteTraining = async (training) => {
    setConfirmDeleteTraining(training);
  };

  const executeDeleteTraining = async (training) => {
    setConfirmDeleteTraining(null);
    try {
      const oldFaltas = training.faltas || [];
      for (const playerId of oldFaltas) {
        const player = jugadores.find(j => j.id === playerId);
        const currentFaltas = player?.faltasEntrenamiento || 0;
        const decVal = currentFaltas > 0 ? -1 : 0;
        if (decVal !== 0) {
          await updateDoc(doc(db, "jugadores", playerId), {
            faltasEntrenamiento: increment(decVal)
          });
        }
      }
      await deleteDoc(doc(db, "entrenamientos", training.id));
      // Si el formulario está abierto con esta sesión, cerrarlo
      if (editingTrainingId === training.id) {
        setShowAddTraining(false);
        setEditingTrainingId(null);
      }
    } catch (err) {
      console.error("Error eliminando entrenamiento:", err);
      showToast("Error al eliminar el entrenamiento.", "error");
    }
  };

  // Eliminar todo el historial de entrenamientos
  const confirmDeleteAllTrainings = () => {
    setConfirmDialog({
      title: "Eliminar Todo el Historial de Entrenamientos",
      message: `¿Estás seguro de que deseas eliminar TODOS los entrenamientos registrados (${entrenamientos.length} sesiones)? Esta acción borrará todas las sesiones del calendario y del historial, y reiniciará a 0 las faltas de entrenamiento de todos los jugadores.`,
      confirmText: "Vaciar Todo",
      cancelText: "Cancelar",
      onConfirm: async () => {
        try {
          const entrenosSnap = await getDocs(collection(db, "entrenamientos"));
          for (const d of entrenosSnap.docs) {
            await deleteDoc(doc(db, "entrenamientos", d.id));
          }
          for (const player of jugadores) {
            await updateDoc(doc(db, "jugadores", player.id), {
              faltasEntrenamiento: 0
            });
          }
          showToast("Historial de entrenamientos vaciado por completo.", "success");
        } catch (err) {
          console.error("Error al vaciar entrenamientos:", err);
          showToast("Error al vaciar el historial: " + err.message, "error");
        }
      }
    });
  };

  // Eliminar entrenamientos específicos de martes, jueves y viernes
  const confirmDeleteMarJueVieTrainings = () => {
    const targetSessions = entrenamientos.filter(t => {
      if (!t.fecha) return false;
      const d = new Date(t.fecha + "T00:00:00");
      const day = d.getDay();
      return day === 2 || day === 4 || day === 5;
    });

    if (targetSessions.length === 0) {
      showToast("No hay entrenamientos en martes, jueves o viernes.", "info");
      return;
    }

    setConfirmDialog({
      title: "Eliminar Entrenamientos de Mar, Jue y Vie",
      message: `¿Deseas eliminar las ${targetSessions.length} sesiones registradas en martes, jueves y viernes? Se actualizarán las faltas de asistencia de la plantilla.`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      onConfirm: async () => {
        try {
          for (const s of targetSessions) {
            await deleteDoc(doc(db, "entrenamientos", s.id));
          }
          const remainingTrainings = entrenamientos.filter(t => !targetSessions.some(ts => ts.id === t.id));
          for (const player of jugadores) {
            const count = remainingTrainings.filter(t => t.faltas && t.faltas.includes(player.id)).length;
            await updateDoc(doc(db, "jugadores", player.id), {
              faltasEntrenamiento: count
            });
          }
          showToast(`Eliminados ${targetSessions.length} entrenamientos de martes, jueves y viernes.`, "success");
        } catch (err) {
          console.error("Error al eliminar entrenamientos seleccionados:", err);
          showToast("Error al eliminar: " + err.message, "error");
        }
      }
    });
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      if (onLogout) onLogout();
    } catch (err) {
      console.error("Error al salir", err);
    }
  };

  // Descargar ZIP con todos los informes PDF de la temporada
  const handleDownloadSeasonZip = async () => {
    setDescargandoZip(true);
    setZipProgress({ current: 0, total: 100, percent: 5, label: "Iniciando compilación de informes..." });
    try {
      await exportSeasonZip({
        temporadaNombre: temporadaConfig?.nombre || "Actual",
        jugadores,
        partidos,
        entrenamientos,
        onProgress: (p) => setZipProgress(p)
      });
      showToast("¡Archivo ZIP con todos los PDFs descargado con éxito!", "success");
    } catch (err) {
      console.error("Error al descargar ZIP de temporada:", err);
      showToast("Error al generar el archivo ZIP: " + err.message, "error");
    } finally {
      setDescargandoZip(false);
      setZipProgress(null);
    }
  };

  // ── Handler: Iniciar Nueva Temporada ────────────────────────────────────
  const handleNuevaTemporada = async () => {
    if (!nuevaTemporadaNombre.trim() || !nuevaTemporadaFechaInicio) return;
    setIniciandoTemporada(true);
    try {
      // 0. Descarga automática previa del ZIP de la temporada que finaliza
      if (autoDownloadZipOnSeasonReset) {
        showToast("Generando copia de seguridad ZIP con todos los PDFs...", "info");
        try {
          await exportSeasonZip({
            temporadaNombre: temporadaConfig?.nombre || "Anterior",
            jugadores,
            partidos,
            entrenamientos,
            onProgress: (p) => setZipProgress(p)
          });
        } catch (zipErr) {
          console.error("Error generando ZIP previo al reinicio:", zipErr);
          showToast("Aviso: no se pudo completar el ZIP automático: " + zipErr.message, "warning");
        }
      }

      // 1. Guardar configuración de temporada en Firestore
      await setDoc(doc(db, "config", "temporada"), {
        nombre: nuevaTemporadaNombre.trim(),
        fechaInicio: nuevaTemporadaFechaInicio,
        creadaAt: new Date().toISOString()
      });

      // 2. Resetear todas las estadísticas de los jugadores a 0
      for (const player of jugadores) {
        await updateDoc(doc(db, "jugadores", player.id), {
          minutosJugados: 0,
          golesFavor: 0,
          golesContra: 0,
          asistencias: 0,
          tarjetasAmarillas: 0,
          tarjetasRojas: 0,
          partidosConvocados: 0,
          mvps: 0,
          faltasEntrenamiento: 0,
          faltasPartido: 0
        });
      }

      // 3. Borrar todos los partidos de la temporada anterior
      const partidosSnap = await getDocs(collection(db, "partidos"));
      for (const d of partidosSnap.docs) {
        await deleteDoc(doc(db, "partidos", d.id));
      }

      // 4. Borrar todos los entrenamientos de la temporada anterior
      const entrenosSnap = await getDocs(collection(db, "entrenamientos"));
      for (const d of entrenosSnap.docs) {
        await deleteDoc(doc(db, "entrenamientos", d.id));
      }

      setShowNuevaTemporadaModal(false);
      setNuevaTemporadaNombre("");
      setNuevaTemporadaFechaInicio("");
      showToast(`¡Temporada ${nuevaTemporadaNombre.trim()} iniciada con éxito! Datos reiniciados.`, "success");
    } catch (err) {
      console.error("Error iniciando nueva temporada:", err);
      showToast("Error al iniciar la nueva temporada: " + err.message, "error");
    } finally {
      setIniciandoTemporada(false);
    }
  };

  // Función para actualizar estadísticas usando Firestore increment()
  const updateStat = async (player, field, value) => {
    // Validar en el cliente que no bajamos de 0
    if (value < 0) {
      const currentValue = player[field] || 0;
      if (currentValue + value < 0) {
        return; // No permitir números negativos
      }
    }
    
    try {
      const playerRef = doc(db, "jugadores", player.id);
      await updateDoc(playerRef, {
        [field]: increment(value)
      });
    } catch (err) {
      console.error("Error actualizando estadística:", err);
      showToast("Error al actualizar datos. Comprueba la conexión o permisos.", "error");
    }
  };

  // Generar historial deportivo y de rendimiento completo en PDF por jugador
  const generateDetailedPlayerPDF = (player) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showToast("Por favor, permite las ventanas emergentes (popups) para descargar el PDF.", "warning");
      return;
    }

    // 1. Filtrar partidos jugados por este jugador
    const matchesPlayed = partidos.filter(match => {
      if (!match.actaGuardada && !match.jugado) return false;
      const s = match.statsJugadores ? match.statsJugadores[player.id] : null;
      return s && s.convocado;
    });

    // 1b. Filtrar partidos con falta / ausencia de este jugador
    const missedMatches = partidos.filter(match => {
      if (!match.actaGuardada && !match.jugado) return false;
      if (match.faltas && match.faltas.includes(player.id)) return true;
      if (match.ausencias && match.ausencias[player.id]) return true;
      const s = match.statsJugadores ? match.statsJugadores[player.id] : null;
      return !s || s.convocado === false;
    });

    // 2. Filtrar entrenamientos ausentes
    const missedSessions = entrenamientos.filter(t => t.faltas && t.faltas.includes(player.id));

    // 3. Calcular estadísticas totales del jugador
    let totalMinutos = 0;
    let totalGoles = 0;
    let totalAsistencias = 0;
    let totalAmarillas = 0;
    let totalRojas = 0;

    matchesPlayed.forEach(match => {
      const s = match.statsJugadores[player.id];
      totalMinutos += s.minutos || 0;
      totalGoles += player.isPortero ? (s.golesContra || 0) : (s.goles || 0);
      totalAsistencias += s.asistencias || 0;
      totalAmarillas += s.amarillas || 0;
      totalRojas += s.rojas || 0;
    });

    // 4. Filas de participación en partidos
    const partidosRows = matchesPlayed.map(match => {
      const s = match.statsJugadores[player.id];
      const matchDateStr = new Date(match.fecha + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
      const golesClub = match.golesGorditos ?? match.golesCamarma;
      const resultadoStr = golesClub !== undefined ? `${golesClub} - ${match.golesRival}` : "N/A";
      
      let tipoParticipacion = "Convocado";
      if (match.alineacion) {
        const asignaciones = match.alineacion.asignaciones || {};
        const suplentes = match.alineacion.suplentes || [];
        if (Object.values(asignaciones).includes(player.id)) {
          tipoParticipacion = "Titular";
        } else if (suplentes.includes(player.id)) {
          tipoParticipacion = "Suplente";
        }
      }

      // Detalle goles
      let golesStr = "-";
      if (player.isPortero) {
        golesStr = `${s.golesContra || 0} recib.`;
      } else if (s.goles > 0) {
        if (s.golesDetalle && s.golesDetalle.length > 0) {
          golesStr = `⚽ ${s.goles} (${s.golesDetalle.map(gd => (gd.minuto === "?" ? "?" : gd.minuto + "'") + (gd.penalti ? " (p)" : "")).join(', ')})`;
        } else {
          golesStr = `⚽ ${s.goles}`;
        }
      }

      // Detalle asistencias
      let asistenciasStr = "-";
      if (s.asistencias > 0) {
        if (s.asistenciasDetalle && s.asistenciasDetalle.length > 0) {
          asistenciasStr = `👟 ${s.asistencias} (${s.asistenciasDetalle.map(ad => ad.minuto === "?" ? "?" : ad.minuto + "'").join(', ')})`;
        } else {
          asistenciasStr = `👟 ${s.asistencias}`;
        }
      }

      // Tarjetas con minutos
      let tarjetasStr = "";
      if (s.amarillas > 0) {
        const mins = s.amarillasDetalle && s.amarillasDetalle.length > 0
          ? `(${s.amarillasDetalle.map(a => a.minuto === '?' ? '?' : a.minuto + "'").join(', ')})`
          : '';
        tarjetasStr += `🟨${s.amarillas > 1 ? ` x${s.amarillas}` : ''} ${mins}`.trim();
      }
      if (s.rojas > 0) {
        const mins = s.rojasDetalle && s.rojasDetalle.length > 0
          ? `(${s.rojasDetalle.map(r => r.minuto === '?' ? '?' : r.minuto + "'").join(', ')})`
          : '';
        tarjetasStr += (tarjetasStr ? ' ' : '') + `🟥 ${mins}`.trim();
      }

      const comentarioTexto = (s.comentarios || s.comentario || s.observaciones || "").trim();

      return `
        <tr>
          <td><strong>vs ${match.rival}</strong></td>
          <td class="text-center">${matchDateStr}</td>
          <td class="text-center font-semibold">${resultadoStr} (${match.condicion === 'local' ? 'L' : 'V'})</td>
          <td class="text-center"><span class="badge ${tipoParticipacion === 'Titular' ? 'badge-centro' : 'badge-portero'}">${tipoParticipacion}</span></td>
          <td class="text-center font-mono">${s.minutos}'</td>
          <td class="text-center text-emerald-600 font-bold">${golesStr}</td>
          <td class="text-center text-blue-600 font-bold">${asistenciasStr}</td>
          <td class="text-center">${tarjetasStr || "-"}</td>
        </tr>
        ${comentarioTexto ? `
          <tr style="background-color: #f8fafc;">
            <td colspan="8" style="padding: 7px 14px; font-size: 11px; color: #334155; font-style: italic; border-left: 3px solid #1e3a8a; border-bottom: 1px solid #cbd5e1;">
              <strong style="color: #1e3a8a; font-style: normal; font-weight: 700;">💬 Comentario / Observación del Partido:</strong> "${comentarioTexto}"
            </td>
          </tr>
        ` : ''}
      `;
    }).join("");

    // 4b. Filas de faltas de partido (con motivo)
    const missedMatchesRows = missedMatches.map(m => {
      const d = new Date(m.fecha + "T00:00:00");
      const dateStr = d.toLocaleDateString("es-ES", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const motivo = (m.ausencias && m.ausencias[player.id]) ? m.ausencias[player.id] : "Falta injustificada";
      const injustificada = motivo === "Falta injustificada" || !motivo;
      const motivoColor = injustificada ? "#ef4444" : "#f59e0b";
      return `
        <tr>
          <td><strong>vs ${m.rival}</strong> (${m.condicion === 'local' ? 'Local' : 'Visitante'})</td>
          <td class="text-center">${dateStr}</td>
          <td style="color:${motivoColor}; font-weight:600;">${motivo}</td>
        </tr>
      `;
    }).join("");

    // 5. Filas de faltas de entreno (con motivo)
    const faltasRows = missedSessions.map(t => {
      const d = new Date(t.fecha + "T00:00:00");
      const dateStr = d.toLocaleDateString("es-ES", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const motivo = (t.ausencias && t.ausencias[player.id]) ? t.ausencias[player.id] : "Falta injustificada";
      const injustificada = motivo === "Falta injustificada" || !motivo;
      const motivoColor = injustificada ? "#ef4444" : "#f59e0b";
      return `
        <tr>
          <td><strong>${dateStr}</strong></td>
          <td style="color:${motivoColor}; font-weight:600;">${motivo}</td>
          <td class="text-slate-500 italic">${t.notas || "Sin observaciones"}</td>
        </tr>
      `;
    }).join("");

    // 6. Filas de lesiones
    const lesionesRows = (player.historialLesiones || []).map(entry => {
      const d = new Date(entry.fechaAlta + "T00:00:00") - new Date(entry.fechaBaja + "T00:00:00");
      const computedDuracion = d >= 0 ? Math.ceil(d / (1000 * 60 * 60 * 24)) : entry.duracion;
      return `
        <tr>
          <td><strong>${entry.tipoLesion}</strong></td>
          <td class="text-center">${entry.fechaBaja}</td>
          <td class="text-center">${entry.fechaAlta}</td>
          <td class="text-center font-bold text-amber-600">${computedDuracion} ${computedDuracion === 1 ? 'día' : 'días'}</td>
        </tr>
      `;
    }).join("");

    // 7. Renderizar en el printWindow
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Historial Deportivo - ${player.nombre}</title>
          <meta charset="utf-8" />
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800;900&display=swap');
            body {
              font-family: 'Outfit', sans-serif;
              color: #1e293b;
              margin: 40px;
              line-height: 1.5;
              background-color: #ffffff;
            }
            .header-report {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 4px solid #1e3a8a;
              padding-bottom: 15px;
              margin-bottom: 25px;
            }
            .title-area h1 {
              font-size: 24px;
              font-weight: 900;
              text-transform: uppercase;
              margin: 0;
              color: #1e3a8a;
              letter-spacing: -0.5px;
            }
            .title-area p {
              font-size: 13px;
              font-weight: 600;
              color: #eab308;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin: 4px 0 0 0;
            }
            .logo {
              width: 55px;
              height: 55px;
              object-fit: contain;
            }
            .profile-card {
              display: flex;
              gap: 25px;
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 16px;
              padding: 20px;
              margin-bottom: 30px;
              align-items: center;
            }
            .profile-photo {
              width: 100px;
              height: 100px;
              border-radius: 50%;
              object-fit: cover;
              border: 3px solid #1e3a8a;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
            }
            .profile-placeholder {
              width: 100px;
              height: 100px;
              border-radius: 50%;
              background-color: #1e3a8a;
              color: #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 40px;
              font-weight: 900;
              border: 3px solid #eab308;
            }
            .profile-info {
              flex: 1;
            }
            .profile-info h2 {
              margin: 0 0 8px 0;
              font-size: 20px;
              font-weight: 800;
              color: #0f172a;
            }
            .profile-details-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 15px;
            }
            .detail-item {
              font-size: 12px;
            }
            .detail-item span {
              display: block;
              color: #64748b;
              font-weight: 600;
              text-transform: uppercase;
              font-size: 10px;
              letter-spacing: 0.5px;
            }
            .detail-item strong {
              color: #1e293b;
              font-size: 13px;
            }
            .section-title {
              font-size: 15px;
              font-weight: 900;
              text-transform: uppercase;
              color: #1e3a8a;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 6px;
              margin-top: 30px;
              margin-bottom: 12px;
              letter-spacing: 0.5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
              font-size: 12px;
            }
            th {
              background-color: #f1f5f9;
              color: #0f172a;
              font-weight: 800;
              text-transform: uppercase;
              font-size: 10px;
              letter-spacing: 0.5px;
              padding: 10px;
              border-bottom: 2px solid #cbd5e1;
              text-align: left;
            }
            .text-center {
              text-align: center;
            }
            td {
              padding: 9px 10px;
              border-bottom: 1px solid #e2e8f0;
              color: #334155;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .badge {
              font-size: 9px;
              font-weight: 800;
              padding: 2.5px 6px;
              border-radius: 6px;
              text-transform: uppercase;
            }
            .badge-portero { background-color: #fae8ff; border-color: #f0abfc; color: #a21caf; }
            .badge-defensa { background-color: #fef3c7; border-color: #fde047; color: #b45309; }
            .badge-centro { background-color: #dbeafe; border-color: #93c5fd; color: #1d4ed8; }
            .badge-delantero { background-color: #d1fae5; border-color: #6ee7b7; color: #047857; }
            
            .stats-cards-grid {
              display: grid;
              grid-template-columns: repeat(6, 1fr);
              gap: 12px;
              margin-bottom: 25px;
            }
            .stat-card {
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 12px;
              text-align: center;
            }
            .stat-card span {
              display: block;
              font-size: 9px;
              font-weight: 600;
              color: #64748b;
              text-transform: uppercase;
              margin-bottom: 3px;
            }
            .stat-card strong {
              font-size: 18px;
              color: #1e3a8a;
              font-weight: 900;
            }
            .empty-msg {
              font-size: 12px;
              color: #64748b;
              font-style: italic;
              padding: 10px;
              background-color: #f8fafc;
              border-radius: 8px;
              border: 1px dashed #cbd5e1;
            }
            @media print {
              body { margin: 20px; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
            }
          </style>
        </head>
        <body>
          <div class="header-report">
            <div class="title-area">
              <h1>C.D. Gorditos C.F</h1>
              <p>Historial Deportivo Individual</p>
            </div>
            <img class="logo" src="${LOGO_BASE64}" alt="C.D. Gorditos C.F Escudo" />
          </div>

          <div class="profile-card">
            ${player.fotoUrl 
              ? `<img class="profile-photo" src="${player.fotoUrl}" alt="${player.nombre}" />`
              : `<div class="profile-placeholder">${player.nombre.charAt(0)}</div>`
            }
            <div class="profile-info">
              <h2>${player.nombre} ${player.dorsal ? `(#${player.dorsal})` : ''}</h2>
              <div class="profile-details-grid">
                <div class="detail-item">
                  <span>Dorsal</span>
                  <strong>${player.dorsal ? `#${player.dorsal}` : 'S/D'}</strong>
                </div>
                <div class="detail-item">
                  <span>Posición</span>
                  <strong>${player.posicion || (player.isPortero ? 'Portero' : 'Jugador')}</strong>
                </div>
                <div class="detail-item">
                  <span>Edad</span>
                  <strong>${calcularEdad(player.fechaNacimiento)} años</strong>
                </div>
                <div class="detail-item">
                  <span>Estado Médico</span>
                  <strong style="color: ${player.lesionado ? '#d97706' : '#16a34a'}">
                    ${player.lesionado ? '🤕 Lesionado (' + (player.tipoLesion || 'Molestias') + ')' : '💪 Disponible'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <div class="stats-cards-grid">
            <div class="stat-card">
              <span>Minutos</span>
              <strong>${totalMinutos}'</strong>
            </div>
            <div class="stat-card">
              <span>Partidos Convocado</span>
              <strong>${matchesPlayed.length}</strong>
            </div>
            <div class="stat-card">
              <span>${player.isPortero ? 'Goles Recibidos' : 'Goles Favor'}</span>
              <strong>${totalGoles}</strong>
            </div>
            <div class="stat-card">
              <span>Asistencias</span>
              <strong>${totalAsistencias}</strong>
            </div>
            <div class="stat-card">
              <span>Ausencias Entreno</span>
              <strong style="color: ${missedSessions.length > 0 ? '#ef4444' : '#16a34a'}">${missedSessions.length}</strong>
            </div>
            <div class="stat-card">
              <span>Ausencias Partido</span>
              <strong style="color: ${missedMatches.length > 0 ? '#ef4444' : '#16a34a'}">${missedMatches.length}</strong>
            </div>
          </div>

          <div class="section-title">Participación Detallada en Partidos Oficiales</div>
          ${matchesPlayed.length === 0 
            ? `<div class="empty-msg">No hay estadísticas de partidos registrados para este jugador.</div>`
            : `<table>
                <thead>
                  <tr>
                    <th>Rival</th>
                    <th class="text-center">Fecha</th>
                    <th class="text-center">Resultado</th>
                    <th class="text-center">Alineación</th>
                    <th class="text-center">Minutos</th>
                    <th class="text-center">${player.isPortero ? 'Goles Recib.' : 'Goles'}</th>
                    <th class="text-center">Asistencias</th>
                    <th class="text-center">Tarjetas</th>
                  </tr>
                </thead>
                <tbody>
                  ${partidosRows}
                </tbody>
              </table>`
          }

          <div class="section-title">Faltas y Ausencias en Partidos</div>
          ${missedMatches.length === 0
            ? `<div class="empty-msg">Asistencia completa a todos los partidos disputados (0 faltas).</div>`
            : `<table>
                <thead>
                  <tr>
                    <th>Partido</th>
                    <th class="text-center">Fecha</th>
                    <th>Motivo / Justificación</th>
                  </tr>
                </thead>
                <tbody>
                  ${missedMatchesRows}
                </tbody>
              </table>`
          }

          <div class="section-title">Faltas de Asistencia a Entrenamientos</div>
          ${missedSessions.length === 0
            ? `<div class="empty-msg">Asistencia impecable a los entrenamientos registrados (100% de asistencia).</div>`
            : `<table>
                <thead>
                  <tr>
                    <th>Fecha de Sesión</th>
                    <th>Motivo / Justificación</th>
                    <th>Observaciones del Míster</th>
                  </tr>
                </thead>
                <tbody>
                  ${faltasRows}
                </tbody>
              </table>`
          }

          <div class="section-title">Historial de Lesiones</div>
          ${(!player.historialLesiones || player.historialLesiones.length === 0)
            ? `<div class="empty-msg">Sin registro de lesiones anteriores.</div>`
            : `<table>
                <thead>
                  <tr>
                    <th>Tipo de Lesión</th>
                    <th class="text-center">Fecha Baja</th>
                    <th class="text-center">Fecha Alta</th>
                    <th class="text-center">Duración</th>
                  </tr>
                </thead>
                <tbody>
                  ${lesionesRows}
                </tbody>
              </table>`
          }

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Crear un nuevo partido
  const handleAddMatch = async (e) => {
    e.preventDefault();
    if (!rival.trim() || !fecha) {
      setMatchError("Por favor, rellena rival y fecha.");
      return;
    }
    try {
      const newMatch = {
        rival: rival.trim(),
        fecha: fecha,
        hora: hora || null,
        condicion: condicion,
        tipoPartido: tipoPartido,
        jornada: tipoPartido === "Liga" ? (jornada || null) : null,
        golesCamarma: 0,
        golesGorditos: 0,
        golesRival: 0,
        jugado: false
      };
      await addDoc(collection(db, "partidos"), newMatch);
      setRival("");
      setFecha("");
      setHora("");
      setCondicion("local");
      setTipoPartido("Liga");
      setJornada("");
      setMatchError("");
    } catch (err) {
      console.error("Error añadiendo partido:", err);
      setMatchError("Error al guardar el partido.");
    }
  };



  // Eliminar un jugador
  const handleDeletePlayer = (player) => {
    setConfirmDialog({
      title: "Eliminar Jugador",
      message: `¿Seguro que quieres eliminar a ${player.nombre}? Esta acción no se puede deshacer y borrará permanentemente su ficha.`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "jugadores", player.id));
          showToast("Jugador eliminado correctamente.", "success");
        } catch (err) {
          console.error("Error eliminando jugador:", err);
          showToast("Error al borrar jugador.", "error");
        }
      }
    });
  };

  // Recalcular estadísticas completas de la plantilla
  const recalcularEstadisticas = () => {
    setConfirmDialog({
      title: "Recalcular Estadísticas",
      message: "¿Estás seguro de que deseas recalcular las estadísticas de toda la plantilla? Esto analizará todas las actas de partidos y sesiones de entrenamiento registradas en Firestore para corregir cualquier desajuste en los contadores (goles, tarjetas, minutos, faltas de asistencia, etc.).",
      confirmText: "Recalcular",
      cancelText: "Cancelar",
      onConfirm: async () => {
        setRecalculandoStats(true);
        try {
          // 1. Inicializar objeto de estadísticas para todos los jugadores
          const statsMap = {};
          jugadores.forEach(j => {
            statsMap[j.id] = {
              minutosJugados: 0,
              golesFavor: 0,
              golesContra: 0,
              asistencias: 0,
              tarjetasAmarillas: 0,
              tarjetasRojas: 0,
              partidosConvocados: 0,
              mvps: 0,
              faltasEntrenamiento: 0,
              faltasPartido: 0
            };
          });

          // 2. Iterar por todos los partidos
          partidos.forEach(match => {
            if (match.jugado || match.actaGuardada) {
              const stats = match.statsJugadores || {};
              const mvpId = match.mvpJugadorId || "";

              // MVP
              if (mvpId && statsMap[mvpId]) {
                statsMap[mvpId].mvps += 1;
              }

              // Estadísticas del partido
              Object.entries(stats).forEach(([jugadorId, playerStats]) => {
                if (statsMap[jugadorId]) {
                  statsMap[jugadorId].minutosJugados += playerStats.minutos || 0;
                  statsMap[jugadorId].golesFavor += playerStats.goles || 0;
                  statsMap[jugadorId].golesContra += playerStats.golesContra || 0;
                  statsMap[jugadorId].asistencias += playerStats.asistencias || 0;
                  statsMap[jugadorId].tarjetasAmarillas += playerStats.amarillas || 0;
                  statsMap[jugadorId].tarjetasRojas += playerStats.rojas || 0;
                  if (playerStats.convocado) {
                    statsMap[jugadorId].partidosConvocados += 1;
                  }
                }
              });

              // Faltas / Bajas del partido
              const matchFaltas = match.faltas || Object.keys(match.ausencias || {});
              matchFaltas.forEach(jugadorId => {
                if (statsMap[jugadorId]) {
                  statsMap[jugadorId].faltasPartido += 1;
                }
              });
            }
          });

          // 3. Iterar por todos los entrenamientos
          entrenamientos.forEach(training => {
            const absents = training.faltas || training.absentPlayerIds || [];
            absents.forEach(jugadorId => {
              if (statsMap[jugadorId]) {
                statsMap[jugadorId].faltasEntrenamiento += 1;
              }
            });
          });

          // 4. Actualizar Firestore
          const promesas = jugadores.map(async (player) => {
            const pStats = statsMap[player.id];
            if (pStats) {
              const playerRef = doc(db, "jugadores", player.id);
              await updateDoc(playerRef, {
                minutosJugados: pStats.minutosJugados,
                golesFavor: pStats.golesFavor,
                golesContra: pStats.golesContra,
                asistencias: pStats.asistencias,
                tarjetasAmarillas: pStats.tarjetasAmarillas,
                tarjetasRojas: pStats.tarjetasRojas,
                partidosConvocados: pStats.partidosConvocados,
                mvps: pStats.mvps,
                faltasEntrenamiento: pStats.faltasEntrenamiento,
                faltasPartido: pStats.faltasPartido
              });
            }
          });

          await Promise.all(promesas);
          showToast("¡Estadísticas de la plantilla recalculadas y corregidas con éxito!", "success");
        } catch (err) {
          console.error("Error al recalcular estadísticas:", err);
          showToast("Error al recalcular las estadísticas: " + err.message, "error");
        } finally {
          setRecalculandoStats(false);
        }
      }
    });
  };

  // Generar reporte PDF de la plantilla
  const generatePDFReport = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showToast("Por favor, permite las ventanas emergentes (popups) para descargar el PDF.", "warning");
      return;
    }

    const rows = jugadores.map(player => {
      const missedDates = entrenamientos
        .filter(t => t.faltas && t.faltas.includes(player.id))
        .map(t => {
          const d = new Date(t.fecha + "T00:00:00");
          return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
        });

      return {
        nombre: player.nombre,
        dorsal: player.dorsal || "",
        posicion: player.posicion || (player.isPortero ? "Portero" : "Jugador"),
        edad: calcularEdad(player.fechaNacimiento),
        goles: player.isPortero ? player.golesContra : player.golesFavor,
        asistencias: player.asistencias || 0,
        minutos: player.minutosJugados || 0,
        faltasEntrenoCount: player.faltasEntrenamiento || 0,
        faltasPartidoCount: player.faltasPartido || 0,
        faltasFechas: missedDates.length > 0 ? missedDates.join(", ") : "Ninguna"
      };
    });

    const rowsHtml = rows.map(r => {
      let badgeClass = "badge";
      if (r.posicion === "Portero") badgeClass += " badge-portero";
      else if (r.posicion === "Defensa") badgeClass += " badge-defensa";
      else if (r.posicion === "Centrocampista") badgeClass += " badge-centro";
      else if (r.posicion === "Delantero") badgeClass += " badge-delantero";

      return `
        <tr>
          <td><strong>${r.dorsal ? `#${r.dorsal} ` : ""}${r.nombre}</strong></td>
          <td><span class="${badgeClass}">${r.posicion}</span></td>
          <td class="text-center">${r.edad}</td>
          <td class="text-center">${r.goles}</td>
          <td class="text-center">${r.asistencias}</td>
          <td class="text-center">${r.minutos}'</td>
          <td class="text-center" style="color: ${r.faltasEntrenoCount > 0 ? '#ef4444' : '#10b981'}; font-weight: bold;">${r.faltasEntrenoCount}</td>
          <td class="text-center" style="color: ${r.faltasPartidoCount > 0 ? '#ef4444' : '#10b981'}; font-weight: bold;">${r.faltasPartidoCount}</td>
          <td class="date-list">${r.faltasFechas}</td>
        </tr>
      `;
    }).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>C.D. Gorditos C.F - Resumen de Plantilla</title>
          <meta charset="utf-8" />
          <style>
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              color: #1e293b;
              margin: 40px;
              line-height: 1.5;
            }
            .header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 3px solid #1e3a8a;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .title-section h1 {
              margin: 0;
              font-size: 26px;
              color: #1e3a8a;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .title-section h2 {
              margin: 5px 0 0 0;
              font-size: 14px;
              color: #eab308;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .meta-date {
              font-size: 12px;
              color: #64748b;
              text-align: right;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 13px;
            }
            th {
              background-color: #f1f5f9;
              color: #1e293b;
              font-weight: bold;
              text-align: left;
              padding: 12px 10px;
              border-bottom: 2px solid #cbd5e1;
              text-transform: uppercase;
              font-size: 11px;
              letter-spacing: 0.5px;
            }
            td {
              padding: 10px;
              border-bottom: 1px solid #e2e8f0;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .text-center {
              text-align: center;
            }
            .badge {
              font-size: 10px;
              font-weight: bold;
              padding: 3px 6px;
              border-radius: 4px;
              background-color: #f1f5f9;
              border: 1px solid #cbd5e1;
            }
            .badge-portero { background-color: #fae8ff; border-color: #f0abfc; color: #a21caf; }
            .badge-defensa { background-color: #fef3c7; border-color: #fde047; color: #b45309; }
            .badge-centro { background-color: #dbeafe; border-color: #93c5fd; color: #1d4ed8; }
            .badge-delantero { background-color: #d1fae5; border-color: #6ee7b7; color: #047857; }
            .date-list {
              font-size: 11px;
              color: #64748b;
              font-style: italic;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div style="display: flex; align-items: center; gap: 16px;">
              <img src="${LOGO_BASE64}" alt="C.D. Gorditos C.F Escudo" style="width: 55px; height: 55px; object-fit: contain;" />
              <div class="title-section">
                <h1>C.D. Gorditos C.F</h1>
                <h2>Informe Resumen de Plantilla</h2>
              </div>
            </div>
            <div class="meta-date">
              <strong>Generado por:</strong> Directiva de Gestión Deportiva<br/>
              <strong>Fecha:</strong> ${new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Posición</th>
                <th class="text-center">Edad</th>
                <th class="text-center">Goles</th>
                <th class="text-center">Asistencias</th>
                <th class="text-center">Minutos</th>
                <th class="text-center">Faltas Entreno</th>
                <th class="text-center">Faltas Partidos</th>
                <th>Detalle Faltas Entreno</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Obtener meses con entrenamientos
  const getMonthsWithTrainings = () => {
    const monthsMap = {};
    entrenamientos.forEach(t => {
      if (t.fecha) {
        const [year, month] = t.fecha.split("-");
        const key = `${year}-${month}`;
        const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
        monthsMap[key] = dateObj.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
      }
    });
    return Object.entries(monthsMap)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, label]) => ({ key, label }));
  };

  // Generar reporte PDF de entrenamientos
  const generateTrainingPDF = (selectedKeys) => {
    if (selectedKeys.length === 0) {
      showToast("Por favor, selecciona al menos un mes.", "warning");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showToast("Por favor, permite las ventanas emergentes (popups) para descargar el PDF.", "warning");
      return;
    }

    // Filtrar sesiones de los meses seleccionados
    const sessions = entrenamientos.filter(t => {
      if (!t.fecha) return false;
      const [year, month] = t.fecha.split("-");
      const key = `${year}-${month}`;
      return selectedKeys.includes(key);
    }).sort((a, b) => a.fecha.localeCompare(b.fecha));

    // Agrupar por mes para el reporte
    const sessionsByMonth = {};
    sessions.forEach(s => {
      const [year, month] = s.fecha.split("-");
      const key = `${year}-${month}`;
      if (!sessionsByMonth[key]) {
        sessionsByMonth[key] = {
          label: new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" }),
          list: []
        };
      }
      sessionsByMonth[key].list.push(s);
    });

    const contentHtml = Object.values(sessionsByMonth).map(monthData => {
      const rowsHtml = monthData.list.map(s => {
        const d = new Date(s.fecha + "T00:00:00");
        const dateStr = d.toLocaleDateString("es-ES", { weekday: 'long', day: 'numeric', month: 'long' });
        const lugarStr = s.lugar ? `<div style="font-size:11px; color:#d97706; font-weight:600; margin-top:3px;">📍 ${s.lugar}</div>` : "";
        
        // Faltas con motivos
        const absences = s.faltas || [];
        const ausencias = s.ausencias || {}; // { [playerId]: motivo }

        let absencesCellHtml;
        if (absences.length === 0) {
          absencesCellHtml = `<span style="color:#16a34a; font-weight:700;">✔ Asistencia completa</span>`;
        } else {
          const lines = absences.map(pid => {
            const p = jugadores.find(j => j.id === pid);
            const nombre = p ? p.nombre : "Jugador";
            const motivo = ausencias[pid] || "";
            const injustificada = !motivo || motivo.toLowerCase() === "falta injustificada";
            const color = injustificada ? "#ef4444" : "#f59e0b";
            const motivoLabel = motivo ? motivo : "Injustificada";
            return `<div style="color:${color}; margin-bottom:2px;">
              <strong>${nombre}</strong>
              <span style="font-size:10px; font-weight:500; opacity:0.85;"> — ${motivoLabel}</span>
            </div>`;
          });
          absencesCellHtml = lines.join("");
        }

        return `
          <tr>
            <td><strong>${dateStr}</strong>${lugarStr}</td>
            <td>${s.notas ? s.notas : "<em style='color:#94a3b8;'>Sin observaciones</em>"}</td>
            <td>${absencesCellHtml}</td>
          </tr>
        `;

      }).join("");

      return `
        <div class="month-block">
          <h2 class="month-title">${monthData.label}</h2>
          <table>
            <thead>
              <tr>
                <th style="width: 25%;">Fecha</th>
                <th style="width: 45%;">Notas / Actividades</th>
                <th style="width: 30%;">Bajas / Faltas</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;
    }).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Resumen de Asistencia a Entrenamientos</title>
          <meta charset="utf-8" />
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800;950&display=swap');
            body {
              font-family: 'Outfit', sans-serif;
              color: #1e293b;
              margin: 40px;
              line-height: 1.5;
              background-color: #ffffff;
            }
            .header-report {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 4px solid #1e3a8a;
              padding-bottom: 15px;
              margin-bottom: 30px;
            }
            .title-area h1 {
              font-size: 24px;
              font-weight: 950;
              text-transform: uppercase;
              margin: 0;
              color: #1e3a8a;
              letter-spacing: -0.5px;
            }
            .title-area p {
              font-size: 13px;
              font-weight: 600;
              color: #eab308;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin: 4px 0 0 0;
            }
            .logo {
              width: 55px;
              height: 55px;
              object-fit: contain;
            }
            .month-block {
              margin-bottom: 35px;
              page-break-inside: avoid;
            }
            .month-title {
              font-size: 16px;
              font-weight: 800;
              text-transform: uppercase;
              color: #1e3a8a;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 6px;
              margin-top: 0;
              margin-bottom: 15px;
              letter-spacing: 0.5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
              font-size: 12px;
            }
            th {
              background-color: #f1f5f9;
              color: #0f172a;
              font-weight: 800;
              text-transform: uppercase;
              font-size: 10px;
              letter-spacing: 0.5px;
              padding: 10px;
              border-bottom: 2px solid #cbd5e1;
              text-align: left;
            }
            td {
              padding: 9px 10px;
              border-bottom: 1px solid #e2e8f0;
              color: #334155;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            @media print {
              body { margin: 20px; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
            }
          </style>
        </head>
        <body>
          <div class="header-report">
            <div class="title-area">
              <h1>C.D. Gorditos C.F</h1>
              <p>Resumen de Asistencia a Entrenamientos</p>
            </div>
            <img class="logo" src="${LOGO_BASE64}" alt="C.D. Gorditos C.F Escudo" />
          </div>

          ${contentHtml}

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Helper para obtener los días del mes y rellenar celdas adyacentes
  const getDaysInMonth = (year, month) => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    const numDays = new Date(year, month + 1, 0).getDate();
    const numDaysPrev = new Date(year, month, 0).getDate();
    const days = [];

    // Rellenar días del mes anterior
    for (let i = startOffset - 1; i >= 0; i--) {
      const prevDay = numDaysPrev - i;
      const prevMonth = month === 0 ? 12 : month;
      const prevYear = month === 0 ? year - 1 : year;
      days.push({
        day: prevDay,
        isCurrentMonth: false,
        dateStr: `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`
      });
    }

    // Rellenar días del mes actual
    for (let i = 1; i <= numDays; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      });
    }

    // Rellenar días del mes siguiente
    const totalCells = days.length <= 35 ? 35 : 42;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      const nextMonth = month === 11 ? 1 : month + 2;
      const nextYear = month === 11 ? year + 1 : year;
      days.push({
        day: i,
        isCurrentMonth: false,
        dateStr: `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      });
    }

    return days;
  };

  const getTrainingForDate = (dateStr) => {
    return entrenamientos.find(t => t.fecha === dateStr);
  };


  // Eliminar un partido
  const handleDeleteMatch = (matchId) => {
    setConfirmDialog({
      title: "Eliminar Partido",
      message: "¿Seguro que quieres eliminar este partido? Esta acción no se puede deshacer y revertirá todas las estadísticas registradas de este encuentro en los jugadores convocados.",
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      onConfirm: async () => {
        try {
          const matchToDelete = partidos.find(p => p.id === matchId);
          if (matchToDelete && matchToDelete.actaGuardada) {
            const stats = matchToDelete.statsJugadores || {};
            const mvpId = matchToDelete.mvpJugadorId || "";

            // Revertir las estadísticas en cada jugador
            for (const jugadorId of Object.keys(stats)) {
              const playerRef = doc(db, "jugadores", jugadorId);
              const pStats = stats[jugadorId];
              
              const updates = {};
              const minutos = pStats.minutos || 0;
              const goles = pStats.goles || 0;
              const golesContra = pStats.golesContra || 0;
              const asistencias = pStats.asistencias || 0;
              const amarillas = pStats.amarillas || 0;
              const rojas = pStats.rojas || 0;
              const convocado = pStats.convocado ? 1 : 0;

              if (minutos > 0) updates.minutosJugados = increment(-minutos);
              if (goles > 0) updates.golesFavor = increment(-goles);
              if (golesContra > 0) updates.golesContra = increment(-golesContra);
              if (asistencias > 0) updates.asistencias = increment(-asistencias);
              if (amarillas > 0) updates.tarjetasAmarillas = increment(-amarillas);
              if (rojas > 0) updates.tarjetasRojas = increment(-rojas);
              if (convocado > 0) updates.partidosConvocados = increment(-convocado);

              // Revertir MVP si este jugador fue elegido MVP
              if (mvpId === jugadorId) {
                updates.mvps = increment(-1);
              }

              if (Object.keys(updates).length > 0) {
                await updateDoc(playerRef, updates);
              }
            }
          }

          // Borrar PDF adjunto en Firestore si existía
          if (matchToDelete?.hasPdfActa) {
            try {
              const chunksSnap = await getDocs(collection(db, "partidos", matchId, "pdf_acta"));
              for (const cDoc of chunksSnap.docs) {
                await deleteDoc(cDoc.ref);
              }
            } catch (storageErr) {
              console.warn("No se pudo eliminar los fragmentos del PDF en Firestore:", storageErr);
            }
          }

          // Borrar el documento del partido
          await deleteDoc(doc(db, "partidos", matchId));
          showToast("Partido eliminado correctamente.", "success");
        } catch (err) {
          console.error("Error eliminando partido y revertiendo estadísticas:", err);
          showToast("Error al eliminar el partido.", "error");
        }
      }
    });
  };

  // Filtrar jugadores por término de búsqueda
  const filteredJugadores = jugadores.filter((j) =>
    j.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
    {/* Modal de Edición de Jugador */}
    {editingPlayer && (
      <EditPlayerModal
        player={editingPlayer}
        onClose={() => setEditingPlayer(null)}
      />
    )}
    {/* Modal de Edición de Lesión */}
    {editingInjury && (
      <EditInjuryModal
        player={editingInjury.player}
        injury={editingInjury.injury}
        onClose={() => setEditingInjury(null)}
      />
    )}
    <div className="flex-1 flex flex-col min-h-screen pb-20 relative" style={{ backgroundColor: '#0f172a' }}>
      {/* Fondo desenfocado */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: 'url(/fondo.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 60%',
          backgroundAttachment: 'fixed',
          filter: 'blur(2.75px) brightness(0.32) saturate(0.8)',
        }}
      />
      {/* Overlay gradiente oscuro para legibilidad */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-slate-950/60 via-slate-950/40 to-slate-950/80" />
      {/* Contenido sobre el fondo */}
      <div className="relative z-10 flex flex-col flex-1">
      
      {/* Cabecera Fija del Panel */}
      <header className="sticky top-0 z-40 backdrop-blur-xl border-b border-white/10 px-4 py-3.5 flex items-center justify-between shadow-2xl" style={{ background: 'rgba(15,23,42,0.72)' }}>
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-camarma-gold/20 blur-md" />
            <img
              src="./logo.png"
              alt="C.D. Gorditos C.F Escudo"
              className="relative w-14 h-14 object-contain hover:scale-110 transition-transform duration-300 drop-shadow-[0_4px_16px_rgba(234,179,8,0.35)]"
            />
          </div>
          <div>
            <h1 className="text-xl font-black text-white font-sans tracking-tight leading-none">C.D. Gorditos C.F</h1>
            <p className="text-[10px] text-camarma-gold font-black uppercase tracking-[0.2em] flex items-center gap-1 mt-0.5">
              <UserCheck className="w-3 h-3" />
              Panel de Directiva
              {temporadaConfig?.nombre && (
                <span className="ml-1.5 bg-camarma-blue/20 border border-camarma-blue/40 text-camarma-blue px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">
                  {temporadaConfig.nombre}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onViewPublic && (
            <button
              onClick={onViewPublic}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white/90 hover:text-white border border-white/15 hover:border-camarma-gold/50 transition-all cursor-pointer text-xs font-extrabold shadow-lg active:scale-95 uppercase tracking-wider backdrop-blur-sm"
              style={{ background: 'rgba(255,255,255,0.07)' }}
              title="Ver Web Pública"
            >
              <Eye className="w-4 h-4 text-camarma-gold shrink-0" />
              <span className="hidden sm:inline">Ver Web</span>
            </button>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center justify-center p-2.5 rounded-xl text-white/50 hover:text-red-400 border border-white/10 hover:border-red-500/30 transition-all cursor-pointer active:scale-95 backdrop-blur-sm"
            style={{ background: 'rgba(255,255,255,0.05)' }}
            title="Cerrar Sesión"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Selector de pestañas táctil grande */}
      <div
        className="flex p-1.5 rounded-2xl sticky top-[73px] z-30 max-w-4xl mx-auto my-4 w-[calc(100%-2rem)] shadow-2xl border border-white/10 backdrop-blur-xl"
        style={{ background: 'rgba(15,23,42,0.70)' }}
      >
        <button
          onClick={() => { setActiveTab("dashboard"); setExpandedPlayerId(null); setShowModPanel(false); }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all duration-200 cursor-pointer select-none ${
            activeTab === "dashboard"
              ? "bg-gradient-to-r from-camarma-gold to-yellow-600 text-slate-950 shadow-lg shadow-camarma-gold/30 scale-[1.02]"
              : "text-white/40 hover:text-white/80 hover:bg-white/8"
          }`}
        >
          <BarChart2 className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Dashboard</span>
          <span className="inline sm:hidden">Dash</span>
        </button>
        <button
          onClick={() => { setActiveTab("jugadores"); setExpandedPlayerId(null); setShowModPanel(false); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all duration-200 cursor-pointer select-none ${
            activeTab === "jugadores"
              ? "bg-gradient-to-r from-camarma-blue to-blue-600 text-white shadow-lg shadow-camarma-blue/30 scale-[1.02]"
              : "text-white/40 hover:text-white/80 hover:bg-white/8"
          }`}
        >
          <Users className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
          <span className="hidden sm:inline">Plantilla</span>
          <span className="inline sm:hidden">Jug.</span>
          <span className="text-[10px] opacity-70 font-mono">({jugadores.length})</span>
        </button>
        <button
          onClick={() => { setActiveTab("partidos"); setExpandedPlayerId(null); setShowModPanel(false); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all duration-200 cursor-pointer select-none ${
            activeTab === "partidos"
              ? "bg-gradient-to-r from-camarma-blue to-blue-600 text-white shadow-lg shadow-camarma-blue/30 scale-[1.02]"
              : "text-white/40 hover:text-white/80 hover:bg-white/8"
          }`}
        >
          <Calendar className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
          <span className="hidden sm:inline">Partidos</span>
          <span className="inline sm:hidden">Part.</span>
          <span className="text-[10px] opacity-70 font-mono">({partidos.length})</span>
        </button>
        <button
          onClick={() => { setActiveTab("entrenamientos"); setExpandedPlayerId(null); setShowModPanel(false); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all duration-200 cursor-pointer select-none ${
            activeTab === "entrenamientos"
              ? "bg-gradient-to-r from-camarma-blue to-blue-600 text-white shadow-lg shadow-camarma-blue/30 scale-[1.02]"
              : "text-white/40 hover:text-white/80 hover:bg-white/8"
          }`}
        >
          <ClipboardList className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
          <span className="hidden sm:inline">Entrenamientos</span>
          <span className="inline sm:hidden">Entr.</span>
          <span className="text-[10px] opacity-70 font-mono">({entrenamientos.length})</span>
        </button>
      </div>

      {/* Contenido Principal */}
      <main className="flex-1 p-4 max-w-4xl mx-auto w-full">

        {/* Pestaña: DASHBOARD */}
        {activeTab === "dashboard" && (() => {
          // ── Computación de datos para el Dashboard ────────────────────────
          const partidosJugados = partidos.filter(p => p.jugado);
          const getGoles = p => Number(p.golesGorditos ?? p.golesCamarma ?? 0);
          const victorias = partidosJugados.filter(p => getGoles(p) > p.golesRival).length;
          const empates = partidosJugados.filter(p => getGoles(p) === p.golesRival).length;
          const derrotas = partidosJugados.filter(p => getGoles(p) < p.golesRival).length;
          const puntos = victorias * 3 + empates;
          const golFavor = partidosJugados.reduce((s, p) => s + getGoles(p), 0);
          const golContra = partidosJugados.reduce((s, p) => s + (p.golesRival || 0), 0);

          // Racha: últimos 5 partidos jugados (el más reciente primero)
          const ultimos5 = [...partidosJugados].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5);

          // Próximo partido: el más cercano no jugado a partir de hoy
          const todayStr = new Date().toISOString().split("T")[0];
          const proximoPartido = partidos
            .filter(p => !p.jugado && p.fecha >= todayStr)
            .sort((a, b) => a.fecha.localeCompare(b.fecha))[0] || null;

          // Top jugadores
          const jugadoresOrdenados = (field) => [...jugadores].sort((a, b) => (b[field] || 0) - (a[field] || 0));
          const topGoleadores = jugadoresOrdenados("golesFavor").slice(0, 3);
          const topPorteros = jugadoresOrdenados("golesContra").slice(0, 1);
          const topAsistencias = jugadoresOrdenados("asistencias").slice(0, 3);
          const topMinutos = jugadoresOrdenados("minutosJugados").slice(0, 3);

          // Asistencia entrenamientos
          const totalSesiones = entrenamientos.length;
          const totalPlantilla = jugadores.length;
          const totalFaltas = jugadores.reduce((s, j) => s + (j.faltasEntrenamiento || 0), 0);
          const maxPosibleFaltas = totalSesiones * totalPlantilla;
          const pctAsistencia = maxPosibleFaltas > 0
            ? Math.round(((maxPosibleFaltas - totalFaltas) / maxPosibleFaltas) * 100)
            : 100;
          const colorAsistencia = pctAsistencia >= 80 ? "text-emerald-400" : pctAsistencia >= 60 ? "text-amber-400" : "text-red-400";
          const bgAsistencia = pctAsistencia >= 80 ? "bg-emerald-500" : pctAsistencia >= 60 ? "bg-amber-500" : "bg-red-500";
          const semaforo = pctAsistencia >= 80 ? "🟢" : pctAsistencia >= 60 ? "🟡" : "🔴";

          // Plantilla disponible / lesionada
          const lesionados = jugadores.filter(j => j.lesionado).length;
          const disponibles = jugadores.length - lesionados;

          // Días activa la temporada
          let diasActiva = null;
          if (temporadaConfig?.fechaInicio) {
            const inicio = new Date(temporadaConfig.fechaInicio + "T00:00:00");
            const hoy = new Date();
            diasActiva = Math.max(0, Math.floor((hoy - inicio) / (1000 * 60 * 60 * 24)));
          }

          return (
            <div className="space-y-5 animate-in fade-in duration-300">

              {/* ── Banner Temporada Activa ─────────────────────────────── */}
              <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800/80 to-slate-900 border border-camarma-gold/30 rounded-3xl p-5 shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-r from-camarma-gold/5 via-transparent to-camarma-blue/5 pointer-events-none" />
                <div className="relative flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-camarma-gold/25 blur-md" />
                      <img src="./logo.png" alt="Escudo" className="relative w-14 h-14 object-contain drop-shadow-[0_4px_16px_rgba(234,179,8,0.4)]" />
                    </div>
                    <div>
                      {temporadaConfig ? (
                        <>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black uppercase tracking-widest text-camarma-gold">Temporada Activa</span>
                            <span className="bg-camarma-gold/15 border border-camarma-gold/40 text-camarma-gold px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">
                              {temporadaConfig.nombre}
                            </span>
                          </div>
                          <h2 className="text-2xl font-black text-white mt-0.5">C.D. Gorditos C.F</h2>
                          {diasActiva !== null && (
                            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                              <Zap className="w-3 h-3 text-camarma-gold" />
                              {diasActiva === 0 ? "Temporada iniciada hoy" : `${diasActiva} días de temporada`}
                              {temporadaConfig.fechaInicio && (
                                <span className="opacity-60 ml-1">
                                  · Inicio: {new Date(temporadaConfig.fechaInicio + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                                </span>
                              )}
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-black uppercase tracking-widest text-slate-500">Sin temporada configurada</span>
                          <h2 className="text-2xl font-black text-white mt-0.5">C.D. Gorditos C.F</h2>
                          <p className="text-xs text-slate-500 mt-0.5">Configura la temporada en la pestaña "Partidos"</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Rendimiento del Equipo + Racha ─────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Record V/E/D */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-3xl p-5 shadow-xl backdrop-blur-md">
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-5 h-5 text-camarma-gold" />
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Rendimiento</h3>
                  </div>
                  {partidosJugados.length === 0 ? (
                    <p className="text-slate-500 text-xs text-center py-4">Sin partidos jugados aún</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="text-center bg-emerald-950/30 border border-emerald-900/40 rounded-2xl p-3">
                          <span className="block text-2xl font-black text-emerald-400">{victorias}</span>
                          <span className="block text-[10px] font-black uppercase text-emerald-600 tracking-wider mt-0.5">Victorias</span>
                        </div>
                        <div className="text-center bg-slate-950/40 border border-slate-800 rounded-2xl p-3">
                          <span className="block text-2xl font-black text-slate-300">{empates}</span>
                          <span className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mt-0.5">Empates</span>
                        </div>
                        <div className="text-center bg-red-950/30 border border-red-900/40 rounded-2xl p-3">
                          <span className="block text-2xl font-black text-red-400">{derrotas}</span>
                          <span className="block text-[10px] font-black uppercase text-red-700 tracking-wider mt-0.5">Derrotas</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs bg-slate-950/40 rounded-xl p-3 border border-slate-800/40">
                        <div className="text-center">
                          <span className="block text-camarma-gold font-black text-lg">{puntos}</span>
                          <span className="block text-slate-500 uppercase text-[9px] tracking-wider">Puntos</span>
                        </div>
                        <div className="text-center">
                          <span className="block text-white font-black text-sm">{golFavor} – {golContra}</span>
                          <span className="block text-slate-500 uppercase text-[9px] tracking-wider">Goles F/C</span>
                        </div>
                        <div className="text-center">
                          <span className="block text-white font-black text-sm">{partidosJugados.length}</span>
                          <span className="block text-slate-500 uppercase text-[9px] tracking-wider">Jugados</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Racha últimos 5 + Próximo partido */}
                <div className="flex flex-col gap-3">
                  {/* Racha */}
                  <div className="bg-slate-800/60 border border-slate-700/50 rounded-3xl p-4 shadow-xl backdrop-blur-md flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-camarma-gold" />
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">Últimos 5</h3>
                    </div>
                    {ultimos5.length === 0 ? (
                      <p className="text-slate-500 text-xs text-center py-2">Sin partidos jugados aún</p>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        {[...ultimos5].reverse().map((p, i) => {
                          const gc = p.golesGorditos ?? p.golesCamarma ?? 0;
                          const ganamos = gc > p.golesRival;
                          const perdimos = gc < p.golesRival;
                          const chip = ganamos
                            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                            : perdimos
                            ? "bg-red-500/20 border-red-500/50 text-red-300"
                            : "bg-slate-700/50 border-slate-600/50 text-slate-300";
                          const letter = ganamos ? "V" : perdimos ? "D" : "E";
                          return (
                            <div key={i} className={`flex flex-col items-center border rounded-xl px-2.5 py-2 ${chip}`}>
                              <span className="text-base font-black leading-none">{letter}</span>
                              <span className="text-[9px] font-bold opacity-70 mt-0.5">{gc}-{p.golesRival}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* Próximo partido */}
                  {proximoPartido && (
                    <div className="bg-camarma-blue/10 border border-camarma-blue/30 rounded-2xl p-4 shadow-xl">
                      <span className="text-[10px] font-black uppercase tracking-widest text-camarma-blue block mb-1.5 flex items-center gap-1">
                        <Target className="w-3 h-3" /> Próximo Partido
                      </span>
                      <p className="text-sm font-black text-white">vs. {proximoPartido.rival}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(proximoPartido.fecha + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                        {proximoPartido.hora && ` · ${proximoPartido.hora}`}
                        <span className={`ml-2 font-bold text-[10px] ${proximoPartido.condicion === "local" ? "text-camarma-blue" : "text-amber-400"}`}>
                          {proximoPartido.condicion === "local" ? "🏠 Local" : "✈️ Visitante"}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Líderes del Equipo ──────────────────────────────────── */}
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-3xl p-5 shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5 text-camarma-gold" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Líderes de la Temporada</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Top Goleadores */}
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-2">⚽ Pichichi</span>
                    <div className="space-y-1.5">
                      {topGoleadores.filter(j => !j.isPortero && (j.golesFavor || 0) > 0).length === 0 ? (
                        <p className="text-xs text-slate-600 italic">Sin goles registrados</p>
                      ) : (
                        topGoleadores.filter(j => !j.isPortero).map((j, i) => (
                          <div key={j.id} className="flex items-center gap-2.5">
                            <span className="text-[10px] font-black text-slate-500 w-4">{i + 1}.</span>
                            <img src={j.fotoUrl || "/placeholder-player.png"} alt={j.nombre} className="w-6 h-6 rounded-full object-cover border border-slate-700" />
                            <span className="text-xs font-bold text-slate-200 flex-1 truncate">{j.dorsal ? `#${j.dorsal} ` : ""}{j.nombre}</span>
                            <span className="text-sm font-black text-camarma-gold">{j.golesFavor || 0}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  {/* Top Asistencias */}
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-2">🪄 Asistencias</span>
                    <div className="space-y-1.5">
                      {topAsistencias.filter(j => (j.asistencias || 0) > 0).length === 0 ? (
                        <p className="text-xs text-slate-600 italic">Sin asistencias registradas</p>
                      ) : (
                        topAsistencias.map((j, i) => (
                          <div key={j.id} className="flex items-center gap-2.5">
                            <span className="text-[10px] font-black text-slate-500 w-4">{i + 1}.</span>
                            <img src={j.fotoUrl || "/placeholder-player.png"} alt={j.nombre} className="w-6 h-6 rounded-full object-cover border border-slate-700" />
                            <span className="text-xs font-bold text-slate-200 flex-1 truncate">{j.dorsal ? `#${j.dorsal} ` : ""}{j.nombre}</span>
                            <span className="text-sm font-black text-camarma-blue">{j.asistencias || 0}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  {/* Top Minutos */}
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-2">⏱️ Más Minutos</span>
                    <div className="space-y-1.5">
                      {topMinutos.filter(j => (j.minutosJugados || 0) > 0).length === 0 ? (
                        <p className="text-xs text-slate-600 italic">Sin minutos registrados</p>
                      ) : (
                        topMinutos.map((j, i) => (
                          <div key={j.id} className="flex items-center gap-2.5">
                            <span className="text-[10px] font-black text-slate-500 w-4">{i + 1}.</span>
                            <img src={j.fotoUrl || "/placeholder-player.png"} alt={j.nombre} className="w-6 h-6 rounded-full object-cover border border-slate-700" />
                            <span className="text-xs font-bold text-slate-200 flex-1 truncate">{j.dorsal ? `#${j.dorsal} ` : ""}{j.nombre}</span>
                            <span className="text-sm font-black text-slate-300">{j.minutosJugados || 0}'</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Asistencia + Estado Plantilla ───────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Asistencia entrenamientos */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-3xl p-5 shadow-xl backdrop-blur-md">
                  <div className="flex items-center gap-2 mb-4">
                    <ClipboardCheck className="w-5 h-5 text-camarma-gold" />
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Asistencia</h3>
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-4xl font-black leading-none">{semaforo}</span>
                    <div>
                      <span className={`text-3xl font-black leading-none ${colorAsistencia}`}>{pctAsistencia}%</span>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Asistencia global</p>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${bgAsistencia}`}
                      style={{ width: `${pctAsistencia}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 mt-2">
                    <span>{totalSesiones} sesiones</span>
                    <span>{totalFaltas} faltas en total</span>
                  </div>
                  {/* Jugador con más faltas */}
                  {jugadores.length > 0 && (
                    (() => {
                      const peorAsistente = [...jugadores].sort((a, b) => (b.faltasEntrenamiento || 0) - (a.faltasEntrenamiento || 0))[0];
                      return peorAsistente?.faltasEntrenamiento > 0 ? (
                        <div className="mt-3 bg-red-950/20 border border-red-900/30 rounded-xl px-3 py-2 flex items-center gap-2">
                          <span className="text-[9px] font-black uppercase text-red-500 tracking-wider">Más faltas:</span>
                          <img src={peorAsistente.fotoUrl || "/placeholder-player.png"} alt="" className="w-5 h-5 rounded-full object-cover border border-red-900/40" />
                          <span className="text-xs font-bold text-red-300 flex-1 truncate">{peorAsistente.nombre}</span>
                          <span className="text-sm font-black text-red-400">{peorAsistente.faltasEntrenamiento}</span>
                        </div>
                      ) : null;
                    })()
                  )}
                </div>

                {/* Estado plantilla */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-3xl p-5 shadow-xl backdrop-blur-md">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-camarma-gold" />
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Estado Plantilla</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="text-center bg-emerald-950/30 border border-emerald-900/40 rounded-2xl p-4">
                      <span className="block text-3xl font-black text-emerald-400">{disponibles}</span>
                      <span className="block text-[10px] font-black uppercase text-emerald-700 tracking-wider mt-0.5">💪 Disponibles</span>
                    </div>
                    <div className="text-center bg-red-950/30 border border-red-900/40 rounded-2xl p-4">
                      <span className="block text-3xl font-black text-red-400">{lesionados}</span>
                      <span className="block text-[10px] font-black uppercase text-red-700 tracking-wider mt-0.5">🩹 Lesionados</span>
                    </div>
                  </div>
                  {lesionados > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Bajas actuales:</span>
                      {jugadores.filter(j => j.lesionado).map(j => (
                        <div key={j.id} className="flex items-center gap-2 bg-red-950/15 border border-red-900/25 rounded-xl px-3 py-1.5">
                          <img src={j.fotoUrl || "/placeholder-player.png"} alt="" className="w-5 h-5 rounded-full object-cover" />
                          <span className="text-xs font-bold text-red-300 flex-1 truncate">{j.dorsal ? `#${j.dorsal} ` : ""}{j.nombre}</span>
                          {j.tipoLesion && <span className="text-[9px] text-red-500 truncate max-w-[80px]">{j.tipoLesion}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {lesionados === 0 && (
                    <div className="text-center py-3 text-xs text-emerald-500 font-bold">
                      ✅ Plantilla al 100% disponible
                    </div>
                  )}
                </div>
              </div>

            </div>
          );
        })()}

        {/* Pestaña: JUGADORES */}
        {activeTab === "jugadores" && (
          <div className="space-y-6">

            {/* Barra de Búsqueda y Botón Fichar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar jugador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-white rounded-2xl pl-12 pr-4 py-4 text-base outline-none focus:border-camarma-blue"
                />
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={recalcularEstadisticas}
                  disabled={recalculandoStats}
                  className="bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-750 text-slate-200 hover:text-white font-extrabold text-xs py-3 px-5 rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Recalcular estadísticas de plantilla desde las actas de partido y entrenamientos"
                >
                  <RefreshCw className={`w-4.5 h-4.5 text-camarma-gold ${recalculandoStats ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Recalcular Stats</span>
                </button>
                <button
                  onClick={generatePDFReport}
                  className="bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-750 text-slate-200 hover:text-white font-extrabold text-xs py-3 px-5 rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer uppercase tracking-wider"
                  title="Descargar PDF Resumen de Plantilla"
                >
                  <FileText className="w-4.5 h-4.5 text-camarma-gold" />
                  <span className="hidden sm:inline">Exportar PDF</span>
                </button>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="bg-gradient-to-r from-camarma-gold to-yellow-600 hover:from-yellow-650 hover:to-yellow-700 text-slate-950 font-black text-xs py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-camarma-gold/10 transition-all transform active:scale-95 cursor-pointer uppercase tracking-wider"
                >
                  <Plus className="w-4.5 h-4.5 stroke-[3px]" />
                  Fichar Jugador
                </button>
              </div>
            </div>

            {/* Formulario Añadir Jugador (desplegable) */}
            {showAddForm && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-200">
                <AddPlayerForm
                  onPlayerAdded={() => setShowAddForm(false)}
                  onClose={() => setShowAddForm(false)}
                />
              </div>
            )}

            {/* Spinner de carga inicial */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                <svg className="animate-spin h-10 w-10 text-camarma-gold" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Cargando plantilla...</span>
              </div>
            ) : filteredJugadores.length === 0 ? (
              <div className="text-center py-20 bg-slate-900/30 border border-slate-800 rounded-3xl text-slate-400">
                {searchTerm ? "No se encontró ningún jugador con ese nombre." : "No hay jugadores registrados en la plantilla."}
              </div>
            ) : (
              /* Lista de Jugadores - Acordeón Colapsable */
              <div className="space-y-3 animate-in fade-in duration-300">
                {filteredJugadores.map((player) => {
                  const isExpanded = expandedPlayerId === player.id;
                  
                  // Color del badge por posición
                  const getPosicionBadge = (pos) => {
                    switch (pos) {
                      case "Portero": return "bg-purple-950/40 text-purple-400 border border-purple-850/40";
                      case "Defensa": return "bg-amber-950/40 text-amber-400 border border-amber-850/40";
                      case "Centrocampista": return "bg-blue-950/40 text-blue-405 border border-blue-850/40";
                      case "Delantero": return "bg-emerald-950/40 text-emerald-405 border border-emerald-850/40";
                      default: return "bg-slate-805 text-slate-400 border border-slate-700";
                    }
                  };

                  return (
                    <div
                      key={player.id}
                      className={`bg-slate-800/60 border rounded-2xl overflow-hidden shadow-md transition-all duration-300 ${
                        isExpanded ? "border-slate-650 ring-1 ring-slate-700/50" : "border-slate-750/70 hover:border-slate-650"
                      }`}
                    >
                      {/* Cabecera del Acordeón */}
                      <div
                        onClick={() => {
                          setExpandedPlayerId(isExpanded ? null : player.id);
                          setShowModPanel(false);
                        }}
                        className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-800/25 transition-colors"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* Foto/Avatar */}
                          <div className="relative shrink-0">
                            <img
                              src={player.fotoUrl || "/placeholder-player.png"}
                              alt={player.nombre}
                              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-slate-800 shadow"
                            />
                            {player.dorsal && (
                              <span className="absolute -top-1 -left-1 bg-slate-900 text-camarma-gold font-mono font-black text-[9px] px-1 py-0.2 rounded border border-slate-700 shadow shrink-0">
                                #{player.dorsal}
                              </span>
                            )}
                            {player.isPortero && (
                              <span className="absolute -bottom-1 -right-1 bg-camarma-gold text-slate-950 text-[9px] font-black uppercase px-1 rounded border border-slate-900">
                                🧤
                              </span>
                            )}
                          </div>

                          {/* Nombre, edad y badge de posición */}
                          <div className="min-w-0">
                            <h4 className="text-sm sm:text-base font-extrabold text-white leading-tight font-sans truncate flex items-center gap-1.5">
                              {player.dorsal && (
                                <span className="text-camarma-gold font-mono font-black text-xs bg-camarma-gold/10 border border-camarma-gold/30 px-1.5 py-0.5 rounded-md shrink-0">
                                  #{player.dorsal}
                                </span>
                              )}
                              {player.nombre}
                              {player.lesionado && (
                                <span className="text-[10px] bg-red-950/50 text-red-400 border border-red-900/40 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5 shrink-0">
                                  🩹 Lesionado
                                </span>
                              )}
                            </h4>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="text-xs text-slate-400 font-medium">
                                {calcularEdad(player.fechaNacimiento)} años
                              </span>
                              <span className="text-slate-650 text-xs">•</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${getPosicionBadge(player.posicion)}`}>
                                {player.posicion || (player.isPortero ? "Portero" : "Jugador")}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Estadísticas rápidas en cabecera */}
                        <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                          <div className="hidden sm:flex items-center gap-4 text-xs font-bold text-slate-400">
                            <div className="text-center min-w-[32px]">
                              <span className="block text-[8px] text-slate-500 uppercase tracking-widest leading-none mb-0.5">Gol</span>
                              <span className="text-white text-sm">{player.isPortero ? player.golesContra : player.golesFavor}</span>
                            </div>
                            <div className="text-center min-w-[40px]">
                              <span className="block text-[8px] text-slate-500 uppercase tracking-widest leading-none mb-0.5">Min</span>
                              <span className="text-slate-300 text-xs">{player.minutosJugados || 0}'</span>
                            </div>
                            <div className="text-center min-w-[28px]">
                              <span className="block text-[8px] text-slate-500 uppercase tracking-widest leading-none mb-0.5">Fal E</span>
                              <span className="text-red-400 text-xs">{player.faltasEntrenamiento || 0}</span>
                            </div>
                            <div className="text-center min-w-[28px]">
                              <span className="block text-[8px] text-slate-500 uppercase tracking-widest leading-none mb-0.5">Fal P</span>
                              <span className="text-amber-400 text-xs">{player.faltasPartido || 0}</span>
                            </div>
                          </div>

                          {/* Indicador de Desplegado */}
                          <div className="p-1 rounded-lg bg-slate-950/40 border border-slate-800/40 text-slate-400 transition-colors">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Contenido Expandido */}
                      {isExpanded && (
                        <div className="p-4 border-t border-slate-850 bg-slate-950/20 animate-in slide-in-from-top-2">
                          {/* Ficha completa en grid */}
                          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 text-center text-xs text-slate-400 bg-slate-950/60 rounded-xl p-3 border border-slate-800/40 mb-4">
                            <div>
                              <span className="block text-[9px] uppercase tracking-wider text-slate-550 mb-0.5">Goles</span>
                              <strong className="text-sm font-bold text-white">
                                {player.isPortero ? `${player.golesContra} (Rec.)` : player.golesFavor}
                              </strong>
                            </div>
                            <div>
                              <span className="block text-[9px] uppercase tracking-wider text-slate-555 mb-0.5">Asistencias</span>
                              <strong className="text-sm font-bold text-white">{player.asistencias || 0}</strong>
                            </div>
                            <div>
                              <span className="block text-[9px] uppercase tracking-wider text-slate-555 mb-0.5">Minutos</span>
                              <strong className="text-sm font-bold text-white">{player.minutosJugados || 0}'</strong>
                            </div>
                            <div>
                              <span className="block text-[9px] uppercase tracking-wider text-slate-555 mb-0.5">Convocado</span>
                              <strong className="text-sm font-bold text-white">{player.partidosConvocados || 0}</strong>
                            </div>
                            <div>
                              <span className="block text-[9px] uppercase tracking-wider text-slate-555 mb-0.5">Faltas Ent.</span>
                              <strong className="text-sm font-bold text-red-400">{player.faltasEntrenamiento || 0}</strong>
                            </div>
                            <div>
                              <span className="block text-[9px] uppercase tracking-wider text-slate-555 mb-0.5">Faltas Part.</span>
                              <strong className="text-sm font-bold text-amber-400">{player.faltasPartido || 0}</strong>
                            </div>
                            <div>
                              <span className="block text-[9px] uppercase tracking-wider text-slate-555 mb-0.5">Amarillas</span>
                              <strong className="text-sm font-bold text-yellow-500">{player.tarjetasAmarillas || 0}</strong>
                            </div>
                            <div>
                              <span className="block text-[9px] uppercase tracking-wider text-slate-555 mb-0.5">Rojas</span>
                              <strong className="text-sm font-bold text-red-500">{player.tarjetasRojas || 0}</strong>
                            </div>
                          </div>

                          {/* Controles de edición táctil */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-900 pb-1.5 cursor-pointer select-none" onClick={() => setShowModPanel(!showModPanel)}>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                ⚙️ Panel de Modificaciones
                              </span>
                              <span className="text-xs text-camarma-gold font-bold transition-all">
                                {showModPanel ? "Ocultar ▲" : "Mostrar ▼"}
                              </span>
                            </div>
                            {showModPanel && (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 animate-in fade-in duration-200">
                                
                                {/* Goles */}
                                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-2 flex flex-col justify-between items-center">
                                  <span className="text-xs font-bold text-slate-300">
                                    ⚽ Goles {player.isPortero ? "Contra" : "Favor"}
                                  </span>
                                  <div className="flex gap-2 w-full mt-2">
                                    <button
                                      onClick={() => updateStat(player, player.isPortero ? "golesContra" : "golesFavor", -1)}
                                      className="flex-1 bg-red-650/20 hover:bg-red-650/30 border border-red-500/20 hover:border-red-500/40 text-red-400 font-bold py-2 rounded-lg cursor-pointer active:scale-95 transition-all text-xs"
                                    >
                                      -1
                                    </button>
                                    <button
                                      onClick={() => updateStat(player, player.isPortero ? "golesContra" : "golesFavor", 1)}
                                      className="flex-1 bg-emerald-650/20 hover:bg-emerald-650/30 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-450 font-bold py-2 rounded-lg cursor-pointer active:scale-95 transition-all text-xs"
                                    >
                                      +1
                                    </button>
                                  </div>
                                </div>

                                {/* Asistencias */}
                                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-2 flex flex-col justify-between items-center">
                                  <span className="text-xs font-bold text-slate-300">🪄 Asistencias</span>
                                  <div className="flex gap-2 w-full mt-2">
                                    <button
                                      onClick={() => updateStat(player, "asistencias", -1)}
                                      className="flex-1 bg-red-650/20 hover:bg-red-650/30 border border-red-500/20 hover:border-red-500/40 text-red-400 font-bold py-2 rounded-lg cursor-pointer active:scale-95 transition-all text-xs"
                                    >
                                      -1
                                    </button>
                                    <button
                                      onClick={() => updateStat(player, "asistencias", 1)}
                                      className="flex-1 bg-emerald-650/20 hover:bg-emerald-650/30 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-450 font-bold py-2 rounded-lg cursor-pointer active:scale-95 transition-all text-xs"
                                    >
                                      +1
                                    </button>
                                  </div>
                                </div>

                                {/* Minutos */}
                                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-2 flex flex-col justify-between items-center">
                                  <span className="text-xs font-bold text-slate-300">⏱️ Minutos</span>
                                  <div className="flex gap-2 w-full mt-2">
                                    <button
                                      onClick={() => updateStat(player, "minutosJugados", -15)}
                                      className="flex-1 bg-red-650/20 hover:bg-red-650/30 border border-red-500/20 hover:border-red-500/40 text-red-400 font-bold py-2 text-xs rounded-lg cursor-pointer active:scale-95 transition-all"
                                    >
                                      -15'
                                    </button>
                                    <button
                                      onClick={() => updateStat(player, "minutosJugados", 15)}
                                      className="flex-1 bg-emerald-650/20 hover:bg-emerald-650/30 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-455 font-bold py-2 text-xs rounded-lg cursor-pointer active:scale-95 transition-all"
                                    >
                                      +15'
                                    </button>
                                  </div>
                                </div>

                                {/* Amarillas */}
                                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-2 flex flex-col justify-between items-center">
                                  <span className="text-xs font-bold text-slate-300">🟨 Amarillas</span>
                                  <div className="flex gap-2 w-full mt-2">
                                    <button
                                      onClick={() => updateStat(player, "tarjetasAmarillas", -1)}
                                      className="flex-1 bg-red-650/20 hover:bg-red-650/30 border border-red-500/20 hover:border-red-500/40 text-red-400 font-bold py-2 rounded-lg cursor-pointer active:scale-95 transition-all text-xs"
                                    >
                                      -
                                    </button>
                                    <button
                                      onClick={() => updateStat(player, "tarjetasAmarillas", 1)}
                                      className="flex-1 bg-yellow-500/20 hover:bg-yellow-550/30 border border-yellow-500/20 hover:border-yellow-500/45 text-yellow-400 font-bold py-2 rounded-lg cursor-pointer active:scale-95 transition-all text-xs"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>

                                {/* Rojas */}
                                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-2 flex flex-col justify-between items-center">
                                  <span className="text-xs font-bold text-slate-300">🟥 Rojas</span>
                                  <div className="flex gap-2 w-full mt-2">
                                    <button
                                      onClick={() => updateStat(player, "tarjetasRojas", -1)}
                                      className="flex-1 bg-red-655/20 hover:bg-red-650/30 border border-red-500/20 hover:border-red-500/40 text-red-400 font-bold py-2 rounded-lg cursor-pointer active:scale-95 transition-all text-xs"
                                    >
                                      -
                                    </button>
                                    <button
                                      onClick={() => updateStat(player, "tarjetasRojas", 1)}
                                      className="flex-1 bg-red-655/20 hover:bg-red-650/30 border border-red-500/20 hover:border-red-500/40 text-red-400 font-bold py-2 rounded-lg cursor-pointer active:scale-95 transition-all text-xs"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>

                                {/* Convocatorias */}
                                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-2 flex flex-col justify-between items-center">
                                  <span className="text-xs font-bold text-slate-300">📋 Convocado</span>
                                  <div className="flex gap-2 w-full mt-2">
                                    <button
                                      onClick={() => updateStat(player, "partidosConvocados", -1)}
                                      className="flex-1 bg-red-655/20 hover:bg-red-650/30 border border-red-500/20 hover:border-red-500/40 text-red-400 font-bold py-2 rounded-lg cursor-pointer active:scale-95 transition-all text-xs"
                                    >
                                      -
                                    </button>
                                    <button
                                      onClick={() => updateStat(player, "partidosConvocados", 1)}
                                      className="flex-1 bg-blue-650/20 hover:bg-blue-650/30 border border-blue-500/20 hover:border-blue-500/40 text-blue-400 font-bold py-2 rounded-lg cursor-pointer active:scale-95 transition-all text-xs"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>

                                {/* Faltas Entrenamiento */}
                                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-2 flex flex-col justify-between items-center">
                                  <span className="text-xs font-bold text-red-400">❌ Falta Entreno</span>
                                  <div className="flex gap-2 w-full mt-2">
                                    <button
                                      onClick={() => updateStat(player, "faltasEntrenamiento", -1)}
                                      className="flex-1 bg-slate-850 hover:bg-slate-800 active:scale-90 text-slate-400 font-bold py-2 rounded-lg cursor-pointer text-xs"
                                    >
                                      -
                                    </button>
                                    <button
                                      onClick={() => updateStat(player, "faltasEntrenamiento", 1)}
                                      className="flex-1 bg-orange-650/20 hover:bg-orange-650/30 border border-orange-500/20 hover:border-orange-500/40 text-orange-400 font-bold py-2 rounded-lg cursor-pointer active:scale-95 transition-all text-xs"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>

                                {/* Faltas Partido */}
                                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-2 flex flex-col justify-between items-center">
                                  <span className="text-xs font-bold text-amber-400">🚫 Falta Partido</span>
                                  <div className="flex gap-2 w-full mt-2">
                                    <button
                                      onClick={() => updateStat(player, "faltasPartido", -1)}
                                      className="flex-1 bg-slate-850 hover:bg-slate-800 active:scale-90 text-slate-400 font-bold py-2 rounded-lg cursor-pointer text-xs"
                                    >
                                      -
                                    </button>
                                    <button
                                      onClick={() => updateStat(player, "faltasPartido", 1)}
                                      className="flex-1 bg-amber-650/20 hover:bg-amber-650/30 border border-amber-500/20 hover:border-amber-500/40 text-amber-400 font-bold py-2 rounded-lg cursor-pointer active:scale-95 transition-all text-xs"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>

                              </div>
                            )}

                            {/* Estado Físico / Lesión */}
                            <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-4 mt-4 space-y-4 text-left">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-350 flex items-center gap-2">
                                  🏥 Estado Físico / Lesión
                                </span>
                                <label className="relative inline-flex items-center cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={player.lesionado || false}
                                    onChange={async (e) => {
                                      const isChecked = e.target.checked;
                                      if (isChecked) {
                                        const todayStr = new Date().toISOString().split("T")[0];
                                        await updateDoc(doc(db, "jugadores", player.id), {
                                          lesionado: true,
                                          tipoLesion: player.tipoLesion || "Molestias físicas",
                                          fechaBaja: todayStr,
                                          fechaRecuperacion: "pendiente"
                                        });
                                      } else {
                                        setAltaPlayer(player);
                                      }
                                    }}
                                    className="sr-only peer"
                                  />
                                  <div className="w-11 h-6 bg-slate-950 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                  <span className="ml-3 text-xs font-bold text-slate-400 peer-checked:text-amber-400">
                                    {player.lesionado ? "🤕 Lesionado" : "💪 Disponible"}
                                  </span>
                                </label>
                              </div>

                              {player.lesionado && (
                                <div className="space-y-3 pt-2">
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                                        Tipo de Lesión
                                      </label>
                                      <input
                                        type="text"
                                        value={player.tipoLesion || ""}
                                        onChange={async (e) => {
                                          await updateDoc(doc(db, "jugadores", player.id), {
                                            tipoLesion: e.target.value
                                          });
                                        }}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs outline-none focus:border-camarma-blue"
                                        placeholder="Ej. Esguince de tobillo"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                                        Fecha de Baja
                                      </label>
                                      <input
                                        type="date"
                                        value={player.fechaBaja || ""}
                                        onChange={async (e) => {
                                          await updateDoc(doc(db, "jugadores", player.id), {
                                            fechaBaja: e.target.value
                                          });
                                        }}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs outline-none focus:border-camarma-blue yellow-date-picker"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                                        Fecha Estimada de Alta
                                      </label>
                                      <input
                                        type="date"
                                        value={player.fechaRecuperacion === "pendiente" ? "" : (player.fechaRecuperacion || "")}
                                        onChange={async (e) => {
                                          await updateDoc(doc(db, "jugadores", player.id), {
                                            fechaRecuperacion: e.target.value
                                          });
                                        }}
                                        disabled={player.fechaRecuperacion === "pendiente"}
                                        className="w-full bg-slate-950 border border-slate-800 disabled:opacity-50 disabled:bg-slate-900 text-white rounded-lg px-3 py-2 text-xs outline-none focus:border-camarma-blue yellow-date-picker"
                                      />
                                    </div>
                                  </div>

                                  <label className="flex items-center gap-2 select-none cursor-pointer pt-1">
                                    <input
                                      type="checkbox"
                                      checked={player.fechaRecuperacion === "pendiente"}
                                      onChange={async (e) => {
                                        const isPending = e.target.checked;
                                        await updateDoc(doc(db, "jugadores", player.id), {
                                          fechaRecuperacion: isPending ? "pendiente" : ""
                                        });
                                      }}
                                      className="rounded border-slate-700 bg-slate-950 text-camarma-blue focus:ring-camarma-blue w-4 h-4 cursor-pointer"
                                    />
                                    <span className="text-xs text-slate-400">Sin fecha de alta (Pendiente de evolución)</span>
                                  </label>
                                </div>
                              )}
                            </div>

                            {/* Historial de Lesiones Pasadas */}
                            {player.historialLesiones && player.historialLesiones.length > 0 && (
                              <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2 text-left">
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  📜 Historial de Lesiones Pasadas
                                </span>
                                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                                  <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                      <tr className="bg-slate-900 text-slate-400 font-bold uppercase text-[9px] tracking-wider border-b border-slate-800">
                                        <th className="p-2.5">Lesión</th>
                                        <th className="p-2.5 text-center">Baja</th>
                                        <th className="p-2.5 text-center">Alta</th>
                                        <th className="p-2.5 text-center">Duración</th>
                                        <th className="p-2.5 text-center">Acciones</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-850">
                                      {player.historialLesiones.map((entry) => (
                                        <tr key={entry.id} className="hover:bg-slate-900/40">
                                          <td className="p-2.5 font-semibold text-slate-200">{entry.tipoLesion}</td>
                                          <td className="p-2.5 text-center text-slate-400">{entry.fechaBaja}</td>
                                          <td className="p-2.5 text-center text-slate-400">{entry.fechaAlta}</td>
                                          <td className="p-2.5 text-center font-bold text-amber-500">{entry.duracion} {entry.duracion === 1 ? 'día' : 'días'}</td>
                                          <td className="p-2.5 text-center">
                                            <button
                                              onClick={() => setEditingInjury({ player, injury: entry })}
                                              className="text-[10px] bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-camarma-gold font-black px-2.5 py-1.5 rounded-lg cursor-pointer transition-all active:scale-95 uppercase tracking-wider flex items-center justify-center gap-1.5 mx-auto"
                                            >
                                              <Pencil className="w-3.5 h-3.5" />
                                              Editar
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                          </div>

                          {/* Acciones del Jugador: Editar, Historial PDF y Eliminar */}
                          <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-700/50 gap-2">
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingPlayer(player); }}
                                className="flex items-center gap-1.5 bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-750 text-blue-400 text-[11px] font-extrabold px-4 py-2.5 rounded-xl cursor-pointer transition-all active:scale-95 uppercase tracking-wider"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Editar Jugador
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); generateDetailedPlayerPDF(player); }}
                                className="flex items-center gap-1.5 bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-750 text-camarma-gold text-[11px] font-extrabold px-4 py-2.5 rounded-xl cursor-pointer transition-all active:scale-95 uppercase tracking-wider"
                              >
                                📄 Historial PDF
                              </button>
                            </div>
                            <button
                              onClick={() => handleDeletePlayer(player)}
                              className="flex items-center gap-1.5 bg-red-950/10 hover:bg-red-900/20 border border-red-900/30 hover:border-red-800/50 text-red-400 text-[11px] font-extrabold px-4 py-2.5 rounded-xl cursor-pointer transition-all active:scale-95 uppercase tracking-wider"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Despedir
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Pestaña: PARTIDOS */}
        {activeTab === "partidos" && (
          <div className="space-y-6">
            
            {/* Cabecera de Temporada / Nueva Temporada — Discreto */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="bg-camarma-blue/10 p-2 rounded-xl border border-camarma-blue/20">
                  <Sparkles className="w-5 h-5 text-camarma-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight uppercase tracking-wider">
                    {temporadaConfig ? `Temporada: ${temporadaConfig.nombre}` : "Sin Temporada Configurada"}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {temporadaConfig && temporadaConfig.fechaInicio
                      ? `Entrenamientos oficiales programados a partir del ${new Date(temporadaConfig.fechaInicio + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}`
                      : "Debes configurar la temporada para que inicien los entrenamientos oficiales."}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleDownloadSeasonZip}
                  disabled={descargandoZip}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 text-[10.5px] font-bold py-2.5 px-3.5 rounded-xl transition-all cursor-pointer active:scale-95 uppercase tracking-wider backdrop-blur-sm bg-slate-950/40"
                  title="Descargar copia de seguridad en ZIP con todos los PDFs de la temporada"
                >
                  <Archive className="w-3.5 h-3.5 text-camarma-gold" />
                  {descargandoZip ? "Generando ZIP..." : "Descargar ZIP"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const nextYear = now.getMonth() >= 6
                      ? `${now.getFullYear()}-${now.getFullYear() + 1}`
                      : `${now.getFullYear() - 1}-${now.getFullYear()}`;
                    setNuevaTemporadaNombre(temporadaConfig?.nombre || nextYear);
                    setNuevaTemporadaFechaInicio("");
                    setShowNuevaTemporadaModal(true);
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-slate-400 hover:text-camarma-gold border border-slate-800 hover:border-camarma-gold/30 text-[10.5px] font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer active:scale-95 uppercase tracking-wider backdrop-blur-sm bg-slate-950/40"
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0 text-camarma-gold" />
                  {temporadaConfig ? "Nueva Temporada" : "Iniciar Temporada"}
                </button>
              </div>
            </div>

            {/* Crear un partido */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-3xl p-5 shadow-xl backdrop-blur-md">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-camarma-gold" />
                Programar Nuevo Partido
              </h3>
              
              <form onSubmit={handleAddMatch} className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                {/* Rival */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Rival</label>
                  <input
                    type="text"
                    value={rival}
                    onChange={(e) => setRival(e.target.value)}
                    placeholder="Ej. CD Meco"
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-camarma-blue"
                  />
                </div>

                {/* Fecha */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Fecha</label>
                  <div 
                    onClick={() => {
                      try {
                        if (matchDateInputRef.current) {
                          matchDateInputRef.current.showPicker();
                        }
                      } catch (err) {
                        console.log("showPicker not supported", err);
                      }
                    }}
                    className="relative cursor-pointer"
                  >
                    <input
                      type="date"
                      ref={matchDateInputRef}
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-4 pr-11 py-3 text-sm outline-none focus:border-camarma-blue cursor-pointer"
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <CalendarDays className="w-5 h-5 text-camarma-gold" />
                    </div>
                  </div>
                </div>

                {/* Hora */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Hora (opcional)</label>
                  <input
                    type="time"
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-camarma-blue"
                  />
                </div>

                {/* Tipo de Partido */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tipo de Partido</label>
                  <select
                    value={tipoPartido}
                    onChange={(e) => setTipoPartido(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-camarma-blue"
                  >
                    <option value="Liga">Liga</option>
                    <option value="Copa">Copa</option>
                    <option value="Amistoso">Amistoso</option>
                    <option value="Pretemporada">Pretemporada</option>
                    <option value="Playoff">Playoff</option>
                  </select>
                </div>

                {/* Jornada (Solo si es Liga) */}
                {tipoPartido === "Liga" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Jornada</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Ej. 1"
                      value={jornada}
                      onChange={(e) => setJornada(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-camarma-blue"
                    />
                  </div>
                )}

                {/* Local o Visitante */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">¿Local o Visitante?</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCondicion("local")}
                      className={`py-3 px-3 rounded-xl text-xs font-black uppercase tracking-wider border transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
                        condicion === "local"
                          ? "bg-gradient-to-r from-camarma-blue to-blue-700 text-white border-transparent shadow-md shadow-camarma-blue/20"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-900"
                      }`}
                    >
                      🏠 Local
                    </button>
                    <button
                      type="button"
                      onClick={() => setCondicion("visitante")}
                      className={`py-3 px-3 rounded-xl text-xs font-black uppercase tracking-wider border transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
                        condicion === "visitante"
                          ? "bg-gradient-to-r from-amber-500 to-camarma-gold text-slate-950 border-transparent shadow-md shadow-camarma-gold/20"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-900"
                      }`}
                    >
                      ✈️ Visitante
                    </button>
                  </div>
                </div>

                {/* Botón Programar */}
                <div className={`${tipoPartido === "Liga" ? "sm:col-span-1" : "sm:col-span-2"}`}>
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-camarma-blue to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-black py-3.5 px-4 rounded-xl shadow-lg shadow-camarma-blue/15 transition-all cursor-pointer uppercase tracking-wider text-xs active:scale-[0.98]"
                  >
                    Programar Partido
                  </button>
                </div>
              </form>
              {matchError && (
                <p className="text-red-400 text-xs mt-2">{matchError}</p>
              )}
            </div>

            {/* Listado de partidos */}
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white border-b border-slate-800 pb-2">
                Calendario de Partidos y Resultados
              </h3>

              {partidos.length === 0 ? (
                <div className="text-center py-10 bg-slate-900/30 border border-slate-800 rounded-3xl text-slate-400 text-sm">
                  No hay partidos programados.
                </div>
              ) : (
                <div className="space-y-4">
                  {partidos.map((match) => (
                    <div
                      key={match.id}
                      className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-sm"
                    >
                      {/* Info: Fecha, Hora, Condición */}
                      <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center min-w-[70px]">
                          <span className="block text-[10px] font-bold uppercase text-camarma-gold">
                            {new Date(match.fecha).toLocaleDateString("es-ES", { month: "short" })}
                          </span>
                          <span className="block text-xl font-extrabold text-white leading-none">
                            {new Date(match.fecha).toLocaleDateString("es-ES", { day: "numeric" })}
                          </span>
                          {match.hora && (
                            <span className="block text-[10px] font-semibold text-slate-400 mt-0.5">{match.hora}</span>
                          )}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {match.condicion && (
                              <span className={`text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded ${match.condicion === "local" ? "bg-camarma-blue/20 text-camarma-blue" : "bg-orange-600/20 text-orange-400"}`}>
                                {match.condicion === "local" ? "🏠 Local" : "✈️ Visitante"}
                              </span>
                            )}
                            {match.tipoPartido && (
                              <span className={`text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-350`}>
                                🏆 {match.tipoPartido} {match.tipoPartido === "Liga" && match.jornada ? ` - J. ${match.jornada}` : ""}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-slate-400 mt-0.5">RIVAL</p>
                          <h4 className="text-base font-bold text-white">{match.rival}</h4>
                        </div>
                      </div>

                      {/* Marcador / Estado del Partido */}
                      <div className="flex items-center gap-6 justify-center w-full md:w-auto py-2 bg-slate-950/40 rounded-xl px-4 border border-slate-800/40">
                        {match.jugado ? (
                          <div className="flex items-center gap-4 text-center">
                            {match.condicion === "visitante" ? (
                              <>
                                <div>
                                  <span className="text-[10px] block font-bold text-slate-500">{match.rival.toUpperCase()}</span>
                                  <span className="text-2xl font-black text-white">{match.golesRival}</span>
                                </div>
                                <span className="text-slate-600 font-bold">-</span>
                                <div>
                                  <span className="text-[10px] block font-bold text-slate-500">GORDITOS C.F</span>
                                  <span className="text-2xl font-black text-white">{match.golesGorditos ?? match.golesCamarma}</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <div>
                                  <span className="text-[10px] block font-bold text-slate-500">GORDITOS C.F</span>
                                  <span className="text-2xl font-black text-white">{match.golesGorditos ?? match.golesCamarma}</span>
                                </div>
                                <span className="text-slate-600 font-bold">-</span>
                                <div>
                                  <span className="text-[10px] block font-bold text-slate-500">{match.rival.toUpperCase()}</span>
                                  <span className="text-2xl font-black text-white">{match.golesRival}</span>
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm font-semibold text-camarma-gold bg-camarma-gold/10 px-3 py-1 rounded-md border border-camarma-gold/20">
                            Pendiente
                          </span>
                        )}
                      </div>

                      {/* Botonera de acciones del partido */}
                      <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                        
                            {/* Botón Ver PDF si existe */}
                            {(match.hasPdfActa || match.actaPdfUrl) && (
                              <button
                                onClick={async () => {
                                  if (match.actaPdfUrl) {
                                    window.open(match.actaPdfUrl, "_blank");
                                    return;
                                  }
                                  try {
                                    const blob = await loadMatchPdfBlob(match.id);
                                    openOrDownloadPdf(blob, match.actaPdfNombre || "Documento_Partido.pdf");
                                  } catch (err) {
                                    console.error(err);
                                    showToast("No se pudo cargar el PDF de la base de datos.", "error");
                                  }
                                }}
                                className="flex items-center gap-1.5 bg-red-950/30 hover:bg-red-900/45 border border-red-900/40 hover:border-red-700/60 text-red-300 font-extrabold text-[11px] py-2.5 px-3 rounded-xl cursor-pointer transition-all active:scale-95 uppercase tracking-wider shadow-sm"
                                title={`Ver Informe / Análisis: ${match.actaPdfNombre || 'Informe del Partido'}`}
                              >
                                <FileText className="w-3.5 h-3.5 text-red-400" />
                                <span className="hidden sm:inline">Informe</span> PDF
                              </button>
                            )}

                            {/* Botón Acta */}
                            <button
                              onClick={() => setActaMatch(match)}
                              className="flex items-center gap-1.5 bg-purple-950/20 hover:bg-purple-900/35 border border-purple-900/30 hover:border-purple-700/50 text-purple-300 font-extrabold text-[11px] py-2.5 px-4 rounded-xl cursor-pointer transition-all active:scale-95 uppercase tracking-wider shadow-sm"
                            >
                              📋 Acta
                            </button>
                            
                            {/* Eliminar partido */}
                            <button
                              onClick={() => handleDeleteMatch(match.id)}
                              className="p-2.5 text-slate-550 hover:text-red-400 hover:bg-red-950/25 border border-transparent hover:border-red-900/30 rounded-xl transition-all cursor-pointer active:scale-95"
                              title="Borrar partido"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pestaña: ENTRENAMIENTOS */}
        {activeTab === "entrenamientos" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Cabecera / Horarios */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 backdrop-blur-md">
              <div>
                <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-camarma-gold" />
                  Entrenamientos Oficiales
                </h3>
                <p className="text-xs text-slate-400">
                  Planifica y gestiona las sesiones y el control de asistencia del equipo.
                </p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto flex-wrap">
                {entrenamientos.length > 0 && (
                  <button
                    onClick={confirmDeleteAllTrainings}
                    className="flex-1 sm:flex-initial bg-red-955/40 hover:bg-red-900/60 border border-red-800/60 hover:border-red-600 text-red-300 hover:text-white font-extrabold text-xs py-3.5 px-4 rounded-2xl flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer transform active:scale-95 select-none uppercase tracking-wider"
                    title="Eliminar todos los entrenamientos del historial y calendario"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                    Vaciar Historial
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedMonths([]);
                    setShowExportTrainingModal(true);
                  }}
                  className="flex-1 sm:flex-initial bg-slate-900/80 hover:bg-slate-855 border border-slate-800 hover:border-slate-750 text-slate-200 hover:text-white font-extrabold text-xs py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer transform active:scale-95 select-none uppercase tracking-wider"
                >
                  📄 Reporte PDF
                </button>
                <button
                  onClick={() => {
                    setEditingTrainingId(null);
                    setTrainingDate(new Date().toISOString().split("T")[0]); // Por defecto hoy
                    setTrainingLugar("");
                    setTrainingNotes("");
                    setAbsentPlayerIds([]);
                    setAbsentPlayerReasons({});
                    setShowAddTraining(!showAddTraining);
                  }}
                  className="flex-1 sm:flex-initial bg-gradient-to-r from-camarma-gold to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-slate-950 font-black text-xs py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-camarma-gold/10 transition-all cursor-pointer transform active:scale-95 shrink-0 select-none uppercase tracking-wider"
                >
                  <Plus className="w-4 h-4 stroke-[3px]" />
                  Registrar Sesión
                </button>
              </div>
            </div>

            {/* Calendario de Entrenamientos */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-3xl p-5 shadow-xl backdrop-blur-md space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/40 pb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  📅 Calendario de Entrenamientos
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                    className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-705 text-slate-350 rounded-xl cursor-pointer active:scale-95 transition-all text-xs font-bold"
                  >
                    ◀
                  </button>
                  <span className="text-xs font-bold text-white uppercase min-w-[120px] text-center capitalize">
                    {calendarDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
                  </span>
                  <button
                    onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                    className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-705 text-slate-350 rounded-xl cursor-pointer active:scale-95 transition-all text-xs font-bold"
                  >
                    ▶
                  </button>
                </div>
              </div>

              {/* Leyenda */}
              <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-400 bg-slate-950/40 p-2.5 rounded-xl border border-slate-850">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-camarma-blue/15 border border-camarma-blue rounded"></div>
                  <span>Sesión Registrada</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base leading-none">⚽</span>
                  <span>Partido</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-slate-950/20 border border-slate-800 rounded"></div>
                  <span>Día Libre</span>
                </div>
              </div>

              {/* Grid del calendario */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 mb-2">
                <div>Lun</div>
                <div>Mar</div>
                <div>Mié</div>
                <div>Jue</div>
                <div>Vie</div>
                <div>Sáb</div>
                <div>Dom</div>
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {getDaysInMonth(calendarDate.getFullYear(), calendarDate.getMonth()).map((cell, idx) => {
                  const session = getTrainingForDate(cell.dateStr);
                  const partido = cell.dateStr ? partidos.find(p => p.fecha === cell.dateStr) : null;

                  // Calcular resultado del partido para imagen y badge
                  let partidoInfo = null;
                  if (partido && cell.isCurrentMonth) {
                    const gc = partido.golesGorditos ?? partido.golesCamarma ?? null;
                    const gr = partido.golesRival ?? null;
                    const played = gc !== null && gr !== null && partido.jugado;
                    if (played) {
                      const ganamos = gc > gr;
                      const perdimos = gc < gr;
                      const img = ganamos ? './victoria.png' : perdimos ? './derrota.png' : './empate.png';
                      const scoreDisplay = partido.condicion === 'visitante' ? `${gr} - ${gc}` : `${gc} - ${gr}`;
                      const label = ganamos ? 'Victoria' : perdimos ? 'Derrota' : 'Empate';
                      const labelColor = ganamos ? 'text-emerald-300' : perdimos ? 'text-red-300' : 'text-slate-300';
                      partidoInfo = { img, scoreDisplay, label, labelColor, played: true, rival: partido.rival };
                    } else {
                      partidoInfo = { played: false, rival: partido.rival };
                    }
                  }

                  // Si hay partido con imagen, la celda tiene aspecto diferente
                  if (partidoInfo?.played) {
                    return (
                      <div
                        key={idx}
                        className="relative rounded-2xl overflow-hidden cursor-pointer border border-slate-700/60 hover:border-slate-500 transition-all active:scale-[0.97] select-none"
                        style={{ aspectRatio: '1 / 1' }}
                        onClick={() => {}}
                      >
                        {/* Imagen de resultado como fondo */}
                        <img
                          src={partidoInfo.img}
                          alt={partidoInfo.label}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        {/* Degradado oscuro sobre la imagen */}
                        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/80" />
                        {/* Contenido superpuesto */}
                        <div className="relative z-10 flex flex-col justify-between h-full p-1.5">
                          <span className="text-[10px] font-extrabold text-white/90 drop-shadow">{cell.day}</span>
                          <div className="text-center">
                            <div className="text-[11px] font-black text-white drop-shadow leading-none">{partidoInfo.scoreDisplay}</div>
                            <div className={`text-[7px] font-black uppercase tracking-wider drop-shadow mt-0.5 ${partidoInfo.labelColor}`}>{partidoInfo.label}</div>
                          </div>
                        </div>
                        {/* Escudo del club si también hay sesión de entreno */}
                        {session && (
                          <div className="absolute top-1 right-1 z-10">
                            <img src="./logo.png" alt="" className="w-4 h-4 object-contain opacity-80" />
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Celda con partido sin resultado
                  if (partidoInfo && !partidoInfo.played) {
                    return (
                      <div
                        key={idx}
                        className="relative aspect-square rounded-2xl flex flex-col justify-between p-2 cursor-pointer transition-all border border-slate-600/60 bg-slate-850/40 text-slate-300 hover:border-slate-500 active:scale-[0.97] select-none"
                      >
                        <span className="text-[10px] font-extrabold">{cell.day}</span>
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-base leading-none">⚽</span>
                          <span className="text-[7px] font-black uppercase text-slate-400 truncate max-w-full text-center leading-tight">{partidoInfo.rival}</span>
                        </div>
                      </div>
                    );
                  }

                  // Celdas normales (entreno / libre)
                  let cellClasses = "relative aspect-square rounded-2xl flex flex-col justify-between p-2 cursor-pointer transition-all border text-left active:scale-[0.97] select-none ";
                  if (!cell.isCurrentMonth) {
                    cellClasses += "opacity-35 bg-slate-900/20 border-slate-850 text-slate-600";
                  } else if (session) {
                    cellClasses += "bg-camarma-blue/10 border-camarma-blue/60 text-white hover:bg-camarma-blue/20";
                  } else {
                    cellClasses += "border-slate-800/80 bg-slate-950/20 text-slate-450 hover:border-slate-700 hover:bg-slate-900/20";
                  }

                  return (
                    <div
                      key={idx}
                      className={cellClasses}
                      onClick={() => {
                        if (session) {
                          handleEditTraining(session);
                        } else if (cell.dateStr) {
                          setEditingTrainingId(null);
                          setTrainingDate(cell.dateStr);
                          setTrainingLugar("");
                          setTrainingNotes("");
                          setAbsentPlayerIds([]);
                          setAbsentPlayerReasons({});
                          setShowAddTraining(true);
                        }
                      }}
                    >
                      {session && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25 z-0">
                          <img src="./logo.png" alt="Escudo C.D. Gorditos C.F" className="w-8 h-8 object-contain" />
                        </div>
                      )}
                      <span className="relative z-10 text-[10px] font-extrabold">{cell.day}</span>
                      {session && (
                        <span className="relative z-10 text-[8px] font-black uppercase text-camarma-gold leading-tight tracking-wider truncate max-w-full">
                          {session.faltas && session.faltas.length > 0 ? `❌ ${session.faltas.length} Faltas` : "✔️ 100% Ok"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* MODAL FORMULARIO de Entrenamiento — superpuesto */}
            {showAddTraining && (
              <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-200">

                  {/* Cabecera del modal */}
                  <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-camarma-blue/15 border border-camarma-blue/30 flex items-center justify-center">
                        <span className="text-base">{editingTrainingId ? "📝" : "⚽"}</span>
                      </div>
                      <div>
                        <h4 className="font-black text-white text-sm leading-tight">
                          {editingTrainingId ? "Editar Sesión" : "Nueva Sesión"}
                        </h4>
                        {trainingDate && (
                          <span className="text-[10px] font-bold text-camarma-gold uppercase tracking-wider">
                            {new Date(trainingDate + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setShowAddTraining(false); setEditingTrainingId(null); }}
                      className="text-slate-400 hover:text-white cursor-pointer p-2 rounded-xl hover:bg-slate-800 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Cuerpo scrollable */}
                  <div className="overflow-y-auto flex-1 p-6">
                    <form id="training-form" onSubmit={handleSaveTraining} className="space-y-5">

                      {/* Fecha */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Fecha del Entrenamiento</label>
                        <div
                          onClick={() => { try { if (trainingDateInputRef.current) trainingDateInputRef.current.showPicker(); } catch(e){} }}
                          className="relative cursor-pointer"
                        >
                          <input
                            type="date"
                            ref={trainingDateInputRef}
                            value={trainingDate}
                            onChange={(e) => setTrainingDate(e.target.value)}
                            required
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-4 pr-11 py-3 text-sm outline-none focus:border-camarma-blue cursor-pointer"
                          />
                          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                            <CalendarDays className="w-5 h-5 text-camarma-gold" />
                          </div>
                        </div>
                      </div>

                      {/* Lugar / Instalación */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Lugar / Instalación</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={trainingLugar}
                            onChange={(e) => setTrainingLugar(e.target.value)}
                            placeholder="Ej. Campo Municipal, Polideportivo, Instalaciones Sur..."
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-4 pr-11 py-3 text-sm outline-none focus:border-camarma-blue"
                          />
                          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                            <MapPin className="w-5 h-5 text-camarma-gold" />
                          </div>
                        </div>
                      </div>

                      {/* Notas */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notas del Entrenamiento</label>
                        <textarea
                          value={trainingNotes}
                          onChange={(e) => setTrainingNotes(e.target.value)}
                          placeholder="Ej. Táctica ofensiva, partidillo final..."
                          rows={3}
                          className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-camarma-blue resize-none"
                        />
                      </div>

                      {/* Control de Bajas */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Control de Bajas / Ausencias</label>
                        <p className="text-[10px] text-slate-500 mb-3">Pulsa en un jugador para marcarlo como ausente y añadir el motivo</p>
                        <div className="grid grid-cols-2 gap-2">
                          {jugadores.map((player) => {
                            const isAbsent = absentPlayerIds.includes(player.id);
                            const reason = absentPlayerReasons[player.id];
                            return (
                              <button
                                type="button"
                                key={player.id}
                                onClick={() => {
                                  if (isAbsent) {
                                    // Si ya está ausente, abrir modal para editar motivo o quitar
                                    setAbsenceReasonInput(reason || "");
                                    setAbsenceModal({ player, mode: 'edit' });
                                  } else {
                                    // Marcar ausente y pedir motivo
                                    setAbsenceReasonInput("");
                                    setAbsenceModal({ player, mode: 'add' });
                                  }
                                }}
                                className={`flex flex-col items-start gap-0.5 p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer select-none ${
                                  isAbsent
                                    ? "bg-red-950/20 border-red-800/60 text-red-400 hover:bg-red-950/30"
                                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                                }`}
                              >
                                <div className="flex items-center gap-1.5 w-full">
                                  <span className="shrink-0">{isAbsent ? "❌" : "✔️"}</span>
                                  <span className="truncate">{player.dorsal ? `#${player.dorsal} ` : ""}{player.nombre}</span>
                                </div>
                                {isAbsent && reason && (
                                  <span className="text-[9px] text-red-400/70 font-normal truncate w-full pl-5">{reason}</span>
                                )}
                                {isAbsent && !reason && (
                                  <span className="text-[9px] text-slate-500 font-normal pl-5">Sin motivo — toca para añadir</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {trainingError && <p className="text-red-400 text-xs">{trainingError}</p>}
                    </form>
                  </div>

                  {/* Footer fijo */}
                  <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/30 flex gap-2">
                    {editingTrainingId && (() => {
                      const sessionToDelete = entrenamientos.find(e => e.id === editingTrainingId);
                      return sessionToDelete ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteTraining(sessionToDelete)}
                          className="flex items-center gap-1.5 bg-red-950/20 hover:bg-red-950/40 border border-dashed border-red-900/50 hover:border-red-700 text-red-400 hover:text-red-300 font-extrabold text-xs py-3 px-4 rounded-xl cursor-pointer transition-all active:scale-95 uppercase tracking-wider"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Eliminar
                        </button>
                      ) : null;
                    })()}
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={() => { setShowAddTraining(false); setEditingTrainingId(null); }}
                      className="bg-slate-900/80 hover:bg-slate-850 border border-slate-800 text-slate-350 hover:text-white font-extrabold text-xs py-3 px-5 rounded-xl cursor-pointer transition-all active:scale-95 uppercase tracking-wider"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      form="training-form"
                      disabled={savingTraining}
                      className="bg-gradient-to-r from-camarma-blue to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 text-white font-black text-xs py-3 px-6 rounded-xl cursor-pointer flex items-center gap-1.5 transition-all active:scale-95 uppercase tracking-wider shadow-md shadow-camarma-blue/15"
                    >
                      {savingTraining ? "Guardando..." : (editingTrainingId ? "Guardar Cambios" : "Guardar Sesión")}
                    </button>
                  </div>

                </div>
              </div>
            )}

            {/* Listado Histórico */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div 
                  className="flex items-center gap-2 cursor-pointer select-none" 
                  onClick={() => setShowTrainingHistory(!showTrainingHistory)}
                >
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Historial de Sesiones Registradas
                    <span className="text-xs text-slate-500 font-mono">({entrenamientos.length})</span>
                  </h3>
                  <span className="text-xs text-camarma-gold font-bold transition-all">
                    {showTrainingHistory ? "Ocultar ▲" : "Mostrar ▼"}
                  </span>
                </div>
                {entrenamientos.length > 0 && (
                  <button
                    onClick={confirmDeleteAllTrainings}
                    className="bg-red-955/40 hover:bg-red-900/60 border border-red-800/60 hover:border-red-600 text-red-300 hover:text-white font-bold text-[10px] py-1.5 px-3 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 uppercase tracking-wider"
                    title="Eliminar todos los entrenamientos del historial"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    Vaciar Todo
                  </button>
                )}
              </div>

              {showTrainingHistory && (
                <div className="animate-in fade-in duration-205">
                  {entrenamientos.length === 0 ? (
                    <div className="text-center py-10 bg-slate-900/30 border border-slate-800 rounded-3xl text-slate-400 text-sm">
                      No hay entrenamientos registrados todavía.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {entrenamientos.map((session) => {
                        const absents = session.faltas || [];
                        return (
                          <div
                            key={session.id}
                            className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 flex flex-col gap-3 backdrop-blur-sm"
                          >
                            {/* Cabecera de sesión */}
                            <div className="flex items-center justify-between border-b border-slate-800/40 pb-2">
                              <div className="flex items-center gap-3">
                                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center min-w-[65px]">
                                  <span className="block text-[9px] font-bold uppercase text-camarma-gold leading-none">
                                    {new Date(session.fecha + "T00:00:00").toLocaleDateString("es-ES", { month: "short" })}
                                  </span>
                                  <span className="block text-lg font-extrabold text-white leading-none mt-1">
                                    {new Date(session.fecha + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric" })}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] bg-slate-955 border border-slate-800 px-2 py-0.5 rounded text-slate-400 font-bold uppercase tracking-wider">
                                    {new Date(session.fecha + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long" })}
                                  </span>
                                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                                    <MapPin className="w-3.5 h-3.5 text-camarma-gold shrink-0" />
                                    <span className="font-medium text-slate-300">
                                      {session.lugar || "Lugar sin especificar"}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleEditTraining(session)}
                                  className="bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-750 text-camarma-gold font-extrabold text-[10px] py-1.5 px-3 rounded-xl cursor-pointer transition-all active:scale-95 uppercase tracking-wider"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => handleDeleteTraining(session)}
                                  className="p-2 text-slate-505 hover:text-red-400 hover:bg-red-950/20 rounded-xl transition-all cursor-pointer active:scale-95"
                                  title="Borrar entrenamiento"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Notas */}
                            {session.notas ? (
                              <div>
                                <span className="block text-[9px] font-extrabold uppercase text-slate-500 mb-0.5">Notas / Resumen</span>
                                <p className="text-xs text-slate-350 bg-slate-950/40 p-2.5 rounded-xl border border-slate-850/40 leading-relaxed">
                                  {session.notas}
                                </p>
                              </div>
                            ) : null}

                            {/* Ausencias */}
                            <div>
                              <span className="block text-[9px] font-extrabold uppercase text-slate-500 mb-1">
                                Ausentes / Bajas ({absents.length})
                              </span>
                              {absents.length === 0 ? (
                                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/15 border border-emerald-900/20 px-2.5 py-1 rounded-lg">
                                  ✔️ Asistencia 100% (Plantilla Completa)
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {absents.map(pid => {
                                    const p = jugadores.find(j => j.id === pid);
                                    return (
                                      <span
                                        key={pid}
                                        className="text-[10px] font-semibold bg-red-950/20 border border-red-900/30 text-red-400 px-2 py-0.5 rounded-md"
                                      >
                                        {p ? p.nombre : "Jugador eliminado"}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      </div>{/* /relative z-10 */}
    </div>

    {/* ── Modal: Nueva Temporada ─────────────────────────────────────────── */}
    {showNuevaTemporadaModal && (
      <div className="fixed inset-0 z-[90] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700/60 rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden max-h-[95vh] animate-in zoom-in-95 duration-200">
          {/* Cabecera */}
          <div className="relative overflow-hidden px-6 py-5 border-b border-slate-800">
            <div className="absolute inset-0 bg-gradient-to-r from-camarma-gold/10 via-transparent to-camarma-blue/5 pointer-events-none" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-camarma-gold/15 border border-camarma-gold/30 flex items-center justify-center shadow-md">
                  <Sparkles className="w-6 h-6 text-camarma-gold" />
                </div>
                <div>
                  <h4 className="font-black text-white text-base leading-tight">Nueva Temporada</h4>
                  <span className="inline-block text-[9px] font-black uppercase text-camarma-gold tracking-widest mt-0.5">
                    Reinicio de datos del club
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowNuevaTemporadaModal(false)}
                disabled={iniciandoTemporada}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors active:scale-95 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Cuerpo */}
          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {/* Nombre de temporada */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                Nombre de la Temporada
              </label>
              <input
                type="text"
                value={nuevaTemporadaNombre}
                onChange={(e) => setNuevaTemporadaNombre(e.target.value)}
                placeholder="Ej. 2026-2027"
                disabled={iniciandoTemporada}
                className="w-full bg-slate-950 border border-slate-800 focus:border-camarma-gold text-white rounded-xl px-4 py-3 text-base outline-none font-bold placeholder:text-slate-600 disabled:opacity-50 transition-colors"
              />
            </div>

            {/* Fecha inicio de entrenamientos */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                Inicio de Entrenamientos
              </label>
              <p className="text-[10px] text-slate-500 mb-2">
                Fecha oficial de inicio de la temporada para el calendario y cómputo de estadísticas.
              </p>
              <div
                onClick={() => { try { if (nuevaTemporadaFechaRef.current) nuevaTemporadaFechaRef.current.showPicker(); } catch(e){} }}
                className="relative cursor-pointer"
              >
                <input
                  type="date"
                  ref={nuevaTemporadaFechaRef}
                  value={nuevaTemporadaFechaInicio}
                  onChange={(e) => setNuevaTemporadaFechaInicio(e.target.value)}
                  disabled={iniciandoTemporada}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-camarma-gold text-white rounded-xl pl-4 pr-11 py-3 text-base outline-none cursor-pointer disabled:opacity-50 transition-colors"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <CalendarDays className="w-5 h-5 text-camarma-gold" />
                </div>
              </div>
            </div>

            {/* Opción de Descarga ZIP con todos los PDFs */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-camarma-gold/15 border border-camarma-gold/30 flex items-center justify-center shrink-0">
                    <Archive className="w-4 h-4 text-camarma-gold" />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs font-black uppercase text-white tracking-wider truncate">
                      Copia de Seguridad en ZIP
                    </h5>
                    <p className="text-[10px] text-slate-400 truncate">
                      Descarga todos los informes PDF de la temporada actual.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSeasonZip}
                  disabled={descargandoZip || iniciandoTemporada}
                  className="bg-camarma-blue hover:bg-blue-600 disabled:opacity-50 text-white font-extrabold text-[10.5px] py-2 px-3 rounded-xl cursor-pointer transition-all active:scale-95 uppercase tracking-wider flex items-center gap-1.5 shrink-0 shadow-sm"
                >
                  {descargandoZip ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Generando...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar ZIP</span>
                    </>
                  )}
                </button>
              </div>

              {/* Barra de progreso interactiva */}
              {zipProgress && (
                <div className="space-y-1.5 pt-1 animate-in fade-in duration-200">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-camarma-gold truncate max-w-[220px]">{zipProgress.label}</span>
                    <span className="text-slate-400 font-mono">{zipProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                    <div 
                      className="bg-gradient-to-r from-camarma-blue to-camarma-gold h-full rounded-full transition-all duration-300"
                      style={{ width: `${zipProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Casilla para descarga automática al iniciar temporada */}
              <label className="flex items-center gap-2 cursor-pointer select-none pt-1 border-t border-slate-900">
                <input
                  type="checkbox"
                  checked={autoDownloadZipOnSeasonReset}
                  onChange={(e) => setAutoDownloadZipOnSeasonReset(e.target.checked)}
                  disabled={descargandoZip || iniciandoTemporada}
                  className="rounded border-slate-700 bg-slate-900 text-camarma-gold focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="text-[10px] text-slate-300 font-medium">
                  Descargar ZIP con todos los PDFs automáticamente antes de reiniciar datos
                </span>
              </label>
            </div>

            {/* Advertencia */}
            <div className="bg-amber-950/30 border border-amber-800/50 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-base">⚠️</span>
                <span className="text-xs font-black uppercase text-amber-400 tracking-wider">Acción irreversible</span>
              </div>
              <p className="text-xs text-amber-200/80 leading-relaxed">Al confirmar se realizarán los siguientes cambios:</p>
              <ul className="text-xs text-amber-200/70 space-y-1.5 pl-2">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5 shrink-0">•</span>
                  <span>Se <strong className="text-amber-300">resetearán a 0</strong> todas las estadísticas de los jugadores (goles, minutos, tarjetas, asistencias, MVPs y faltas)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5 shrink-0">•</span>
                  <span>Se <strong className="text-amber-300">eliminarán todos los partidos</strong> y entrenamientos de la temporada anterior</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                  <span className="text-emerald-200/80">Las <strong className="text-emerald-300">fichas de jugadores</strong> (fotos, datos personales, historial de lesiones) se conservan intactas</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Pie */}
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/20 flex gap-3">
            <button
              onClick={() => setShowNuevaTemporadaModal(false)}
              disabled={iniciandoTemporada}
              className="flex-1 bg-slate-900/80 hover:bg-slate-850 border border-slate-800 text-slate-350 hover:text-white font-extrabold text-xs py-3.5 px-4 rounded-xl transition-all active:scale-95 cursor-pointer uppercase tracking-wider disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleNuevaTemporada}
              disabled={iniciandoTemporada || !nuevaTemporadaNombre.trim() || !nuevaTemporadaFechaInicio}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-camarma-gold to-yellow-600 hover:from-yellow-500 hover:to-camarma-gold disabled:from-slate-800 disabled:to-slate-800 text-slate-950 disabled:text-slate-600 font-black text-xs py-3.5 px-4 rounded-xl transition-all active:scale-95 cursor-pointer uppercase tracking-wider shadow-md shadow-camarma-gold/20 disabled:shadow-none disabled:cursor-not-allowed"
            >
              {iniciandoTemporada ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Iniciando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 stroke-[2.5px]" />
                  Confirmar Nueva Temporada
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Modal de Acta de Partido (pantalla completa) */}

    {actaMatch && (
      <ActaPartido
        match={actaMatch}
        jugadores={jugadores}
        onClose={() => setActaMatch(null)}
      />
    )}

    {/* Modal de Motivo de Ausencia */}
    {absenceModal && (
      <div className="fixed inset-0 z-[80] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Cabecera */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
            <div className="w-9 h-9 rounded-full bg-red-950/30 border border-red-900/30 flex items-center justify-center shrink-0">
              <span className="text-base">❌</span>
            </div>
            <div>
              <h4 className="font-black text-white text-sm leading-tight">
                {absenceModal.mode === 'add' ? 'Marcar Ausencia' : 'Editar Ausencia'}
              </h4>
              <span className="text-[10px] font-bold text-slate-400">{absenceModal.player.dorsal ? `#${absenceModal.player.dorsal} ` : ""}{absenceModal.player.nombre}</span>
            </div>
          </div>

          {/* Cuerpo */}
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Motivo de la ausencia</label>
              <input
                type="text"
                value={absenceReasonInput}
                onChange={(e) => setAbsenceReasonInput(e.target.value)}
                placeholder="Ej. Lesión en rodilla, trabajo, viaje..."
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:border-camarma-blue font-sans"
                autoFocus
              />
            </div>
            {/* Acceso rápido */}
            <div className="flex flex-wrap gap-1.5">
              {["Falta injustificada", "Lesión", "Trabajo", "Viaje", "Enfermedad"].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setAbsenceReasonInput(opt)}
                  className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                    absenceReasonInput === opt
                      ? 'bg-red-600/20 border-red-600/50 text-red-300'
                      : 'bg-slate-850 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 flex gap-2 flex-wrap">
            {/* Quitar ausencia — solo en modo edición */}
            {absenceModal.mode === 'edit' && (
              <button
                type="button"
                onClick={() => {
                  setAbsentPlayerIds(prev => prev.filter(id => id !== absenceModal.player.id));
                  setAbsentPlayerReasons(prev => { const n = { ...prev }; delete n[absenceModal.player.id]; return n; });
                  setAbsenceModal(null);
                }}
                className="flex items-center gap-1 bg-slate-850 hover:bg-slate-800 border border-dashed border-slate-700 text-slate-400 hover:text-white font-extrabold text-xs py-2.5 px-3.5 rounded-xl cursor-pointer transition-all active:scale-95 uppercase tracking-wider"
              >
                <X className="w-3.5 h-3.5" /> Quitar ausencia
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setAbsenceModal(null)}
              className="bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white font-extrabold text-xs py-2.5 px-4 rounded-xl cursor-pointer transition-all active:scale-95 uppercase tracking-wider"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                const id = absenceModal.player.id;
                // Añadir a ausentes si no estaba
                if (!absentPlayerIds.includes(id)) {
                  setAbsentPlayerIds(prev => [...prev, id]);
                }
                // Guardar motivo
                setAbsentPlayerReasons(prev => ({ ...prev, [id]: absenceReasonInput.trim() }));
                setAbsenceModal(null);
              }}
              className="bg-gradient-to-r from-red-700 to-red-800 hover:from-red-600 hover:to-red-700 text-white font-black text-xs py-2.5 px-5 rounded-xl cursor-pointer transition-all active:scale-95 uppercase tracking-wider shadow-md"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    )}

    {confirmDeleteTraining && (
      <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Cabecera */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
            <div className="w-10 h-10 rounded-full bg-red-950/30 flex items-center justify-center border border-red-900/35 shadow-md shrink-0">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h4 className="font-black text-white text-base leading-tight">Eliminar Sesión</h4>
              <span className="inline-block text-[9px] font-black uppercase text-red-400 tracking-widest mt-0.5">
                Acción Irreversible
              </span>
            </div>
          </div>
          {/* Cuerpo */}
          <div className="p-6 space-y-3 font-sans">
            <p className="text-sm text-slate-300 leading-relaxed">
              ¿Seguro que quieres eliminar el entrenamiento del{" "}
              <strong className="text-white">
                {confirmDeleteTraining.fecha
                  ? new Date(confirmDeleteTraining.fecha + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })
                  : confirmDeleteTraining.fecha}
              </strong>?
            </p>
            {confirmDeleteTraining.faltas?.length > 0 && (
              <div className="bg-amber-950/20 border border-amber-900/30 p-3 rounded-2xl">
                <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">⚠️ Aviso</span>
                <p className="text-xs text-amber-300/80 mt-1">
                  Se restarán automáticamente <strong>{confirmDeleteTraining.faltas.length} falta(s)</strong> de los jugadores afectados.
                </p>
              </div>
            )}
          </div>
          {/* Pie */}
          <div className="p-6 border-t border-slate-800 bg-slate-950/20 flex gap-3">
            <button
              onClick={() => setConfirmDeleteTraining(null)}
              className="flex-1 bg-slate-900/80 hover:bg-slate-850 border border-slate-800 text-slate-350 hover:text-white font-extrabold text-xs py-3.5 px-4 rounded-xl transition-all active:scale-95 cursor-pointer uppercase tracking-wider font-sans"
            >
              Cancelar
            </button>
            <button
              onClick={() => executeDeleteTraining(confirmDeleteTraining)}
              className="flex-1 bg-gradient-to-r from-red-700 to-red-800 hover:from-red-600 hover:to-red-700 text-white font-black text-xs py-3.5 px-4 rounded-xl transition-all active:scale-95 cursor-pointer uppercase tracking-wider font-sans shadow-lg shadow-red-900/20"
            >
              Eliminar Sesión
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Modal de Exportar Reporte de Entrenamientos */}
    {showExportTrainingModal && (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-200">
          {/* Cabecera */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
            <div className="flex items-center gap-3 font-sans">
              <div className="w-10 h-10 rounded-full bg-slate-850 flex items-center justify-center border border-slate-800 shadow-md">
                <ClipboardCheck className="w-5 h-5 text-camarma-gold" />
              </div>
              <div className="text-left">
                <h4 className="font-black text-white text-base leading-tight">Reporte de Asistencia</h4>
                <span className="inline-block text-[9px] font-black uppercase text-camarma-gold tracking-widest mt-0.5">
                  Selecciona los meses
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowExportTrainingModal(false)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cuerpo */}
          <div className="p-6 space-y-5 overflow-y-auto flex-1 font-sans">
            {getMonthsWithTrainings().length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">
                No hay entrenamientos registrados para exportar.
              </p>
            ) : (
              <div className="space-y-4">
                {/* Seleccionar Todos */}
                <div className="flex items-center justify-between bg-slate-950/45 border border-slate-850/60 p-3.5 rounded-2xl text-left">
                  <div>
                    <span className="text-sm font-bold text-white block">Seleccionar Todos</span>
                    <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                      Exporta todo el historial de entrenamientos
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const allMonths = getMonthsWithTrainings().map(m => m.key);
                      if (selectedMonths.length === allMonths.length) {
                        setSelectedMonths([]);
                      } else {
                        setSelectedMonths(allMonths);
                      }
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all cursor-pointer select-none ${
                      selectedMonths.length === getMonthsWithTrainings().length
                        ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-400"
                        : "bg-slate-850 border-slate-800 text-slate-400"
                    }`}
                  >
                    {selectedMonths.length === getMonthsWithTrainings().length ? "Deseleccionar" : "Seleccionar"}
                  </button>
                </div>

                <div className="space-y-2 text-left">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    Meses Disponibles
                  </label>
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                    {getMonthsWithTrainings().map(m => {
                      const isSelected = selectedMonths.includes(m.key);
                      return (
                        <label
                          key={m.key}
                          className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                            isSelected
                              ? "bg-camarma-blue/15 border-camarma-blue/40 text-white font-bold"
                              : "bg-slate-950/20 border-slate-850 hover:bg-slate-850/30 text-slate-350"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              if (isSelected) {
                                setSelectedMonths(prev => prev.filter(key => key !== m.key));
                              } else {
                                setSelectedMonths(prev => [...prev, m.key]);
                              }
                            }}
                            className="rounded border-slate-800 bg-slate-900 text-camarma-blue focus:ring-0 w-4 h-4 cursor-pointer"
                          />
                          <span className="capitalize">{m.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Pie de modal */}
          <div className="p-6 border-t border-slate-800 bg-slate-950/20 flex gap-3">
            <button
              onClick={() => setShowExportTrainingModal(false)}
              className="flex-1 bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-750 text-slate-355 hover:text-white font-extrabold text-xs py-3.5 px-4 rounded-xl transition-all active:scale-95 cursor-pointer uppercase tracking-wider"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                generateTrainingPDF(selectedMonths);
                setShowExportTrainingModal(false);
              }}
              disabled={selectedMonths.length === 0}
              className={`flex-1 font-extrabold text-xs py-3.5 px-4 rounded-xl transition-all active:scale-95 cursor-pointer uppercase tracking-wider ${
                selectedMonths.length === 0
                  ? "bg-slate-950 text-slate-650 cursor-not-allowed border border-slate-900"
                  : "bg-gradient-to-r from-camarma-gold to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-slate-950 shadow-md"
              }`}
            >
              Generar PDF
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Botón flotante de ayuda */}
    <button
      onClick={() => setShowHelpModal(true)}
      className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-camarma-gold to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-slate-950 p-4 rounded-full shadow-2xl transition-all cursor-pointer hover:scale-110 active:scale-95 flex items-center justify-center group"
      title="Ayuda de la Directiva"
    >
      <HelpCircle className="w-6 h-6 stroke-[2.5px]" />
      <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-out font-black uppercase text-xs tracking-wider whitespace-nowrap ml-0 group-hover:ml-2">
        Ayuda
      </span>
    </button>

    {/* Modal de ayuda */}
    {showHelpModal && (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-200">
          {/* Cabecera */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-850 flex items-center justify-center border border-slate-800 shadow-md">
                <HelpCircle className="w-5 h-5 text-camarma-gold" />
              </div>
              <div className="text-left">
                <h4 className="font-black text-white text-base leading-tight font-sans">Guía de la Directiva</h4>
                <span className="inline-block text-[9px] font-black uppercase text-camarma-gold tracking-widest mt-0.5">
                  Centro de Ayuda / Míster
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowHelpModal(false)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cuerpo */}
          <div className="p-6 space-y-5 overflow-y-auto flex-1 font-sans text-left">

            {/* Sección 1 — Partidos y Actas */}
            <div className="space-y-2">
              <h5 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                📅 Partidos, Calendario y Actas Oficiales
              </h5>
              <ul className="text-xs text-slate-400 list-disc pl-5 space-y-1.5 leading-relaxed">
                <li>En la pestaña <strong className="text-slate-200">Partidos</strong> pulsa <strong className="text-camarma-gold">Registrar Partido</strong> e introduce rival, fecha, hora y condición (local o visitante).</li>
                <li>Los resultados y competiciones oficiales están conectados con el portal de <strong className="text-slate-200">LaPreferente</strong>.</li>
                <li>Pulsa el botón morado <strong className="text-purple-300">📋 Acta</strong> para gestionar la mesa de control del encuentro.</li>
                <li><strong className="text-slate-200">Alineación táctica:</strong> Selecciona el esquema táctico y asigna titulares sobre el campo y suplentes en el banquillo.</li>
                <li><strong className="text-slate-200">Control de asistencia al partido:</strong> Cada jugador dispone de botones directos <strong className="text-emerald-400">✔️ Sí asiste</strong> y <strong className="text-rose-400">❌ No asiste</strong>. Si un jugador está en bajas y lo convocas (al once o al banquillo), se marca automáticamente como <strong className="text-emerald-400">Sí asiste</strong>. Si a un convocado le marcas <strong className="text-rose-400">No asiste</strong>, se retira automáticamente de la alineación y se coloca en <strong className="text-rose-300">Bajas y Faltas al Partido</strong> con su justificación.</li>
                <li><strong className="text-slate-200">Goles y eventos con minuto:</strong> Al anotar un gol se registra el minuto exacto y si fue de penalti, al igual que asistencias y tarjetas.</li>
                <li><strong className="text-slate-200">Confirmación y sincronización:</strong> Al confirmar el acta con el marcador, crónica y MVP, todas las estadísticas y faltas de partido se guardan y actualizan automáticamente en la plantilla.</li>
              </ul>
            </div>

            {/* Sección 2 — Entrenamientos */}
            <div className="space-y-2 border-t border-slate-800/60 pt-4">
              <h5 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                👟 Gestión de Entrenamientos Oficiales
              </h5>
              <ul className="text-xs text-slate-400 list-disc pl-5 space-y-1.5 leading-relaxed">
                <li><strong className="text-slate-200">Sin sesiones predefinidas:</strong> El calendario nunca genera entrenamientos automáticos. Solo existen y contabilizan las sesiones que tú crees expresamente.</li>
                <li>Pulsa cualquier día del calendario o el botón <strong className="text-camarma-gold">Registrar Sesión</strong> para programar un entrenamiento.</li>
                <li><strong className="text-slate-200">Lugar / Instalación personalizada:</strong> Puedes escribir el campo o recinto donde se entrena cada sesión, además de notas técnicas del míster.</li>
                <li><strong className="text-slate-200">Faltas de entrenamiento:</strong> Apunta las bajas de la sesión con sus respectivos motivos justificados o injustificados.</li>
                <li><strong className="text-slate-200">Vaciar Historial:</strong> Si necesitas limpiar el calendario por completo, dispones del botón rojo <strong className="text-rose-400">🗑️ Vaciar Historial</strong> para borrar todas las sesiones y reiniciar las faltas de entreno a cero.</li>
              </ul>
            </div>

            {/* Sección 3 — Faltas, Bajas y Lesiones */}
            <div className="space-y-2 border-t border-slate-800/60 pt-4">
              <h5 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                🏥 Diferenciación de Faltas y Control Médico
              </h5>
              <ul className="text-xs text-slate-400 list-disc pl-5 space-y-1.5 leading-relaxed">
                <li>El sistema separa formalmente entre <strong className="text-rose-400">Faltas de Entrenamiento</strong> y <strong className="text-amber-400">Faltas de Partido</strong> en todos los perfiles, fichas e informes.</li>
                <li><strong className="text-slate-200">Baja médica por lesión:</strong> En la ficha del jugador puedes activar el estado de lesión, indicar el diagnóstico y fecha de baja. Mientras esté lesionado, el sistema precarga automáticamente el motivo en los partidos y entrenos.</li>
                <li><strong className="text-slate-200">Alta médica:</strong> Al pulsar "Dar de Alta" se calcula la duración total de la baja y se almacena en el historial médico del jugador.</li>
              </ul>
            </div>

            {/* Sección 4 — Plantilla y Auditoría de Stats */}
            <div className="space-y-2 border-t border-slate-800/60 pt-4">
              <h5 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                📊 Plantilla y Modificación Táctil
              </h5>
              <ul className="text-xs text-slate-400 list-disc pl-5 space-y-1.5 leading-relaxed">
                <li>En la pestaña <strong className="text-slate-200">Plantilla</strong> puedes desplegar la ficha de cualquier jugador para ver sus estadísticas completas.</li>
                <li><strong className="text-slate-200">Panel de Modificaciones (+/-):</strong> Permite ajustar manualmente goles, minutos, asistencias, tarjetas, partidos convocados y ahora también <strong className="text-slate-200">Falta Entreno</strong> y <strong className="text-slate-200">Falta Partido</strong>.</li>
                <li><strong className="text-camarma-gold">⟳ Recalcular Stats:</strong> Ejecuta una auditoría completa recalculando goles, minutos, convocatorias y faltas (de entrenos y partidos) directamente desde las actas y sesiones creadas, garantizando datos 100% exactos.</li>
              </ul>
            </div>

            {/* Sección 5 — Reportes PDF */}
            <div className="space-y-2 border-t border-slate-800/60 pt-4">
              <h5 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                📄 Generación de Reportes PDF
              </h5>
              <ul className="text-xs text-slate-400 list-disc pl-5 space-y-1.5 leading-relaxed">
                <li>Todos los reportes oficiales incorporan el <strong className="text-slate-200">escudo oficial del C.D. Gorditos C.F</strong> en alta resolución.</li>
                <li><strong className="text-slate-200">PDF de plantilla:</strong> Informe general con la tabla completa de rendimiento de todo el equipo.</li>
                <li><strong className="text-slate-200">PDF individual de jugador:</strong> Expediente con foto, tabla de partidos jugados, ausencias a partidos, faltas a entrenos e historial de lesiones.</li>
                <li><strong className="text-slate-200">PDF de entrenamientos:</strong> Resumen de asistencia mensual o total con lugares y notas de sesión.</li>
                <li><strong className="text-slate-200">PDF de acta:</strong> Ficha oficial imprimible del encuentro con alineación, resultado, crónica y bajas.</li>
              </ul>
            </div>

            {/* Sección 6 — Cambio de Temporada y Archivo ZIP */}
            <div className="space-y-2 border-t border-slate-800/60 pt-4">
              <h5 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                📦 Cambio de Temporada y Descarga en ZIP
              </h5>
              <ul className="text-xs text-slate-400 list-disc pl-5 space-y-1.5 leading-relaxed">
                <li>El botón <strong className="text-camarma-gold">Nueva Temporada</strong> permite reiniciar los datos para un nuevo curso conservando las fichas y datos personales de los futbolistas.</li>
                <li><strong className="text-slate-200">Copia de Seguridad en ZIP:</strong> Puedes descargar un archivo ZIP que recopila automáticamente <strong className="text-amber-300">todos los PDFs de la temporada</strong>: el reporte general, la ficha de cada jugador, todas las actas de partidos y el historial de entrenamientos, organizados en carpetas.</li>
                <li>La descarga en ZIP también se puede realizar en cualquier momento desde el botón <strong className="text-slate-200">Descargar ZIP</strong> en la barra de temporada.</li>
              </ul>
            </div>

          </div>

          {/* Pie */}
          <div className="p-6 border-t border-slate-800 bg-slate-950/20 flex justify-end">
            <button
              onClick={() => setShowHelpModal(false)}
              className="bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-750 text-slate-300 hover:text-white font-extrabold text-xs py-3.5 px-6 rounded-xl transition-all active:scale-95 cursor-pointer uppercase tracking-wider"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Modal para Confirmar Alta Médica de un Jugador */}
    {altaPlayer && (
      <AltaPlayerModal
        player={altaPlayer}
        onClose={() => setAltaPlayer(null)}
        onDischarged={() => showToast("Jugador dado de alta correctamente.", "success")}
      />
    )}

    {/* Modal de Confirmación Personalizado */}
    {confirmDialog && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-sm bg-slate-800 border border-slate-700/70 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 p-6 space-y-4">
          <div className="text-center space-y-2">
            <h3 className="text-base font-extrabold text-white">{confirmDialog.title}</h3>
            <p className="text-xs text-slate-355 leading-relaxed text-left">{confirmDialog.message}</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setConfirmDialog(null)}
              className="flex-1 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 font-extrabold text-xs py-3 rounded-xl cursor-pointer transition-all active:scale-95"
            >
              {confirmDialog.cancelText || "Cancelar"}
            </button>
            <button
              onClick={() => {
                confirmDialog.onConfirm();
                setConfirmDialog(null);
              }}
              className="flex-1 bg-gradient-to-r from-camarma-gold to-yellow-600 hover:from-yellow-650 hover:to-yellow-700 text-slate-950 font-black text-xs py-3 rounded-xl shadow-lg shadow-camarma-gold/10 transition-all active:scale-95 cursor-pointer"
            >
              {confirmDialog.confirmText || "Confirmar"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Componente Toast */}
    {toast && (
      <div className={`fixed bottom-6 right-6 z-[110] flex items-center gap-2.5 px-4 py-3.5 rounded-2xl shadow-xl border animate-in slide-in-from-bottom-5 duration-300 ${
        toast.type === 'error' 
          ? 'bg-red-955/90 border-red-500/30 text-red-400' 
          : toast.type === 'warning'
          ? 'bg-amber-950/90 border-amber-500/30 text-amber-400'
          : 'bg-emerald-950/90 border-emerald-500/30 text-emerald-400'
      }`}>
        <span className="text-xs font-bold font-sans uppercase tracking-wider">{toast.type === 'error' ? '❌' : toast.type === 'warning' ? '⚠️' : '✅'} {toast.message}</span>
      </div>
    )}
  </>
  );
}
