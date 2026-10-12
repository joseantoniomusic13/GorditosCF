import React, { useState, useMemo, useEffect, useRef } from "react";
import { db } from "../firebase";
import { doc, updateDoc, increment } from "firebase/firestore";
import { X, Check, ChevronDown, User, Shield, ArrowLeftRight, ClipboardList, Award, Activity, UserX, FileText, Upload, Trash2, ExternalLink, Download, Loader2 } from "lucide-react";
import { LOGO_BASE64 } from "../logoBase64";
import {
  saveMatchPdfToFirestore,
  loadMatchPdfBlob,
  deleteMatchPdfFromFirestore,
  openOrDownloadPdf
} from "../utils/matchPdfFirestore";

// ─────────────────────────────────────────────
// FORMACIONES DISPONIBLES
// Cada slot tiene: id, label (abreviatura), top%, left%
// ─────────────────────────────────────────────
const FORMACIONES = {
  "4-3-3": {
    label: "4-3-3",
    slots: [
      { id: "POR", label: "POR", top: 88, left: 50 },
      { id: "LD",  label: "LD",  top: 72, left: 82 },
      { id: "DCH", label: "DCD", top: 72, left: 62 },
      { id: "DCI", label: "DCI", top: 72, left: 38 },
      { id: "LI",  label: "LI",  top: 72, left: 18 },
      { id: "MC",  label: "MC",  top: 52, left: 50 },
      { id: "MCD", label: "MCD", top: 52, left: 70 },
      { id: "MCI", label: "MCI", top: 52, left: 30 },
      { id: "ED",  label: "ED",  top: 28, left: 80 },
      { id: "DC",  label: "DC",  top: 22, left: 50 },
      { id: "EI",  label: "EI",  top: 28, left: 20 },
    ],
  },
  "4-4-2": {
    label: "4-4-2",
    slots: [
      { id: "POR", label: "POR", top: 88, left: 50 },
      { id: "LD",  label: "LD",  top: 72, left: 82 },
      { id: "DCH", label: "DCD", top: 72, left: 62 },
      { id: "DCI", label: "DCI", top: 72, left: 38 },
      { id: "LI",  label: "LI",  top: 72, left: 18 },
      { id: "EXD", label: "EXD", top: 50, left: 82 },
      { id: "MCD", label: "MCD", top: 50, left: 62 },
      { id: "MCI", label: "MCI", top: 50, left: 38 },
      { id: "EXI", label: "EXI", top: 50, left: 18 },
      { id: "DCD", label: "DC D",top: 24, left: 62 },
      { id: "DCI2",label: "DC I",top: 24, left: 38 },
    ],
  },
  "4-2-3-1": {
    label: "4-2-3-1",
    slots: [
      { id: "POR", label: "POR", top: 88, left: 50 },
      { id: "LD",  label: "LD",  top: 73, left: 82 },
      { id: "DCH", label: "DCD", top: 73, left: 62 },
      { id: "DCI", label: "DCI", top: 73, left: 38 },
      { id: "LI",  label: "LI",  top: 73, left: 18 },
      { id: "MDV1",label: "MDV", top: 58, left: 62 },
      { id: "MDV2",label: "MDV", top: 58, left: 38 },
      { id: "EXD", label: "EXD", top: 38, left: 80 },
      { id: "MAM", label: "MAM", top: 36, left: 50 },
      { id: "EXI", label: "EXI", top: 38, left: 20 },
      { id: "DC",  label: "DC",  top: 18, left: 50 },
    ],
  },
  "3-5-2": {
    label: "3-5-2",
    slots: [
      { id: "POR", label: "POR", top: 88, left: 50 },
      { id: "DCD", label: "DCD", top: 73, left: 70 },
      { id: "DCC", label: "DCC", top: 73, left: 50 },
      { id: "DCI", label: "DCI", top: 73, left: 30 },
      { id: "CRD", label: "CRD", top: 52, left: 88 },
      { id: "MCD", label: "MCD", top: 52, left: 68 },
      { id: "MCC", label: "MCC", top: 50, left: 50 },
      { id: "MCI", label: "MCI", top: 52, left: 32 },
      { id: "CRI", label: "CRI", top: 52, left: 12 },
      { id: "DCD2",label: "DC D",top: 24, left: 65 },
      { id: "DCI2",label: "DC I",top: 24, left: 35 },
    ],
  },
};

