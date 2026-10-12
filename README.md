# 1000 Hitos · versión web para dos

Juego clásico de 1000 Hitos (Fournier) en el navegador. Servidor Node con WebSocket: el servidor guarda el mazo, las manos y valida cada jugada; cada cliente solo recibe su propia mano.

## Probar en local
```
npm install
npm test
npm start        # http://localhost:3000
```
Abre dos pestañas (una en privado), crea la partida en una y entra con el código en la otra.

## Publicar en internet (Render, plan gratuito)
1. Sube esta carpeta a un repositorio de GitHub.
2. En render.com: **New → Web Service** → elige el repositorio.
3. Runtime Node · Build Command `npm install` · Start Command `npm start` · plan Free.
4. Cuando termine tendrás una URL `https://…onrender.com` (HTTPS y WebSocket seguros automáticos).
5. Crea una sala desde esa URL, copia el enlace y envíaselo a tu pareja. Comprobadlo desde redes distintas.
Alternativas equivalentes: Fly.io o Railway (mismo `npm start`; usan la variable `PORT`).

## Límites importantes
- Las partidas viven **en memoria**: si el servicio se reinicia o redespliega, se pierden. En el plan gratuito de Render el servicio se duerme tras ~15 min sin uso: la primera visita tarda unos segundos y, si se durmió a mitad de partida, esta se pierde. Verifica las condiciones vigentes del plan antes de publicar.
- Recargar la página o una desconexión breve **sí** conservan la partida (token de sesión guardado en el navegador).
- Las salas inactivas se borran tras 24 h.

## Reglas implementadas y decisiones
- 106 cartas con la composición del PDF; 6 cartas por jugador; robar, jugar o descartar.
- Se arranca con Semáforo verde (o Prioridad de paso). Tras reparar otras averías no hace falta otro verde.
- Un bloqueo de conducción a la vez + límite de velocidad aparte. Averías solo contra rival en marcha (regla clásica).
- Máximo dos 200 km; meta exacta en 1.000 km; la carrera acaba al instante.
- Jugada maestra: tras recibir una avería, puedes jugar el escudo correspondiente **antes de robar en tu turno** (así el rival no ve tu mano); cancela la avería, repones carta y robas/juegas de nuevo. Decisión de diseño: no es en el mismo instante del ataque.
- Mazo agotado: se barajan descarte y cartas jugadas de nuevo, salvo la carta superior de los mazos de kilómetros, marcha y velocidad de cada jugador, los escudos en juego y las manos. Los kilómetros siguen contando aunque sus cartas se reciclen.
- Escudo jugado con la avería ya activa: la retira. Descartes definitivos.

## Pendiente / simplificaciones
- Las cartas son arte SVG propio inspirado en la edición clásica española; conviene retocarlas contra las fotos.
- Las animaciones son sencillas y no hay pruebas automáticas de red; la sincronización hay que probarla con dos dispositivos reales.
