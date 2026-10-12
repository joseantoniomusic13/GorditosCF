import React, { useState, useRef } from "react";
import {
  X,
  Database,
  Download,
  Upload,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  FileText,
  Users,
  Calendar,
  ClipboardList,
  Sparkles,
  RefreshCw,
  HardDrive
} from "lucide-react";
import {
  createDatabaseBackup,
  parseAndValidateBackupFile,
  restoreDatabaseBackup
} from "../utils/databaseBackup";

export default function DatabaseBackupModal({
  isOpen,
  onClose,
  jugadores = [],
  partidos = [],
  entrenamientos = [],
  temporadaConfig = null,
  showToast = () => {}
}) {
  const [activeTab, setActiveTab] = useState("export"); // "export" o "restore"

  // Estados de Exportación
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null); // { percent, label }
  const [lastExportSummary, setLastExportSummary] = useState(null);

  // Estados de Restauración
  const [restoreFile, setRestoreFile] = useState(null);
  const [parsedBackup, setParsedBackup] = useState(null);
  const [analyzingFile, setAnalyzingFile] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const [clearExisting, setClearExisting] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(null); // { percent, label }
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  // Manejador de Exportación
  const handleExport = async () => {
    setExporting(true);
    setExportProgress({ percent: 0, label: "Preparando exportación..." });
    try {
      const res = await createDatabaseBackup((progress) => {
        setExportProgress(progress);
      });
      setLastExportSummary(res);
      showToast("¡Copia de seguridad descargada correctamente!", "success");
    } catch (err) {
      console.error(err);
      showToast("Error al generar la copia: " + err.message, "error");
    } finally {
      setExporting(false);
    }
  };

  // Manejador de selección de archivo para restaurar
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFile(file);
    setRestoreError("");
    setParsedBackup(null);
    setRestoreSuccess(false);
    setConfirmText("");
    setAnalyzingFile(true);

    try {
      const result = await parseAndValidateBackupFile(file);
      setParsedBackup(result);
    } catch (err) {
      console.error(err);
      setRestoreError(err.message || "Error al leer el archivo de copia.");
    } finally {
      setAnalyzingFile(false);
    }
  };

  // Manejador de Restauración
  const handleRestore = async () => {
    if (!parsedBackup) return;
    if (confirmText.trim().toUpperCase() !== "RESTAURAR") {
      setRestoreError("Debes escribir la palabra RESTAURAR en mayúsculas para confirmar.");
      return;
    }

    setRestoring(true);
    setRestoreError("");
    setRestoreProgress({ percent: 0, label: "Iniciando restauración..." });

    try {
      const result = await restoreDatabaseBackup(
        parsedBackup.backupData,
        { clearExisting },
        (progress) => {
          setRestoreProgress(progress);
        }
      );

      setRestoreSuccess(true);
      showToast("¡Base de datos restaurada con éxito!", "success");
    } catch (err) {
      console.error(err);
      setRestoreError("Fallo en la restauración: " + err.message);
      showToast("Error en la restauración: " + err.message, "error");
    } finally {
      setRestoring(false);
    }
  };

  const isBusy = exporting || restoring || analyzingFile;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto flex flex-col max-h-[92vh]">
        {/* Encabezado */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-camarma-blue/20 rounded-2xl border border-camarma-blue/30 text-camarma-gold">
              <Database className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight uppercase">
                Copia de Seguridad Firestore
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
                Respaldo íntegro de la base de datos (jugadores, fotos, actas PDF, partidos y asistencias)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isBusy}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-all disabled:opacity-30 cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de Pestañas (Exportar vs Restaurar) */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 p-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("export")}
            disabled={isBusy}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === "export"
                ? "bg-camarma-blue text-white shadow-lg shadow-camarma-blue/25"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <Download className="w-4 h-4" />
            Descargar Copia
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("restore")}
            disabled={isBusy}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === "restore"
                ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <Upload className="w-4 h-4" />
            Restaurar Copia
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* ───────────────────────────────────────────────────────────── */}
          {/* PESTAÑA: DESCARGAR COPIA DE SEGURIDAD (EXPORTAR) */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeTab === "export" && (
            <div className="space-y-5">
              <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-4">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  ¿Qué incluye esta copia de seguridad?
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  Se genera un archivo <strong className="text-white">JSON estandarizado</strong> con el 100% de la información almacenada en Firebase Firestore, listo para restaurar en caso de fallo, pérdida de datos o cambio de cuenta.
                </p>

                {/* Resumen de datos actuales */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-2">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5">
                    <div className="text-lg font-black text-white">{jugadores.length}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 flex items-center justify-center gap-1">
                      <Users className="w-3 h-3 text-camarma-gold" /> Jugadores
                    </div>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5">
                    <div className="text-lg font-black text-white">{partidos.length}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 flex items-center justify-center gap-1">
                      <Calendar className="w-3 h-3 text-blue-400" /> Partidos
                    </div>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5">
                    <div className="text-lg font-black text-white">
                      {partidos.filter(p => p.hasPdfActa || (p.totalPdfChunks && p.totalPdfChunks > 0)).length}
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 flex items-center justify-center gap-1">
                      <FileText className="w-3 h-3 text-purple-400" /> Actas PDF
                    </div>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5">
                    <div className="text-lg font-black text-white">{entrenamientos.length}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 flex items-center justify-center gap-1">
                      <ClipboardList className="w-3 h-3 text-emerald-400" /> Entrenos
                    </div>
                  </div>
                </div>
              </div>

              {/* Barra de progreso de exportación */}
              {exporting && exportProgress && (
                <div className="bg-slate-950/70 border border-camarma-blue/40 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 text-camarma-gold animate-spin" />
                      {exportProgress.label}
                    </span>
                    <span className="font-mono font-bold text-camarma-gold">
                      {exportProgress.percent}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-camarma-blue to-camarma-gold h-full transition-all duration-300 rounded-full"
                      style={{ width: `${exportProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Mensaje de última copia completada */}
              {lastExportSummary && !exporting && (
                <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-emerald-300">
                      ¡Copia generada y descargada exitosamente!
                    </p>
                    <p className="text-slate-300 font-mono text-[11px]">
                      {lastExportSummary.fileName}
                    </p>
                    <p className="text-slate-400 text-[10.5px]">
                      Guarda este archivo en una memoria USB, Google Drive o en tu disco duro para tener siempre una copia segura.
                    </p>
                  </div>
                </div>
              )}

              {/* Botón de acción */}
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-camarma-blue via-blue-600 to-camarma-blue hover:from-blue-600 hover:to-camarma-blue text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 shadow-xl shadow-camarma-blue/20 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                {exporting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Generando Copia de Seguridad...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 text-camarma-gold" />
                    Descargar Copia de Seguridad Ahora
                  </>
                )}
              </button>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Consejo:</strong> Haz una copia semanal o antes de crear una nueva temporada. Las fotos y actas oficiales PDF en Base64 se incluyen íntegramente.
                </span>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* PESTAÑA: RESTAURAR COPIA DE SEGURIDAD (IMPORTAR) */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeTab === "restore" && (
            <div className="space-y-5">
              {/* Selector de Archivo */}
              <div
                onClick={() => !isBusy && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  restoreFile
                    ? "border-amber-500/60 bg-amber-500/5 hover:border-amber-400"
                    : "border-slate-700 bg-slate-950/40 hover:border-camarma-blue/60 hover:bg-slate-950/60"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.zip"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isBusy}
                />
                <HardDrive className={`w-8 h-8 mx-auto mb-2 ${restoreFile ? "text-amber-400" : "text-slate-500"}`} />
                <p className="text-xs sm:text-sm font-bold text-white mb-1">
                  {restoreFile ? restoreFile.name : "Selecciona o arrastra el archivo de copia (.json o .zip)"}
                </p>
                <p className="text-[11px] text-slate-400">
                  Formato compatible: GorditosCF_Backup_Firestore_*.json
                </p>
              </div>

              {/* Cargando validación */}
              {analyzingFile && (
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl text-center text-xs text-slate-300 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 text-camarma-gold animate-spin" />
                  Analizando y validando copia de seguridad...
                </div>
              )}

              {/* Error al leer el archivo */}
              {restoreError && (
                <div className="p-4 bg-red-950/30 border border-red-500/40 rounded-2xl text-xs text-red-300 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{restoreError}</span>
                </div>
              )}

              {/* Éxito de la restauración */}
              {restoreSuccess && (
                <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-2xl text-xs text-emerald-300 flex items-start gap-2.5">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold mb-1">¡Restauración completada con éxito!</strong>
                    <span>Todos los documentos han sido volcados en Firestore. La aplicación ya refleja los datos restaurados.</span>
                  </div>
                </div>
              )}

              {/* Resumen del archivo analizado y opciones de restauración */}
              {parsedBackup && !restoreSuccess && (
                <div className="space-y-4">
                  <div className="bg-slate-950/70 border border-amber-500/30 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4" /> Copia Válida de Gorditos C.F
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {parsedBackup.summary.exportedAt
                          ? `Exportada: ${new Date(parsedBackup.summary.exportedAt).toLocaleString("es-ES")}`
                          : "Fecha no disponible"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-2">
                        <div className="text-base font-black text-white">{parsedBackup.summary.totalJugadores}</div>
                        <div className="text-[9.5px] text-slate-400 font-bold uppercase">Jugadores</div>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-2">
                        <div className="text-base font-black text-white">{parsedBackup.summary.totalPartidos}</div>
                        <div className="text-[9.5px] text-slate-400 font-bold uppercase">Partidos</div>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-2">
                        <div className="text-base font-black text-white">{parsedBackup.summary.totalPartidosConPdf}</div>
                        <div className="text-[9.5px] text-slate-400 font-bold uppercase">Actas PDF</div>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-2">
                        <div className="text-base font-black text-white">{parsedBackup.summary.totalEntrenamientos}</div>
                        <div className="text-[9.5px] text-slate-400 font-bold uppercase">Entrenamientos</div>
                      </div>
                    </div>
                  </div>

                  {/* Modo de Restauración */}
                  <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                      Modo de Restauración:
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-xl hover:bg-slate-900/60 transition-colors">
                      <input
                        type="radio"
                        name="restoreMode"
                        checked={clearExisting}
                        onChange={() => setClearExisting(true)}
                        className="mt-0.5 accent-amber-500"
                        disabled={isBusy}
                      />
                      <div className="text-xs">
                        <strong className="text-white block font-semibold">
                          Restauración Limpia (Recomendado)
                        </strong>
                        <span className="text-slate-400 text-[11px]">
                          Borra los datos actuales y deja la base de datos exactamente en el estado que tenía al hacer la copia.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-xl hover:bg-slate-900/60 transition-colors">
                      <input
                        type="radio"
                        name="restoreMode"
                        checked={!clearExisting}
                        onChange={() => setClearExisting(false)}
                        className="mt-0.5 accent-amber-500"
                        disabled={isBusy}
                      />
                      <div className="text-xs">
                        <strong className="text-white block font-semibold">
                          Restauración Combinada / Segura
                        </strong>
                        <span className="text-slate-400 text-[11px]">
                          Sobrescribe los registros de la copia pero no borra registros creados posteriormente.
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Confirmación obligatoria por seguridad */}
                  <div className="bg-red-950/20 border border-red-500/30 rounded-2xl p-4 space-y-3">
                    <div className="flex items-start gap-2 text-red-300 text-xs">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Atención:</strong> Esta acción sobrescribirá la base de datos de producción con los datos de esta copia. Para confirmar, escribe la palabra <strong className="text-white bg-red-950/80 px-1.5 py-0.5 rounded border border-red-800">RESTAURAR</strong> a continuación:
                      </span>
                    </div>

                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="Escribe RESTAURAR"
                      disabled={isBusy}
                      className="w-full bg-slate-950 border border-red-800/60 focus:border-red-500 text-white rounded-xl px-4 py-2.5 text-xs uppercase tracking-widest outline-none font-bold"
                    />
                  </div>

                  {/* Barra de Progreso de Restauración */}
                  {restoring && restoreProgress && (
                    <div className="bg-slate-950/70 border border-amber-500/40 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                          {restoreProgress.label}
                        </span>
                        <span className="font-mono font-bold text-amber-400">
                          {restoreProgress.percent}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full transition-all duration-300 rounded-full"
                          style={{ width: `${restoreProgress.percent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Botón de Restaurar */}
                  <button
                    type="button"
                    onClick={handleRestore}
                    disabled={restoring || confirmText.trim().toUpperCase() !== "RESTAURAR"}
                    className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-amber-600 to-red-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 shadow-xl shadow-red-900/30 transition-all active:scale-[0.99] disabled:opacity-40 cursor-pointer"
                  >
                    {restoring ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Restaurando Base de Datos...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-white" />
                        Ejecutar Restauración de Firestore
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pie del Modal */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-[11px] text-slate-400">
          <span>C.D. Gorditos C.F • Firestore Backup Engine</span>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="text-slate-300 hover:text-white font-bold cursor-pointer disabled:opacity-30"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
