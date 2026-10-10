import React, { useState, useEffect } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { checkIsAdmin } from "./config";
import PublicView from "./components/PublicView";
import Login from "./components/Login";
import AdminPanel from "./components/AdminPanel";

export default function App() {
  const [currentView, setCurrentView] = useState("public"); // "public", "login", "admin"
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let isFirstLoad = true;
    // Escuchar el estado de autenticación de Firebase
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Validar si el usuario que ha iniciado sesión es administrador
        if (checkIsAdmin(firebaseUser.uid)) {
          setUser(firebaseUser);
          // Si el usuario entra o refresca la página estando logueado, le mandamos al panel administrativo al inicio
          if (isFirstLoad) {
            setCurrentView("admin");
          }
        } else {
          // Si no es administrador válido, cerramos sesión inmediatamente
          await signOut(auth);
          setUser(null);
          setCurrentView("public");
        }
      } else {
        setUser(null);
        // Si no está autenticado e intenta ver el admin, redirigir a pública
        setCurrentView((prev) => (prev === "admin" ? "public" : prev));
      }
      setInitializing(false);
      isFirstLoad = false;
    });

    return () => unsubscribe();
  }, []);

  if (initializing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white gap-6 relative overflow-hidden">
        {/* Glowing backdrop circle */}
        <div className="absolute w-64 h-64 bg-gradient-to-tr from-camarma-blue/20 to-camarma-gold/15 rounded-full blur-3xl animate-pulse"></div>
        
        <div className="relative group flex items-center justify-center">
          <div className="absolute w-36 h-36 bg-gradient-to-tr from-camarma-blue/30 to-camarma-gold/25 rounded-full blur-2xl animate-pulse"></div>
          <img
            src="./escudo.jpg"
            alt="C.D. Gorditos C.F Escudo"
            className="relative w-32 h-32 md:w-36 md:h-36 object-contain drop-shadow-[0_10px_25px_rgba(30,58,138,0.4)] hover:scale-105 duration-500 transition-transform"
          />
        </div>
        
        <div className="flex flex-col items-center gap-3 z-10">
          <div className="flex items-center gap-2.5 text-slate-300">
            <svg className="animate-spin h-5 w-5 text-camarma-gold" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="font-extrabold tracking-widest text-xs uppercase font-sans text-slate-300">Cargando Club...</span>
          </div>
          <span className="text-[10px] tracking-widest text-camarma-gold font-bold uppercase">#AúpaGorditos</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans antialiased">
      {currentView === "public" && (
        <PublicView
          onAdminClick={() => setCurrentView(user ? "admin" : "login")}
          isAdmin={!!user}
        />
      )}
      
      {currentView === "login" && (
        <Login
          onLoginSuccess={(usr) => {
            setUser(usr);
            setCurrentView("admin");
          }}
          onBackToPublic={() => setCurrentView("public")}
        />
      )}
      
      {currentView === "admin" && (
        <AdminPanel
          adminUser={user}
          onViewPublic={() => setCurrentView("public")}
          onLogout={() => {
            setUser(null);
            setCurrentView("public");
          }}
        />
      )}
    </div>
  );
}
