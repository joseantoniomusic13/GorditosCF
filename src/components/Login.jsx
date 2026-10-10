import React, { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { checkIsAdmin } from "../config";
import { LogIn, ArrowLeft, ShieldAlert, Eye, EyeOff } from "lucide-react";

export default function Login({ onLoginSuccess, onBackToPublic }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Por favor, rellena todos los campos.");
      return;
    }

    setLoading(true);
    setError("");

    // Mapeo automático de nombres de usuario a correos electrónicos internos de Firebase
    const userClean = username.trim().toLowerCase();
    let email = "";
    let authPassword = password;
    
    if (userClean === "presidente") {
      email = "presidente@gorditoscf.com";
      if (password === "123") {
        authPassword = "presidente123"; // Firebase Auth requiere mínimo 6 caracteres
      }
    } else if (userClean === "admin") {
      email = "admin@gorditoscf.com";
      if (password === "123") {
        authPassword = "presidente123";
      }
    } else {
      setError("Usuario no reconocido. Utiliza 'presidente' o 'admin'.");
      setLoading(false);
      return;
    }

    try {
      // Iniciar sesión en Firebase Auth usando el correo interno mapeado
      const userCredential = await signInWithEmailAndPassword(auth, email, authPassword);
      const user = userCredential.user;

      // Validar si el UID está en la lista de administradores autorizados
      if (checkIsAdmin(user.uid)) {
        onLoginSuccess(user);
      } else {
        // Si no es administrador, cerrar sesión inmediatamente
        await signOut(auth);
        setError("Acceso denegado: tu cuenta no está autorizada para administrar el club.");
      }
    } catch (err) {
      console.error(err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        setError("Usuario o contraseña incorrectos.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Demasiados intentos fallidos. Por favor, inténtalo más tarde.");
      } else {
        setError("Ocurrió un error al iniciar sesión. Inténtalo de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 py-8">
      <div className="w-full max-w-md bg-slate-800/85 border border-slate-700/50 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
        
        {/* Adorno brillante de fondo */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-camarma-blue/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-camarma-gold/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Botón de volver */}
        <button
          onClick={onBackToPublic}
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a la web
        </button>

        {/* Encabezado */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative group mb-4">
            <div className="absolute inset-0 bg-gradient-to-tr from-camarma-blue/30 to-camarma-gold/30 rounded-full blur-xl opacity-60 scale-90 animate-pulse"></div>
            <img
              src="./escudo.jpg"
              alt="Escudo C.D. Gorditos C.F"
              className="relative w-24 h-24 md:w-28 md:h-28 object-contain drop-shadow-[0_8px_20px_rgba(30,58,138,0.4)] hover:scale-105 hover:rotate-3 transition-all duration-300"
            />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-sans">
            Acceso Directiva
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-[280px]">
            Panel de control exclusivo para el Presidente y Directiva del C.D. Gorditos C.F.
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-950/40 border border-red-900/60 rounded-2xl text-red-200 text-sm">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 focus:border-camarma-blue focus:ring-1 focus:ring-camarma-blue text-white rounded-2xl px-4 py-4 text-base transition-all outline-none placeholder:text-slate-500"
              placeholder="Ej. presidente"
              required
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className="relative">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 focus:border-camarma-blue focus:ring-1 focus:ring-camarma-blue text-white rounded-2xl pl-4 pr-12 py-4 text-base transition-all outline-none placeholder:text-slate-500"
                placeholder="••••••••"
                required
                disabled={loading}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-2 cursor-pointer"
                tabIndex="-1"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-camarma-blue to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-2xl shadow-lg transition-all transform active:scale-[0.98] cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Verificando...
              </span>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Acceder al Panel
              </>
            )}
          </button>
        </form>

        {/* Nota aclaratoria táctil */}
        <p className="text-center text-xs text-slate-500 mt-6 leading-relaxed">
          Acceso restringido para el Presidente y Directiva del C.D. Gorditos C.F.
        </p>
      </div>
    </div>
  );
}
