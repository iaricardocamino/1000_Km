'use strict';
// Servidor HTTP + WebSocket. El servidor es la única fuente de verdad.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { WebSocketServer } = require('ws');
const R = require('./rules');
const html = fs.readFileSync(path.join(__dirname, '../public/index.html'));
const rooms = new Map();
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const code = () => Array.from({ length: 6 }, () => ALPHA[crypto.randomInt(ALPHA.length)]).join('');
const clean = n => String(n || '').replace(/[<>&"']/g, '').trim().slice(0, 16);

const srv = http.createServer((q, s) => {
  if (q.url === '/health') return s.end('ok');
  s.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); s.end(html);
});
const wss = new WebSocketServer({ server: srv, maxPayload: 2048 });
const send = (ws, o) => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));

function push(room) {
  room.seats.forEach((st, i) => {
    if (!st) return;
    const seats = room.seats.map((x, j) => x ? { name: x.name || 'Jugador ' + (j + 1), connected: !!x.ws } : null);
    const s = { code: room.code, you: i, started: !!room.g, seats };
    if (room.g) Object.assign(s, R.view(room.g, i));
    send(st.ws, { type: 'state', s });
  });
}

wss.on('connection', ws => {
  ws.alive = true; ws.on('pong', () => ws.alive = true);
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.type === 'create') {
      let c; do c = code(); while (rooms.has(c));
      const room = { code: c, seats: [{ token: crypto.randomUUID(), name: clean(m.name), ws }, null], g: null, last: Date.now() };
      rooms.set(c, room); ws.ctx = { room, seat: 0 };
      send(ws, { type: 'joined', code: c, token: room.seats[0].token }); return push(room);
    }
    if (m.type === 'join') {
      const room = rooms.get(String(m.code || '').toUpperCase());
      if (!room) return send(ws, { type: 'error', msg: 'Sala no encontrada', fatal: true });
      let seat = room.seats.findIndex(s => s && s.token === m.token);
      if (seat < 0) {
        seat = room.seats.findIndex(s => !s);
        if (seat < 0) return send(ws, { type: 'error', msg: 'La sala está llena', fatal: true });
        room.seats[seat] = { token: crypto.randomUUID(), name: clean(m.name) };
      }
      const st = room.seats[seat]; if (st.ws && st.ws !== ws) st.ws.close();
      st.ws = ws; if (m.name && !st.name) st.name = clean(m.name); ws.ctx = { room, seat }; room.last = Date.now();
      send(ws, { type: 'joined', code: room.code, token: st.token }); return push(room);
    }
    const c = ws.ctx; if (!c) return;
    const { room, seat } = c; room.last = Date.now();
    if (m.type === 'start' || m.type === 'rematch') {
      const ok = m.type === 'start' ? !room.g && seat === 0 && room.seats[1] : room.g && room.g.over;
      if (!ok) return send(ws, { type: 'error', msg: 'No se puede empezar ahora' });
      room.g = R.newGame(crypto.randomInt(2)); return push(room);
    }
    if (!room.g) return;
    const e = R.act(room.g, seat, m.type, m.card);
    if (e) send(ws, { type: 'error', msg: e }); else push(room);
  });
  ws.on('close', () => { const c = ws.ctx; if (c && c.room.seats[c.seat] && c.room.seats[c.seat].ws === ws) { c.room.seats[c.seat].ws = null; push(c.room); } });
});
setInterval(() => { wss.clients.forEach(w => { if (!w.alive) return w.terminate(); w.alive = false; w.ping(); }); }, 30000);
setInterval(() => { for (const [k, r] of rooms) if (Date.now() - r.last > 864e5) rooms.delete(k); }, 36e5);
srv.listen(process.env.PORT || 3000, () => console.log('1000 Hitos en puerto', process.env.PORT || 3000));
