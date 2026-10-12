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
const newPlayer = () => ({ km: 0, status: 'start', limit: false, shields: [], n200: 0, hand: [] });

function newGame(first) {
  const deck = shuffle(buildDeck());
  const p = [newPlayer(), newPlayer()];
  for (let i = 0; i < 6; i++) { p[0].hand.push(deck.pop()); p[1].hand.push(deck.pop()); }
  return { deck, discard: [], p, turn: first, phase: 'draw', lastHazard: null, over: false, winner: null, rev: 0, msg: '' };
}

// Devuelve null si la carta es jugable, o el motivo por el que no.
function why(g, seat, card) {
  if (g.over) return 'La carrera ha terminado';
  if (g.turn !== seat) return 'No es tu turno';
  if (g.phase !== 'play') return 'Primero roba una carta';
  const me = g.p[seat], rv = g.p[1 - seat], k = card.k;
  if (k[0] === 'd') {
    const v = +k.slice(1);
    if (me.status !== 'go') return me.status === 'start' ? 'Necesitas un semáforo verde para arrancar' : 'Estás detenido: repara primero';
    if (me.km + v > 1000) return 'Superarías los 1.000 km';
    if (me.limit && v > 50) return 'Límite de velocidad: solo 25 o 50 km';
    if (v === 200 && me.n200 >= 2) return 'Máximo dos cartas de 200 km';
    return null;
  }
  if (HAZ.includes(k)) {
    if (rv.shields.includes(SHIELD_OF[k])) return 'El rival tiene el escudo correspondiente';
    if (k === 'limit') return rv.limit ? 'El rival ya tiene límite' : null;
    return rv.status === 'go' ? null : 'El rival no está en marcha';
  }
  if (k === 'go') return ['start', 'stop'].includes(me.status) ? null : 'No lo necesitas ahora';
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

function endTurn(g, seat) {
  g.turn = 1 - seat; g.phase = g.deck.length ? 'draw' : 'play';
  if (!g.deck.length) { // mazo agotado: se sigue sin robar hasta quedarse sin cartas
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
    take(me, c.id); me.shields.push(c.k);
    if (g.lastHazard.k === 'limit') me.limit = false; else me.status = 'go';
    g.lastHazard = null; if (g.deck.length) me.hand.push(g.deck.pop());
    g.msg = '¡Jugada maestra! Avería cancelada y turno extra'; g.rev++; return null;
  }
  if (g.turn !== seat) return 'No es tu turno';
  if (type === 'draw') {
    if (g.phase !== 'draw') return 'Ya has robado';
    g.lastHazard = null; me.hand.push(g.deck.pop()); g.phase = 'play'; g.msg = ''; g.rev++; return null;
  }
  if (g.phase !== 'play') return 'Primero roba una carta';
  const card = me.hand.find(c => c.id === cardId); if (!card) return 'Esa carta no es tuya';
  g.lastHazard = null; g.msg = '';
  if (type === 'discard') { take(me, cardId); g.discard.push(card); }
  else if (type === 'play') {
    const r = why(g, seat, card); if (r) return r;
    take(me, cardId); const k = card.k;
    if (k[0] === 'd') {
      const v = +k.slice(1); me.km += v; if (v === 200) me.n200++;
      if (me.km === 1000) { g.over = true; g.winner = seat; }
    } else if (HAZ.includes(k)) {
      if (k === 'limit') rv.limit = true; else rv.status = k;
      g.lastHazard = { victim: 1 - seat, k };
    } else if (k === 'go' || REMEDY_OF[k]) { me.status = 'go'; g.discard.push(card); }
    else if (k === 'endlimit') { me.limit = false; g.discard.push(card); }
    else { // escudo: protege y retira la avería asociada si ya estaba activa
      me.shields.push(k);
      if (k === 'right') { if (['start', 'stop'].includes(me.status)) me.status = 'go'; me.limit = false; }
      else if (me.status === SHIELD_CURES[k]) me.status = 'go';
    }
  } else return 'Comando desconocido';
  g.rev++;
  if (!g.over) endTurn(g, seat);
  return null;
}

// Vista privada: solo la mano propia, nunca el orden del mazo.
function view(g, seat) {
  const me = g.p[seat];
  const pub = p => ({ km: p.km, status: p.status, limit: p.limit, shields: p.shields, n200: p.n200, hand: p.hand.length });
  const cc = coupCard(g, seat);
  return {
    rev: g.rev, turn: g.turn, phase: g.phase, over: g.over, winner: g.winner, msg: g.msg,
    deck: g.deck.length, discard: g.discard.length, p: g.p.map(pub),
    hand: me.hand, legal: Object.fromEntries(me.hand.map(c => [c.id, why(g, seat, c)])),
    coup: cc ? cc.id : null
  };
}
module.exports = { buildDeck, newGame, why, act, view, coupCard };
