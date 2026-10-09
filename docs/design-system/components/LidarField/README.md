# LidarField

The living background: a perspective lidar scan of drifting terrain rendered as dots, with a sweeping `accent` scanline and every current visitor's pointer trail in their `presence-*` color.

**Consumer provides** a full-viewport `<canvas>` fixed behind the page (`position: fixed; inset: 0; z-index: -1; pointer-events: none`) and the peer list `[{ colorVar: '--presence-3', trail: [[x, y], …] }]` with coordinates normalized 0–1. `Paper.lidarField(canvas, { pitch: 12, peers })` returns `{ stop, setPeers }`.

On the site, peers come from a realtime channel (one broadcast of the pointer ~15×/s, throttled, no identity). Drop to 40% opacity behind articles. Still frame under `prefers-reduced-motion`.
