const test = require('node:test'), assert = require('node:assert');
const R = require('../server/rules');
const mk = (hand0, patch = {}) => { const g = R.newGame(0); g.phase = 'play'; g.p[0].hand = hand0; Object.assign(g.p[0], patch); return g; };
test('baraja de 106 cartas', () => { const d = R.buildDeck(); assert.equal(d.length, 106); assert.equal(d.filter(c => c.k === 'go').length, 14); });
test('no avanza sin semáforo verde', () => { const g = mk([{ id: 900, k: 'd25' }]); assert.ok(R.act(g, 0, 'play', 900)); });
test('límite de velocidad', () => {
  const g = mk([{ id: 900, k: 'd75' }, { id: 901, k: 'd50' }], { status: 'go', limit: true });
  assert.ok(R.act(g, 0, 'play', 900)); assert.equal(R.act(g, 0, 'play', 901), null); assert.equal(g.p[0].km, 50);
});
test('máximo dos 200 y se puede superar los 1000', () => {
  const g = mk([{ id: 900, k: 'd200' }], { status: 'go', n200: 2 }); assert.ok(R.act(g, 0, 'play', 900));
  const h = mk([{ id: 901, k: 'd50' }, { id: 902, k: 'd25' }], { status: 'go', km: 975 });
  assert.equal(R.act(h, 0, 'play', 901), null); assert.equal(h.winner, 0); assert.equal(h.p[0].km, 1025); assert.equal(h.over, true);
});
test('pinchazo bloquea al rival', () => {
  const g = mk([{ id: 900, k: 'flat' }]); g.p[1].status = 'go';
  assert.equal(R.act(g, 0, 'play', 900), null); assert.equal(g.p[1].status, 'flat');
});
test('jugada maestra', () => {
  const g = mk([{ id: 900, k: 'flat' }]); g.p[1].status = 'go'; g.p[1].hand = [{ id: 950, k: 'punct' }];
  R.act(g, 0, 'play', 900); assert.equal(R.coupCard(g, 1).id, 950);
  assert.equal(R.act(g, 1, 'coup', 950), null); assert.equal(g.p[1].status, 'go'); assert.equal(g.turn, 1); assert.equal(g.phase, 'draw');
  assert.ok(R.act(g, 1, 'coup', 950));
});
test('la vista no revela la mano rival', () => { const v = R.view(R.newGame(0), 0); assert.equal(v.p[1].hand, 6); assert.equal(v.deck, 94); assert.ok(!('deckOrder' in v)); });
test('mazo agotado: se rebaraja salvo cartas superiores y manos', () => {
  const g = mk([{ id: 900, k: 'd25' }, { id: 901, k: 'd50' }], { status: 'go' }); g.deck = [];
  g.discard = [{ id: 1, k: 'd25' }]; g.p[0].pk = [{ id: 2, k: 'd25' }, { id: 3, k: 'd25' }]; g.p[1].sc = [{ id: 4, k: 'ace' }];
  assert.equal(R.act(g, 0, 'discard', 900), null);
  assert.equal(g.shuf, 1); assert.equal(g.deck.length, 2); assert.equal(g.discard.length, 1); assert.equal(g.discard[0].id, 900); assert.equal(g.p[0].pk.length, 1); assert.equal(g.p[0].pk[0].id, 3);
  assert.equal(g.p[1].sc.length, 1); assert.equal(g.p[0].hand.length, 1); assert.equal(g.phase, 'draw');
});
test('tras reparar hace falta un Libre, salvo con Vehículo prioritario', () => {
  for (const [k, st] of [['spare', 'flat'], ['repair', 'accident'], ['fuel', 'gas']]) {
    const g = mk([{ id: 900, k }, { id: 901, k: 'd25' }, { id: 902, k: 'go' }], { status: st });
    assert.equal(R.act(g, 0, 'play', 900), null); assert.equal(g.p[0].status, 'rep');
    g.turn = 0; g.phase = 'play'; assert.ok(R.act(g, 0, 'play', 901));
    assert.equal(R.act(g, 0, 'play', 902), null); assert.equal(g.p[0].status, 'go');
  }
  const h = mk([{ id: 900, k: 'spare' }], { status: 'flat', shields: ['right'] }); R.act(h, 0, 'play', 900); assert.equal(h.p[0].status, 'go');
});
test('robar del descarte', () => {
  const g = R.newGame(0); g.turn = 0; g.phase = 'draw';
  assert.ok(R.act(g, 0, 'drawdiscard')); g.discard = [{ id: 999, k: 'd25' }]; const n = g.deck.length;
  assert.equal(R.act(g, 0, 'drawdiscard'), null); assert.equal(g.deck.length, n); assert.equal(g.discard.length, 0); assert.equal(g.p[0].hand.length, 7);
  assert.ok(R.act(g, 0, 'drawdiscard')); assert.equal(g.phase, 'play');
});
test('jugada maestra con cada escudo', () => {
  for (const [haz, sh] of [['accident', 'ace'], ['gas', 'tank'], ['flat', 'punct'], ['stop', 'right']]) {
    const g = mk([{ id: 900, k: haz }]); g.p[1].status = 'go'; g.p[1].hand = [{ id: 950, k: sh }];
    R.act(g, 0, 'play', 900); assert.equal(R.coupCard(g, 1).id, 950); assert.equal(R.act(g, 1, 'coup', 950), null); assert.equal(g.p[1].status, 'go');
  }
  const g = mk([{ id: 900, k: 'flat' }]); g.p[1].status = 'go'; g.p[1].hand = [{ id: 950, k: 'punct' }, { id: 951, k: 'd25' }];
  R.act(g, 0, 'play', 900); assert.equal(R.act(g, 1, 'draw'), null); assert.equal(R.coupCard(g, 1), null); // rechazar la jugada maestra es opcional
});
test('simulación: sin cartas duplicadas ni perdidas', () => {
  for (let n = 0; n < 40; n++) {
    const g = R.newGame(n % 2); let steps = 0;
    while (!g.over && steps++ < 3000) {
      const s = g.turn, v = R.view(g, s), h = g.p[s].hand;
      if (v.coup !== null && Math.random() < .7) R.act(g, s, 'coup', v.coup);
      else if (g.phase === 'draw') R.act(g, s, g.discard.length && Math.random() < .3 ? 'drawdiscard' : 'draw');
      else if (h.length) { const pl = h.filter(c => !R.why(g, s, c)), c = pl.length && Math.random() < .85 ? pl[Math.floor(Math.random() * pl.length)] : h[Math.floor(Math.random() * h.length)]; R.act(g, s, pl.includes(c) ? 'play' : 'discard', c.id); }
      const all = [...g.deck, ...g.discard]; g.p.forEach(p => all.push(...p.hand, ...p.pk, ...p.pd, ...p.ps, ...p.sc));
      assert.equal(all.length, 106); assert.equal(new Set(all.map(c => c.id)).size, 106);
    }
  }
});
