const test = require('node:test'), assert = require('node:assert');
const R = require('../server/rules');
const mk = (hand0, patch = {}) => { const g = R.newGame(0); g.phase = 'play'; g.p[0].hand = hand0; Object.assign(g.p[0], patch); return g; };
test('baraja de 106 cartas', () => { const d = R.buildDeck(); assert.equal(d.length, 106); assert.equal(d.filter(c => c.k === 'go').length, 14); });
test('no avanza sin semáforo verde', () => { const g = mk([{ id: 900, k: 'd25' }]); assert.ok(R.act(g, 0, 'play', 900)); });
test('límite de velocidad', () => {
  const g = mk([{ id: 900, k: 'd75' }, { id: 901, k: 'd50' }], { status: 'go', limit: true });
  assert.ok(R.act(g, 0, 'play', 900)); assert.equal(R.act(g, 0, 'play', 901), null); assert.equal(g.p[0].km, 50);
});
test('máximo dos 200 y meta exacta', () => {
  const g = mk([{ id: 900, k: 'd200' }], { status: 'go', n200: 2 }); assert.ok(R.act(g, 0, 'play', 900));
  const h = mk([{ id: 901, k: 'd50' }, { id: 902, k: 'd25' }], { status: 'go', km: 975 });
  assert.ok(R.act(h, 0, 'play', 901)); assert.equal(R.act(h, 0, 'play', 902), null); assert.equal(h.winner, 0);
});
test('pinchazo bloquea al rival', () => {
  const g = mk([{ id: 900, k: 'flat' }]); g.p[1].status = 'go';
  assert.equal(R.act(g, 0, 'play', 900), null); assert.equal(g.p[1].status, 'flat');
});
test('jugada maestra', () => {
  const g = mk([{ id: 900, k: 'flat' }]); g.p[1].status = 'go'; g.p[1].hand = [{ id: 950, k: 'punct' }];
  R.act(g, 0, 'play', 900); assert.equal(R.coupCard(g, 1).id, 950);
  assert.equal(R.act(g, 1, 'coup', 950), null); assert.equal(g.p[1].status, 'go'); assert.equal(g.turn, 1);
  assert.ok(R.act(g, 1, 'coup', 950));
});
test('la vista no revela la mano rival', () => { const v = R.view(R.newGame(0), 0); assert.equal(v.p[1].hand, 6); assert.equal(v.deck, 94); assert.ok(!('deckOrder' in v)); });
test('mazo agotado: se rebaraja salvo cartas superiores y manos', () => {
  const g = mk([{ id: 900, k: 'd25' }, { id: 901, k: 'd50' }], { status: 'go' }); g.deck = [];
  g.discard = [{ id: 1, k: 'd25' }]; g.p[0].pk = [{ id: 2, k: 'd25' }, { id: 3, k: 'd25' }]; g.p[1].sc = [{ id: 4, k: 'ace' }];
  assert.equal(R.act(g, 0, 'discard', 900), null);
  assert.equal(g.shuf, 1); assert.equal(g.deck.length, 3); assert.equal(g.p[0].pk.length, 1); assert.equal(g.p[0].pk[0].id, 3);
  assert.equal(g.p[1].sc.length, 1); assert.equal(g.p[0].hand.length, 1); assert.equal(g.phase, 'draw');
});