// ─────────────────────────────────────────────
// MODAL DE ESTADÍSTICAS DE UN JUGADOR EN EL PARTIDO
// ─────────────────────────────────────────────
function ModalJugadorActa({ jugador, stats, jugadoresPlantilla, motivoAusenciaInicial = "", onSave, onClose, onRemove }) {
  const [minutos, setMinutos] = useState(stats.minutos ?? 90);
  const [goles, setGoles] = useState(stats.goles ?? 0);
  const [golesContra, setGolesContra] = useState(stats.golesContra ?? 0);
  const [asistencias, setAsistencias] = useState(stats.asistencias ?? 0);
  const [amarillas, setAmarillas] = useState(stats.amarillas ?? 0);
  const [rojas, setRojas] = useState(stats.rojas ?? 0);
  const [convocado, setConvocado] = useState(stats.convocado ?? true);
  const [motivoAusencia, setMotivoAusencia] = useState(motivoAusenciaInicial);
  const [sustituido, setSustituido] = useState(stats.sustituido ?? false);
  const [minCambio, setMinCambio] = useState(stats.minCambio ?? "");
  const [sustituidoPorId, setSustituidoPorId] = useState(stats.sustituidoPorId ?? "");

  // Detalle de goles y asistencias para registrar los minutos y penaltis
  const [golesDetalle, setGolesDetalle] = useState(() => {
    if (stats.golesDetalle) return stats.golesDetalle;
    if (stats.goles > 0) {
      return Array.from({ length: stats.goles }).map(() => ({ minuto: "?", penalti: false }));
    }
    return [];
  });
  const [asistenciasDetalle, setAsistenciasDetalle] = useState(() => {
    if (stats.asistenciasDetalle) return stats.asistenciasDetalle;
    if (stats.asistencias > 0) {
      return Array.from({ length: stats.asistencias }).map(() => ({ minuto: "?" }));
    }
    return [];
  });

  // Detalle de amarillas y rojas con minuto
  const [amarillasDetalle, setAmarillasDetalle] = useState(() => {
    if (stats.amarillasDetalle) return stats.amarillasDetalle;
    if (stats.amarillas > 0) {
      return Array.from({ length: stats.amarillas }).map(() => ({ minuto: "?" }));
    }
    return [];
  });
  const [rojasDetalle, setRojasDetalle] = useState(() => {
    if (stats.rojasDetalle) return stats.rojasDetalle;
    if (stats.rojas > 0) {
      return Array.from({ length: stats.rojas }).map(() => ({ minuto: "?" }));
    }
    return [];
  });

  // Estados para los mini-formularios de añadir gol/asistencia
  const [showAddGoalPrompt, setShowAddGoalPrompt] = useState(false);
  const [newGoalMin, setNewGoalMin] = useState("");
  const [newGoalPenalti, setNewGoalPenalti] = useState(false);

  const [showAddAssistPrompt, setShowAddAssistPrompt] = useState(false);
  const [newAssistMin, setNewAssistMin] = useState("");

  // Estados para prompts de tarjetas
  const [showAddAmarillasPrompt, setShowAddAmarillasPrompt] = useState(false);
  const [newAmarillasMin, setNewAmarillasMin] = useState("");
  const [showAddRojasPrompt, setShowAddRojasPrompt] = useState(false);
  const [newRojasMin, setNewRojasMin] = useState("");
  const [validationError, setValidationError] = useState("");

  const handleSave = () => {
    const minCambioInt = sustituido ? (parseInt(minCambio) || 0) : null;
    // Si no asiste, minutos = 0
    const minutosFinales = !convocado ? 0 : (sustituido && minCambioInt ? minCambioInt : (parseInt(minutos) || 0));
    onSave({
      minutos: minutosFinales,
      goles: !convocado ? 0 : (parseInt(goles) || 0),
      golesContra: !convocado ? 0 : (parseInt(golesContra) || 0),
      asistencias: !convocado ? 0 : (parseInt(asistencias) || 0),
      amarillas: !convocado ? 0 : amarillasDetalle.length,
      rojas: !convocado ? 0 : rojasDetalle.length,
      convocado,
      sustituido: !convocado ? false : sustituido,
      minCambio: minCambioInt,
      sustituidoPorId: sustituido ? sustituidoPorId : null,
      golesDetalle: !convocado ? [] : golesDetalle,
      asistenciasDetalle: !convocado ? [] : asistenciasDetalle,
      amarillasDetalle: !convocado ? [] : amarillasDetalle,
      rojasDetalle: !convocado ? [] : rojasDetalle
    }, motivoAusencia);
  };

  const handleRemoveLastGoal = () => {
    if (golesDetalle.length > 0) {
      const updated = golesDetalle.slice(0, -1);
      setGolesDetalle(updated);
      setGoles(updated.length);
    } else {
      setGoles(0);
    }
  };

  const handleRemoveLastAssist = () => {
    if (asistenciasDetalle.length > 0) {
      const updated = asistenciasDetalle.slice(0, -1);
      setAsistenciasDetalle(updated);
      setAsistencias(updated.length);
    } else {
      setAsistencias(0);
    }
  };

  const handleAddGoal = () => {
    const min = parseInt(newGoalMin);
    if (isNaN(min) || min < 1 || min > 120) {
      setValidationError("Por favor introduce un minuto válido (1-120).");
      return;
    }
    setValidationError("");
    const updatedGoals = [...golesDetalle, { minuto: min, penalti: newGoalPenalti }].sort((a, b) => {
      if (a.minuto === "?") return 1;
      if (b.minuto === "?") return -1;
      return a.minuto - b.minuto;
    });
    setGolesDetalle(updatedGoals);
    setGoles(updatedGoals.length);
    setShowAddGoalPrompt(false);
    setNewGoalMin("");
    setNewGoalPenalti(false);
  };

  const handleAddAssist = () => {
    const min = parseInt(newAssistMin);
    if (isNaN(min) || min < 1 || min > 120) {
      setValidationError("Por favor introduce un minuto válido (1-120).");
      return;
    }
    setValidationError("");
    const updatedAssists = [...asistenciasDetalle, { minuto: min }].sort((a, b) => {
      if (a.minuto === "?") return 1;
      if (b.minuto === "?") return -1;
      return a.minuto - b.minuto;
    });
    setAsistenciasDetalle(updatedAssists);
    setAsistencias(updatedAssists.length);
    setShowAddAssistPrompt(false);
    setNewAssistMin("");
  };

  const handleAddAmarilla = () => {
    const min = parseInt(newAmarillasMin);
    if (isNaN(min) || min < 1 || min > 120) {
      setValidationError("Por favor introduce un minuto válido (1-120).");
      return;
    }
    setValidationError("");
    const updated = [...amarillasDetalle, { minuto: min }].sort((a, b) => {
      if (a.minuto === "?") return 1;
      if (b.minuto === "?") return -1;
      return a.minuto - b.minuto;
    });
    setAmarillasDetalle(updated);
    setAmarillas(updated.length);
    setShowAddAmarillasPrompt(false);
    setNewAmarillasMin("");
  };

  const handleAddRoja = () => {
    const min = parseInt(newRojasMin);
    if (isNaN(min) || min < 1 || min > 120) {
      setValidationError("Por favor introduce un minuto válido (1-120).");
      return;
    }
    setValidationError("");
    const updated = [...rojasDetalle, { minuto: min }].sort((a, b) => {
      if (a.minuto === "?") return 1;
      if (b.minuto === "?") return -1;
      return a.minuto - b.minuto;
    });
    setRojasDetalle(updated);
    setRojas(updated.length);
    setShowAddRojasPrompt(false);
    setNewRojasMin("");
  };

  const esPortero = jugador?.isPortero || jugador?.posicion === "Portero";

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Cabecera del modal */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            {jugador?.fotoUrl ? (
              <img src={jugador.fotoUrl} alt={jugador.nombre} className="w-12 h-12 rounded-full object-cover border-2 border-camarma-blue bg-slate-950 shadow-md" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-slate-850 flex items-center justify-center border border-slate-800 shadow-md">
                <User className="w-6 h-6 text-slate-400" />
              </div>
            )}
            <div>
              <h4 className="font-black text-white text-base leading-tight font-sans">{jugador?.nombre}</h4>
              <span className="inline-block text-[9px] font-black uppercase text-camarma-gold tracking-widest mt-0.5">
                {jugador?.posicion || "Jugador"}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del formulario scrollable */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 font-sans">
          
          {validationError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl font-bold text-left">
              ⚠️ {validationError}
            </div>
          )}

          {/* Selector Asiste / No Asiste */}
          <div className="flex items-center justify-between bg-slate-950/40 border border-slate-850/60 p-3.5 rounded-2xl">
            <div>
              <span className="text-sm font-bold text-white block">Asistencia al Partido</span>
              <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                {convocado ? "El jugador asiste al encuentro" : "El jugador NO asiste (pasará a Bajas)"}
              </span>
            </div>
            
            <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setConvocado(true);
                  setMotivoAusencia("");
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer select-none ${
                  convocado
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                ✔️ Sí asiste
              </button>
              <button
                type="button"
                onClick={() => {
                  setConvocado(false);
                  if (!motivoAusencia) {
                    setMotivoAusencia(jugador?.lesionado ? "Lesión" : "Falta injustificada");
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer select-none ${
                  !convocado
                    ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                ❌ No asiste
              </button>
            </div>
          </div>

          {!convocado && (
            <div className="p-4 bg-red-950/20 border border-red-900/30 rounded-2xl space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-black uppercase tracking-wider text-red-400">
                  Motivo / Justificación de la Falta al Partido
                </label>
                <span className="text-[9px] text-red-400/80 font-bold">Se colocará en Bajas</span>
              </div>
              <input
                type="text"
                value={motivoAusencia}
                onChange={(e) => setMotivoAusencia(e.target.value)}
                placeholder="Ej. Lesión, Trabajo, Falta injustificada..."
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-red-500 font-sans"
              />
              <div className="flex flex-wrap gap-1.5">
                {["Falta injustificada", "Lesión", "Trabajo", "Viaje", "Enfermedad", "Decisión técnica"].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setMotivoAusencia(opt)}
                    className={`text-[9px] font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                      motivoAusencia === opt
                        ? 'bg-red-600/30 border-red-600/60 text-red-300'
                        : 'bg-slate-850 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-amber-300/90 font-semibold bg-amber-950/30 border border-amber-900/40 rounded-xl p-2">
                ⚠️ Al guardar como "No asiste", el jugador saldrá automáticamente del once/banquillo y se colocará en Bajas y Faltas al Partido.
              </p>
            </div>
          )}

          {/* Minutos jugados */}
          <div className="space-y-2">
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">⏱️ Minutos Jugados</label>
            <div className="flex items-center gap-3 bg-slate-950/20 p-2 border border-slate-850 rounded-2xl">
              <button
                onClick={() => setMinutos(Math.max(0, minutos - 5))}
                className="w-11 h-11 bg-slate-850 hover:bg-slate-800 text-slate-350 hover:text-white font-extrabold text-lg rounded-xl transition-all active:scale-90 cursor-pointer border border-slate-800"
              >
                -
              </button>
              <input
                type="number"
                value={minutos}
                onChange={(e) => setMinutos(Math.min(120, Math.max(0, parseInt(e.target.value) || 0)))}
                className="flex-1 bg-slate-950 border border-slate-850 text-white text-center text-xl font-bold rounded-xl py-2 outline-none focus:border-camarma-blue font-mono"
              />
              <button
                onClick={() => setMinutos(Math.min(120, minutos + 5))}
                className="w-11 h-11 bg-slate-850 hover:bg-slate-800 text-slate-350 hover:text-white font-extrabold text-lg rounded-xl transition-all active:scale-90 cursor-pointer border border-slate-800"
              >
                +
              </button>
            </div>
            <div className="flex gap-2">
              {[45, 60, 90].map(m => (
                <button
                  key={m}
                  onClick={() => setMinutos(m)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all border ${minutos === m ? "bg-camarma-blue border-camarma-blue text-white shadow-sm" : "bg-slate-850 border-slate-800 text-slate-400 hover:text-white"}`}
                >
                  {m}'
                </button>
              ))}
            </div>
          </div>

          {/* Goles Favor / Contra / Asistencias */}
          <div className="space-y-4 pt-2 border-t border-slate-850/60">
            {!esPortero ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Goles */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">⚽ Goles</label>
                    <div className="flex items-center gap-2 bg-slate-950/40 p-1.5 border border-slate-850/80 rounded-2xl shadow-inner">
                      <button
                        type="button"
                        onClick={handleRemoveLastGoal}
                        className="w-9 h-9 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/20 rounded-lg text-lg font-black active:scale-90 cursor-pointer flex items-center justify-center transition-all"
                      >
                        -
                      </button>
                      <span className="flex-1 text-center text-xl font-mono font-black text-white">{goles}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddGoalPrompt(!showAddGoalPrompt);
                          setShowAddAssistPrompt(false);
                        }}
                        className="w-9 h-9 bg-emerald-955/20 hover:bg-emerald-955/40 text-emerald-400 border border-emerald-900/20 rounded-lg text-lg font-black active:scale-90 cursor-pointer flex items-center justify-center transition-all"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Asistencias */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">👟 Asistencias</label>
                    <div className="flex items-center gap-2 bg-slate-950/40 p-1.5 border border-slate-850/80 rounded-2xl shadow-inner">
                      <button
                        type="button"
                        onClick={handleRemoveLastAssist}
                        className="w-9 h-9 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/20 rounded-lg text-lg font-black active:scale-90 cursor-pointer flex items-center justify-center transition-all"
                      >
                        -
                      </button>
                      <span className="flex-1 text-center text-xl font-mono font-black text-white">{asistencias}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddAssistPrompt(!showAddAssistPrompt);
                          setShowAddGoalPrompt(false);
                        }}
                        className="w-9 h-9 bg-emerald-955/20 hover:bg-emerald-955/40 text-emerald-400 border border-emerald-900/20 rounded-lg text-lg font-black active:scale-90 cursor-pointer flex items-center justify-center transition-all"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Formulario Añadir Gol */}
                {showAddGoalPrompt && (
                  <div className="bg-slate-950/80 p-3.5 border border-slate-850 rounded-2xl space-y-3 animate-in slide-in-from-top-2 duration-200">
                    <span className="block text-[10px] font-black uppercase text-camarma-gold tracking-wider">⚽ Añadir Gol</span>
                    <div className="grid grid-cols-2 gap-3 items-end">
                      <div className="space-y-1">
                        <label className="block text-[9px] uppercase text-slate-500 font-bold">Minuto de Juego</label>
                        <input
                          type="number"
                          placeholder="Ej: 34"
                          value={newGoalMin}
                          onChange={(e) => setNewGoalMin(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-camarma-blue font-mono font-bold"
                          min="1"
                          max="120"
                        />
                      </div>
                      <div className="pb-2.5">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={newGoalPenalti}
                            onChange={(e) => setNewGoalPenalti(e.target.checked)}
                            className="rounded border-slate-800 bg-slate-900 text-camarma-blue focus:ring-0 w-4 h-4"
                          />
                          ¿Fue penalti?
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddGoalPrompt(false);
                          setNewGoalMin("");
                          setNewGoalPenalti(false);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleAddGoal}
                        className="px-4 py-1.5 rounded-lg bg-camarma-blue hover:bg-blue-600 text-white shadow-sm transition-colors"
                      >
                        Confirmar
                      </button>
                    </div>
                  </div>
                )}

                {/* Formulario Añadir Asistencia */}
                {showAddAssistPrompt && (
                  <div className="bg-slate-950/80 p-3.5 border border-slate-850 rounded-2xl space-y-3 animate-in slide-in-from-top-2 duration-200">
                    <span className="block text-[10px] font-black uppercase text-camarma-gold tracking-wider">👟 Añadir Asistencia</span>
                    <div className="space-y-1">
                      <label className="block text-[9px] uppercase text-slate-500 font-bold">Minuto de Juego</label>
                      <input
                        type="number"
                        placeholder="Ej: 72"
                        value={newAssistMin}
                        onChange={(e) => setNewAssistMin(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-camarma-blue font-mono font-bold"
                        min="1"
                        max="120"
                      />
                    </div>
                    <div className="flex gap-2 justify-end text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddAssistPrompt(false);
                          setNewAssistMin("");
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleAddAssist}
                        className="px-4 py-1.5 rounded-lg bg-camarma-blue hover:bg-blue-600 text-white shadow-sm transition-colors"
                      >
                        Confirmar
                      </button>
                    </div>
                  </div>
                )}

                {/* Listados de Desglose de Goles */}
                {golesDetalle.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Desglose de Goles</span>
                    <div className="flex flex-wrap gap-1.5">
                      {golesDetalle.map((g, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 bg-slate-950 border border-slate-850 text-[10px] font-extrabold text-white px-2.5 py-1 rounded-xl shadow-sm">
                          ⚽ {g.minuto === "?" ? "Gol" : "Min. " + g.minuto}{g.penalti ? " (P)" : ""}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = golesDetalle.filter((_, i) => i !== idx);
                              setGolesDetalle(updated);
                              setGoles(updated.length);
                            }}
                            className="text-red-400 hover:text-red-300 font-black ml-0.5 text-xs hover:bg-slate-900 rounded px-1 transition-all cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Listados de Desglose de Asistencias */}
                {asistenciasDetalle.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Desglose de Asistencias</span>
                    <div className="flex flex-wrap gap-1.5">
                      {asistenciasDetalle.map((a, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 bg-slate-950 border border-slate-850 text-[10px] font-extrabold text-white px-2.5 py-1 rounded-xl shadow-sm">
                          👟 {a.minuto === "?" ? "Asist." : "Min. " + a.minuto}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = asistenciasDetalle.filter((_, i) => i !== idx);
                              setAsistenciasDetalle(updated);
                              setAsistencias(updated.length);
                            }}
                            className="text-red-400 hover:text-red-300 font-black ml-0.5 text-xs hover:bg-slate-900 rounded px-1 transition-all cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Goles Contra para Portero */
              <div className="space-y-2">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">🥅 Goles Recibidos</label>
                <div className="flex items-center gap-3 bg-slate-950/20 p-2 border border-slate-850 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setGolesContra(Math.max(0, golesContra - 1))}
                    className="w-11 h-11 bg-red-955/40 text-red-400 border border-red-900/20 rounded-xl text-xl font-black active:scale-90 cursor-pointer flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center text-2xl font-mono font-black text-white">{golesContra}</span>
                  <button
                    type="button"
                    onClick={() => setGolesContra(golesContra + 1)}
                    className="w-11 h-11 bg-emerald-955/40 text-emerald-400 border border-emerald-900/20 rounded-xl text-xl font-black active:scale-90 cursor-pointer flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tarjetas */}
          <div className="space-y-3 pt-2 border-t border-slate-850/60">

            {/* Amarillas */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">🟨 Amarillas</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (amarillasDetalle.length > 0) {
                        const updated = amarillasDetalle.slice(0, -1);
                        setAmarillasDetalle(updated);
                        setAmarillas(updated.length);
                      }
                    }}
                    className="w-8 h-8 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/20 rounded-lg text-base font-black active:scale-90 cursor-pointer flex items-center justify-center transition-all"
                  >-</button>
                  <span className="w-8 text-center text-lg font-mono font-black text-yellow-400">{amarillasDetalle.length}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddAmarillasPrompt(!showAddAmarillasPrompt);
                      setShowAddRojasPrompt(false);
                    }}
                    className="w-8 h-8 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-lg text-base font-black active:scale-90 cursor-pointer flex items-center justify-center transition-all"
                  >+</button>
                </div>
              </div>
              {showAddAmarillasPrompt && (
                <div className="bg-slate-950/80 p-3 border border-yellow-900/30 rounded-2xl space-y-2 animate-in slide-in-from-top-2 duration-200">
                  <span className="block text-[10px] font-black uppercase text-yellow-400 tracking-wider">🟨 Minuto de la Amarilla</span>
                  <div className="flex gap-2 items-end">
                    <input
                      type="number"
                      placeholder="Ej: 45"
                      value={newAmarillasMin}
                      onChange={(e) => setNewAmarillasMin(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-yellow-500 font-mono font-bold"
                      min="1" max="120"
                      autoFocus
                    />
                    <div className="flex gap-1.5 text-[10px] font-bold">
                      <button type="button" onClick={() => { setShowAddAmarillasPrompt(false); setNewAmarillasMin(""); }} className="px-2.5 py-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors">✕</button>
                      <button type="button" onClick={handleAddAmarilla} className="px-3 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white shadow-sm transition-colors">✓</button>
                    </div>
                  </div>
                </div>
              )}
              {amarillasDetalle.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {amarillasDetalle.map((a, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 bg-yellow-950/30 border border-yellow-900/30 text-[10px] font-extrabold text-yellow-400 px-2.5 py-1 rounded-xl">
                      🟨 Min. {a.minuto === "?" ? "?" : a.minuto}
                      <button type="button" onClick={() => { const u = amarillasDetalle.filter((_, i) => i !== idx); setAmarillasDetalle(u); setAmarillas(u.length); }} className="text-red-400 hover:text-red-300 font-black text-xs cursor-pointer">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Rojas */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">🟥 Rojas</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (rojasDetalle.length > 0) {
                        const updated = rojasDetalle.slice(0, -1);
                        setRojasDetalle(updated);
                        setRojas(updated.length);
                      }
                    }}
                    className="w-8 h-8 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/20 rounded-lg text-base font-black active:scale-90 cursor-pointer flex items-center justify-center transition-all"
                  >-</button>
                  <span className="w-8 text-center text-lg font-mono font-black text-red-500">{rojasDetalle.length}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddRojasPrompt(!showAddRojasPrompt);
                      setShowAddAmarillasPrompt(false);
                    }}
                    className="w-8 h-8 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-base font-black active:scale-90 cursor-pointer flex items-center justify-center transition-all"
                  >+</button>
                </div>
              </div>
              {showAddRojasPrompt && (
                <div className="bg-slate-950/80 p-3 border border-red-900/30 rounded-2xl space-y-2 animate-in slide-in-from-top-2 duration-200">
                  <span className="block text-[10px] font-black uppercase text-red-400 tracking-wider">🟥 Minuto de la Roja</span>
                  <div className="flex gap-2 items-end">
                    <input
                      type="number"
                      placeholder="Ej: 78"
                      value={newRojasMin}
                      onChange={(e) => setNewRojasMin(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-red-500 font-mono font-bold"
                      min="1" max="120"
                      autoFocus
                    />
                    <div className="flex gap-1.5 text-[10px] font-bold">
                      <button type="button" onClick={() => { setShowAddRojasPrompt(false); setNewRojasMin(""); }} className="px-2.5 py-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors">✕</button>
                      <button type="button" onClick={handleAddRoja} className="px-3 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white shadow-sm transition-colors">✓</button>
                    </div>
                  </div>
                </div>
              )}
              {rojasDetalle.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {rojasDetalle.map((r, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 bg-red-950/30 border border-red-900/30 text-[10px] font-extrabold text-red-400 px-2.5 py-1 rounded-xl">
                      🟥 Min. {r.minuto === "?" ? "?" : r.minuto}
                      <button type="button" onClick={() => { const u = rojasDetalle.filter((_, i) => i !== idx); setRojasDetalle(u); setRojas(u.length); }} className="text-red-400 hover:text-red-300 font-black text-xs cursor-pointer">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sustitución */}
          <div className="space-y-4 border-t border-slate-850/60 pt-4">
            <div className="flex items-center justify-between bg-slate-950/20 p-3 rounded-2xl border border-slate-850/50">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-2 select-none">
                <ArrowLeftRight className="w-4 h-4 text-orange-400" /> ¿Fue sustituido?
              </span>
              <button
                onClick={() => setSustituido(!sustituido)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer select-none ${sustituido ? "bg-orange-600/20 border-orange-500/35 text-orange-400" : "bg-slate-850 border-slate-800 text-slate-400"}`}
              >
                {sustituido ? "🔄 Sí" : "No"}
              </button>
            </div>
            
            {sustituido && (
              <div className="space-y-3 bg-slate-950/40 p-4 border border-slate-850 rounded-2xl animate-in fade-in duration-200">
                <div className="grid grid-cols-3 gap-3 items-center">
                  <label className="text-xs font-bold text-slate-400 col-span-1">Minuto cambio</label>
                  <div className="col-span-2 space-y-1">
                    <input
                      type="number"
                      value={minCambio}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMinCambio(val);
                        // Auto-calcular minutos del jugador que sale
                        const parsed = parseInt(val);
                        if (!isNaN(parsed) && parsed >= 1 && parsed <= 120) {
                          setMinutos(parsed);
                        }
                      }}
                      placeholder="Ej. 65"
                      className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-orange-500 font-mono"
                    />
                    {minCambio && !isNaN(parseInt(minCambio)) && (
                      <p className="text-[9px] text-orange-400/80 font-bold">
                        ⏱️ Jugará {parseInt(minCambio)}\'  · El suplente entrará en el {parseInt(minCambio)}\' y jugará {Math.max(0, 90 - parseInt(minCambio))}\'
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 items-center">
                  <label className="text-xs font-bold text-slate-400 col-span-1">Entra</label>
                  <div className="relative col-span-2">
                    <select
                      value={sustituidoPorId}
                      onChange={(e) => setSustituidoPorId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs font-bold outline-none appearance-none cursor-pointer focus:border-camarma-blue"
                      style={{ backgroundColor: "#0f172a", color: "#ffffff" }}
                    >
                      <option value="" className="bg-slate-900 text-white" style={{ backgroundColor: "#0f172a", color: "#ffffff" }}>-- Selecciona --</option>
                      {jugadoresPlantilla.map(j => (
                        <option key={j.id} value={j.id} className="bg-slate-900 text-white" style={{ backgroundColor: "#0f172a", color: "#ffffff" }}>{j.nombre}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer / Guardar */}
        <div className="bg-slate-950/40 p-4 border-t border-slate-850 flex flex-col gap-2">
          <button
            onClick={handleSave}
            className={`w-full flex items-center justify-center gap-2 font-black py-4 rounded-2xl text-sm shadow-md transition-all active:scale-[0.98] cursor-pointer select-none uppercase tracking-wider ${
              !convocado
                ? "bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white"
                : "bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white"
            }`}
          >
            {!convocado ? (
              <>
                <UserX className="w-4.5 h-4.5" />
                Guardar y Colocar en Bajas
              </>
            ) : (
              <>
                <Check className="w-4.5 h-4.5" />
                Confirmar Datos
              </>
            )}
          </button>
          
          {onRemove && (
            <button
              onClick={onRemove}
              className="w-full flex items-center justify-center gap-2 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-dashed border-red-900/40 py-3 rounded-2xl text-xs font-bold transition-all active:scale-[0.98] cursor-pointer select-none uppercase tracking-wider"
            >
              <X className="w-4 h-4 text-red-400" />
              Quitar de la Convocatoria (Mover a Bajas)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CAMPO DE FÚTBOL CON POSICIONES
// ─────────────────────────────────────────────
function SlotJugador({ slot, jugadorAsignado, onClick }) {
  const isPortero = slot.id === "POR";
  return (
    <div
      className="absolute flex flex-col items-center gap-1.5 cursor-pointer group select-none transition-all duration-300"
      style={{
        top: `${slot.top}%`,
        left: `${slot.left}%`,
        transform: "translate(-50%, -50%)",
        minWidth: "68px",
      }}
      onClick={() => onClick(slot.id)}
    >
      {/* Foto o avatar vacío */}
      <div className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:scale-105 group-active:scale-95
        ${jugadorAsignado 
          ? (isPortero 
            ? "border-amber-500 bg-amber-500/10 shadow-[0_0_12px_rgba(245,158,11,0.25)]" 
            : "border-camarma-blue bg-camarma-blue/10 shadow-[0_0_12px_rgba(30,144,255,0.25)]") 
          : "border-white/10 bg-slate-950/50 border-dashed hover:border-white/30 hover:bg-slate-900/60"}`}>
        {jugadorAsignado?.fotoUrl ? (
          <img src={jugadorAsignado.fotoUrl} alt={jugadorAsignado.nombre} className="w-full h-full object-cover" />
        ) : (
          <User className={`w-5 h-5 sm:w-6 sm:h-6 ${jugadorAsignado ? "text-white" : "text-white/20 group-hover:text-white/40 transition-colors"}`} />
        )}
        {/* Indicador de más si está vacío */}
        {!jugadorAsignado && (
          <span className="absolute inset-0 flex items-center justify-center text-white/0 group-hover:text-white/45 text-xl font-bold transition-all bg-black/0 group-hover:bg-slate-900/30">
            +
          </span>
        )}
      </div>

      {/* Nombre corto */}
      <span className={`text-[9px] sm:text-[10px] font-black leading-tight text-center rounded-lg px-2 py-0.5 max-w-[66px] sm:max-w-[76px] truncate border shadow-md transition-all duration-300
        ${jugadorAsignado 
          ? "text-white bg-slate-950/90 border-slate-800/80" 
          : "text-slate-400 bg-slate-950/40 border-white/5 group-hover:text-white group-hover:border-white/20"}`}>
        {jugadorAsignado ? jugadorAsignado.nombre.split(" ").slice(-1)[0] : slot.label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL: ACTA DE PARTIDO
// ─────────────────────────────────────────────
export default function ActaPartido({ match, jugadores, onClose }) {
  const [formacion, setFormacion] = useState(match.alineacion?.formacion ?? "4-3-3");
  const [asignaciones, setAsignaciones] = useState(match.alineacion?.asignaciones ?? {});
  const [suplentes, setSuplentes] = useState(match.alineacion?.suplentes ?? []);
  const [statsJugadores, setStatsJugadores] = useState(match.statsJugadores ?? {});
  const [cronica, setCronica] = useState(match.cronica ?? "");
  const [mvpJugadorId, setMvpJugadorId] = useState(match.mvpJugadorId ?? "");
  const [golesCamarma, setGolesCamarma] = useState(match.golesGorditos ?? match.golesCamarma ?? 0);
  const [golesRival, setGolesRival] = useState(match.golesRival ?? 0);
  const [matchAusencias, setMatchAusencias] = useState(match.ausencias ?? {});
  const [matchFaltas, setMatchFaltas] = useState(() => {
    if (match.faltas && Array.isArray(match.faltas)) return match.faltas;
    if (match.ausencias && Object.keys(match.ausencias).length > 0) return Object.keys(match.ausencias);
    const assigned = new Set([
      ...Object.values(match.alineacion?.asignaciones || {}).filter(Boolean),
      ...(match.alineacion?.suplentes || [])
    ]);
    return (jugadores || []).filter(j => !assigned.has(j.id)).map(j => j.id);
  });
  const [absenceModal, setAbsenceModal] = useState(null); // { player, mode: 'add'|'edit' }
  const [absenceReasonInput, setAbsenceReasonInput] = useState("");

  const [modalSlot, setModalSlot] = useState(null); // slotId o "suplente_{id}"
  const [selectorSlot, setSelectorSlot] = useState(null); // slotId que está eligiendo jugador
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState("");
  const [pendingDischarge, setPendingDischarge] = useState(null);
  const [toast, setToast] = useState(null); // { message, type }

  // ── Estado para el Acta Oficial en PDF (Almacenada en Firestore) ──────────────
  const [hasPdfActa, setHasPdfActa] = useState(Boolean(match.hasPdfActa || match.actaPdfUrl));
  const [actaPdfNombre, setActaPdfNombre] = useState(match.actaPdfNombre ?? "");
  const [actaPdfSize, setActaPdfSize] = useState(match.actaPdfSize ?? null);
  const [actaPdfFecha, setActaPdfFecha] = useState(match.actaPdfFecha ?? null);
  const [actaPdfUrl, setActaPdfUrl] = useState(match.actaPdfUrl ?? null);
  const [cachedBlob, setCachedBlob] = useState(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfUploadProgress, setPdfUploadProgress] = useState(0);
  const [pdfLoadingBlob, setPdfLoadingBlob] = useState(false);
  const pdfInputRef = useRef(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Subir y fragmentar PDF directamente en Firestore ──────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      showToast("Por favor, selecciona un archivo en formato PDF.", "error");
      return;
    }

    // Límite de 15 MB
    if (file.size > 15 * 1024 * 1024) {
      showToast("El archivo es demasiado grande (máximo 15 MB).", "error");
      return;
    }

    setPdfUploading(true);
    setPdfUploadProgress(0);

    try {
      const { metadata } = await saveMatchPdfToFirestore(match.id, file, (progress) => {
        setPdfUploadProgress(progress);
      });

      // Crear y cachear el Blob local para apertura inmediata
      setCachedBlob(file);
      setHasPdfActa(true);
      setActaPdfNombre(metadata.actaPdfNombre);
      setActaPdfSize(metadata.actaPdfSize);
      setActaPdfFecha(metadata.actaPdfFecha);
      setActaPdfUrl(null);
      showToast("Acta en PDF guardada con éxito en la base de datos.", "success");
    } catch (err) {
      console.error("Error guardando PDF en Firestore:", err);
      showToast("Error al guardar el PDF en la base de datos.", "error");
    } finally {
      setPdfUploading(false);
    }
  };

  // ── Ver / Descargar PDF desde Firestore ──────────────
  const handleViewPdf = async () => {
    // Si tiene una URL externa directa:
    if (actaPdfUrl) {
      window.open(actaPdfUrl, "_blank");
      return;
    }

    // Si ya tenemos el Blob en memoria:
    if (cachedBlob) {
      openOrDownloadPdf(cachedBlob, actaPdfNombre || "Acta_Partido.pdf");
      return;
    }

    // Si hay que descargarlo de la base de datos (Firestore):
    setPdfLoadingBlob(true);
    try {
      const blob = await loadMatchPdfBlob(match.id);
      setCachedBlob(blob);
      openOrDownloadPdf(blob, actaPdfNombre || "Acta_Partido.pdf");
    } catch (err) {
      console.error("Error cargando PDF desde Firestore:", err);
      showToast("No se pudo cargar el PDF desde la base de datos.", "error");
    } finally {
      setPdfLoadingBlob(false);
    }
  };

  // ── Eliminar PDF de Firestore ──────────────
  const handleRemovePdf = async () => {
    if (!window.confirm("¿Seguro que deseas eliminar el acta en PDF de este partido?")) return;

    setPdfUploading(true);
    try {
      await deleteMatchPdfFromFirestore(match.id);
      setHasPdfActa(false);
      setActaPdfNombre("");
      setActaPdfSize(null);
      setActaPdfFecha(null);
      setActaPdfUrl(null);
      setCachedBlob(null);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
      showToast("Acta en PDF eliminada de la base de datos.", "success");
    } catch (err) {
      console.error("Error al eliminar PDF:", err);
      showToast("Error al eliminar el acta.", "error");
    } finally {
      setPdfUploading(false);
    }
  };

  // ── Autoguardado con debounce ────────────────
  const [autoSaveStatus, setAutoSaveStatus] = useState(null); // null | 'saving' | 'saved'
  const autoSaveTimer = useRef(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Saltamos el primer render para no guardar innecesariamente al montar
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Cancelar el timer anterior si hay cambios rápidos
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setAutoSaveStatus('saving');
    autoSaveTimer.current = setTimeout(async () => {
      try {
        const matchRef = doc(db, "partidos", match.id);
        await updateDoc(matchRef, {
          cronica: cronica.trim(),
          mvpJugadorId: mvpJugadorId || null,
          alineacion: { formacion, asignaciones, suplentes },
          statsJugadores,
          golesCamarma,
          golesGorditos: golesCamarma,
          golesRival,
          faltas: matchFaltas,
          ausencias: matchAusencias,
        });
        setAutoSaveStatus('saved');
        // Limpiar el indicador a los 3s
        setTimeout(() => setAutoSaveStatus(null), 3000);
      } catch (e) {
        console.error('Autoguardado fallido:', e);
        setAutoSaveStatus(null);
      }
    }, 1500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [statsJugadores, golesCamarma, golesRival, cronica, mvpJugadorId, formacion, asignaciones, suplentes, matchFaltas, matchAusencias]);

  // ── Refs para sincronización de estadísticas de plantilla ──────────
  // 'statsJugadoresConfirmados' es el campo de Firestore que registra exactamente
  // qué stats se han aplicado a los documentos de jugadores. Es la fuente fiable
  // para calcular el diff y nunca se confunde con el autoguardado de statsJugadores.
  const lastConfirmedStatsRef = useRef(
    match.statsJugadoresConfirmados || 
    (match.actaGuardada ? match.statsJugadores || {} : {})
  );
  const lastConfirmedMvpRef = useRef(match.mvpJugadorId || "");
  const lastConfirmedFaltasRef = useRef(
    match.statsFaltasConfirmadas || match.faltas || []
  );
  // Evita doble sincronización si el usuario pulsa Confirmar y luego cierra
  const actaConfirmadaEnSesionRef = useRef(false);
  const [cerrando, setCerrando] = useState(false);

  const slots = FORMACIONES[formacion].slots;

  // IDs ya asignados (para evitar duplicados)
  const asignadosIds = useMemo(() => {
    return new Set([...Object.values(asignaciones).filter(Boolean), ...suplentes]);
  }, [asignaciones, suplentes]);

  // Jugadores libres (no asignados aún)
  const jugadoresLibres = jugadores.filter(j => !asignadosIds.has(j.id));

  const getJugador = (id) => jugadores.find(j => j.id === id);

  // Al hacer click en un slot del campo:
  const handleSlotClick = (slotId) => {
    if (asignaciones[slotId]) {
      setModalSlot(slotId);
    } else {
      setSelectorSlot(slotId);
    }
  };

  const dischargePlayer = async (player) => {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const baja = player.fechaBaja || todayStr;
      
      const diffTime = new Date(todayStr) - new Date(baja);
      const duracion = diffTime >= 0 ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;

      const archiveEntry = {
        id: Date.now().toString(),
        tipoLesion: player.tipoLesion || "Molestias físicas",
        fechaBaja: baja,
        fechaAlta: todayStr,
        duracion: duracion
      };

      const currentHistorial = player.historialLesiones || [];
      const playerRef = doc(db, "jugadores", player.id);
      
      await updateDoc(playerRef, {
        lesionado: false,
        tipoLesion: "",
        fechaBaja: "",
        fechaRecuperacion: "",
        historialLesiones: [...currentHistorial, archiveEntry]
      });
    } catch (err) {
      console.error("Error al dar de alta al jugador:", err);
      showToast("Error al actualizar el estado médico del jugador.", "error");
    }
    setPendingDischarge(null);
  };

  const tryAsignarJugador = (slotId, jugadorId) => {
    const player = jugadores.find(j => j.id === jugadorId);
    if (!player) return;

    const proceed = () => {
      setAsignaciones(prev => ({ ...prev, [slotId]: jugadorId }));
      setMatchFaltas(prev => prev.filter(id => id !== jugadorId));
      setMatchAusencias(prev => {
        const next = { ...prev };
        delete next[jugadorId];
        return next;
      });
      setStatsJugadores(prev => ({ 
        ...prev, 
        [jugadorId]: { 
          ...(prev[jugadorId] || { 
            minutos: 90, 
            goles: 0, 
            golesContra: 0, 
            asistencias: 0, 
            amarillas: 0, 
            rojas: 0, 
            golesDetalle: [], 
            asistenciasDetalle: [],
            amarillasDetalle: [],
            rojasDetalle: []
          }), 
          convocado: true 
        } 
      }));
      setSelectorSlot(null);
    };

    if (player.lesionado) {
      setPendingDischarge({
        player,
        onConfirm: async () => {
          await dischargePlayer(player);
          proceed();
        },
        onCancel: () => setPendingDischarge(null)
      });
    } else {
      proceed();
    }
  };

  const desasignarSlot = (slotId) => {
    const jugId = asignaciones[slotId];
    setAsignaciones(prev => {
      const newA = { ...prev };
      delete newA[slotId];
      return newA;
    });
    if (jugId) {
      setMatchFaltas(prev => prev.includes(jugId) ? prev : [...prev, jugId]);
      const p = getJugador(jugId);
      if (p?.lesionado) {
        setMatchAusencias(prev => ({ ...prev, [jugId]: "Lesión" }));
      }
    }
  };

  const tryAddSuplente = (jugadorId) => {
    if (suplentes.length >= 9) {
      showToast("Máximo 9 suplentes en el banquillo.", "warning");
      return;
    }
    const player = jugadores.find(j => j.id === jugadorId);
    if (!player) return;

    const proceed = () => {
      setSuplentes(prev => [...prev, jugadorId]);
      setMatchFaltas(prev => prev.filter(id => id !== jugadorId));
      setMatchAusencias(prev => {
        const next = { ...prev };
        delete next[jugadorId];
        return next;
      });
      setStatsJugadores(prev => ({ 
        ...prev, 
        [jugadorId]: { 
          ...(prev[jugadorId] || { 
            minutos: 0, 
            goles: 0, 
            golesContra: 0, 
            asistencias: 0, 
            amarillas: 0, 
            rojas: 0, 
            golesDetalle: [], 
            asistenciasDetalle: [],
            amarillasDetalle: [],
            rojasDetalle: []
          }), 
          convocado: true 
        } 
      }));
      setSelectorSlot(null);
    };

    if (player.lesionado) {
      setPendingDischarge({
        player,
        onConfirm: async () => {
          await dischargePlayer(player);
          proceed();
        },
        onCancel: () => setPendingDischarge(null)
      });
    } else {
      proceed();
    }
  };

  const removeSuplente = (jugadorId) => {
    setSuplentes(prev => prev.filter(id => id !== jugadorId));
    setMatchFaltas(prev => prev.includes(jugadorId) ? prev : [...prev, jugadorId]);
    const p = getJugador(jugadorId);
    if (p?.lesionado) {
      setMatchAusencias(prev => ({ ...prev, [jugadorId]: "Lesión" }));
    }
  };

  const guardarStats = (jugadorId, newStats, motivoAusencia) => {
    if (newStats.convocado === false) {
      // 1. Quitar de titulares si estaba asignado a un slot
      setAsignaciones(prev => {
        const next = { ...prev };
        Object.entries(next).forEach(([slot, id]) => {
          if (id === jugadorId) {
            delete next[slot];
          }
        });
        return next;
      });

      // 2. Quitar de suplentes si estaba en banquillo
      setSuplentes(prev => prev.filter(id => id !== jugadorId));

      // 3. Añadir a faltas y registrar motivo
      setMatchFaltas(prev => prev.includes(jugadorId) ? prev : [...prev, jugadorId]);
      
      const p = getJugador(jugadorId);
      const motFinal = (motivoAusencia && motivoAusencia.trim()) || (p?.lesionado ? "Lesión" : "Falta injustificada");
      setMatchAusencias(prev => ({ ...prev, [jugadorId]: motFinal }));

      // 4. Limpiar stats de juego activo
      setStatsJugadores(prev => ({
        ...prev,
        [jugadorId]: {
          ...newStats,
          convocado: false,
          minutos: 0,
          goles: 0,
          golesContra: 0,
          asistencias: 0,
          amarillas: 0,
          rojas: 0,
          sustituido: false,
          minCambio: null,
          sustituidoPorId: null,
          golesDetalle: [],
          asistenciasDetalle: [],
          amarillasDetalle: [],
          rojasDetalle: []
        }
      }));

      showToast(`${p?.nombre || "Jugador"} colocado en Bajas y Faltas al Partido.`, "info");
    } else {
      setMatchFaltas(prev => prev.filter(id => id !== jugadorId));
      setMatchAusencias(prev => {
        const next = { ...prev };
        delete next[jugadorId];
        return next;
      });

      setStatsJugadores(prev => {
        const updated = { ...prev, [jugadorId]: newStats };
        // Si el jugador que sale fue sustituido y tiene minuto de cambio,
        // actualizar automáticamente los minutos del jugador que entra
        if (newStats.sustituido && newStats.sustituidoPorId && newStats.minCambio) {
          const minEntrada = Math.max(0, 90 - newStats.minCambio);
          const sustitutoActual = updated[newStats.sustituidoPorId] || {
            minutos: minEntrada, goles: 0, golesContra: 0, asistencias: 0,
            amarillas: 0, rojas: 0, convocado: true,
            golesDetalle: [], asistenciasDetalle: [],
            amarillasDetalle: [], rojasDetalle: []
          };
          updated[newStats.sustituidoPorId] = {
            ...sustitutoActual,
            minutos: minEntrada
          };
        }
        return updated;
      });
    }

    setModalSlot(null);
  };

  const jugadorIdModal = modalSlot
    ? (modalSlot.startsWith("suplente_") ? modalSlot.replace("suplente_", "") : asignaciones[modalSlot])
    : null;

  // ── Sincroniza estadísticas de jugadores (diff entre baseline y estado actual) ──
  const syncPlayerStats = async (oldStats, newStats, oldMvpId, newMvpId, oldFaltas = [], newFaltas = []) => {
    const todosLosJugadoresIds = new Set([
      ...Object.values(asignaciones).filter(Boolean),
      ...suplentes,
      ...Object.keys(oldStats)
    ]);

    for (const jugadorId of todosLosJugadoresIds) {
      const playerRef = doc(db, "jugadores", jugadorId);
      const playerOld = oldStats[jugadorId] || { minutos: 0, goles: 0, golesContra: 0, asistencias: 0, amarillas: 0, rojas: 0, convocado: false };
      const playerNew = newStats[jugadorId];
      const updates = {};

      if (playerNew) {
        const diffMinutos = (playerNew.minutos || 0) - (playerOld.minutos || 0);
        const diffGoles = (playerNew.goles || 0) - (playerOld.goles || 0);
        const diffGolesContra = (playerNew.golesContra || 0) - (playerOld.golesContra || 0);
        const diffAsistencias = (playerNew.asistencias || 0) - (playerOld.asistencias || 0);
        const diffAmarillas = (playerNew.amarillas || 0) - (playerOld.amarillas || 0);
        const diffRojas = (playerNew.rojas || 0) - (playerOld.rojas || 0);
        const diffConvocado = (playerNew.convocado ? 1 : 0) - (playerOld.convocado ? 1 : 0);

        if (diffMinutos !== 0) updates.minutosJugados = increment(diffMinutos);
        if (diffGoles !== 0) updates.golesFavor = increment(diffGoles);
        if (diffGolesContra !== 0) updates.golesContra = increment(diffGolesContra);
        if (diffAsistencias !== 0) updates.asistencias = increment(diffAsistencias);
        if (diffAmarillas !== 0) updates.tarjetasAmarillas = increment(diffAmarillas);
        if (diffRojas !== 0) updates.tarjetasRojas = increment(diffRojas);
        if (diffConvocado !== 0) updates.partidosConvocados = increment(diffConvocado);
      } else {
        if (playerOld.minutos > 0) updates.minutosJugados = increment(-playerOld.minutos);
        if (playerOld.goles > 0) updates.golesFavor = increment(-playerOld.goles);
        if (playerOld.golesContra > 0) updates.golesContra = increment(-playerOld.golesContra);
        if (playerOld.asistencias > 0) updates.asistencias = increment(-playerOld.asistencias);
        if (playerOld.amarillas > 0) updates.tarjetasAmarillas = increment(-playerOld.amarillas);
        if (playerOld.rojas > 0) updates.tarjetasRojas = increment(-playerOld.rojas);
        if (playerOld.convocado) updates.partidosConvocados = increment(-1);
      }

      // MVP diff
      let diffMvp = 0;
      if (oldMvpId === jugadorId && newMvpId !== jugadorId) diffMvp = -1;
      else if (oldMvpId !== jugadorId && newMvpId === jugadorId) diffMvp = 1;
      if (diffMvp !== 0) updates.mvps = increment(diffMvp);

      if (Object.keys(updates).length > 0) {
        await updateDoc(playerRef, updates);
      }
    }

    // Diff de faltas de partido
    const allFaltasIds = new Set([...oldFaltas, ...newFaltas]);
    for (const fId of allFaltasIds) {
      const wasAbsent = oldFaltas.includes(fId);
      const isAbsent = newFaltas.includes(fId);
      const diffFalta = (isAbsent ? 1 : 0) - (wasAbsent ? 1 : 0);
      if (diffFalta !== 0) {
        const pRef = doc(db, "jugadores", fId);
        await updateDoc(pRef, {
          faltasPartido: increment(diffFalta)
        });
      }
    }
  };

  // Confirmar el Acta (también actualiza plantilla)
  const confirmarActa = async () => {
    setGuardando(true);
    setError("");
    try {
      const oldStats = lastConfirmedStatsRef.current;
      const newStats = statsJugadores;
      const oldMvpId = lastConfirmedMvpRef.current;
      const newMvpId = mvpJugadorId || "";
      const oldFaltas = lastConfirmedFaltasRef.current;
      const newFaltas = matchFaltas;

      await syncPlayerStats(oldStats, newStats, oldMvpId, newMvpId, oldFaltas, newFaltas);

      // Guardar en Firestore: tanto el acta como el campo 'confirmado' para futuros diffs
      const matchRef = doc(db, "partidos", match.id);
      await updateDoc(matchRef, {
        actaGuardada: true,
        cronica: cronica.trim(),
        mvpJugadorId: newMvpId || null,
        alineacion: { formacion, asignaciones, suplentes },
        statsJugadores: newStats,
        statsJugadoresConfirmados: newStats, // baseline fiable para futuros diffs
        faltas: newFaltas,
        ausencias: matchAusencias,
        statsFaltasConfirmadas: newFaltas,
        golesCamarma,
        golesGorditos: golesCamarma,
        golesRival,
        hasPdfActa: Boolean(hasPdfActa),
        actaPdfNombre: actaPdfNombre || null,
        actaPdfSize: actaPdfSize || null,
        actaPdfFecha: actaPdfFecha || null,
        actaPdfUrl: actaPdfUrl || null
      });

      // Actualizar baseline para futuros diffs
      lastConfirmedStatsRef.current = { ...newStats };
      lastConfirmedMvpRef.current = newMvpId;
      lastConfirmedFaltasRef.current = [...newFaltas];
      actaConfirmadaEnSesionRef.current = true;
      setGuardado(true);
    } catch (err) {
      console.error(err);
      setError("Error al guardar el acta. Comprueba tu conexión.");
    } finally {
      setGuardando(false);
    }
  };

  // Cerrar: sincroniza plantilla automáticamente si no se había confirmado
  const handleClose = async () => {
    if (!actaConfirmadaEnSesionRef.current) {
      const oldStats = lastConfirmedStatsRef.current;
      const newStats = statsJugadores;
      const oldMvpId = lastConfirmedMvpRef.current;
      const newMvpId = mvpJugadorId || "";
      const oldFaltas = lastConfirmedFaltasRef.current;
      const newFaltas = matchFaltas;

      // Comprobamos si hay algo que sincronizar (evitar escrituras innecesarias)
      const hayDiferencias = 
        JSON.stringify(oldStats) !== JSON.stringify(newStats) || 
        oldMvpId !== newMvpId ||
        JSON.stringify(oldFaltas) !== JSON.stringify(newFaltas);

      if (hayDiferencias) {
        setCerrando(true);
        try {
          await syncPlayerStats(oldStats, newStats, oldMvpId, newMvpId, oldFaltas, newFaltas);
          const matchRef = doc(db, "partidos", match.id);
          await updateDoc(matchRef, {
            actaGuardada: true,
            jugado: true,
            statsJugadoresConfirmados: newStats,
            faltas: newFaltas,
            ausencias: matchAusencias,
            statsFaltasConfirmadas: newFaltas
          });
        } catch (e) {
          console.error("Error al sincronizar al cerrar:", e);
        } finally {
          setCerrando(false);
        }
      }
    }
    onClose();
  };

  const exportMatchToPDF = () => {
    const getPositionPriority = (pos) => {
      const p = (pos || "").toLowerCase();
      if (p.includes("portero") || p.includes("por")) return 1;
      if (p.includes("defensa") || p.includes("lateral") || p.includes("central") || p.includes("ld") || p.includes("li") || p.includes("dcd") || p.includes("dci")) return 2;
      if (p.includes("medio") || p.includes("centro") || p.includes("volante") || p.includes("mc") || p.includes("mcd") || p.includes("mci") || p.includes("mdv") || p.includes("mam")) return 3;
      if (p.includes("delantero") || p.includes("extremo") || p.includes("punta") || p.includes("dc") || p.includes("ed") || p.includes("ei") || p.includes("exd") || p.includes("exi")) return 4;
      return 5;
    };

    const titularesIds = Object.values(asignaciones).filter(Boolean);
    const suplentesIds = suplentes || [];

    const getPlayerWithStats = (id, esTitular) => {
      const p = jugadores.find(j => j.id === id);
      const stats = statsJugadores[id] || { minutos: 0, goles: 0, golesContra: 0, asistencias: 0, amarillas: 0, rojas: 0, convocado: false };
      return {
        nombre: p ? p.nombre : "Jugador",
        posicion: p ? (p.posicion || (p.isPortero ? "Portero" : "Jugador")) : "N/A",
        prioridad: getPositionPriority(p ? p.posicion : ""),
        minutos: stats.minutos || 0,
        goles: stats.goles || 0,
        golesContra: stats.golesContra || 0,
        asistencias: stats.asistencias || 0,
        amarillas: stats.amarillas || 0,
        rojas: stats.rojas || 0,
        convocado: stats.convocado ? "Sí" : "No",
        tipo: esTitular ? "Titular" : "Suplente",
        isPortero: p ? (p.isPortero || p.posicion === "Portero") : false,
        golesDetalle: stats.golesDetalle || [],
        asistenciasDetalle: stats.asistenciasDetalle || [],
        amarillasDetalle: stats.amarillasDetalle || [],
        rojasDetalle: stats.rojasDetalle || []
      };
    };

    const titularesSorted = titularesIds
      .map(id => getPlayerWithStats(id, true))
      .sort((a, b) => a.prioridad - b.prioridad);

    const suplentesSorted = suplentesIds
      .map(id => getPlayerWithStats(id, false))
      .sort((a, b) => a.prioridad - b.prioridad);

    const allPlayersReport = [...titularesSorted, ...suplentesSorted];

    const rowsHtml = allPlayersReport.map(r => `
      <tr>
        <td><strong>${r.nombre}</strong></td>
        <td class="text-slate-500">${r.posicion}</td>
        <td class="text-center font-bold">${r.tipo}</td>
        <td class="text-center">${r.minutos}'</td>
        <td class="text-center font-semibold text-emerald-600">
          ${r.isPortero 
            ? `${r.golesContra} (Recibidos)` 
            : (r.goles > 0 
              ? `⚽ ${r.goles} ${r.golesDetalle.length > 0 ? `<div style="font-size:10px; color:#64748b; font-weight:normal; margin-top:2px;">(${r.golesDetalle.map(gd => `${gd.minuto === "?" ? "?" : `${gd.minuto}'`}${gd.penalti ? " (p)" : ""}`).join(', ')})</div>` : ''}` 
              : "-")}
        </td>
        <td class="text-center">
          ${r.asistencias > 0 
            ? `👟 ${r.asistencias} ${r.asistenciasDetalle.length > 0 ? `<div style="font-size:10px; color:#64748b; font-weight:normal; margin-top:2px;">(${r.asistenciasDetalle.map(ad => `${ad.minuto === "?" ? "?" : `${ad.minuto}'`}`).join(', ')})</div>` : ''}` 
            : "-"}
        </td>
        <td class="text-center">
          ${r.amarillas > 0
            ? `🟨 ${r.amarillas > 1 ? `x${r.amarillas} ` : ''}${r.amarillasDetalle.length > 0
              ? `<div style="font-size:10px; color:#92400e; font-weight:normal; margin-top:2px;">(${r.amarillasDetalle.map(a => a.minuto === '?' ? '?' : `${a.minuto}'`).join(', ')})</div>`
              : ''}`
            : '-'}
        </td>
        <td class="text-center">
          ${r.rojas > 0
            ? `🟥 ${r.rojasDetalle.length > 0
              ? `<div style="font-size:10px; color:#991b1b; font-weight:normal; margin-top:2px;">(${r.rojasDetalle.map(rj => rj.minuto === '?' ? '?' : `${rj.minuto}'`).join(', ')})</div>`
              : ''}`
            : '-'}
        </td>
      </tr>
    `).join("");

    const mvpPlayer = jugadores.find(j => j.id === mvpJugadorId);

    const bajasReport = matchFaltas.map(id => {
      const p = getJugador(id);
      const motivo = matchAusencias[id] || (p?.lesionado ? "Lesión" : "");
      const injustificada = !motivo || motivo.toLowerCase() === "falta injustificada";
      return {
        nombre: p ? p.nombre : "Jugador",
        posicion: p ? (p.posicion || (p.isPortero ? "Portero" : "Jugador")) : "N/A",
        motivo: motivo || "Falta injustificada",
        injustificada
      };
    });

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Acta de Partido - C.D. Gorditos C.F</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              color: #1e293b;
              padding: 40px;
              line-height: 1.6;
            }
            .header {
              border-bottom: 3px solid #0f172a;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .title {
              font-size: 28px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: -0.5px;
              margin: 0;
              color: #0f172a;
            }
            .subtitle {
              font-size: 16px;
              font-weight: 600;
              color: #475569;
              margin: 5px 0 0 0;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 30px;
              background-color: #f8fafc;
              padding: 20px;
              border-radius: 12px;
              border: 1px solid #e2e8f0;
            }
            .meta-item strong {
              color: #0f172a;
            }
            .section-title {
              font-size: 18px;
              font-weight: 800;
              text-transform: uppercase;
              margin-top: 30px;
              margin-bottom: 15px;
              color: #0f172a;
              border-bottom: 1px solid #cbd5e1;
              padding-bottom: 8px;
            }
            .cronica {
              font-style: italic;
              color: #334155;
              background-color: #f1f5f9;
              padding: 15px 20px;
              border-left: 4px solid #3b82f6;
              border-radius: 4px;
              margin-bottom: 30px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 15px;
            }
            th {
              background-color: #0f172a;
              color: white;
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              padding: 12px;
              text-align: left;
            }
            td {
              padding: 12px;
              border-bottom: 1px solid #e2e8f0;
              font-size: 13px;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-slate-500 { color: #64748b; }
            .text-emerald-600 { color: #059669; }
            .mvp-box {
              background: linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%);
              border: 1px solid #fde68a;
              color: #92400e;
              padding: 15px 20px;
              border-radius: 8px;
              font-weight: 600;
              font-size: 14px;
              margin-bottom: 25px;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header" style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <h1 class="title">Acta Oficial de Partido</h1>
              <div class="subtitle">C.D. Gorditos C.F • Temporada de Competición</div>
            </div>
            <img src="${LOGO_BASE64}" alt="C.D. Gorditos C.F Escudo" style="width: 55px; height: 55px; object-fit: contain;" />
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <strong>Partido:</strong> ${match.condicion === "visitante" ? `${match.rival} vs C.D. Gorditos C.F` : `C.D. Gorditos C.F vs ${match.rival}`}<br/>
              <strong>Tipo de Partido:</strong> ${match.tipoPartido || "Liga"}${match.tipoPartido === "Liga" && match.jornada ? ` (Jornada ${match.jornada})` : ""}<br/>
              <strong>Condición:</strong> ${match.condicion === "visitante" ? "✈️ Visitante" : "🏠 Local"}<br/>
              <strong>Fecha:</strong> ${new Date(match.fecha + "T00:00:00").toLocaleDateString("es-ES", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div class="meta-item">
              <strong>Resultado:</strong> ${match.condicion === "visitante" ? `${golesRival} - ${golesCamarma}` : `${golesCamarma} - ${golesRival}`}<br/>
              <strong>Formación táctica:</strong> ${formacion || "N/A"}<br/>
              <strong>Estado:</strong> Finalizado
            </div>
          </div>

          ${mvpPlayer ? `
            <div class="mvp-box">
              🌟 <strong>MVP del Encuentro:</strong> ${mvpPlayer.nombre} (${mvpPlayer.posicion || "Jugador"})
            </div>
          ` : ""}

          ${cronica ? `
            <div class="section-title">Crónica del Míster</div>
            <div class="cronica">
              "${cronica}"
            </div>
          ` : ""}

          <div class="section-title">Ficha Técnica e Informe de Rendimiento</div>
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Posición</th>
                <th class="text-center">Rol</th>
                <th class="text-center">Minutos</th>
                <th class="text-center">Goles</th>
                <th class="text-center">Asistencias</th>
                <th class="text-center">Amarillas</th>
                <th class="text-center">Rojas</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          ${bajasReport.length > 0 ? `
            <div class="section-title">Bajas y Faltas al Partido</div>
            <table>
              <thead>
                <tr>
                  <th style="width: 35%;">Jugador</th>
                  <th style="width: 25%;">Posición</th>
                  <th style="width: 40%;">Justificación / Motivo</th>
                </tr>
              </thead>
              <tbody>
                ${bajasReport.map(b => `
                  <tr>
                    <td><strong>${b.nombre}</strong></td>
                    <td class="text-slate-500">${b.posicion}</td>
                    <td style="color: ${b.injustificada ? '#ef4444' : '#f59e0b'}; font-weight: 600;">
                      ${b.injustificada ? '❌ Falta Injustificada' : `⚠️ ${b.motivo}`}
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          ` : ""}

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

  return (
    <div className="fixed inset-0 z-40 bg-slate-950 flex flex-col overflow-hidden">
      
      {/* Cabecera Principal */}
      <header className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800/80 px-6 py-4 flex items-center justify-between shrink-0 shadow-lg backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-camarma-blue/10 p-2 rounded-xl border border-camarma-blue/20">
            <ClipboardList className="w-5 h-5 text-camarma-gold" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white leading-tight uppercase font-sans tracking-wide">Acta del Partido</h2>
            <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-0.5">
              {match.condicion === "visitante" ? `${match.rival} vs C.D. Gorditos C.F` : `C.D. Gorditos C.F vs ${match.rival}`} • {new Date(match.fecha + "T00:00:00").toLocaleDateString("es-ES", { day:"numeric", month:"long", year:"numeric" })}
              {match.tipoPartido && ` • ${match.tipoPartido}${match.tipoPartido === "Liga" && match.jornada ? ` (Jornada ${match.jornada})` : ""}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(hasPdfActa || actaPdfUrl) && (
            <button
              onClick={handleViewPdf}
              disabled={pdfLoadingBlob}
              className="flex items-center gap-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-200 border border-red-500/40 font-black text-[10px] sm:text-xs py-2.5 px-3 sm:px-4 rounded-xl transition-all cursor-pointer active:scale-95 select-none uppercase tracking-wider shrink-0 shadow-sm disabled:opacity-50"
              title="Abrir o descargar acta oficial en PDF importada"
            >
              {pdfLoadingBlob ? (
                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
              )}
              <span className="hidden sm:inline">Acta Oficial</span> (PDF)
            </button>
          )}
          <button
            onClick={exportMatchToPDF}
            className="flex items-center gap-1.5 bg-gradient-to-r from-camarma-gold to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-slate-950 font-black text-[10px] sm:text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer border border-slate-700/80 active:scale-95 select-none uppercase tracking-wider shrink-0"
            title="Exportar acta a PDF"
          >
            📥 Exportar PDF
          </button>
          <button
            onClick={handleClose}
            disabled={cerrando}
            className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 cursor-pointer border border-slate-800 transition-colors active:scale-95 shrink-0 disabled:opacity-60 disabled:cursor-wait relative"
            title={cerrando ? "Sincronizando plantilla..." : "Cerrar acta"}
          >
            {cerrando
              ? <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
              : <X className="w-5 h-5" />
            }
          </button>
        </div>
      </header>

      {/* Cuerpo principal en malla responsiva */}
      <div className="flex-1 overflow-y-auto bg-slate-950 text-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* COLUMNA IZQUIERDA: Pizarra Táctica (6 Cols) */}
            <div className="lg:col-span-6 flex flex-col items-center gap-4 lg:sticky lg:top-6">
              <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 shadow-xl backdrop-blur-md flex flex-col items-center relative overflow-hidden">
                <div className="absolute top-0 w-full h-24 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none"></div>
                <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest mb-4 z-10 flex items-center gap-1.5">
                  🟢 PIZARRA TÁCTICA
                </span>
                
                {/* CAMPO DE FÚTBOL */}
                <div
                  className="relative w-full rounded-3xl overflow-hidden border-2 border-emerald-600/35 shadow-[0_20px_50px_rgba(0,0,0,0.65)] mx-auto"
                  style={{
                    background: "radial-gradient(circle at center, #1b4332 0%, #081c15 100%)",
                    aspectRatio: "2/3",
                    maxHeight: "690px",
                    maxWidth: "460px",
                  }}
                >
                  {/* Líneas del campo SVG */}
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ opacity: 0.35 }}>
                    <rect x="5" y="3" width="90" height="94" fill="none" stroke="white" strokeWidth="0.8" />
                    <line x1="5" y1="50" x2="95" y2="50" stroke="white" strokeWidth="0.6" />
                    <circle cx="50" cy="50" r="12" fill="none" stroke="white" strokeWidth="0.6" />
                    <circle cx="50" cy="50" r="1" fill="white" />
                    <rect x="20" y="78" width="60" height="19" fill="none" stroke="white" strokeWidth="0.6" />
                    <rect x="35" y="88" width="30" height="9" fill="none" stroke="white" strokeWidth="0.6" />
                    <rect x="20" y="3" width="60" height="19" fill="none" stroke="white" strokeWidth="0.6" />
                    <rect x="35" y="3" width="30" height="9" fill="none" stroke="white" strokeWidth="0.6" />
                    <rect x="42" y="95.5" width="16" height="4" fill="none" stroke="white" strokeWidth="0.6" />
                    <rect x="42" y="0.5" width="16" height="4" fill="none" stroke="white" strokeWidth="0.6" />
                    <circle cx="50" cy="85" r="0.7" fill="white" />
                    <circle cx="50" cy="15" r="0.7" fill="white" />
                  </svg>

                  {/* Slots de jugadores */}
                  {slots.map(slot => (
                    <SlotJugador
                      key={slot.id}
                      slot={slot}
                      jugadorAsignado={asignaciones[slot.id] ? getJugador(asignaciones[slot.id]) : null}
                      onClick={handleSlotClick}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* COLUMNA DERECHA: Configuración, Suplentes, Crónica y Guardado (6 Cols) */}
            <div className="lg:col-span-6 space-y-6">
              
              {/* Esquema Táctico Card */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 shadow-xl backdrop-blur-md space-y-4">
                <span className="text-[10px] font-extrabold uppercase text-camarma-gold tracking-widest block">
                  Sistema de Juego
                </span>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="text-sm font-black text-white uppercase font-sans">Selección de Formación</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(FORMACIONES).map(f => (
                      <button
                        key={f}
                        onClick={() => setFormacion(f)}
                        className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer select-none border ${formacion === f ? "bg-camarma-blue border-camarma-blue text-white shadow-md shadow-camarma-blue/20" : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white"}`}
                      >
                        {FORMACIONES[f].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Banquillo / Suplentes Card */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 shadow-xl backdrop-blur-md space-y-4">
                <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Shield className="w-4.5 h-4.5 text-camarma-gold" />
                    Banquillo / Suplentes ({suplentes.length})
                  </h4>
                  <span className="text-[9px] text-slate-500 font-bold">Máximo 9</span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {suplentes.map(supId => {
                    const jug = getJugador(supId);
                    if (!jug) return null;
                    return (
                      <div
                        key={supId}
                        className="flex items-center gap-2.5 bg-slate-950/60 border border-slate-850 hover:border-camarma-blue/40 rounded-2xl px-3 py-2 cursor-pointer hover:scale-[1.02] shadow-sm select-none transition-all group duration-300"
                        onClick={() => setModalSlot(`suplente_${supId}`)}
                      >
                        {jug.fotoUrl ? (
                          <img src={jug.fotoUrl} alt={jug.nombre} className="w-7 h-7 rounded-full object-cover border border-slate-850" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center border border-slate-750">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        )}
                        <span className="text-xs font-bold text-white group-hover:text-camarma-blue transition-colors">
                          {jug.nombre.split(" ").slice(-1)[0] || jug.nombre}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeSuplente(supId); }}
                          className="text-slate-500 hover:text-red-400 p-0.5 rounded-full hover:bg-slate-800 cursor-pointer transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  {suplentes.length < 9 && (
                    <button
                      onClick={() => setSelectorSlot("suplente")}
                      className="flex items-center gap-1.5 bg-slate-950/30 hover:bg-camarma-blue/15 border border-dashed border-slate-800 hover:border-camarma-blue rounded-2xl px-4 py-2 text-xs font-bold text-slate-400 hover:text-white cursor-pointer transition-all duration-300 select-none"
                    >
                      + Añadir suplente
                    </button>
                  )}
                </div>
              </div>

              {/* Bajas y Faltas al Partido Card */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 shadow-xl backdrop-blur-md space-y-4">
                <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <UserX className="w-4.5 h-4.5 text-red-400" />
                    Bajas y Faltas al Partido ({jugadoresLibres.length})
                  </h4>
                  <span className="text-[9px] text-slate-500 font-bold">Pulsa para añadir o editar justificación</span>
                </div>
                {jugadoresLibres.length === 0 ? (
                  <p className="text-slate-500 text-xs italic">Todos los jugadores asisten al encuentro.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                    {jugadoresLibres.map(jug => {
                      const isFalta = matchFaltas.includes(jug.id);
                      const motivo = matchAusencias[jug.id] || (jug.lesionado ? "Lesión" : "");
                      const injustificada = !motivo || motivo.toLowerCase() === "falta injustificada";

                      return (
                        <div
                          key={jug.id}
                          className="flex items-center justify-between bg-slate-950/40 border border-slate-850/60 rounded-2xl p-2.5 transition-all hover:border-slate-700/50"
                        >
                          <div
                            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                            onClick={() => {
                              setAbsenceReasonInput(motivo || (jug.lesionado ? "Lesión" : ""));
                              setAbsenceModal({ player: jug, mode: motivo ? 'edit' : 'add' });
                            }}
                          >
                            {jug.fotoUrl ? (
                              <img src={jug.fotoUrl} alt={jug.nombre} className="w-8 h-8 rounded-full object-cover border border-slate-850 shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-750 shrink-0">
                                <User className="w-4 h-4 text-slate-500" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-bold text-slate-200 block truncate leading-tight">
                                {jug.nombre}
                              </span>
                              <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                                {isFalta ? (
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border leading-none ${
                                    injustificada
                                      ? "bg-red-950/40 border-red-900/40 text-red-400"
                                      : "bg-amber-950/40 border-amber-900/40 text-amber-400"
                                  }`}>
                                    {motivo ? `⚠️ ${motivo}` : "❌ Sin motivo - Toca"}
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border leading-none bg-emerald-950/40 border-emerald-900/40 text-emerald-400">
                                    ✔️ Asiste (Sin minutos)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {/* Selector de Asistencia: Dos botones claros */}
                            <div className="flex items-center p-0.5 bg-slate-900 border border-slate-800 rounded-xl">
                              <button
                                type="button"
                                onClick={() => {
                                  // Marcar Sí asiste (quitar falta)
                                  setMatchFaltas(prev => prev.filter(id => id !== jug.id));
                                  setMatchAusencias(prev => {
                                    const n = { ...prev };
                                    delete n[jug.id];
                                    return n;
                                  });
                                }}
                                className={`text-[9px] font-black px-2 py-1 rounded-lg transition-all cursor-pointer select-none ${
                                  !isFalta
                                    ? "bg-emerald-600 text-white shadow-sm"
                                    : "text-slate-500 hover:text-slate-300"
                                }`}
                                title="Marcar que Sí Asiste al partido"
                              >
                                ✔️ Sí asiste
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  // Marcar No asiste (falta y pedir motivo)
                                  if (!isFalta) {
                                    setMatchFaltas(prev => prev.includes(jug.id) ? prev : [...prev, jug.id]);
                                    setAbsenceReasonInput(jug.lesionado ? "Lesión" : "Falta injustificada");
                                    setAbsenceModal({ player: jug, mode: 'add' });
                                  } else {
                                    setAbsenceReasonInput(motivo || (jug.lesionado ? "Lesión" : "Falta injustificada"));
                                    setAbsenceModal({ player: jug, mode: 'edit' });
                                  }
                                }}
                                className={`text-[9px] font-black px-2 py-1 rounded-lg transition-all cursor-pointer select-none ${
                                  isFalta
                                    ? "bg-red-600 text-white shadow-sm"
                                    : "text-slate-500 hover:text-slate-300"
                                }`}
                                title="Marcar que No Asiste (Falta al partido)"
                              >
                                ❌ No asiste
                              </button>
                            </div>

                            <button
                              onClick={() => tryAddSuplente(jug.id)}
                              className="bg-camarma-blue/15 hover:bg-camarma-blue border border-camarma-blue/30 hover:border-camarma-blue text-camarma-blue-light hover:text-white text-[10px] font-bold px-2 py-1.5 rounded-xl transition-all cursor-pointer select-none shrink-0"
                              title="Convocar al Banquillo (Se marcará automáticamente como 'Sí asiste')"
                            >
                              + Banquillo
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Resumen del Acta / Estadísticas Individuales Card */}
              {Object.keys(statsJugadores).length > 0 && (
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl overflow-hidden shadow-xl backdrop-blur-md">
                  <div className="px-5 py-4 border-b border-slate-850 flex items-center gap-2">
                    <Activity className="w-4.5 h-4.5 text-camarma-blue-light" />
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 font-sans">
                      Resumen Estadístico del Encuentro
                    </h4>
                  </div>
                  <div className="divide-y divide-slate-850/60 max-h-[360px] overflow-y-auto pr-1">
                    {[...Object.values(asignaciones).filter(Boolean), ...suplentes].map(jugId => {
                      const jug = getJugador(jugId);
                      const s = statsJugadores[jugId];
                      if (!jug || !s) return null;
                      const esPortero = jug.isPortero || jug.posicion === "Portero";
                      const slotEntry = Object.entries(asignaciones).find(([, id]) => id === jugId);
                      
                      return (
                        <div
                          key={jugId}
                          className="flex items-center justify-between px-5 py-3 hover:bg-slate-800/30 cursor-pointer transition-colors"
                          onClick={() => {
                            if (slotEntry) setModalSlot(slotEntry[0]);
                            else setModalSlot(`suplente_${jugId}`);
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {jug.fotoUrl ? (
                              <img src={jug.fotoUrl} alt={jug.nombre} className="w-8 h-8 rounded-full object-cover border border-slate-850" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-750">
                                <User className="w-4 h-4 text-slate-500" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-white block truncate">{jug.nombre}</span>
                              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                                {slotEntry ? `Titular (${slotEntry[0]})` : "Suplente"}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap items-center justify-end gap-2 text-[10px] font-black shrink-0">
                            <span className="text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-850">
                              {s.minutos}'
                            </span>
                            {!esPortero && s.goles > 0 && (
                              <span 
                                className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 cursor-help"
                                title={s.golesDetalle && s.golesDetalle.length > 0 
                                  ? s.golesDetalle.map(gd => (gd.minuto === "?" ? "?" : gd.minuto + "'") + (gd.penalti ? " (P)" : "")).join(', ')
                                  : "Goles"}
                              >
                                ⚽ {s.goles}
                              </span>
                            )}
                            {esPortero && s.golesContra > 0 && (
                              <span className="bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20">
                                🥅 {s.golesContra}
                              </span>
                            )}
                            {s.asistencias > 0 && (
                              <span 
                                className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 cursor-help"
                                title={s.asistenciasDetalle && s.asistenciasDetalle.length > 0 
                                  ? s.asistenciasDetalle.map(ad => ad.minuto === "?" ? "?" : ad.minuto + "'").join(', ')
                                  : "Asistencias"}
                              >
                                👟 {s.asistencias}
                              </span>
                            )}
                            {s.amarillas > 0 && (
                              <span className="bg-yellow-500/15 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/20">
                                🟨 {s.amarillas}
                              </span>
                            )}
                            {s.rojas > 0 && (
                              <span className="bg-red-500/15 text-red-400 px-2 py-0.5 rounded border border-red-500/20">
                                🟥 {s.rojas}
                              </span>
                            )}
                            {s.sustituido && (
                              <span className="bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded border border-orange-500/20">
                                🔄 {s.minCambio}'
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Crónica y MVP del Partido Card */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 shadow-xl backdrop-blur-md space-y-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-camarma-gold border-b border-slate-850 pb-2 flex items-center gap-2">
                  📝 Detalles Post-Partido (Cuerpo Técnico)
                </h3>

                {/* Marcador del Partido */}
                <div className="grid grid-cols-2 gap-4 bg-slate-950/45 p-4 rounded-2xl border border-slate-850/60 text-left">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      ⚽ Goles C.D. Gorditos C.F
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={golesCamarma}
                      onChange={(e) => setGolesCamarma(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-800 text-white text-center rounded-xl py-2.5 text-lg font-black outline-none focus:border-camarma-blue font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      ⚽ Goles Rival
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={golesRival}
                      onChange={(e) => setGolesRival(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-800 text-white text-center rounded-xl py-2.5 text-lg font-black outline-none focus:border-camarma-blue font-mono"
                    />
                  </div>
                </div>
                
                {/* Nominar MVP */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    🌟 Nominar MVP del Partido
                  </label>
                  <div className="relative">
                    <select
                      value={mvpJugadorId}
                      onChange={(e) => setMvpJugadorId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800/80 text-white rounded-2xl px-4 py-3.5 text-sm outline-none focus:border-camarma-blue cursor-pointer appearance-none font-medium"
                    >
                      <option value="" className="bg-slate-900 text-white">-- Selecciona al MVP del encuentro --</option>
                      {[...Object.values(asignaciones).filter(Boolean), ...suplentes].map(pid => {
                        const p = getJugador(pid);
                        return p ? (
                          <option key={pid} value={pid} className="bg-slate-900 text-white">
                            {p.nombre} ({p.posicion || (p.isPortero ? "Portero" : "Jugador")})
                          </option>
                        ) : null;
                      })}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Crónica del partido */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    ✍️ Crónica / Resumen Táctico del Míster
                  </label>
                  <textarea
                    value={cronica}
                    onChange={(e) => setCronica(e.target.value)}
                    placeholder="Escribe aquí el resumen del partido, notas tácticas o comentarios destacados para los aficionados y jugadores..."
                    rows={5}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-camarma-blue text-white rounded-2xl p-4 text-sm outline-none resize-none leading-relaxed transition-all font-medium"
                  />
                </div>
              </div>

              {/* Acta Oficial del Partido (PDF Importado en Firestore) */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 shadow-xl backdrop-blur-md space-y-4">
                <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-camarma-gold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-camarma-gold" />
                    Acta Oficial Arbitral (PDF Opcional)
                  </h3>
                  {(hasPdfActa || actaPdfUrl) && (
                    <span className="text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                      <Check className="w-3 h-3" /> PDF Adjuntado
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  Puedes importar el acta oficial en PDF directamente desde tu ordenador. Se guarda en la base de datos (Cloud Firestore) de forma ligera y segura.
                </p>

                {/* Input de archivo oculto */}
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {/* Estado de subida con barra de progreso */}
                {pdfUploading && (
                  <div className="bg-slate-950/60 border border-camarma-blue/40 rounded-2xl p-4 flex flex-col gap-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-camarma-blue" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Guardando acta en la base de datos...
                      </span>
                      <span className="font-mono text-camarma-gold">{pdfUploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-camarma-blue to-camarma-gold h-full transition-all duration-200"
                        style={{ width: `${pdfUploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Si ya hay un PDF subido */}
                {!pdfUploading && (hasPdfActa || actaPdfUrl) && (
                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-red-950/30 border border-red-500/30 flex items-center justify-center shrink-0 text-red-400">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate max-w-xs sm:max-w-sm" title={actaPdfNombre || "Acta_Oficial.pdf"}>
                          {actaPdfNombre || "Acta_Oficial.pdf"}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          {actaPdfSize && (
                            <span>{(actaPdfSize / 1024).toFixed(0)} KB</span>
                          )}
                          {actaPdfSize && actaPdfFecha && <span>•</span>}
                          {actaPdfFecha && (
                            <span>Subido el {new Date(actaPdfFecha).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleViewPdf}
                        disabled={pdfLoadingBlob}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all border border-slate-700 shadow-sm cursor-pointer disabled:opacity-50"
                        title="Abrir o descargar PDF"
                      >
                        {pdfLoadingBlob ? (
                          <Loader2 className="w-3.5 h-3.5 text-camarma-gold animate-spin" />
                        ) : (
                          <ExternalLink className="w-3.5 h-3.5 text-camarma-gold" />
                        )}
                        {pdfLoadingBlob ? "Cargando..." : "Ver PDF"}
                      </button>
                      <button
                        type="button"
                        onClick={() => pdfInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-750 cursor-pointer"
                        title="Reemplazar archivo PDF"
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-400" />
                        Cambiar
                      </button>
                      <button
                        type="button"
                        onClick={handleRemovePdf}
                        className="p-2 bg-red-950/30 hover:bg-red-900/40 text-red-400 hover:text-red-300 rounded-xl transition-all border border-red-900/40 cursor-pointer"
                        title="Eliminar PDF del partido"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Si no hay PDF y no se está subiendo */}
                {!pdfUploading && !hasPdfActa && !actaPdfUrl && (
                  <div
                    onClick={() => pdfInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-800 hover:border-camarma-blue/60 bg-slate-950/40 hover:bg-slate-900/40 rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 group flex flex-col items-center justify-center gap-2"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-slate-850 group-hover:bg-camarma-blue/20 border border-slate-750 group-hover:border-camarma-blue/40 flex items-center justify-center transition-all">
                      <Upload className="w-5 h-5 text-slate-400 group-hover:text-camarma-gold transition-colors" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white group-hover:text-camarma-blue-light transition-colors">
                        Haz clic para seleccionar el acta en PDF de tu PC
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Formato PDF (almacenamiento en base de datos)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Botón de Guardado y Confirmar */}
              <div className="space-y-3">
                {/* Indicador de autoguardado */}
                {autoSaveStatus && (
                  <div className={`flex items-center justify-center gap-2 text-xs font-bold py-2 rounded-xl transition-all animate-in fade-in duration-300 ${
                    autoSaveStatus === 'saving'
                      ? 'text-slate-400 bg-slate-850/50'
                      : 'text-emerald-400 bg-emerald-950/30 border border-emerald-900/30'
                  }`}>
                    {autoSaveStatus === 'saving' ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Guardando cambios...
                      </>
                    ) : (
                      <>✅ Guardado automáticamente</>
                    )}
                  </div>
                )}
                {error && <p className="text-red-400 text-sm font-bold text-center">{error}</p>}
                {guardado ? (
                  <div className="w-full py-4.5 bg-emerald-600/20 border border-emerald-500/40 rounded-2xl text-emerald-400 font-extrabold text-center text-sm shadow-md animate-in fade-in duration-300">
                    ✅ Estadísticas de plantilla actualizadas con éxito
                  </div>
                ) : (
                  <button
                    onClick={confirmarActa}
                    disabled={guardando || Object.values(asignaciones).filter(Boolean).length === 0}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-camarma-gold to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 disabled:from-slate-800 disabled:to-slate-800 text-slate-950 disabled:text-slate-500 font-black py-4.5 text-base rounded-2xl shadow-xl transition-all active:scale-[0.98] cursor-pointer select-none uppercase tracking-wider"
                  >
                    {guardando ? (
                      <>
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Actualizando estadísticas...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5 stroke-[3px]" />
                        Confirmar Acta y Actualizar Plantilla
                      </>
                    )}
                  </button>
                )}
              </div>

            </div>

          </div>
        </div>
      </div>

      {/* MODAL DE SELECCIÓN DE JUGADOR PARA UN SLOT */}
      {selectorSlot && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl max-h-[75vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-850">
              <h4 className="font-black text-white text-sm uppercase tracking-wide">Seleccionar Jugador</h4>
              <button
                onClick={() => setSelectorSlot(null)}
                className="text-slate-400 hover:text-white cursor-pointer p-1.5 rounded-lg hover:bg-slate-850 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 p-3 space-y-1">
              {jugadoresLibres.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">Todos los jugadores de la plantilla ya están asignados.</p>
              ) : (
                jugadoresLibres.map(jug => (
                  <button
                    key={jug.id}
                    onClick={() => selectorSlot === "suplente" ? tryAddSuplente(jug.id) : tryAsignarJugador(selectorSlot, jug.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-800/60 transition-colors cursor-pointer text-left group"
                  >
                    {jug.fotoUrl ? (
                      <img src={jug.fotoUrl} alt={jug.nombre} className="w-10 h-10 rounded-full object-cover border border-slate-800" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-850 flex items-center justify-center border border-slate-800">
                        <User className="w-5 h-5 text-slate-500 group-hover:text-slate-400 transition-colors" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-bold text-white group-hover:text-camarma-blue transition-colors">{jug.nombre}</p>
                      <p className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">{jug.posicion || (jug.isPortero ? "Portero" : "Jugador")}</p>
                    </div>
                  </button>
                ))
              )}
              
              {/* Desasignar si ya tenía jugador */}
              {selectorSlot !== "suplente" && asignaciones[selectorSlot] && (
                <div className="pt-2 px-1">
                  <button
                    onClick={() => { desasignarSlot(selectorSlot); setSelectorSlot(null); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-red-950/15 border border-dashed border-red-900/40 text-red-400 hover:bg-red-950/25 transition-all cursor-pointer font-bold text-xs"
                  >
                    <X className="w-4 h-4 text-red-400" />
                    Quitar jugador de esta posición
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ESTADÍSTICAS */}
      {modalSlot && jugadorIdModal && (
        <ModalJugadorActa
          jugador={getJugador(jugadorIdModal)}
          stats={statsJugadores[jugadorIdModal] || {}}
          jugadoresPlantilla={jugadores.filter(j => j.id !== jugadorIdModal)}
          motivoAusenciaInicial={matchAusencias[jugadorIdModal] || ""}
          onSave={(newStats, motivo) => guardarStats(jugadorIdModal, newStats, motivo)}
          onClose={() => setModalSlot(null)}
          onRemove={() => {
            if (modalSlot.startsWith("suplente_")) {
              removeSuplente(jugadorIdModal);
            } else {
              desasignarSlot(modalSlot);
            }
            setStatsJugadores(prev => {
              const newStats = { ...prev };
              delete newStats[jugadorIdModal];
              return newStats;
            });
            setModalSlot(null);
          }}
        />
      )}

      {/* Modal de Motivo de Ausencia al Partido */}
      {absenceModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Cabecera */}
            <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
              <div className="w-9 h-9 rounded-full bg-red-950/30 border border-red-900/30 flex items-center justify-center shrink-0">
                <span className="text-base">❌</span>
              </div>
              <div className="text-left font-sans">
                <h4 className="font-black text-white text-sm leading-tight">
                  Falta al Partido: {absenceModal.mode === 'add' ? 'Justificar' : 'Editar Motivo'}
                </h4>
                <span className="text-[10px] font-bold text-slate-400">{absenceModal.player.nombre}</span>
              </div>
            </div>

            {/* Cuerpo */}
            <div className="p-5 space-y-4 text-left font-sans">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Motivo de no asistencia</label>
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
                {["Falta injustificada", "Lesión", "Trabajo", "Viaje", "Enfermedad", "Decisión técnica"].map(opt => (
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

            {/* Pie */}
            <div className="px-5 pb-5 flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  const id = absenceModal.player.id;
                  setMatchFaltas(prev => prev.filter(fId => fId !== id));
                  setMatchAusencias(prev => {
                    const n = { ...prev };
                    delete n[id];
                    return n;
                  });
                  setAbsenceModal(null);
                }}
                className="flex items-center gap-1 bg-slate-850 hover:bg-slate-800 border border-dashed border-slate-700 text-emerald-400 hover:text-white font-extrabold text-xs py-2.5 px-3 rounded-xl cursor-pointer transition-all active:scale-95 uppercase tracking-wider"
                title="Marcar que sí asiste al encuentro"
              >
                ✔️ Asiste
              </button>
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
                  if (!matchFaltas.includes(id)) {
                    setMatchFaltas(prev => [...prev, id]);
                  }
                  setMatchAusencias(prev => ({ ...prev, [id]: absenceReasonInput.trim() }));
                  setAbsenceModal(null);
                }}
                className="bg-gradient-to-r from-red-700 to-red-800 hover:from-red-600 hover:to-red-700 text-white font-black text-xs py-2.5 px-5 rounded-xl cursor-pointer transition-all active:scale-95 uppercase tracking-wider shadow-md"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal personalizado para confirmar el alta médica */}
      {pendingDischarge && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Cabecera */}
            <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800 bg-slate-900">
              <div className="w-10 h-10 rounded-full bg-red-950/30 flex items-center justify-center border border-red-900/35 shadow-md">
                <span className="text-lg">🩹</span>
              </div>
              <div className="text-left font-sans">
                <h4 className="font-black text-white text-base leading-tight">Jugador Lesionado</h4>
                <span className="inline-block text-[9px] font-black uppercase text-red-400 tracking-widest mt-0.5">
                  Confirmación de Convocatoria
                </span>
              </div>
            </div>

            {/* Cuerpo */}
            <div className="p-6 space-y-4 text-left font-sans">
              <p className="text-sm text-slate-300 leading-relaxed">
                ¿Estás seguro de que quieres meter en la plantilla a <strong className="text-white">{pendingDischarge.player.nombre}</strong>?
              </p>
              <div className="bg-slate-950/40 border border-slate-850/60 p-3.5 rounded-2xl">
                <span className="block text-[9px] font-extrabold uppercase text-slate-500 mb-1">Estado Médico Activo</span>
                <p className="text-xs text-red-450 font-bold flex items-center gap-1.5">
                  ⚠️ {pendingDischarge.player.tipoLesion || "Lesión de evolución pendiente"} (Baja desde el {pendingDischarge.player.fechaBaja})
                </p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Al confirmar, se le dará <strong className="text-slate-200">de alta automáticamente</strong> con fecha de hoy, calculando su periodo de recuperación y archivando su historial clínico.
              </p>
            </div>

            {/* Pie */}
            <div className="p-6 border-t border-slate-800 bg-slate-950/20 flex gap-3">
              <button
                onClick={pendingDischarge.onCancel}
                className="flex-1 bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-750 text-slate-355 hover:text-white font-extrabold text-xs py-3.5 px-4 rounded-xl transition-all active:scale-95 cursor-pointer uppercase tracking-wider font-sans"
              >
                Cancelar
              </button>
              <button
                onClick={pendingDischarge.onConfirm}
                className="flex-1 bg-gradient-to-r from-camarma-gold to-yellow-600 hover:from-yellow-650 hover:to-yellow-700 text-slate-950 font-black text-xs py-3.5 px-4 rounded-xl transition-all active:scale-95 cursor-pointer uppercase tracking-wider font-sans shadow-lg shadow-camarma-gold/10"
              >
                Confirmar y Convocar
              </button>
            </div>
          </div>
        </div>
      )}
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
    </div>
  );
}
