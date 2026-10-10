import React, { useState, useRef } from "react";
import { db } from "../firebase";
import { collection, addDoc, updateDoc, doc } from "firebase/firestore";
import { UserPlus, Image, X, Loader2, Sparkles } from "lucide-react";

// Comprime y redimensiona la imagen usando Canvas para que quepa en Firestore (<1MB por documento)
const comprimirImagen = (file, maxWidth = 300, quality = 0.75) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Calcular nuevas dimensiones manteniendo proporción cuadrada
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

        // Exportar como JPEG comprimido en Base64
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

export default function AddPlayerForm({ onPlayerAdded, onClose }) {
  const [nombre, setNombre] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [posicion, setPosicion] = useState("Delantero");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const fileInputRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError("La imagen no debe superar los 10MB.");
        return;
      }
      setImageFile(file);
      // Mostrar previsualización inmediata con la imagen original
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      setError("");
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setError("Por favor, introduce el nombre del jugador.");
      return;
    }
    if (!fechaNacimiento) {
      setError("Por favor, selecciona la fecha de nacimiento.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      let fotoFinal = "";
      if (imageFile) {
        // 1. Comprimir y convertir la imagen a Base64 para guardarla en Firestore
        //    Sin usar Firebase Storage (plan gratuito)
        const fotoBase64 = await comprimirImagen(imageFile, 300, 0.75);

        // Verificar que el tamaño Base64 no supera ~750KB para ser seguro con Firestore
        if (fotoBase64.length > 750000) {
          // Si aún es grande, comprimir más agresivamente
          const fotoBase64Extra = await comprimirImagen(imageFile, 200, 0.6);
          if (fotoBase64Extra.length > 750000) {
            setError("La imagen es demasiado grande incluso comprimida. Selecciona una foto más pequeña.");
            setLoading(false);
            return;
          }
          fotoFinal = fotoBase64Extra;
        } else {
          fotoFinal = fotoBase64;
        }
      }

      // Determinar si es portero para compatibilidad en consultas
      const isPortero = posicion === "Portero";
      const timestamp = Date.now();

      // 2. Guardar todo el documento en Firestore (sin Storage)
      const newPlayerData = {
        nombre: nombre.trim(),
        fechaNacimiento: fechaNacimiento,
        posicion: posicion,
        isPortero: isPortero,
        fotoUrl: fotoFinal, // Base64 directamente en Firestore
        minutosJugados: 0,
        tarjetasAmarillas: 0,
        tarjetasRojas: 0,
        partidosConvocados: 0,
        golesFavor: 0,
        golesContra: 0,
        faltasEntrenamiento: 0,
        faltasPartido: 0,
        createdAt: timestamp,
      };

      const docRef = await addDoc(collection(db, "jugadores"), newPlayerData);
      
      // Actualizar el documento para incluir su propio ID de firestore
      await updateDoc(doc(db, "jugadores", docRef.id), {
        id: docRef.id
      });

      // Resetear campos
      setNombre("");
      setFechaNacimiento("");
      setPosicion("Delantero");
      setImageFile(null);
      setImagePreview(null);
      
      if (onPlayerAdded) {
        onPlayerAdded({ ...newPlayerData, id: docRef.id });
      }
    } catch (err) {
      console.error(err);
      setError("Error al guardar el jugador. Asegúrate de estar logueado y tener permisos en Firestore.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800 border border-slate-700/60 rounded-3xl p-6 shadow-2xl relative">
      
      {/* Encabezado del Formulario */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-camarma-gold animate-bounce" />
          <h3 className="text-lg font-bold text-white font-sans">
            Fichar Nuevo Jugador
          </h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-700 transition-colors cursor-pointer"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-red-200 text-sm">
            {error}
          </div>
        )}

        {/* Input de Nombre */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
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

        {/* Fecha de Nacimiento y Posición en Campo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
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

        {/* Selección y Previsualización de Imagen */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
            Foto del Jugador <span className="text-slate-400 font-normal lowercase">(opcional)</span>
          </label>
          
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageChange}
            className="hidden"
            disabled={loading}
          />

          {!imagePreview ? (
            <button
              type="button"
              onClick={() => fileInputRef.current.click()}
              className="w-full h-36 bg-slate-900 hover:bg-slate-900/60 border-2 border-dashed border-slate-700 hover:border-camarma-blue rounded-2xl flex flex-col items-center justify-center gap-2 transition-all group cursor-pointer"
              disabled={loading}
            >
              <Image className="w-8 h-8 text-slate-500 group-hover:text-camarma-blue transition-colors" />
              <span className="text-sm font-semibold text-slate-400 group-hover:text-white transition-colors">
                Subir foto desde la galería (opcional)
              </span>
              <span className="text-xs text-slate-600">
                Se comprimirá automáticamente
              </span>
            </button>
          ) : (
            <div className="relative w-full h-48 bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden flex items-center justify-center">
              <img
                src={imagePreview}
                alt="Vista previa"
                className="h-full w-auto object-cover max-w-full"
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 bg-slate-800/90 text-white hover:text-red-400 p-2 rounded-full shadow-md transition-colors cursor-pointer"
                disabled={loading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Botón de envío con control de carga */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-camarma-gold to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 disabled:from-slate-800 disabled:to-slate-800 text-slate-950 disabled:text-slate-500 font-bold py-4 px-6 rounded-2xl shadow-lg transition-all transform active:scale-[0.98] cursor-pointer"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Comprimiendo y guardando...
            </span>
          ) : (
            <>
              <UserPlus className="w-5 h-5" />
              Registrar Jugador
            </>
          )}
        </button>
      </form>
    </div>
  );
}
