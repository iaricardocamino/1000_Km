'use strict';
// Reglas de 1000 Hitos (edición clásica). Lógica pura, sin red ni interfaz.
const crypto = require('crypto');
const DIST = { 25: 10, 50: 10, 75: 10, 100: 12, 200: 4 };
const COUNTS = { accident: 3, gas: 3, flat: 3, stop: 5, limit: 4, repair: 6, fuel: 6, spare: 6, go: 14, endlimit: 6, ace: 1, tank: 1, punct: 1, right: 1 };
const HAZ = ['accident', 'gas', 'flat', 'stop', 'limit'];
const REMEDY_OF = { repair: 'accident', fuel: 'gas', spare: 'flat' };
const SHIELD_OF = { accident: 'ace', gas: 'tank', flat: 'punct', stop: 'right', limit: 'right' };
const SHIELD_CURES = { ace: 'accident', tank: 'gas', punct: 'flat' };

function buildDeck() {
  let id = 0; const d = [];
  for (const [v, n] of Object.entries(DIST)) for (let i = 0; i < n; i++) d.push({ id: id++, k: 'd' + v });
  for (const [k, n] of Object.entries(COUNTS)) for (let i = 0; i < n; i++) d.push({ id: id++, k });
  return d;
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const newPlayer = () => ({ km: 0, status: 'start', limit: false, shields: [], n200: 0, hand: [], pk: [], pd: [], ps: [], sc: [] });

function newGame(first) {
  const deck = shuffle(buildDeck());
  const p = [newPlayer(), newPlayer()];
  for (let i = 0; i < 6; i++) { p[0].hand.push(deck.pop()); p[1].hand.push(deck.pop()); }
  return { deck, discard: [], p, turn: first, phase: 'draw', lastHazard: null, over: false, winner: null, rev: 0, msg: '', shuf: 0, last: null };
}

// Devuelve null si la carta es jugable, o el motivo por el que no.
function why(g, seat, card) {
  if (g.over) return 'La carrera ha terminado';
  if (g.turn !== seat) return 'No es tu turno';
  if (g.phase !== 'play') return 'Primero roba una carta';
  const me = g.p[seat], rv = g.p[1 - seat], k = card.k;
  if (k[0] === 'd') {
    const v = +k.slice(1);
    if (me.status !== 'go') return me.status === 'start' ? 'Necesitas un semáforo verde para arrancar' : me.status === 'rep' ? 'Ya está reparado: juega un Libre (verde) antes de avanzar' : 'Estás detenido: repara primero';
    if (me.limit && v > 50) return 'Límite de velocidad: solo 25 o 50 km';
    if (v === 200 && me.n200 >= 2) return 'Máximo dos cartas de 200 km';
    return null;
  }
  if (HAZ.includes(k)) {
    if (rv.shields.includes(SHIELD_OF[k])) return 'El rival tiene el escudo correspondiente';
    if (k === 'limit') return rv.limit ? 'El rival ya tiene límite' : null;
    return rv.status === 'go' ? null : 'El rival no está en marcha';
  }
  if (k === 'go') return ['start', 'stop', 'rep'].includes(me.status) ? null : 'No lo necesitas ahora';
  if (REMEDY_OF[k]) return me.status === REMEDY_OF[k] ? null : 'No tienes esa avería';
  if (k === 'endlimit') return me.limit ? null : 'No tienes límite de velocidad';
  return me.shields.includes(k) ? 'Ya has jugado este escudo' : null; // escudos
}

// Carta de escudo con la que la víctima puede reaccionar (jugada maestra), o null.
function coupCard(g, seat) {
  const h = g.lastHazard;
  if (!h || h.victim !== seat || g.turn !== seat || g.phase !== 'draw' || g.over) return null;
  const me = g.p[seat];
  if (!(h.k === 'limit' ? me.limit : me.status === h.k)) return null;
  return me.hand.find(c => c.k === SHIELD_OF[h.k]) || null;
}

// Mazo agotado: se barajan descarte y cartas jugadas, salvo la carta superior de los mazos
// de kilómetros, marcha y velocidad de cada jugador, los escudos en juego y las manos.
function refill(g) {
  if (g.deck.length) return;
  const top = g.discard.pop(); const pool = g.discard.splice(0); if (top) g.discard.push(top);
  for (const p of g.p) for (const z of ['pk', 'pd', 'ps']) { const top = p[z].pop(); pool.push(...p[z]); p[z] = top ? [top] : []; }
  if (!pool.length) return;
  g.deck = shuffle(pool); g.shuf++; g.msg = 'Se acabó el mazo: barajando las cartas jugadas…';
}
function endTurn(g, seat) {
  refill(g);
  g.turn = 1 - seat; g.phase = g.deck.length || g.discard.length ? 'draw' : 'play';
  if (!g.deck.length && !g.discard.length) { // mazo agotado: se sigue sin robar hasta quedarse sin cartas
    if (!g.p[g.turn].hand.length) g.turn = seat;
    if (!g.p[0].hand.length && !g.p[1].hand.length) {
      g.over = true; const [a, b] = [g.p[0].km, g.p[1].km]; g.winner = a === b ? -1 : a > b ? 0 : 1;
    }
  }
}
function take(p, id) { const i = p.hand.findIndex(c => c.id === id); return i < 0 ? null : p.hand.splice(i, 1)[0]; }

// Ejecuta un comando del cliente. Devuelve null si va bien o el texto del error.
function act(g, seat, type, cardId) {
  if (g.over) return 'La carrera ha terminado';
  const me = g.p[seat], rv = g.p[1 - seat];
  if (type === 'coup') {
    const c = coupCard(g, seat); if (!c || c.id !== cardId) return 'No puedes hacer jugada maestra';
    take(me, c.id); me.shields.push(c.k); me.sc.push(c); g.last = { n: g.rev + 1, seat, k: c.k, t: 'coup' };
    if (g.lastHazard.k === 'limit') me.limit = false; else me.status = 'go';
    g.lastHazard = null; if (g.deck.length) me.hand.push(g.deck.pop());
    g.msg = '¡Jugada maestra! Avería cancelada y turno extra'; g.rev++; return null;
  }
  if (g.turn !== seat) return 'No es tu turno';
  if (type === 'drawdiscard') {
    if (g.phase !== 'draw') return 'Ya has robado';
    if (!g.discard.length) return 'El descarte está vacío';
    g.lastHazard = null; g.msg = ''; const c = g.discard.pop(); me.hand.push(c); g.phase = 'play';
    g.last = { n: g.rev + 1, seat, k: c.k, t: 'takediscard' }; g.rev++; return null;
  }
  if (type === 'draw') {
    if (g.phase !== 'draw') return 'Ya has robado';
    const sh = g.shuf; refill(g); if (!g.deck.length) return 'El mazo está vacío: coge del descarte';
    g.lastHazard = null; if (g.shuf === sh) g.msg = ''; me.hand.push(g.deck.pop()); g.phase = 'play'; g.rev++; return null;
  }
  if (g.phase !== 'play') return 'Primero roba una carta';
  const card = me.hand.find(c => c.id === cardId); if (!card) return 'Esa carta no es tuya';
  g.lastHazard = null; g.msg = '';
  if (type === 'discard') { take(me, cardId); g.discard.push(card); }
  else if (type === 'play') {
    const r = why(g, seat, card); if (r) return r;
    take(me, cardId); const k = card.k;
    if (k[0] === 'd') {
      const v = +k.slice(1); me.km += v; me.pk.push(card); if (v === 200) me.n200++;
      if (me.km >= 1000) { g.over = true; g.winner = seat; }
    } else if (HAZ.includes(k)) {
      if (k === 'limit') { rv.limit = true; rv.ps.push(card); } else { rv.status = k; rv.pd.push(card); }
      g.lastHazard = { victim: 1 - seat, k };
    } else if (k === 'go') { me.status = 'go'; me.pd.push(card); }
    else if (REMEDY_OF[k]) { me.status = me.shields.includes('right') ? 'go' : 'rep'; me.pd.push(card); } // tras reparar hace falta un Libre, salvo con Vehículo prioritario
    else if (k === 'endlimit') { me.limit = false; me.ps.push(card); }
    else { // escudo: protege y retira la avería asociada si ya estaba activa
      me.shields.push(k); me.sc.push(card);
      if (k === 'right') { if (['start', 'stop', 'rep'].includes(me.status)) me.status = 'go'; me.limit = false; }
      else if (me.status === SHIELD_CURES[k]) me.status = me.shields.includes('right') ? 'go' : 'rep';
    }
  } else return 'Comando desconocido';
  g.last = { n: g.rev + 1, seat, k: card.k, t: type };
  g.rev++;
  if (!g.over) endTurn(g, seat);
  return null;
}

// Vista privada: solo la mano propia, nunca el orden del mazo.
function view(g, seat) {
  const me = g.p[seat];
  const pub = p => ({ km: p.km, status: p.status, limit: p.limit, shields: p.shields, n200: p.n200, hand: p.hand.length, pk: p.pk.slice(-4), pd: p.pd.slice(-3), ps: p.ps.slice(-1), sc: p.sc });
  const cc = coupCard(g, seat);
  return {
    rev: g.rev, turn: g.turn, phase: g.phase, over: g.over, winner: g.winner, msg: g.msg,
    deck: g.deck.length, discard: g.discard.length, dtop: g.discard[g.discard.length - 1] || null, shuf: g.shuf, last: g.last, p: g.p.map(pub),
    hand: me.hand, legal: Object.fromEntries(me.hand.map(c => [c.id, why(g, seat, c)])),
    coup: cc ? cc.id : null
  };
}
module.exports = { buildDeck, newGame, why, act, view, coupCard };
