import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, query, orderBy, doc } from "firebase/firestore";
import { Shield, Calendar, Award, LogIn, Trophy, Clock, Heart, AlertCircle, ClipboardList, User, Activity, TrendingUp, X, ArrowLeftRight, MapPin } from "lucide-react";

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
      { id: "MCC", fill: "MCC", top: 50, left: 50 },
      { id: "MCI", label: "MCI", top: 52, left: 32 },
      { id: "CRI", label: "CRI", top: 52, left: 12 },
      { id: "DCD2",label: "DC D",top: 24, left: 65 },
      { id: "DCI2",label: "DC I",top: 24, left: 35 },
    ],
  },
};

export default function PublicView({ onAdminClick, isAdmin }) {
  const [activeTab, setActiveTab] = useState("stats"); // "stats", "calendario", "entrenamientos", "clasificacion"
  const [jugadores, setJugadores] = useState([]);
  const [partidos, setPartidos] = useState([]);
  const [entrenamientos, setEntrenamientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatchDetails, setSelectedMatchDetails] = useState(null);
  const [selectedTrainingDetails, setSelectedTrainingDetails] = useState(null);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [temporadaConfig, setTemporadaConfig] = useState(null); // { nombre, fechaInicio }

  // Helpers del calendario (solo lectura)
  const getDaysInMonth = (year, month) => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    const numDays = new Date(year, month + 1, 0).getDate();
    const numDaysPrev = new Date(year, month, 0).getDate();
    const days = [];
    for (let i = startOffset - 1; i >= 0; i--) {
      const prevDay = numDaysPrev - i;
      const prevMonth = month === 0 ? 12 : month;
      const prevYear = month === 0 ? year - 1 : year;
      days.push({ day: prevDay, isCurrentMonth: false, dateStr: `${prevYear}-${String(prevMonth).padStart(2,'0')}-${String(prevDay).padStart(2,'0')}` });
    }
    for (let i = 1; i <= numDays; i++) {
      days.push({ day: i, isCurrentMonth: true, dateStr: `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}` });
    }
    const totalCells = days.length <= 35 ? 35 : 42;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      const nextMonth = month === 11 ? 1 : month + 2;
      const nextYear = month === 11 ? year + 1 : year;
      days.push({ day: i, isCurrentMonth: false, dateStr: `${nextYear}-${String(nextMonth).padStart(2,'0')}-${String(i).padStart(2,'0')}` });
    }
    return days;
  };

  const getTrainingForDate = (dateStr) => entrenamientos.find(t => t.fecha === dateStr);

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
      console.error("Error cargando vista pública de jugadores: ", error);
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
      console.error("Error cargando vista pública de partidos: ", error);
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
      console.error("Error cargando vista pública de entrenamientos: ", error);
    });
    return () => unsubscribe();
  }, []);

  // Escuchar configuración de temporada activa
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "config", "temporada"), (snapshot) => {
      if (snapshot.exists()) {
        setTemporadaConfig(snapshot.data());
      } else {
        setTemporadaConfig(null);
      }
    }, (error) => {
      console.error("Error cargando config de temporada en vista pública: ", error);
    });
    return () => unsubscribe();
  }, []);

  // 1. Pichichi (Goleadores de campo ordenados por golesFavor descendiente)
  // Excluimos porteros de la tabla de pichichis a menos que hayan marcado un gol, pero por defecto los filtramos
  const pichichis = [...jugadores]
    .filter((j) => !j.isPortero || j.golesFavor > 0)
    .sort((a, b) => b.golesFavor - a.golesFavor);

  // 2. Zamora (Porteros ordenados por golesContra ascendente, requiere haber jugado minutos)
  const zamoras = [...jugadores]
    .filter((j) => j.isPortero)
    .sort((a, b) => a.golesContra - b.golesContra);

  // 3. Calendario (Partidos futuros)
  const calendario = partidos.filter((p) => !p.jugado);

  // 4. Resultados (Partidos jugados, ordenados de más reciente a más antiguo)
  const resultados = [...partidos]
    .filter((p) => p.jugado)
    .reverse();

  const exportMatchToPDF = (match) => {
    if (!match) return;

    // Helper para prioridad de posición
    const getPositionPriority = (pos) => {
      const p = (pos || "").toLowerCase();
      if (p.includes("portero") || p.includes("por")) return 1;
      if (p.includes("defensa") || p.includes("lateral") || p.includes("central") || p.includes("ld") || p.includes("li") || p.includes("dcd") || p.includes("dci")) return 2;
      if (p.includes("medio") || p.includes("centro") || p.includes("volante") || p.includes("mc") || p.includes("mcd") || p.includes("mci") || p.includes("mdv") || p.includes("mam")) return 3;
      if (p.includes("delantero") || p.includes("extremo") || p.includes("punta") || p.includes("dc") || p.includes("ed") || p.includes("ei") || p.includes("exd") || p.includes("exi")) return 4;
      return 5;
    };

    // Ordenar Titulares y Suplentes por posición
    const titularesIds = Object.values(match.alineacion?.asignaciones || {}).filter(Boolean);
    const suplentesIds = match.alineacion?.suplentes || [];

    const getPlayerWithStats = (id, esTitular) => {
      const p = jugadores.find(j => j.id === id);
      const stats = match.statsJugadores?.[id] || { minutos: 0, goles: 0, golesContra: 0, asistencias: 0, amarillas: 0, rojas: 0, convocado: false };
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
        isPortero: p ? (p.isPortero || p.posicion === "Portero") : false
      };
    };

    const titularesSorted = titularesIds
      .map(id => getPlayerWithStats(id, true))
      .sort((a, b) => a.prioridad - b.prioridad);

    const suplentesSorted = suplentesIds
      .map(id => getPlayerWithStats(id, false))
      .sort((a, b) => a.prioridad - b.prioridad);

    const allPlayersReport = [...titularesSorted, ...suplentesSorted];

    // Construir tabla HTML
    const rowsHtml = allPlayersReport.map(r => `
      <tr>
        <td><strong>${r.nombre}</strong></td>
        <td class="text-slate-500">${r.posicion}</td>
        <td class="text-center font-bold">${r.tipo}</td>
        <td class="text-center">${r.minutos}'</td>
        <td class="text-center font-semibold text-emerald-600">${r.isPortero ? `${r.golesContra} (Recibidos)` : (r.goles > 0 ? `⚽ ${r.goles}` : "-")}</td>
        <td class="text-center">${r.asistencias > 0 ? `👟 ${r.asistencias}` : "-"}</td>
        <td class="text-center">${r.amarillas > 0 ? Array.from({ length: r.amarillas }).map(() => "🟨").join("") : ""}</td>
        <td class="text-center">${r.rojas > 0 ? "🟥" : ""}</td>
      </tr>
    `).join("");

    const mvpPlayer = jugadores.find(j => j.id === match.mvpJugadorId);

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
          <div class="header">
            <h1 class="title">Acta Oficial de Partido</h1>
            <div class="subtitle">C.D. Gorditos C.F • Temporada de Competición</div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <strong>Partido:</strong> ${match.condicion === "visitante" ? `${match.rival} vs C.D. Gorditos C.F` : `C.D. Gorditos C.F vs ${match.rival}`}<br/>
              <strong>Condición:</strong> ${match.condicion === "visitante" ? "✈️ Visitante" : "🏠 Local"}<br/>
              <strong>Fecha:</strong> ${new Date(match.fecha + "T00:00:00").toLocaleDateString("es-ES", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div class="meta-item">
              <strong>Resultado:</strong> ${match.condicion === "visitante" ? `${match.golesRival} - ${match.golesGorditos ?? match.golesCamarma}` : `${match.golesGorditos ?? match.golesCamarma} - ${match.golesRival}`}<br/>
              <strong>Formación táctica:</strong> ${match.alineacion?.formacion || "N/A"}<br/>
              <strong>Estado:</strong> Finalizado
            </div>
          </div>

          ${mvpPlayer ? `
            <div class="mvp-box">
              🌟 <strong>MVP del Encuentro:</strong> ${mvpPlayer.nombre} (${mvpPlayer.posicion || "Jugador"})
            </div>
          ` : ""}

          ${match.cronica ? `
            <div class="section-title">Crónica del Míster</div>
            <div class="cronica">
              "${match.cronica}"
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
    <div className="flex-1 bg-slate-900 text-slate-100 flex flex-col min-h-screen">
      
      {/* Hero / Header principal elegante */}
      <header className="relative bg-gradient-to-b from-slate-800/80 to-slate-900 border-b border-slate-850 px-4 py-8 flex flex-col items-center justify-center text-center shadow-xl">
        {/* Luces de fondo deportivas */}
        <div className="absolute top-0 w-full max-w-4xl h-48 bg-gradient-to-r from-camarma-blue/30 via-blue-500/15 to-camarma-gold/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Botón Acceso Directiva en esquina superior derecha */}
        <button
          onClick={onAdminClick}
          className="absolute top-4 right-4 flex items-center gap-2 bg-slate-900/80 hover:bg-camarma-blue hover:text-white border border-slate-700/80 hover:border-camarma-blue px-3 py-2 rounded-xl text-xs font-bold text-slate-400 transition-all cursor-pointer shadow-md active:scale-95"
        >
          {isAdmin ? (
            <>
              <Shield className="w-4 h-4 text-camarma-gold" />
              <span>Panel Directiva</span>
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              <span>Directiva</span>
            </>
          )}
        </button>

        {/* Escudo y Nombre del Club */}
        <div className="relative group mb-4">
          <div className="absolute inset-0 bg-gradient-to-tr from-camarma-blue/35 via-blue-500/20 to-camarma-gold/30 rounded-full blur-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-500 scale-90 animate-pulse"></div>
          <img
            src="./escudo.jpg"
            alt="C.D. Gorditos C.F Escudo"
            className="relative w-32 h-32 md:w-36 md:h-36 object-contain hover:scale-105 hover:rotate-3 transition-all duration-500 drop-shadow-[0_10px_25px_rgba(0,0,0,0.4)] cursor-pointer"
          />
        </div>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white font-sans uppercase">
          C.D. Gorditos <span className="text-camarma-gold">C.F</span>
        </h1>
        <p className="text-slate-400 mt-2 text-sm md:text-base max-w-md font-medium tracking-wide">
          Portal Oficial de Estadísticas, Resultados y Calendario de Partidos.
        </p>

        {/* Slogan del club */}
        <span className="mt-4 px-3 py-1 bg-camarma-blue/10 border border-camarma-blue/20 text-xs font-semibold tracking-widest text-camarma-blue-light uppercase rounded-full">
          #¡AúpaGorditos!
        </span>

        {/* Badge temporada activa */}
        {temporadaConfig?.nombre && (
          <span className="mt-2 px-4 py-1.5 bg-camarma-gold/10 border border-camarma-gold/30 text-xs font-black tracking-widest text-camarma-gold uppercase rounded-full flex items-center gap-1.5 animate-in fade-in duration-500">
            <span className="w-1.5 h-1.5 bg-camarma-gold rounded-full animate-pulse" />
            Temporada {temporadaConfig.nombre}
          </span>
        )}
      </header>

      {/* Selector de pestañas público */}
      <div className="bg-slate-800/95 border-b border-slate-700/60 backdrop-blur-md sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto px-4 flex justify-center sm:justify-start gap-1 p-2">
          <button
            onClick={() => setActiveTab("stats")}
            className={`flex items-center gap-2 py-3 px-5 rounded-xl text-sm font-bold transition-all cursor-pointer select-none ${
              activeTab === "stats"
                ? "bg-camarma-blue text-white shadow-md shadow-camarma-blue/10"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Trophy className="w-4 h-4 text-camarma-gold" />
            Estadísticas
          </button>
          <button
            onClick={() => setActiveTab("calendario")}
            className={`flex items-center gap-2 py-3 px-5 rounded-xl text-sm font-bold transition-all cursor-pointer select-none ${
              activeTab === "calendario"
                ? "bg-camarma-blue text-white shadow-md shadow-camarma-blue/10"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Calendar className="w-4 h-4 text-camarma-gold" />
            Calendario
          </button>
          <button
            onClick={() => setActiveTab("entrenamientos")}
            className={`flex items-center gap-2 py-3 px-5 rounded-xl text-sm font-bold transition-all cursor-pointer select-none ${
              activeTab === "entrenamientos"
                ? "bg-camarma-blue text-white shadow-md shadow-camarma-blue/10"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ClipboardList className="w-4 h-4 text-camarma-gold" />
            Entrenamientos
          </button>
          <button
            onClick={() => setActiveTab("clasificacion")}
            className={`flex items-center gap-2 py-3 px-5 rounded-xl text-sm font-bold transition-all cursor-pointer select-none ${
              activeTab === "clasificacion"
                ? "bg-camarma-blue text-white shadow-md shadow-camarma-blue/10"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Award className="w-4 h-4 text-camarma-gold" />
            Clasificación
          </button>
        </div>
      </div>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        
        {/* PESTAÑA: ESTADÍSTICAS */}
        {activeTab === "stats" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Pichichi Leaderboard */}
            <div className="bg-slate-800/65 border border-slate-700/50 rounded-3xl overflow-hidden shadow-xl backdrop-blur-md">
              <div className="bg-gradient-to-r from-slate-850 to-camarma-blue/20 px-6 py-5 border-b border-slate-700/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Trophy className="w-6 h-6 text-camarma-gold" />
                  <h3 className="text-base sm:text-lg font-extrabold text-white font-sans uppercase tracking-wider">
                    Tabla Pichichi
                  </h3>
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-900/80 px-3 py-1 rounded-full border border-slate-700/60">
                  Goles
                </span>
              </div>

              {loading ? (
                <div className="p-12 flex justify-center">
                  <svg className="animate-spin h-8 w-8 text-camarma-gold" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : pichichis.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No hay goleadores registrados.</div>
              ) : (
                <div className="divide-y divide-slate-800/60">
                  {pichichis.map((player, idx) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between px-6 py-4 hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <span className={`w-6 text-center font-bold text-sm shrink-0 ${
                          idx === 0 ? "text-camarma-gold text-lg" : idx === 1 ? "text-slate-300" : idx === 2 ? "text-amber-600" : "text-slate-500"
                        }`}>
                          {idx + 1}
                        </span>
                        
                        <img
                          src={player.fotoUrl || "/placeholder-player.png"}
                          alt={player.nombre}
                          className="w-12 h-12 rounded-full object-cover border border-slate-700 shrink-0"
                        />
                        
                        <div className="min-w-0">
                          <h4 className="font-bold text-white font-sans text-sm md:text-base leading-tight truncate">
                            {player.nombre}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {calcularEdad(player.fechaNacimiento)} años • {player.posicion || (player.isPortero ? "Portero" : "Jugador de Campo")} • Convocado: {player.partidosConvocados || 0}
                          </p>
                          {player.mvps > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full mt-1 select-none">
                              🌟 MVP {player.mvps}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                        <div className="text-center min-w-[45px] sm:min-w-[50px] bg-slate-900/80 p-1.5 sm:p-2 rounded-xl border border-slate-700/80">
                          <span className="block text-[8px] uppercase font-bold text-slate-500">Goles</span>
                          <strong className="text-sm sm:text-base font-extrabold text-white font-sans">
                            {player.golesFavor}
                          </strong>
                        </div>

                        <div className="text-center min-w-[45px] sm:min-w-[50px] bg-slate-900/80 p-1.5 sm:p-2 rounded-xl border border-slate-700/80">
                          <span className="block text-[8px] uppercase font-bold text-slate-500">Asist.</span>
                          <strong className="text-sm sm:text-base font-extrabold text-white font-sans">
                            {player.asistencias || 0}
                          </strong>
                        </div>
                        
                        <div className="hidden sm:block text-center min-w-[50px]">
                          <span className="block text-[8px] uppercase font-bold text-slate-500">Minutos</span>
                          <span className="text-xs font-semibold text-slate-400 font-sans">
                            {player.minutosJugados || 0}'
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Zamora Leaderboard (Porteros) */}
            {zamoras.length > 0 && (
              <div className="bg-slate-800/65 border border-slate-700/50 rounded-3xl overflow-hidden shadow-xl backdrop-blur-md">
                <div className="bg-gradient-to-r from-slate-850 to-camarma-gold/15 px-6 py-5 border-b border-slate-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Award className="w-6 h-6 text-camarma-gold" />
                    <h3 className="text-base sm:text-lg font-extrabold text-white font-sans uppercase tracking-wider">
                      Trofeo Zamora
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-900/80 px-3 py-1 rounded-full border border-slate-700/60">
                    Recibidos
                  </span>
                </div>
                
                <div className="divide-y divide-slate-800/60">
                  {zamoras.map((player, idx) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between px-6 py-4 hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <span className="w-6 text-center font-bold text-sm text-slate-400 shrink-0">
                          {idx + 1}
                        </span>
                        <img
                          src={player.fotoUrl || "/placeholder-player.png"}
                          alt={player.nombre}
                          className="w-12 h-12 rounded-full object-cover border border-slate-700 shrink-0"
                        />
                        <div className="min-w-0">
                          <h4 className="font-bold text-white font-sans text-sm md:text-base leading-tight truncate">
                            {player.nombre}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {calcularEdad(player.fechaNacimiento)} años • {player.posicion || (player.isPortero ? "Portero" : "Jugador de Campo")} • Convocado: {player.partidosConvocados || 0}
                          </p>
                          {player.mvps > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full mt-1 select-none">
                              🌟 MVP {player.mvps}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                        <div className="text-center min-w-[55px] sm:min-w-[60px] bg-slate-900/80 p-1.5 sm:p-2 rounded-xl border border-slate-700/80">
                          <span className="block text-[8px] uppercase font-bold text-slate-500">Recibidos</span>
                          <strong className="text-sm sm:text-base font-extrabold text-red-400 font-sans">
                            {player.golesContra || 0}
                          </strong>
                        </div>
                        
                        <div className="hidden sm:block text-center min-w-[50px]">
                          <span className="block text-[8px] uppercase font-bold text-slate-500 font-sans">Minutos</span>
                          <span className="text-xs font-semibold text-slate-400">
                            {player.minutosJugados || 0}'
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
          
          {/* Nuevas Secciones de Control Total: Parte Médico y Dashboard Analítico */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
            {/* Enfermería / Parte Médico */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-md flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider mb-4 border-b border-slate-700/60 pb-3 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-red-500 animate-pulse" />
                  Parte Médico / Enfermería
                </h3>

                {jugadores.filter(j => j.lesionado).length === 0 ? (
                  <div className="text-center py-10 bg-slate-900/40 rounded-2xl border border-slate-800/40 text-slate-400 text-sm">
                    <span className="block text-2xl mb-2">💪</span>
                    Plantilla al 100%. No hay bajas médicas en este momento.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {jugadores.filter(j => j.lesionado).map(player => (
                      <div
                        key={player.id}
                        className="bg-slate-905/60 border border-slate-800/60 rounded-2xl p-4 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          {player.fotoUrl ? (
                            <img src={player.fotoUrl} alt={player.nombre} className="w-10 h-10 rounded-full object-cover border border-slate-700 shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0">
                              <User className="w-5 h-5 text-slate-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-white leading-tight truncate">{player.nombre}</h4>
                            <div className="text-xs text-amber-500 mt-1 flex items-center gap-1 font-medium">
                              <span>🤕 Baja:</span>
                              <span className="truncate text-slate-350 font-normal">{player.tipoLesion || "Molestias físicas"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 rounded-lg uppercase tracking-wide">
                            {player.fechaRecuperacion === "pendiente" ? (
                              "Pendiente de evolución"
                            ) : player.fechaRecuperacion ? (
                              `Retorno: ${new Date(player.fechaRecuperacion + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`
                            ) : (
                              "En observación"
                            )}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Estadísticas de Rendimiento */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-md">
              <h3 className="text-base font-bold text-white uppercase tracking-wider mb-4 border-b border-slate-700/60 pb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-camarma-gold" />
                Estadísticas y Rendimiento
              </h3>

              {(() => {
                const played = partidos.filter(p => p.jugado);
                const getGoles = p => Number(p.golesGorditos ?? p.golesCamarma ?? 0);
                const wins = played.filter(p => getGoles(p) > p.golesRival).length;
                const draws = played.filter(p => getGoles(p) === p.golesRival).length;
                const losses = played.filter(p => getGoles(p) < p.golesRival).length;
                const winRate = played.length ? Math.round((wins / played.length) * 100) : 0;
                const goalsScored = played.reduce((acc, p) => acc + getGoles(p), 0);
                const goalsConceded = played.reduce((acc, p) => acc + Number(p.golesRival || 0), 0);
                const cleanSheets = played.filter(p => Number(p.golesRival || 0) === 0).length;

                const totalPossible = entrenamientos.length * jugadores.length;
                const totalAbsences = entrenamientos.reduce((acc, t) => acc + (t.faltas ? t.faltas.length : 0), 0);
                const attendanceRate = totalPossible > 0 ? Math.round(((totalPossible - totalAbsences) / totalPossible) * 100) : 100;

                return (
                  <div className="space-y-5">
                    {/* Asistencia Media a Entrenamientos */}
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1.5">
                        <span className="text-slate-300">Asistencia a Entrenamientos</span>
                        <span className="text-camarma-gold font-bold">{attendanceRate}%</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-750">
                        <div
                          className="bg-gradient-to-r from-camarma-blue-light to-camarma-gold h-full rounded-full transition-all duration-1000"
                          style={{ width: `${attendanceRate}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Porcentaje de Victorias */}
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1.5">
                        <span className="text-slate-300">Porcentaje de Victorias</span>
                        <span className="text-emerald-400 font-bold">{winRate}%</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-750">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-1000"
                          style={{ width: `${winRate}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Grid de Stats Rápidas */}
                    <div className="grid grid-cols-3 gap-3 pt-2">
                      <div className="bg-slate-905/60 border border-slate-800/60 p-3 rounded-2xl text-center">
                        <span className="block text-[8px] font-extrabold uppercase text-slate-500 tracking-wider">
                          Goles a Favor
                        </span>
                        <strong className="text-lg font-black text-white block mt-1">
                          {goalsScored}
                        </strong>
                      </div>
                      <div className="bg-slate-905/60 border border-slate-800/60 p-3 rounded-2xl text-center">
                        <span className="block text-[8px] font-extrabold uppercase text-slate-500 tracking-wider">
                          Goles en Contra
                        </span>
                        <strong className="text-lg font-black text-red-400 block mt-1">
                          {goalsConceded}
                        </strong>
                      </div>
                      <div className="bg-slate-905/60 border border-slate-800/60 p-3 rounded-2xl text-center">
                        <span className="block text-[8px] font-extrabold uppercase text-slate-500 tracking-wider">
                          Porterías Cero
                        </span>
                        <strong className="text-lg font-black text-emerald-400 block mt-1">
                          {cleanSheets}
                        </strong>
                      </div>
                    </div>

                    {/* Resumen partidos */}
                    <div className="text-[10px] text-slate-500 text-center pt-2 border-t border-slate-800/40">
                      Resumen de {played.length} partidos oficiales: {wins} victorias, {draws} empates, {losses} derrotas
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA: CALENDARIO Y RESULTADOS */}
        {activeTab === "calendario" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Banner enlace oficial LaPreferente */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800/90 to-slate-900 border border-camarma-gold/30 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase text-camarma-gold tracking-widest block mb-1">
                  Competición Oficial
                </span>
                <h3 className="text-base sm:text-lg font-black text-white">
                  Calendario, Resultados y Ficha en LaPreferente
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  C.D. Gorditos C.F. No Federado · Temporada 2026/2027
                </p>
              </div>
              <a
                href="https://www.lapreferente.com/E55455/cd-gorditos-cf-no-federado"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-camarma-gold to-yellow-600 hover:from-yellow-500 hover:to-camarma-gold text-slate-950 font-black text-xs py-3 px-5 rounded-2xl transition-all active:scale-95 shadow-md shadow-camarma-gold/20 shrink-0 uppercase tracking-wider cursor-pointer"
              >
                <span>Ver en LaPreferente</span>
                <span>↗</span>
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Calendario de Partidos (Próximos) */}
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-md">
                <h3 className="text-base font-bold text-white uppercase tracking-wider mb-4 border-b border-slate-700/60 pb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-camarma-gold" />
                Próximos Partidos
              </h3>

              {calendario.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-10 bg-slate-900/40 rounded-2xl border border-slate-700/50">No hay partidos pendientes programados.</p>
              ) : (
                <div className="space-y-4">
                  {calendario.map((match) => (
                    <div
                      key={match.id}
                      className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="bg-slate-800 border border-slate-700 p-2.5 rounded-xl text-center min-w-[62px] shrink-0">
                          <span className="block text-[9px] font-bold text-camarma-gold uppercase leading-none">
                            {new Date(match.fecha + "T00:00:00").toLocaleDateString("es-ES", { month: "short" })}
                          </span>
                          <span className="block text-lg font-black text-white leading-none mt-1">
                            {new Date(match.fecha + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric" })}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[9px] bg-slate-800 border border-slate-700/40 px-1.5 py-0.5 rounded text-slate-400 font-bold uppercase tracking-wide">
                              {match.condicion === "visitante" ? "✈️ Visitante" : "🏠 Local"}
                            </span>
                            {match.tipoPartido && (
                              <span className="text-[9px] bg-camarma-blue/10 border border-camarma-blue/20 px-1.5 py-0.5 rounded text-camarma-blue-light font-bold uppercase tracking-wide">
                                🏆 {match.tipoPartido} {match.tipoPartido === "Liga" && match.jornada ? ` - J. ${match.jornada}` : ""}
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm sm:text-base font-bold text-white leading-tight mt-1.5 truncate">
                            {match.condicion === "visitante" 
                              ? `${match.rival} vs C.D. Gorditos C.F` 
                              : `C.D. Gorditos C.F vs ${match.rival}`}
                          </h4>
                          {match.hora && (
                            <p className="text-[10px] text-slate-500 mt-0.5">⏱️ Hora: {match.hora}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Últimos Resultados */}
            <div className="bg-slate-800/65 border border-slate-700/50 rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-md">
              <h3 className="text-base font-bold text-white uppercase tracking-wider mb-4 border-b border-slate-700/60 pb-3 flex items-center gap-2">
                <Award className="w-5 h-5 text-camarma-gold" />
                Últimos Resultados
              </h3>

              {resultados.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-10 bg-slate-900/40 rounded-2xl border border-slate-800/60">Aún no se han disputado partidos esta temporada.</p>
              ) : (
                <div className="space-y-4">
                  {resultados.map((match) => (
                    <div
                      key={match.id}
                      className="bg-slate-900/60 border border-slate-800/50 rounded-2xl p-4 flex flex-col gap-3"
                    >
                      {/* Fecha */}
                      <div className="flex justify-between items-center text-xs text-slate-500">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>
                            {new Date(match.fecha + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long" })}
                          </span>
                          {match.tipoPartido && (
                            <span className="text-[8px] font-bold bg-camarma-blue/10 text-camarma-blue-light border border-camarma-blue/20 px-1.5 py-0.2 rounded uppercase">
                              {match.tipoPartido} {match.tipoPartido === "Liga" && match.jornada ? ` - J. ${match.jornada}` : ""}
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] font-bold bg-emerald-950/50 text-emerald-400 border border-emerald-900/50 px-1.5 py-0.5 rounded uppercase">
                          Finalizado
                        </span>
                      </div>

                      {/* Marcador */}
                      <div className="flex items-center justify-between bg-slate-805/50 p-3 rounded-xl border border-slate-800/30">
                        {match.condicion === "visitante" ? (
                          <>
                            {/* Visitante: Rival es Local, Gorditos es Visitante */}
                            <span className="text-xs sm:text-sm font-bold text-slate-400 truncate max-w-[120px]">{match.rival}</span>
                            
                            <div className="flex items-center gap-2 font-black text-sm sm:text-base shrink-0 mx-2">
                              <span className={`text-white px-2.5 py-1 rounded bg-slate-900`}>
                                {match.golesRival}
                              </span>
                              <span className="text-slate-650">-</span>
                              <span className={`text-white px-2.5 py-1 rounded bg-camarma-blue`}>
                                {match.golesGorditos ?? match.golesCamarma}
                              </span>
                            </div>

                            <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[120px] text-right">C.D. Gorditos C.F</span>
                          </>
                        ) : (
                          <>
                            {/* Local: Gorditos es Local, Rival es Visitante */}
                            <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[120px]">C.D. Gorditos C.F</span>
                            
                            <div className="flex items-center gap-2 font-black text-sm sm:text-base shrink-0 mx-2">
                              <span className={`text-white px-2.5 py-1 rounded bg-camarma-blue`}>
                                {match.golesGorditos ?? match.golesCamarma}
                              </span>
                              <span className="text-slate-655">-</span>
                              <span className={`text-white px-2.5 py-1 rounded bg-slate-900`}>
                                {match.golesRival}
                              </span>
                            </div>

                            <span className="text-xs sm:text-sm font-bold text-slate-400 truncate max-w-[120px] text-right">{match.rival}</span>
                          </>
                        )}
                      </div>

                      {/* Botón Ver Detalle */}
                      {match.actaGuardada && (
                        <button
                          onClick={() => setSelectedMatchDetails(match)}
                          className="w-full bg-slate-850 hover:bg-camarma-blue/90 hover:text-white border border-slate-750 hover:border-camarma-blue py-2 rounded-xl text-xs font-bold text-slate-350 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98] shadow-sm select-none"
                        >
                          <ClipboardList className="w-4 h-4 text-camarma-gold" />
                          Ver Detalle / Alineación
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

        {/* PESTAÑA: ENTRENAMIENTOS */}
        {activeTab === "entrenamientos" && (
          <div className="space-y-6 animate-in fade-in duration-300">

            {/* Cabecera informativa */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-3xl p-5 shadow-xl backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-camarma-gold" />
                  Entrenamientos Oficiales
                </h3>
                <p className="text-xs text-slate-400">Calendario de entrenamientos y control de asistencia del equipo.</p>
              </div>
              <div className="shrink-0 bg-slate-900/60 px-4 py-2.5 rounded-2xl border border-slate-800/50 text-center">
                <span className="text-[10px] font-extrabold uppercase text-camarma-gold tracking-widest block mb-0.5">Nota</span>
                <p className="text-[11px] text-slate-400 italic">"La asistencia es clave para las convocatorias."</p>
              </div>
            </div>

            {/* Calendario de solo lectura */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-3xl p-5 shadow-xl backdrop-blur-md space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/40 pb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  📅 Calendario de Entrenamientos
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                    className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 rounded-xl cursor-pointer active:scale-95 transition-all text-xs font-bold"
                  >◀</button>
                  <span className="text-xs font-bold text-white uppercase min-w-[130px] text-center capitalize">
                    {calendarDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
                  </span>
                  <button
                    onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                    className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 rounded-xl cursor-pointer active:scale-95 transition-all text-xs font-bold"
                  >▶</button>
                </div>
              </div>

              {/* Leyenda */}
              <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-400 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-camarma-blue/15 border border-camarma-blue rounded" />
                  <span>Sesión Registrada</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base leading-none">⚽</span>
                  <span>Partido</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-slate-950/20 border border-slate-800 rounded" />
                  <span>Día Libre</span>
                </div>
              </div>

              {/* Cabecera días de la semana */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 mb-2">
                <div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div><div>Dom</div>
              </div>

              {/* Grid días */}
              <div className="grid grid-cols-7 gap-1.5">
                {getDaysInMonth(calendarDate.getFullYear(), calendarDate.getMonth()).map((cell, idx) => {
                  const session = getTrainingForDate(cell.dateStr);
                  const partido = cell.dateStr ? partidos.find(p => p.fecha === cell.dateStr) : null;

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

                  // Celda partido con resultado
                  if (partidoInfo?.played) {
                    return (
                      <div
                        key={idx}
                        className="relative rounded-2xl overflow-hidden border border-slate-700/60 select-none"
                        style={{ aspectRatio: '1 / 1' }}
                      >
                        <img src={partidoInfo.img} alt={partidoInfo.label} className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/80" />
                        <div className="relative z-10 flex flex-col justify-between h-full p-1.5">
                          <span className="text-[10px] font-extrabold text-white/90 drop-shadow">{cell.day}</span>
                          <div className="text-center">
                            <div className="text-[11px] font-black text-white drop-shadow leading-none">{partidoInfo.scoreDisplay}</div>
                            <div className={`text-[7px] font-black uppercase tracking-wider drop-shadow mt-0.5 ${partidoInfo.labelColor}`}>{partidoInfo.label}</div>
                          </div>
                        </div>
                        {session && (
                          <div className="absolute top-1 right-1 z-10">
                            <img src="./escudo.jpg" alt="" className="w-4 h-4 object-contain opacity-80" />
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Celda partido pendiente
                  if (partidoInfo && !partidoInfo.played) {
                    return (
                      <div
                        key={idx}
                        className="relative aspect-square rounded-2xl flex flex-col justify-between p-2 border border-slate-600/60 bg-slate-850/40 text-slate-300 select-none"
                      >
                        <span className="text-[10px] font-extrabold">{cell.day}</span>
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-base leading-none">⚽</span>
                          <span className="text-[7px] font-black uppercase text-slate-400 truncate max-w-full text-center leading-tight">{partidoInfo.rival}</span>
                        </div>
                      </div>
                    );
                  }

                  // Celdas normales
                  let cellClasses = "relative aspect-square rounded-2xl flex flex-col justify-between p-2 border text-left select-none ";
                  if (!cell.isCurrentMonth) {
                    cellClasses += "opacity-35 bg-slate-900/20 border-slate-850 text-slate-600";
                  } else if (session) {
                    cellClasses += "bg-camarma-blue/10 border-camarma-blue/60 text-white cursor-pointer hover:border-camarma-blue active:scale-95";
                  } else {
                    cellClasses += "border-slate-800/80 bg-slate-950/20 text-slate-450";
                  }

                  return (
                    <div
                      key={idx}
                      className={cellClasses}
                      onClick={() => session && setSelectedTrainingDetails(session)}
                    >
                      {session && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25 z-0">
                          <img src="./escudo.jpg" alt="" className="w-8 h-8 object-contain" />
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

            {/* Listado de Sesiones Registradas */}
            {entrenamientos.length > 0 && (
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-3xl p-5 shadow-xl backdrop-blur-md space-y-4">
                <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-camarma-gold" />
                  Sesiones Registradas ({entrenamientos.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[...entrenamientos]
                    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
                    .slice(0, 8)
                    .map(session => (
                      <div
                        key={session.id}
                        onClick={() => setSelectedTrainingDetails(session)}
                        className="bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 text-center min-w-[55px] shrink-0">
                            <span className="block text-[8px] font-bold uppercase text-camarma-gold leading-none">
                              {new Date(session.fecha + "T00:00:00").toLocaleDateString("es-ES", { month: "short" })}
                            </span>
                            <span className="block text-base font-extrabold text-white leading-none mt-1">
                              {new Date(session.fecha + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric" })}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                              {new Date(session.fecha + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long" })}
                            </span>
                            <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium mt-0.5 truncate">
                              <MapPin className="w-3 h-3 text-camarma-gold shrink-0" />
                              <span className="truncate">{session.lugar || "Lugar sin especificar"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                            {session.faltas && session.faltas.length > 0 ? `❌ ${session.faltas.length}` : "✔️ 100%"}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Modal de Detalle de Entrenamiento */}
            {selectedTrainingDetails && (
              <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-700/60 rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-camarma-blue/15 border border-camarma-blue/30 flex items-center justify-center">
                        <ClipboardList className="w-5 h-5 text-camarma-gold" />
                      </div>
                      <div>
                        <h4 className="font-black text-white text-base leading-tight">Sesión de Entrenamiento</h4>
                        <span className="text-[10px] font-bold text-camarma-gold uppercase tracking-wider">
                          {new Date(selectedTrainingDetails.fecha + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedTrainingDetails(null)}
                      className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6 space-y-4 overflow-y-auto">
                    {/* Lugar */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Lugar / Instalación</span>
                      <div className="flex items-center gap-2 text-white text-sm font-semibold">
                        <MapPin className="w-4 h-4 text-camarma-gold shrink-0" />
                        <span>{selectedTrainingDetails.lugar || "Campo Municipal / Habitual"}</span>
                      </div>
                    </div>

                    {/* Notas */}
                    {selectedTrainingDetails.notas && (
                      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Notas / Trabajo</span>
                        <p className="text-xs text-slate-300 leading-relaxed">{selectedTrainingDetails.notas}</p>
                      </div>
                    )}

                    {/* Resumen de Asistencia */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Control de Asistencia</span>
                      <p className="text-xs text-slate-300">
                        {selectedTrainingDetails.faltas && selectedTrainingDetails.faltas.length > 0
                          ? `Registradas ${selectedTrainingDetails.faltas.length} bajas o ausencias.`
                          : "✔️ 100% de asistencia de la plantilla."}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-center">
                    <button
                      onClick={() => setSelectedTrainingDetails(null)}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-3 rounded-xl transition-all uppercase tracking-wider cursor-pointer"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* PESTAÑA: CLASIFICACIÓN */}
        {activeTab === "clasificacion" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-700/60 pb-4 mb-6 gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Award className="w-6 h-6 text-camarma-gold" />
                    Competición y Calendario Oficial
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    C.D. Gorditos C.F. No Federado · Plantilla y Temporada 2026/2027 (LaPreferente)
                  </p>
                </div>
                <a
                  href="https://www.lapreferente.com/E55455/cd-gorditos-cf-no-federado"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gradient-to-r from-camarma-gold to-yellow-600 hover:from-yellow-500 hover:to-camarma-gold text-slate-950 font-black text-xs py-2.5 px-4 rounded-xl transition-all flex items-center gap-1.5 shrink-0 select-none cursor-pointer shadow-md shadow-camarma-gold/20 uppercase tracking-wider"
                >
                  🌐 Abrir en LaPreferente
                </a>
              </div>

              {/* Nota informativa */}
              <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/50 text-slate-400 text-xs mb-6 leading-relaxed">
                ℹ️ La plantilla, calendario de partidos y resultados están vinculados a <strong>LaPreferente</strong>. Puedes navegar por la ficha oficial a continuación o pulsar en <strong>"Abrir en LaPreferente"</strong>.
              </div>

              {/* Iframe oficial de LaPreferente */}
              <div className="relative w-full h-[700px] bg-white rounded-2xl overflow-hidden border border-slate-700/50 shadow-inner">
                <iframe
                  src="https://www.lapreferente.com/E55455/cd-gorditos-cf-no-federado"
                  title="C.D. Gorditos C.F. No Federado - LaPreferente"
                  className="absolute top-0 left-0 w-full h-full border-0"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer corporativo elegante */}
      <footer className="mt-auto bg-slate-800/80 border-t border-slate-700/60 py-6 text-center text-xs text-slate-500 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} C.D. Gorditos C.F. Todos los derechos reservados.</p>
          <div className="flex items-center gap-1.5 text-slate-650">
            <span>Hecho con</span>
            <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
            <span>para el C.D. Gorditos C.F</span>
          </div>
        </div>
      </footer>

      {/* Modal de Detalle de Partido */}
      {selectedMatchDetails && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700/50 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col my-8 overflow-hidden max-h-[90vh]">
            
            {/* Cabecera / Banner del Marcador */}
            <div className="relative bg-gradient-to-r from-slate-850 to-camarma-blue/20 p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-extrabold bg-camarma-gold/10 text-camarma-gold border border-camarma-gold/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    Detalle del Partido
                  </span>
                  {selectedMatchDetails.tipoPartido && (
                    <span className="text-[10px] font-extrabold bg-camarma-blue/15 text-camarma-blue-light border border-camarma-blue/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
                      🏆 {selectedMatchDetails.tipoPartido} {selectedMatchDetails.tipoPartido === "Liga" && selectedMatchDetails.jornada ? ` - Jornada ${selectedMatchDetails.jornada}` : ""}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  {new Date(selectedMatchDetails.fecha + "T00:00:00").toLocaleDateString("es-ES", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => setSelectedMatchDetails(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white p-2 rounded-xl transition-all border border-slate-750 active:scale-95 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Marcador Gigante */}
            <div className="bg-slate-950/50 py-8 px-6 border-b border-slate-800/60 flex flex-col items-center justify-center text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-camarma-blue/5 to-camarma-gold/5 pointer-events-none"></div>
              
              <div className="flex items-center justify-center gap-6 md:gap-12 relative z-10 w-full max-w-2xl">
                {/* Equipo Local */}
                <div className="flex-1 text-right min-w-0">
                  <h3 className="text-lg md:text-2xl font-black text-white uppercase tracking-tight truncate">
                    {selectedMatchDetails.condicion === "visitante" ? selectedMatchDetails.rival : "C.D. Gorditos C.F"}
                  </h3>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Local</span>
                </div>

                {/* Score */}
                <div className="flex items-center gap-3 bg-slate-900 border border-slate-755 px-5 py-3 rounded-2xl shrink-0 shadow-lg">
                  <strong className="text-2xl md:text-4xl font-black text-white font-mono leading-none">
                    {selectedMatchDetails.condicion === "visitante" ? selectedMatchDetails.golesRival : (selectedMatchDetails.golesGorditos ?? selectedMatchDetails.golesCamarma)}
                  </strong>
                  <span className="text-slate-605 text-lg font-bold">-</span>
                  <strong className="text-2xl md:text-4xl font-black text-white font-mono leading-none">
                    {selectedMatchDetails.condicion === "visitante" ? (selectedMatchDetails.golesGorditos ?? selectedMatchDetails.golesCamarma) : selectedMatchDetails.golesRival}
                  </strong>
                </div>

                {/* Equipo Visitante */}
                <div className="flex-1 text-left min-w-0">
                  <h3 className="text-lg md:text-2xl font-black text-white uppercase tracking-tight truncate">
                    {selectedMatchDetails.condicion === "visitante" ? "C.D. Gorditos C.F" : selectedMatchDetails.rival}
                  </h3>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Visitante</span>
                </div>
              </div>
            </div>

            {/* Contenido / Cuerpo con scroll */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Campo de Fútbol / Alineación Visual (6 Columnas) */}
                <div className="lg:col-span-6 flex flex-col gap-4">
                  <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                    ⚽ Alineación Titular ({selectedMatchDetails.alineacion?.formacion || "4-3-3"})
                  </h4>
                  
                  {/* Contenedor del Campo */}
                  <div className="relative w-full aspect-[2/3] max-w-[460px] mx-auto bg-gradient-to-b from-[#1b4332] to-[#081c15] rounded-3xl border-2 border-emerald-600/35 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.65)] flex flex-col justify-between p-4 select-none">
                    {/* Líneas del Campo */}
                    <div className="absolute top-1/2 left-1/2 w-32 h-32 border-2 border-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/10 -translate-y-1/2 pointer-events-none" />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 border-b-2 border-x-2 border-white/10 pointer-events-none" />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-8 border-b-2 border-x-2 border-white/10 pointer-events-none" />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-20 border-t-2 border-x-2 border-white/10 pointer-events-none" />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-8 border-t-2 border-x-2 border-white/10 pointer-events-none" />

                    {/* Dibujo de jugadores */}
                    {(() => {
                      const currentFormacion = selectedMatchDetails.alineacion?.formacion;
                      const slots = (FORMACIONES[currentFormacion] || FORMACIONES["4-3-3"]).slots;
                      
                      return slots.map(slot => {
                        const playerId = selectedMatchDetails.alineacion?.asignaciones?.[slot.id];
                        const player = jugadores.find(j => j.id === playerId);
                        const isMvp = selectedMatchDetails.mvpJugadorId === playerId;
                        
                        return (
                          <div
                            key={slot.id}
                            className="absolute flex flex-col items-center justify-center text-center"
                            style={{
                              top: `${slot.top}%`,
                              left: `${slot.left}%`,
                              transform: "translate(-50%, -50%)",
                            }}
                          >
                            <div className="relative">
                              {player ? (
                                <>
                                  <img
                                    src={player.fotoUrl || "/placeholder-player.png"}
                                    alt={player.nombre}
                                    className="w-10 h-10 rounded-full object-cover border-2 border-camarma-blue shadow-lg bg-slate-900"
                                  />
                                  {isMvp && (
                                    <span className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] shadow-md animate-pulse">
                                      🌟
                                    </span>
                                  )}
                                </>
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-slate-900/60 border border-slate-700/60 flex items-center justify-center text-slate-500 text-[10px] font-bold">
                                  {slot.label}
                                </div>
                              )}
                            </div>
                            {player && (
                              <span className="mt-1 text-[9px] font-bold text-white bg-slate-950/80 border border-slate-800 px-1 py-0.5 rounded shadow max-w-[75px] truncate block whitespace-nowrap">
                                {player.nombre.split(" ").slice(-1)[0]}
                              </span>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Crónica, MVP y Ficha Técnica (6 Columnas) */}
                <div className="lg:col-span-6 space-y-6">
                  
                  {/* Cronica Míster */}
                  {selectedMatchDetails.cronica && (
                    <div className="bg-slate-850 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                        <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                        </svg>
                      </div>
                      <h4 className="text-xs font-extrabold uppercase text-camarma-gold tracking-wider mb-2">
                        ✍️ Crónica del Míster
                      </h4>
                      <p className="text-sm text-slate-300 leading-relaxed italic whitespace-pre-line font-medium">
                        "{selectedMatchDetails.cronica}"
                      </p>
                    </div>
                  )}

                  {/* MVP Banner */}
                  {(() => {
                    const mvpPlayer = jugadores.find(j => j.id === selectedMatchDetails.mvpJugadorId);
                    if (!mvpPlayer) return null;
                    return (
                      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-850 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-4 shadow-lg">
                        <div className="relative">
                          <img
                            src={mvpPlayer.fotoUrl || "/placeholder-player.png"}
                            alt={mvpPlayer.nombre}
                            className="w-16 h-16 rounded-full object-cover border-2 border-amber-500 shadow-md bg-slate-900"
                          />
                          <span className="absolute -bottom-1.5 -right-1.5 bg-amber-500 text-slate-950 font-black text-[10px] w-6 h-6 rounded-full flex items-center justify-center border-2 border-slate-900">
                            🌟
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-[9px] font-black uppercase text-amber-400 tracking-wider">
                            MVP del Encuentro
                          </span>
                          <h4 className="text-base font-black text-white truncate font-sans leading-tight mt-0.5">
                            {mvpPlayer.nombre}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1">
                            Elegido por su destacada aportación en este partido.
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Detalle de Jugadores Convocados y Stats */}
                  <div className="bg-slate-850 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4 font-sans">
                    <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <Activity className="w-4 h-4 text-camarma-blue-light" />
                      Rendimiento Individual
                    </h4>

                    <div className="divide-y divide-slate-800/40 max-h-[300px] overflow-y-auto pr-1 space-y-3">
                      {/* Titulares en Lista */}
                      <div className="pb-3">
                        <span className="block text-[8px] font-extrabold uppercase text-slate-500 mb-2">Titulares</span>
                        <div className="space-y-2">
                          {Object.values(selectedMatchDetails.alineacion?.asignaciones || {}).map(pid => {
                            const p = jugadores.find(j => j.id === pid);
                            const stats = selectedMatchDetails.statsJugadores?.[pid];
                            if (!p) return null;
                            return (
                              <div key={pid} className="flex items-center justify-between text-xs py-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <img src={p.fotoUrl || "/placeholder-player.png"} className="w-6 h-6 rounded-full object-cover border border-slate-750 bg-slate-900 shrink-0" />
                                  <span className="font-bold text-white truncate max-w-[150px]">{p.nombre}</span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0 text-[10px]">
                                  <span className="text-slate-400 font-semibold">{stats?.minutos || 0}'</span>
                                  <div className="flex items-center gap-1 select-none">
                                    {Array.from({ length: stats?.goles || 0 }).map((_, i) => (
                                      <span key={`g-${i}`}>⚽</span>
                                    ))}
                                    {Array.from({ length: stats?.asistencias || 0 }).map((_, i) => (
                                      <span key={`a-${i}`}>👟</span>
                                    ))}
                                    {Array.from({ length: stats?.amarillas || 0 }).map((_, i) => (
                                      <span key={`y-${i}`} className="w-2 h-3 bg-yellow-500 rounded-sm inline-block border border-yellow-600/50" />
                                    ))}
                                    {Array.from({ length: stats?.rojas || 0 }).map((_, i) => (
                                      <span key={`r-${i}`} className="w-2 h-3 bg-red-600 rounded-sm inline-block border border-red-700" />
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Suplentes en Lista */}
                      {selectedMatchDetails.alineacion?.suplentes?.length > 0 && (
                        <div className="pt-3">
                          <span className="block text-[8px] font-extrabold uppercase text-slate-500 mb-2">Suplentes</span>
                          <div className="space-y-2">
                            {selectedMatchDetails.alineacion.suplentes.map(pid => {
                              const p = jugadores.find(j => j.id === pid);
                              const stats = selectedMatchDetails.statsJugadores?.[pid];
                              if (!p) return null;
                              return (
                                <div key={pid} className="flex items-center justify-between text-xs py-1">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <img src={p.fotoUrl || "/placeholder-player.png"} className="w-6 h-6 rounded-full object-cover border border-slate-750 bg-slate-900 shrink-0" />
                                    <span className="font-bold text-slate-300 truncate max-w-[150px]">{p.nombre}</span>
                                    <span className="text-[9px] text-slate-500 font-medium">(suplente)</span>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0 text-[10px]">
                                    <span className="text-slate-400 font-semibold">{stats?.minutos || 0}'</span>
                                    <div className="flex items-center gap-1 select-none">
                                      {Array.from({ length: stats?.goles || 0 }).map((_, i) => (
                                        <span key={`g-${i}`}>⚽</span>
                                      ))}
                                      {Array.from({ length: stats?.asistencias || 0 }).map((_, i) => (
                                        <span key={`a-${i}`}>👟</span>
                                      ))}
                                      {Array.from({ length: stats?.amarillas || 0 }).map((_, i) => (
                                        <span key={`y-${i}`} className="w-2 h-3 bg-yellow-500 rounded-sm inline-block border border-yellow-600/50" />
                                      ))}
                                      {Array.from({ length: stats?.rojas || 0 }).map((_, i) => (
                                        <span key={`r-${i}`} className="w-2 h-3 bg-red-600 rounded-sm inline-block border border-red-700" />
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

              </div>
            </div>

            {/* Pie del modal */}
            <div className="bg-slate-955/40 p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-center gap-3">
              {isAdmin && (
                <button
                  onClick={() => exportMatchToPDF(selectedMatchDetails)}
                  className="bg-gradient-to-r from-camarma-gold to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-slate-950 font-black text-xs py-2.5 px-6 rounded-xl transition-all cursor-pointer border border-slate-700/80 active:scale-95 select-none uppercase tracking-wider flex items-center justify-center gap-1.5"
                >
                  📥 Exportar PDF Acta
                </button>
              )}
              <button
                onClick={() => setSelectedMatchDetails(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-2.5 px-6 rounded-xl transition-all cursor-pointer border border-slate-700/80 active:scale-95 select-none"
              >
                Cerrar Ficha del Partido
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
