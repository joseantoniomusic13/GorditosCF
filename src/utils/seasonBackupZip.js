import JSZip from "jszip";
import html2pdf from "html2pdf.js";
import { LOGO_BASE64 } from "../logoBase64";
import { calcularEstadisticasCambios } from "./matchSubstitutions";

// Helper para calcular edad
function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return "-";
  const hoy = new Date();
  const nac = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) {
    edad--;
  }
  return edad;
}

// 1. HTML para Reporte General de Plantilla
export function getGeneralReportHTML({ jugadores, partidos, entrenamientos, temporadaNombre }) {
  const rows = jugadores.map(player => {
    const missedDates = entrenamientos
      .filter(t => t.faltas && t.faltas.includes(player.id))
      .map(t => {
        const d = new Date(t.fecha + "T00:00:00");
        return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
      });

    return {
      nombre: player.nombre,
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
    let badgeBg = "#f1f5f9";
    let badgeColor = "#334155";
    if (r.posicion === "Portero") { badgeBg = "#fef3c7"; badgeColor = "#b45309"; }
    else if (r.posicion === "Defensa") { badgeBg = "#dbeafe"; badgeColor = "#1d4ed8"; }
    else if (r.posicion === "Centrocampista") { badgeBg = "#dcfce7"; badgeColor = "#15803d"; }
    else if (r.posicion === "Delantero") { badgeBg = "#fee2e2"; badgeColor = "#b91c1c"; }

    return `
      <tr>
        <td><strong>${r.nombre}</strong></td>
        <td><span style="background:${badgeBg}; color:${badgeColor}; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:bold;">${r.posicion}</span></td>
        <td style="text-align:center;">${r.edad}</td>
        <td style="text-align:center; font-weight:bold;">${r.goles}</td>
        <td style="text-align:center;">${r.asistencias}</td>
        <td style="text-align:center;">${r.minutos}'</td>
        <td style="text-align:center; color:${r.faltasEntrenoCount > 0 ? '#ef4444' : '#10b981'}; font-weight:bold;">${r.faltasEntrenoCount}</td>
        <td style="text-align:center; color:${r.faltasPartidoCount > 0 ? '#ef4444' : '#10b981'}; font-weight:bold;">${r.faltasPartidoCount}</td>
        <td style="font-size:11px; color:#64748b;">${r.faltasFechas}</td>
      </tr>
    `;
  }).join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>C.D. Gorditos C.F - Resumen de Plantilla ${temporadaNombre || ""}</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; margin: 25px; line-height: 1.4; background:#fff; font-size: 12px; }
          .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 20px; }
          .title-section h1 { margin: 0; font-size: 22px; color: #1e3a8a; text-transform: uppercase; font-weight: 900; letter-spacing: -0.5px; }
          .title-section p { margin: 3px 0 0 0; font-size: 12px; color: #b45309; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
          .logo { width: 50px; height: 50px; object-fit: contain; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #f8fafc; color: #475569; font-weight: 800; text-transform: uppercase; font-size: 10px; padding: 8px 6px; border-bottom: 2px solid #cbd5e1; text-align: left; }
          td { padding: 7px 6px; border-bottom: 1px solid #f1f5f9; }
          .footer { margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display:flex; align-items:center; gap:12px;">
            <img class="logo" src="${LOGO_BASE64}" alt="Escudo" />
            <div class="title-section">
              <h1>C.D. Gorditos C.F</h1>
              <p>Resumen Oficial de Plantilla • Temporada ${temporadaNombre || ""}</p>
            </div>
          </div>
          <div style="text-align:right; font-size:11px; color:#64748b;">
            <span>Fecha: ${new Date().toLocaleDateString("es-ES")}</span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Jugador</th>
              <th>Posición</th>
              <th style="text-align:center;">Edad</th>
              <th style="text-align:center;">Goles</th>
              <th style="text-align:center;">Asist.</th>
              <th style="text-align:center;">Minutos</th>
              <th style="text-align:center;">Faltas Ent.</th>
              <th style="text-align:center;">Faltas Part.</th>
              <th>Fechas Faltas</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div class="footer">
          <span>Portal Oficial C.D. Gorditos C.F</span>
          <span>Total Jugadores: ${jugadores.length}</span>
        </div>
      </body>
    </html>
  `;
}

// 2. HTML para Informe Individual de Jugador
export function getPlayerReportHTML({ player, partidos, entrenamientos, temporadaNombre }) {
  const matchesPlayed = partidos.filter(match => {
    if (!match.actaGuardada && !match.jugado) return false;
    const s = match.statsJugadores ? match.statsJugadores[player.id] : null;
    return s && s.convocado;
  });

  const missedMatches = partidos.filter(match => {
    if (!match.actaGuardada && !match.jugado) return false;
    if (match.faltas && match.faltas.includes(player.id)) return true;
    if (match.ausencias && match.ausencias[player.id]) return true;
    const s = match.statsJugadores ? match.statsJugadores[player.id] : null;
    return !s || s.convocado === false;
  });

  const missedSessions = entrenamientos.filter(t => t.faltas && t.faltas.includes(player.id));

  let totalMinutos = 0;
  let totalGoles = 0;
  let totalAsistencias = 0;
  let totalAmarillas = 0;
  let totalRojas = 0;

  const getPlayerMatchMinutes = (match) => {
    const s = match.statsJugadores?.[player.id];
    if (!s) return 0;
    if (match.sustituciones && match.sustituciones.length > 0) {
      const rawTit = Object.values(match.alineacion?.asignaciones || {}).filter(Boolean);
      const tit = Array.from(new Set(rawTit)).filter(Boolean);
      const sup = (match.alineacion?.suplentes || []).filter(id => !tit.includes(id));
      const est = calcularEstadisticasCambios(tit, sup, match.sustituciones, 90);
      if (est[player.id] && est[player.id].minutosTotales !== undefined) {
        return est[player.id].minutosTotales;
      }
    }
    return s.minutos || 0;
  };

  matchesPlayed.forEach(match => {
    const s = match.statsJugadores[player.id];
    totalMinutos += getPlayerMatchMinutes(match);
    totalGoles += player.isPortero ? (s.golesContra || 0) : (s.goles || 0);
    totalAsistencias += s.asistencias || 0;
    totalAmarillas += s.amarillas || 0;
    totalRojas += s.rojas || 0;
  });

  const matchesRows = matchesPlayed.map(match => {
    const s = match.statsJugadores[player.id];
    const d = new Date(match.fecha + "T00:00:00");
    const formattedDate = d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
    const score = match.condicion === "local" 
      ? `${match.golesGorditos ?? match.golesCamarma ?? 0} - ${match.golesRival}`
      : `${match.golesRival} - ${match.golesGorditos ?? match.golesCamarma ?? 0}`;

    const comentarioTexto = (s.comentarios || s.comentario || s.observaciones || "").trim();
    const minutosPart = getPlayerMatchMinutes(match);

    return `
      <tr>
        <td><strong>${formattedDate}</strong></td>
        <td>${match.rival}</td>
        <td style="text-align:center;">${match.condicion === "local" ? "Casa" : "Fuera"}</td>
        <td style="text-align:center;">${score}</td>
        <td style="text-align:center;">${minutosPart}'</td>
        <td style="text-align:center; font-weight:bold;">${player.isPortero ? `${s.golesContra || 0} (Rec)` : (s.goles > 0 ? `⚽ ${s.goles}` : "-")}</td>
        <td style="text-align:center;">${s.asistencias > 0 ? `👟 ${s.asistencias}` : "-"}</td>
        <td style="text-align:center;">${s.amarillas > 0 ? "🟨" : ""} ${s.rojas > 0 ? "🟥" : ""}</td>
      </tr>
      ${comentarioTexto ? `
        <tr style="background:#f8fafc;">
          <td colspan="8" style="padding:5px 10px; font-size:10.5px; color:#334155; font-style:italic; border-left:3px solid #1e3a8a; border-bottom:1px solid #e2e8f0;">
            <strong style="color:#1e3a8a; font-style:normal; font-weight:bold;">💬 Comentario del Partido:</strong> "${comentarioTexto}"
          </td>
        </tr>
      ` : ''}
    `;
  }).join("");

  const missedMatchesRows = missedMatches.map(match => {
    const d = new Date(match.fecha + "T00:00:00");
    const formattedDate = d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
    const motivo = match.ausencias && match.ausencias[player.id] ? match.ausencias[player.id] : "Sin justificación registrada";
    return `
      <tr>
        <td><strong>${formattedDate}</strong></td>
        <td>${match.rival}</td>
        <td style="text-align:center;">${match.condicion === "local" ? "Casa" : "Fuera"}</td>
        <td style="color:#b45309; font-weight:600;">⚠️ ${motivo}</td>
      </tr>
    `;
  }).join("");

  const missedSessionsRows = missedSessions.map(session => {
    const d = new Date(session.fecha + "T00:00:00");
    const formattedDate = d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
    const motivo = session.ausencias && session.ausencias[player.id] ? session.ausencias[player.id] : "Sin justificar / Falta";
    return `
      <tr>
        <td><strong>${formattedDate}</strong></td>
        <td style="color:#b45309; font-weight:600;">⚠️ ${motivo}</td>
        <td style="font-size:11px; color:#64748b;">${session.notas || "-"}</td>
      </tr>
    `;
  }).join("");

  const injuriesRows = (player.historialLesiones || []).map(entry => {
    let computedDuracion = entry.duracionDias;
    if (!computedDuracion && entry.fechaBaja && entry.fechaAlta) {
      const baja = new Date(entry.fechaBaja + "T00:00:00");
      const alta = new Date(entry.fechaAlta + "T00:00:00");
      computedDuracion = Math.max(1, Math.round((alta - baja) / (1000 * 60 * 60 * 24)));
    }
    return `
      <tr>
        <td><strong>${entry.tipoLesion}</strong></td>
        <td style="text-align:center;">${entry.fechaBaja}</td>
        <td style="text-align:center;">${entry.fechaAlta}</td>
        <td style="text-align:center; font-weight:bold; color:#d97706;">${computedDuracion || "-"} días</td>
      </tr>
    `;
  }).join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Historial Deportivo - ${player.nombre}</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; margin: 25px; line-height: 1.4; background:#fff; font-size:12px; }
          .header-report { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 18px; }
          .title-area h1 { font-size: 20px; font-weight: 900; text-transform: uppercase; margin: 0; color: #1e3a8a; }
          .title-area p { font-size: 11px; font-weight: bold; color: #b45309; text-transform: uppercase; margin: 2px 0 0 0; }
          .logo { width: 48px; height: 48px; object-fit: contain; }
          .player-profile-card { display: flex; align-items: center; gap: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; margin-bottom: 18px; }
          .player-photo { width: 55px; height: 55px; border-radius: 50%; object-fit: cover; border: 2px solid #1e3a8a; }
          .player-info-meta h2 { font-size: 16px; margin: 0; font-weight: 800; color: #0f172a; }
          .stats-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 18px; }
          .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; text-align: center; }
          .stat-card .val { font-size: 16px; font-weight: 900; color: #1e3a8a; }
          .stat-card .label { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-top: 2px; }
          .section-title { font-size: 12px; font-weight: 900; text-transform: uppercase; color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; margin: 15px 0 8px 0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          th { background: #f1f5f9; color: #475569; font-weight: 800; text-transform: uppercase; font-size: 9.5px; padding: 6px; border-bottom: 1px solid #cbd5e1; text-align: left; }
          td { padding: 6px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="header-report">
          <div style="display:flex; align-items:center; gap:12px;">
            <img class="logo" src="${LOGO_BASE64}" alt="Escudo" />
            <div class="title-area">
              <h1>C.D. Gorditos C.F</h1>
              <p>Ficha Individual Deportiva • Temporada ${temporadaNombre || ""}</p>
            </div>
          </div>
          <div style="font-size:10px; color:#64748b; text-align:right;">
            <span>Fecha: ${new Date().toLocaleDateString("es-ES")}</span>
          </div>
        </div>

        <div class="player-profile-card">
          <img class="player-photo" src="${player.fotoUrl || LOGO_BASE64}" alt="${player.nombre}" />
          <div class="player-info-meta">
            <h2>${player.nombre} #${player.dorsal || "S/D"}</h2>
            <div style="font-size:11px; color:#64748b; margin-top:2px;">
              ${player.posicion || (player.isPortero ? "Portero" : "Jugador")} • ${calcularEdad(player.fechaNacimiento)} años
            </div>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card"><div class="val">${matchesPlayed.length}</div><div class="label">Partidos</div></div>
          <div class="stat-card"><div class="val">${totalMinutos}'</div><div class="label">Minutos</div></div>
          <div class="stat-card"><div class="val">${totalGoles}</div><div class="label">${player.isPortero ? "Goles Rec" : "Goles"}</div></div>
          <div class="stat-card"><div class="val">${totalAsistencias}</div><div class="label">Asistencias</div></div>
          <div class="stat-card"><div class="val" style="color:#ef4444;">${player.faltasEntrenamiento || 0}</div><div class="label">Faltas Entreno</div></div>
          <div class="stat-card"><div class="val" style="color:#d97706;">${player.faltasPartido || 0}</div><div class="label">Faltas Partido</div></div>
        </div>

        <div class="section-title">Participación en Partidos (${matchesPlayed.length})</div>
        ${matchesPlayed.length > 0 ? `
          <table>
            <thead><tr><th>Fecha</th><th>Rival</th><th style="text-align:center;">Lugar</th><th style="text-align:center;">Resultado</th><th style="text-align:center;">Minutos</th><th style="text-align:center;">Goles</th><th style="text-align:center;">Asist.</th><th style="text-align:center;">Tarjetas</th></tr></thead>
            <tbody>${matchesRows}</tbody>
          </table>
        ` : `<p style="color:#94a3b8; font-style:italic; font-size:11px;">Sin partidos jugados.</p>`}

        ${missedMatches.length > 0 ? `
          <div class="section-title">Faltas y Ausencias en Partidos (${missedMatches.length})</div>
          <table>
            <thead><tr><th>Fecha</th><th>Rival</th><th style="text-align:center;">Lugar</th><th>Motivo / Justificación</th></tr></thead>
            <tbody>${missedMatchesRows}</tbody>
          </table>
        ` : ''}

        <div class="section-title">Faltas de Asistencia a Entrenamientos (${missedSessions.length})</div>
        ${missedSessions.length > 0 ? `
          <table>
            <thead><tr><th>Fecha de Sesión</th><th>Motivo / Justificación</th><th>Observaciones del Míster</th></tr></thead>
            <tbody>${missedSessionsRows}</tbody>
          </table>
        ` : `<p style="color:#10b981; font-weight:bold; font-size:11px;">✔️ 100% de asistencia a los entrenamientos registrados.</p>`}

        ${injuriesRows ? `
          <div class="section-title">Historial de Bajas Médicas y Lesiones</div>
          <table>
            <thead><tr><th>Lesión</th><th style="text-align:center;">Fecha Baja</th><th style="text-align:center;">Fecha Alta</th><th style="text-align:center;">Duración</th></tr></thead>
            <tbody>${injuriesRows}</tbody>
          </table>
        ` : ''}
      </body>
    </html>
  `;
}

// 3. HTML para Reporte de Entrenamientos
export function getTrainingReportHTML({ entrenamientos, jugadores, temporadaNombre }) {
  const sessionsRows = entrenamientos.map(t => {
    const d = new Date(t.fecha + "T00:00:00");
    const dateFormatted = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
    const absents = t.faltas || [];
    const absentsNames = absents.map(pid => {
      const p = jugadores.find(j => j.id === pid);
      const motivo = t.ausencias && t.ausencias[pid] ? ` (${t.ausencias[pid]})` : "";
      return p ? `${p.nombre}${motivo}` : `Jugador${motivo}`;
    }).join(", ");

    return `
      <tr>
        <td style="white-space:nowrap;"><strong>${dateFormatted}</strong></td>
        <td>${t.lugar || "Lugar habitual"}</td>
        <td style="font-size:11px; color:#475569;">${t.notas || "-"}</td>
        <td style="text-align:center; font-weight:bold; color:${absents.length > 0 ? '#ef4444' : '#10b981'};">${absents.length}</td>
        <td style="font-size:11px; color:#64748b;">${absentsNames || "Plantilla completa"}</td>
      </tr>
    `;
  }).join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>C.D. Gorditos C.F - Historial de Entrenamientos ${temporadaNombre || ""}</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; margin: 25px; line-height: 1.4; background:#fff; font-size:12px; }
          .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 20px; }
          .title-section h1 { margin: 0; font-size: 22px; color: #1e3a8a; text-transform: uppercase; font-weight: 900; }
          .title-section p { margin: 3px 0 0 0; font-size: 12px; color: #b45309; font-weight: bold; text-transform: uppercase; }
          .logo { width: 50px; height: 50px; object-fit: contain; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #f8fafc; color: #475569; font-weight: 800; text-transform: uppercase; font-size: 10px; padding: 8px 6px; border-bottom: 2px solid #cbd5e1; text-align: left; }
          td { padding: 7px 6px; border-bottom: 1px solid #f1f5f9; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display:flex; align-items:center; gap:12px;">
            <img class="logo" src="${LOGO_BASE64}" alt="Escudo" />
            <div class="title-section">
              <h1>C.D. Gorditos C.F</h1>
              <p>Historial de Entrenamientos y Asistencias • Temporada ${temporadaNombre || ""}</p>
            </div>
          </div>
          <div style="text-align:right; font-size:11px; color:#64748b;">
            <span>Total Sesiones: ${entrenamientos.length}</span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Lugar</th>
              <th>Notas / Trabajo</th>
              <th style="text-align:center;">Bajas</th>
              <th>Jugadores Ausentes</th>
            </tr>
          </thead>
          <tbody>
            ${sessionsRows || '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">No hay sesiones registradas.</td></tr>'}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

// 4. HTML para Acta Oficial de Partido
export function getMatchReportHTML({ match, jugadores, temporadaNombre }) {
  const getPositionPriority = (pos) => {
    const p = (pos || "").toLowerCase();
    if (p.includes("portero") || p.includes("por")) return 1;
    if (p.includes("defensa") || p.includes("lateral") || p.includes("central")) return 2;
    if (p.includes("medio") || p.includes("centro") || p.includes("volante")) return 3;
    if (p.includes("delantero") || p.includes("extremo") || p.includes("punta")) return 4;
    return 5;
  };

  const rawTitulares = Object.values(match.alineacion?.asignaciones || {}).filter(Boolean);
  const titularesIds = Array.from(new Set(rawTitulares))
    .filter(id => Boolean(id) && jugadores.some(j => j && j.id === id && j.nombre));

    const suplentesIds = Array.from(new Set(match.alineacion?.suplentes || []))
    .filter(id => Boolean(id) && !titularesIds.includes(id) && jugadores.some(j => j && j.id === id && j.nombre));

  const estCambios = (match.sustituciones && match.sustituciones.length > 0)
    ? calcularEstadisticasCambios(titularesIds, suplentesIds, match.sustituciones, 90)
    : {};

  const getPlayerWithStats = (id, esTitular) => {
    const p = jugadores.find(j => j && j.id === id);
    if (!p || !p.nombre) return null;
    const stats = match.statsJugadores?.[id] || { minutos: 0, goles: 0, golesContra: 0, asistencias: 0, amarillas: 0, rojas: 0, convocado: false };
    const minutosFinal = (estCambios[id] && estCambios[id].minutosTotales !== undefined)
      ? estCambios[id].minutosTotales
      : (stats.minutos || 0);

    return {
      nombre: p.nombre,
      posicion: p.posicion || (p.isPortero ? "Portero" : "Jugador"),
      prioridad: getPositionPriority(p.posicion || ""),
      minutos: minutosFinal,
      goles: stats.goles || 0,
      golesContra: stats.golesContra || 0,
      asistencias: stats.asistencias || 0,
      amarillas: stats.amarillas || 0,
      rojas: stats.rojas || 0,
      tipo: esTitular ? "Titular" : "Suplente",
      isPortero: Boolean(p.isPortero || p.posicion === "Portero")
    };
  };

  const allPlayersReport = [
    ...titularesIds.map(id => getPlayerWithStats(id, true)).filter(Boolean).sort((a, b) => a.prioridad - b.prioridad),
    ...suplentesIds.map(id => getPlayerWithStats(id, false)).filter(Boolean).sort((a, b) => a.prioridad - b.prioridad)
  ];

  const playersRows = allPlayersReport.map(r => `
    <tr>
      <td><strong>${r.nombre}</strong></td>
      <td>${r.posicion}</td>
      <td style="text-align:center; font-weight:bold;">${r.tipo}</td>
      <td style="text-align:center;">${r.minutos}'</td>
      <td style="text-align:center; font-weight:bold;">${r.isPortero ? `${r.golesContra} (Rec)` : (r.goles > 0 ? `⚽ ${r.goles}` : "-")}</td>
      <td style="text-align:center;">${r.asistencias > 0 ? `👟 ${r.asistencias}` : "-"}</td>
      <td style="text-align:center;">${r.amarillas > 0 ? "🟨" : ""} ${r.rojas > 0 ? "🟥" : ""}</td>
    </tr>
  `).join("");

  const matchFaltas = (match.faltas || Object.keys(match.ausencias || {}))
    .filter(pid => jugadores.some(j => j && j.id === pid && j.nombre));
  const bajasRows = matchFaltas.map(pid => {
    const p = jugadores.find(j => j && j.id === pid);
    if (!p) return "";
    const motivo = match.ausencias?.[pid] || "Sin justificar";
    return `
      <tr>
        <td><strong>${p.nombre}</strong></td>
        <td>${p.posicion || (p.isPortero ? "Portero" : "Jugador")}</td>
        <td style="color:#b45309; font-weight:600;">⚠️ ${motivo}</td>
      </tr>
    `;
  }).filter(Boolean).join("");

  const d = new Date(match.fecha + "T00:00:00");
  const fechaStr = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const gc = match.golesGorditos ?? match.golesCamarma ?? 0;
  const gr = match.golesRival ?? 0;
  const scoreDisplay = match.condicion === "visitante" ? `${gr} - ${gc}` : `${gc} - ${gr}`;
  const localTeam = match.condicion === "visitante" ? match.rival : "C.D. Gorditos C.F";
  const visitorTeam = match.condicion === "visitante" ? "C.D. Gorditos C.F" : match.rival;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Acta de Partido - vs ${match.rival}</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; margin: 25px; line-height: 1.4; background:#fff; font-size:12px; }
          .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 18px; }
          .title-section h1 { margin: 0; font-size: 20px; color: #1e3a8a; text-transform: uppercase; font-weight: 900; }
          .title-section p { margin: 2px 0 0 0; font-size: 11px; color: #b45309; font-weight: bold; text-transform: uppercase; }
          .logo { width: 48px; height: 48px; object-fit: contain; }
          .score-banner { display: flex; align-items: center; justify-content: space-between; background: #0f172a; color: #fff; border-radius: 12px; padding: 15px 25px; margin-bottom: 18px; }
          .score-banner h2 { font-size: 26px; margin: 0; font-family: monospace; font-weight: 900; }
          .team-name { font-size: 15px; font-weight: 800; text-transform: uppercase; }
          .section-title { font-size: 12px; font-weight: 900; text-transform: uppercase; color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; margin: 15px 0 8px 0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          th { background: #f8fafc; color: #475569; font-weight: 800; text-transform: uppercase; font-size: 9.5px; padding: 6px; border-bottom: 1px solid #cbd5e1; text-align: left; }
          td { padding: 6px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display:flex; align-items:center; gap:12px;">
            <img class="logo" src="${LOGO_BASE64}" alt="Escudo" />
            <div class="title-section">
              <h1>C.D. Gorditos C.F</h1>
              <p>Acta Oficial de Partido • Temporada ${temporadaNombre || ""}</p>
            </div>
          </div>
          <div style="text-align:right; font-size:11px; color:#64748b;">
            <span>${fechaStr}</span>
          </div>
        </div>

        <div class="score-banner">
          <div class="team-name">${localTeam}</div>
          <h2>${scoreDisplay}</h2>
          <div class="team-name">${visitorTeam}</div>
        </div>

        <div class="section-title">Alineación y Estadísticas del Partido</div>
        <table>
          <thead>
            <tr>
              <th>Jugador</th>
              <th>Posición</th>
              <th style="text-align:center;">Rol</th>
              <th style="text-align:center;">Minutos</th>
              <th style="text-align:center;">Goles</th>
              <th style="text-align:center;">Asist.</th>
              <th style="text-align:center;">Tarjetas</th>
            </tr>
          </thead>
          <tbody>
            ${playersRows}
          </tbody>
        </table>

        ${match.sustituciones && match.sustituciones.length > 0 ? `
          <div class="section-title">Sustituciones y Cambios (${match.sustituciones.length})</div>
          <table>
            <thead>
              <tr>
                <th style="width:15%; text-align:center;">Minuto</th>
                <th style="width:35%;">🔴 Jugador que Sale</th>
                <th style="width:35%;">🟢 Jugador que Entra</th>
                <th style="width:15%;">Motivo / Nota</th>
              </tr>
            </thead>
            <tbody>
              ${match.sustituciones.map(s => {
                const pSale = jugadores.find(j => j.id === s.saleId);
                const pEntra = jugadores.find(j => j.id === s.entraId);
                return `
                  <tr>
                    <td style="text-align:center; font-weight:800; color:#ea580c;">${s.minuto}'</td>
                    <td style="color:#dc2626; font-weight:600;">🔴 ${pSale ? pSale.nombre : "Jugador"}</td>
                    <td style="color:#16a34a; font-weight:600;">🟢 ${pEntra ? pEntra.nombre : "Jugador"}</td>
                    <td style="color:#64748b; font-size:10px;">${s.motivo || "-"}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        ` : ''}

        ${matchFaltas.length > 0 ? `
          <div class="section-title">Bajas y Faltas al Partido (${matchFaltas.length})</div>
          <table>
            <thead>
              <tr><th>Jugador</th><th>Posición</th><th>Motivo / Justificación</th></tr>
            </thead>
            <tbody>
              ${bajasRows}
            </tbody>
          </table>
        ` : ''}

        ${match.cronica ? `
          <div class="section-title">Crónica del Partido</div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px; font-size:11.5px; line-height:1.5; color:#334155; font-style:italic; white-space:pre-wrap; word-break:break-word;">
            "${match.cronica}"
          </div>
        ` : ''}
      </body>
    </html>
  `;
}

// 5. Conversión de HTML a Blob PDF utilizando html2pdf.js
async function htmlToPdfBlob(htmlContent, filename) {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "794px"; // A4 en px a 96 DPI
  container.style.backgroundColor = "#ffffff";
  container.innerHTML = htmlContent;
  document.body.appendChild(container);

  try {
    const opt = {
      margin: [8, 8, 8, 8],
      filename: filename || "documento.pdf",
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: { scale: 1.5, useCORS: true, logging: false },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    };
    const pdfBlob = await html2pdf().set(opt).from(container).output("blob");
    return pdfBlob;
  } finally {
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  }
}

// 6. Generación del ZIP con todos los archivos PDF posibles
export async function exportSeasonZip({ temporadaNombre, jugadores, partidos, entrenamientos, onProgress }) {
  const zip = new JSZip();
  const safeSeason = (temporadaNombre || "Actual").replace(/[^a-zA-Z0-9_-]/g, "_");

  // Crear carpetas organizadas dentro del zip
  const folderGeneral = zip.folder("01_Plantilla_General");
  const folderJugadores = zip.folder("02_Fichas_Jugadores");
  const folderPartidos = zip.folder("03_Actas_Partidos");
  const folderEntrenamientos = zip.folder("04_Entrenamientos");

  const totalTasks = 1 + jugadores.length + (partidos.filter(p => p.jugado || p.actaGuardada).length) + (entrenamientos.length > 0 ? 1 : 0);
  let completed = 0;

  const updateProgress = (label) => {
    completed++;
    if (onProgress) {
      onProgress({
        current: completed,
        total: totalTasks,
        percent: Math.round((completed / totalTasks) * 90),
        label
      });
    }
  };

  // 1. Reporte General de Plantilla
  try {
    const generalHTML = getGeneralReportHTML({ jugadores, partidos, entrenamientos, temporadaNombre });
    const generalBlob = await htmlToPdfBlob(generalHTML, `Reporte_General_Plantilla_${safeSeason}.pdf`);
    folderGeneral.file(`Reporte_General_Plantilla_${safeSeason}.pdf`, generalBlob);
  } catch (err) {
    console.error("Error generando PDF general, fallback HTML:", err);
    folderGeneral.file(`Reporte_General_Plantilla_${safeSeason}.html`, getGeneralReportHTML({ jugadores, partidos, entrenamientos, temporadaNombre }));
  }
  updateProgress("Reporte general de plantilla");

  // 2. Fichas Individuales de Cada Jugador
  for (const player of jugadores) {
    const safeName = (player.nombre || "Jugador").replace(/[^a-zA-Z0-9_-]/g, "_");
    const dorsalStr = String(player.dorsal || "00").padStart(2, "0");
    const filename = `Ficha_${dorsalStr}_${safeName}.pdf`;
    try {
      const playerHTML = getPlayerReportHTML({ player, partidos, entrenamientos, temporadaNombre });
      const playerBlob = await htmlToPdfBlob(playerHTML, filename);
      folderJugadores.file(filename, playerBlob);
    } catch (err) {
      console.error(`Error generando PDF de ${player.nombre}, fallback HTML:`, err);
      folderJugadores.file(filename.replace(".pdf", ".html"), getPlayerReportHTML({ player, partidos, entrenamientos, temporadaNombre }));
    }
    updateProgress(`Ficha de ${player.nombre}`);
  }

  // 3. Actas Oficiales de Partidos Jugados
  const playedMatches = partidos.filter(p => p.jugado || p.actaGuardada);
  for (const match of playedMatches) {
    const safeRival = (match.rival || "Rival").replace(/[^a-zA-Z0-9_-]/g, "_");
    const fecha = match.fecha || "Fecha";
    const filename = `Acta_${fecha}_vs_${safeRival}.pdf`;
    try {
      const matchHTML = getMatchReportHTML({ match, jugadores, temporadaNombre });
      const matchBlob = await htmlToPdfBlob(matchHTML, filename);
      folderPartidos.file(filename, matchBlob);
    } catch (err) {
      console.error(`Error generando acta ${match.rival}, fallback HTML:`, err);
      folderPartidos.file(filename.replace(".pdf", ".html"), getMatchReportHTML({ match, jugadores, temporadaNombre }));
    }
    updateProgress(`Acta vs ${match.rival}`);
  }

  // 4. Reporte de Entrenamientos
  if (entrenamientos.length > 0) {
    const filename = `Historial_Entrenamientos_${safeSeason}.pdf`;
    try {
      const trainingHTML = getTrainingReportHTML({ entrenamientos, jugadores, temporadaNombre });
      const trainingBlob = await htmlToPdfBlob(trainingHTML, filename);
      folderEntrenamientos.file(filename, trainingBlob);
    } catch (err) {
      console.error("Error generando PDF de entrenamientos, fallback HTML:", err);
      folderEntrenamientos.file(filename.replace(".pdf", ".html"), getTrainingReportHTML({ entrenamientos, jugadores, temporadaNombre }));
    }
    updateProgress("Historial de entrenamientos");
  }

  // 5. Archivo README con resumen de temporada
  const summaryText = `=====================================================
C.D. GORDITOS C.F - ARCHIVO DIGITAL DE TEMPORADA
Temporada: ${temporadaNombre || "Oficial"}
Fecha de Exportación: ${new Date().toLocaleString("es-ES")}
=====================================================

Contenido del archivo ZIP:
- 01_Plantilla_General: Reporte consolidado con todas las estadísticas, Pichichi y faltas de la plantilla.
- 02_Fichas_Jugadores: Expediente individual detallado de cada uno de los ${jugadores.length} jugadores.
- 03_Actas_Partidos: Actas oficiales completas de los ${playedMatches.length} partidos jugados.
- 04_Entrenamientos: Registro y control de asistencia de las ${entrenamientos.length} sesiones de entrenamiento.

¡Aúpa Gorditos C.F!
`;
  zip.file(`README_Temporada_${safeSeason}.txt`, summaryText);

  // Comprimir y descargar
  if (onProgress) onProgress({ current: totalTasks, total: totalTasks, percent: 95, label: "Comprimiendo archivo ZIP..." });
  const zipBlob = await zip.generateAsync({ type: "blob" });

  const downloadUrl = URL.createObjectURL(zipBlob);
  const downloadLink = document.createElement("a");
  downloadLink.href = downloadUrl;
  downloadLink.download = `CD_Gorditos_CF_Temporada_${safeSeason}_Informes_Completos.zip`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(downloadUrl);

  if (onProgress) onProgress({ current: totalTasks, total: totalTasks, percent: 100, label: "¡Descarga completada!" });
  return true;
}
