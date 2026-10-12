import React, { useState, useRef, useEffect } from "react";
import { db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { X, Image, Loader2, Save, UserCog } from "lucide-react";

// Reutilizamos la misma función de compresión de AddPlayerForm
const comprimirImagen = (file, maxWidth = 300, quality = 0.75) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxWidth) / height);
          height = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const base64 = canvas.toDataURL("image/jpeg", quality);
        resolve(base64);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function EditPlayerModal({ player, onClose }) {
  const [nombre, setNombre] = useState(player.nombre || "");
  const [dorsal, setDorsal] = useState(player.dorsal !== undefined && player.dorsal !== null ? String(player.dorsal) : "");
  const [fechaNacimiento, setFechaNacimiento] = useState(player.fechaNacimiento || "");
  const [posicion, setPosicion] = useState(player.posicion || "Delantero");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(player.fotoUrl || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef(null);

  // Cerrar con Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [loading, onClose]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("La imagen no debe superar los 10MB.");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
    setError("");
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setError("El nombre no puede estar vacío.");
      return;
    }
    if (!fechaNacimiento) {
      setError("Selecciona la fecha de nacimiento.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const updates = {
        nombre: nombre.trim(),
        dorsal: dorsal !== "" ? String(dorsal).trim() : "",
        fechaNacimiento,
        posicion,
        isPortero: posicion === "Portero",
      };

      // Solo actualizar foto si se eligió una nueva
      if (imageFile) {
        let fotoBase64 = await comprimirImagen(imageFile, 300, 0.75);
        if (fotoBase64.length > 750000) {
          fotoBase64 = await comprimirImagen(imageFile, 200, 0.6);
          if (fotoBase64.length > 750000) {
            setError("La imagen es demasiado grande. Elige una más pequeña.");
            setLoading(false);
            return;
          }
        }
        updates.fotoUrl = fotoBase64;
      } else if (!imagePreview) {
        // Si se eliminó la foto sin reemplazar, limpiarla
        updates.fotoUrl = "";
      }

      await updateDoc(doc(db, "jugadores", player.id), updates);
      setSuccess(true);
      setTimeout(() => onClose(), 900);
    } catch (err) {
      console.error(err);
      setError("Error al guardar cambios. Comprueba tu conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    // Overlay semitransparente
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
    >
      <div className="w-full max-w-md bg-slate-800 border border-slate-700/70 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700/60 bg-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-camarma-blue/20 rounded-xl">
              <UserCog className="w-5 h-5 text-camarma-blue" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white leading-tight">Editar Jugador</h2>
              <p className="text-[11px] text-slate-400 font-medium">{player.nombre}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-red-300 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-900/60 rounded-xl text-emerald-300 text-sm flex items-center gap-2">
              ✅ Cambios guardados correctamente
            </div>
          )}

          {/* Foto - Vista previa grande arriba */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Foto del Jugador <span className="text-slate-500 font-normal lowercase">(opcional)</span>
            </label>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageChange}
              className="hidden"
              disabled={loading}
            />

            {imagePreview ? (
              <div className="relative w-full h-44 bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden flex items-center justify-center">
                <img
                  src={imagePreview}
                  alt="Vista previa"
                  className="h-full w-auto object-cover max-w-full"
                />
                {/* Botones superpuestos */}
                <div className="absolute inset-0 bg-slate-950/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current.click()}
                    disabled={loading}
                    className="bg-camarma-blue text-white text-xs font-bold px-4 py-2 rounded-xl shadow cursor-pointer"
                  >
                    Cambiar foto
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    disabled={loading}
                    className="bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow cursor-pointer"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current.click()}
                className="w-full h-36 bg-slate-900 hover:bg-slate-900/60 border-2 border-dashed border-slate-700 hover:border-camarma-blue rounded-2xl flex flex-col items-center justify-center gap-2 transition-all group cursor-pointer"
                disabled={loading}
              >
                <Image className="w-8 h-8 text-slate-500 group-hover:text-camarma-blue transition-colors" />
                <span className="text-sm font-semibold text-slate-400 group-hover:text-white transition-colors">
                  Subir nueva foto
                </span>
                <span className="text-xs text-slate-600">Se comprimirá automáticamente</span>
              </button>
            )}
          </div>

          {/* Nombre y Dorsal */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Nombre del Jugador
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 focus:border-camarma-blue focus:ring-1 focus:ring-camarma-blue text-white rounded-xl px-4 py-3 text-base outline-none placeholder:text-slate-500"
                placeholder="Ej. Juan Pérez"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Dorsal <span className="text-slate-500 lowercase font-normal">(opc.)</span>
              </label>
              <input
                type="number"
                min="0"
                max="99"
                value={dorsal}
                onChange={(e) => setDorsal(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 focus:border-camarma-blue focus:ring-1 focus:ring-camarma-blue text-white rounded-xl px-4 py-3 text-base outline-none placeholder:text-slate-500"
                placeholder="Ej. 10"
                disabled={loading}
              />
            </div>
          </div>

          {/* Fecha nacimiento + Posición */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Fecha de Nacimiento
              </label>
              <input
                type="date"
                value={fechaNacimiento}
                onChange={(e) => setFechaNacimiento(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 focus:border-camarma-blue focus:ring-1 focus:ring-camarma-blue text-white rounded-xl px-4 py-3 text-base outline-none"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Posición
              </label>
              <select
                value={posicion}
                onChange={(e) => setPosicion(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 focus:border-camarma-blue focus:ring-1 focus:ring-camarma-blue text-white rounded-xl px-4 py-3.5 text-base outline-none"
                disabled={loading}
              >
                <option value="Delantero" className="bg-slate-900 text-white">⚽ Delantero</option>
                <option value="Centrocampista" className="bg-slate-900 text-white">🪄 Centrocampista</option>
                <option value="Defensa" className="bg-slate-900 text-white">🛡️ Defensa</option>
                <option value="Portero" className="bg-slate-900 text-white">🧤 Portero</option>
              </select>
            </div>
          </div>

          {/* Botón Guardar */}
          <button
            type="submit"
            disabled={loading || success}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-camarma-blue to-blue-700 hover:from-blue-600 hover:to-blue-800 disabled:from-slate-700 disabled:to-slate-700 text-white disabled:text-slate-500 font-bold py-4 px-6 rounded-2xl shadow-lg transition-all transform active:scale-[0.98] cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Guardando...
              </span>
            ) : success ? (
              <span>✅ Guardado</span>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Guardar Cambios
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
