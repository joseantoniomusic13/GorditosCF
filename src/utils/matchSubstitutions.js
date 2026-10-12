/**
 * Utilidades para el cálculo y gestión de sustituciones en partidos
 * con soporte para cambios volantes / rotativos / ilimitados (reingresos).
 */

/**
 * Calcula los tramos de juego y minutos acumulados de cada jugador según la alineación y los cambios.
 *
 * @param {Array<string>} titularesIds - IDs de los jugadores que inician en el campo (minuto 0)
 * @param {Array<string>} suplentesIds - IDs de los suplentes (inician en banquillo)
 * @param {Array<Object>} sustituciones - Array de { id, minuto, saleId, entraId, motivo }
 * @param {number} duracionPartido - Duración total del encuentro (por defecto 90)
 * @returns {Object} Mapa: jugadorId => { minutosTotales: number, tramos: Array<Object>, enCampoAlFinal: boolean }
 */
export function calcularEstadisticasCambios(titularesIds = [], suplentesIds = [], sustituciones = [], duracionPartido = 90) {
  const jugadoresMap = {};

  const ensurePlayer = (id) => {
    if (!jugadoresMap[id]) {
      jugadoresMap[id] = {
        enCampo: false,
        minutoEntrada: null,
        tramos: [],
        minutosTotales: 0,
        esTitular: false
      };
    }
    return jugadoresMap[id];
  };

  // 1. Titulares: inician en el terreno de juego en el minuto 0
  (titularesIds || []).filter(Boolean).forEach(id => {
    const p = ensurePlayer(id);
    p.enCampo = true;
    p.minutoEntrada = 0;
    p.esTitular = true;
  });

  // 2. Suplentes: inician en el banquillo
  (suplentesIds || []).filter(Boolean).forEach(id => {
    const p = ensurePlayer(id);
    p.enCampo = false;
    p.minutoEntrada = null;
    p.esTitular = false;
  });

  // 3. Ordenar sustituciones por minuto ascendente de forma segura
  const subsOrdenadas = [...(sustituciones || [])]
    .map(s => ({
      ...s,
      minuto: Math.min(120, Math.max(0, parseInt(s.minuto) || 0))
    }))
    .sort((a, b) => a.minuto - b.minuto);

  // 4. Procesar cada sustitución en orden cronológico
  subsOrdenadas.forEach(sub => {
    const m = sub.minuto;
    const { saleId, entraId } = sub;

    // A) Jugador que sale al banquillo
    if (saleId) {
      const pSale = ensurePlayer(saleId);
      const desde = pSale.minutoEntrada !== null ? pSale.minutoEntrada : 0;
      const duracion = Math.max(0, m - desde);

      pSale.tramos.push({
        desde,
        hasta: m,
        minutos: duracion,
        tipo: "salida",
        otroJugadorId: entraId,
        motivo: sub.motivo || "",
        desc: `Minuto ${m}': Sale al banquillo (jugó ${duracion}')`
      });
      pSale.minutosTotales += duracion;
      pSale.enCampo = false;
      pSale.minutoEntrada = null;
    }

    // B) Jugador que entra (o reingresa) al campo
    if (entraId) {
      const pEntra = ensurePlayer(entraId);
      // Si por alguna razón técnica figuraba ya en el campo, cerramos el tramo anterior
      if (pEntra.enCampo && pEntra.minutoEntrada !== null) {
        const durPrev = Math.max(0, m - pEntra.minutoEntrada);
        pEntra.tramos.push({
          desde: pEntra.minutoEntrada,
          hasta: m,
          minutos: durPrev,
          tipo: "reingreso_ajuste",
          desc: `Minuto ${pEntra.minutoEntrada}'-${m}': En campo (${durPrev}')`
        });
        pEntra.minutosTotales += durPrev;
      }

      pEntra.enCampo = true;
      pEntra.minutoEntrada = m;
    }
  });

  // 5. Tramo final: para todos los que quedaron en el campo hasta el pitido final
  Object.entries(jugadoresMap).forEach(([id, p]) => {
    if (p.enCampo && p.minutoEntrada !== null) {
      const duracion = Math.max(0, duracionPartido - p.minutoEntrada);
      p.tramos.push({
        desde: p.minutoEntrada,
        hasta: duracionPartido,
        minutos: duracion,
        tipo: "final",
        desc: `Minuto ${p.minutoEntrada}'-${duracionPartido}': Hasta final (${duracion}')`
      });
      p.minutosTotales += duracion;
      p.enCampo = false;
      p.minutoEntrada = null;
    }
  });

  return jugadoresMap;
}

/**
 * Obtiene el resumen de tramos y minutos calculados para un jugador concreto.
 */
export function obtenerTramosJugador(jugadorId, titularesIds = [], suplentesIds = [], sustituciones = [], duracionPartido = 90) {
  const todos = calcularEstadisticasCambios(titularesIds, suplentesIds, sustituciones, duracionPartido);
  const data = todos[jugadorId];
  if (!data || data.tramos.length === 0) {
    return null;
  }
  return {
    totalMinutos: data.minutosTotales,
    tramos: data.tramos
  };
}
