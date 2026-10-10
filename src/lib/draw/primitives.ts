export type RGB = [number, number, number];
export type Pt = [number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Everything an illustration needs to render itself. */
export interface Env {
  ctx: CanvasRenderingContext2D;
  /** total device scale (zoom * dpr) – shadows are not transformed by the CTM, so we compensate */
  s: number;
  acc: RGB;
  /** seconds */
  t: number;
  /** energy 0..1 (idle ≈ .38, active = 1) */
  e: number;
  active: boolean;
  done: boolean;
  /** 0..1 progress while active */
  prog: number;
  /** card width */
  w: number;
  /** generate-node state: -1 idle · 0..1 generating · 1..2 ready */
  gen: number;
  pillHover: boolean;
}

/** A repeating single-dot tile (dot centred), `px` device pixels square */
export function dotTile(px: number, r: number, color: string): CanvasPattern | null {
  const c = document.createElement("canvas");
  c.width = px;
  c.height = px;
  const x = c.getContext("2d");
  if (!x) return null;
  x.fillStyle = color;
  x.beginPath();
  x.arc(px / 2, px / 2, r, 0, Math.PI * 2);
  x.fill();
  return x.createPattern(c, "repeat");
}

export const A = (env: Env, a: number) => `rgba(${env.acc[0]},${env.acc[1]},${env.acc[2]},${a})`;
export const W = (a: number) => `rgba(255,255,255,${a})`;

export const FONT = '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function shadow(env: Env, color: string, blur: number, oy = 0) {
  const { ctx } = env;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur * env.s;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = oy * env.s;
}

export function noShadow(env: Env) {
  const { ctx } = env;
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowOffsetX = 0;
}

/** soft radial accent glow */
export function spot(env: Env, x: number, y: number, r: number, alpha: number) {
  if (alpha <= 0.002) return;
  const { ctx } = env;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, A(env, alpha));
  g.addColorStop(1, A(env, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export interface TileOpts {
  accent?: number;
  shadow?: boolean;
  top?: string;
  bottom?: string;
}

/** The signature dark, softly-lit rounded square */
export function tile(env: Env, x: number, y: number, w: number, h: number, r: number, o: TileOpts = {}) {
  const { ctx } = env;
  ctx.save();
  if (o.shadow) shadow(env, "rgba(0,0,0,0.65)", 16, 7);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, o.top ?? "#313134");
  g.addColorStop(1, o.bottom ?? "#1b1b1d");
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();

  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.clip();
  const hg = ctx.createLinearGradient(0, y, 0, y + h * 0.55);
  hg.addColorStop(0, "rgba(255,255,255,0.075)");
  hg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hg;
  ctx.fillRect(x, y, w, h * 0.55);
  ctx.restore();

  rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.lineWidth = 1;
  ctx.strokeStyle = o.accent && o.accent > 0.01 ? A(env, 0.16 + 0.6 * Math.min(1, o.accent)) : W(0.075);
  ctx.stroke();
}

/* ───────────── icons (24×24 box) ───────────── */

interface IconDef {
  d: string;
  fill?: boolean;
  lw?: number;
}

const ICONS = {
  upload: {
    d: "M12 16V5M7.5 9.5L12 5l4.5 4.5M5 15v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3",
    lw: 1.9,
  },
  addfile: {
    d: "M20 12V7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h5M17 15v6M14 18h6",
    lw: 2.5,
  },
  doc: {
    d: "M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM14 3v5h5M9 13h6M9 17h4",
    lw: 1.8,
  },
  folder: {
    d: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
    fill: true,
    lw: 1.4,
  },
  bolt: {
    d: "M13.5 2L4.5 13.5h6L9.5 22l9-11.5h-6z",
    fill: true,
    lw: 1.6,
  },
  sparkle: {
    d: "M10 3.5Q11 10 17.5 11Q11 12 10 18.5Q9 12 2.5 11Q9 10 10 3.5zM18.5 2Q19 5 22 5.5Q19 6 18.5 9Q18 6 15 5.5Q18 5 18.5 2z",
    fill: true,
    lw: 1.2,
  },
  user: {
    d: "M12 3.5a4.2 4.2 0 1 0 0 8.4a4.2 4.2 0 1 0 0-8.4zM4.5 20.5c0-4.2 3.3-6.5 7.5-6.5s7.5 2.3 7.5 6.5z",
    fill: true,
    lw: 1.2,
  },
  check: {
    d: "M5 12.5l4.5 4.5L19 7.5",
    lw: 2.8,
  },
} satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;

const pathCache = new Map<string, Path2D>();
function getPath(name: IconName): Path2D {
  let p = pathCache.get(name);
  if (!p) {
    p = new Path2D(ICONS[name].d);
    pathCache.set(name, p);
  }
  return p;
}

export function icon(env: Env, name: IconName, cx: number, cy: number, size: number, color: string, glow = 0) {
  const { ctx } = env;
  const def: IconDef = ICONS[name];
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  if (glow > 0) shadow(env, color, glow, 0);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  const p = getPath(name);
  if (def.fill) {
    ctx.fill(p);
    ctx.lineWidth = def.lw ?? 1.4;
    ctx.stroke(p);
  } else {
    ctx.lineWidth = def.lw ?? 1.8;
    ctx.stroke(p);
  }
  ctx.restore();
}

/* ───────────── polylines & wires ───────────── */

export function polyLen(pts: Pt[]): number {
  let L = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    L += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  }
  return L;
}

export function subPoly(pts: Pt[], s0: number, s1: number): Pt[] {
  const out: Pt[] = [];
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (seg === 0) continue;
    const st = acc;
    const en = acc + seg;
    if (en >= s0 && st <= s1) {
      const u0 = Math.max(0, (s0 - st) / seg);
      const u1 = Math.min(1, (s1 - st) / seg);
      const p0: Pt = [a[0] + (b[0] - a[0]) * u0, a[1] + (b[1] - a[1]) * u0];
      const p1: Pt = [a[0] + (b[0] - a[0]) * u1, a[1] + (b[1] - a[1]) * u1];
      if (out.length === 0) out.push(p0);
      out.push(p1);
    }
    acc = en;
  }
  return out;
}

export function strokePoly(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

/** Draw a short glowing comet along a polyline */
export function comet(env: Env, pts: Pt[], head: number, len: number, alpha = 1, width = 1.8) {
  const { ctx } = env;
  const seg = subPoly(pts, head - len, head);
  if (seg.length < 2) return;
  const a = seg[0];
  const b = seg[seg.length - 1];
  if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) < 0.01) return;
  const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
  g.addColorStop(0, A(env, 0));
  g.addColorStop(1, A(env, alpha));
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = g;
  ctx.lineWidth = width;
  shadow(env, A(env, 0.9), 7);
  strokePoly(ctx, seg);
  ctx.restore();
}

/** A dim wire with a travelling accent pulse – the reference's yellow dashes */
export function wire(env: Env, pts: Pt[], o: { phase?: number; speed?: number; len?: number } = {}) {
  const { ctx } = env;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "#2b2b2e";
  ctx.lineWidth = 1.5;
  strokePoly(ctx, pts);
  ctx.restore();

  const L = polyLen(pts);
  const len = o.len ?? 22;
  const speed = (o.speed ?? 55) * (0.55 + env.e * 0.9);
  const cycle = L + len + 30;
  const head = (((env.t * speed + (o.phase ?? 0) * cycle) % cycle) + cycle) % cycle;
  comet(env, pts, head, len, 0.4 + 0.6 * env.e);
}

export function dot(env: Env, x: number, y: number, r: number, color: string, glow = 0) {
  const { ctx } = env;
  ctx.save();
  if (glow) shadow(env, color, glow);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

export function bar(env: Env, x: number, y: number, w: number, h: number, color: string) {
  const { ctx } = env;
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/* ───────────── hexagons ───────────── */

export function hexPts(x: number, y: number, R: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    pts.push([x + R * Math.cos(a), y + R * Math.sin(a)]);
  }
  return pts;
}

export function polyPath(ctx: CanvasRenderingContext2D, pts: Pt[], rad: number) {
  const n = pts.length;
  ctx.beginPath();
  const m0: Pt = [(pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2];
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    ctx.arcTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, rad);
  }
  ctx.closePath();
}

export function hex(env: Env, x: number, y: number, R: number, o: TileOpts = {}) {
  const { ctx } = env;
  const pts = hexPts(x, y, R);
  ctx.save();
  if (o.shadow) shadow(env, "rgba(0,0,0,0.6)", 16, 7);
  const g = ctx.createLinearGradient(0, y - R, 0, y + R);
  g.addColorStop(0, o.top ?? "#303033");
  g.addColorStop(1, o.bottom ?? "#1a1a1c");
  polyPath(ctx, pts, 7);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();

  ctx.save();
  polyPath(ctx, pts, 7);
  ctx.clip();
  const hg = ctx.createLinearGradient(0, y - R, 0, y);
  hg.addColorStop(0, "rgba(255,255,255,0.07)");
  hg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hg;
  ctx.fillRect(x - R, y - R, R * 2, R);
  ctx.restore();

  polyPath(ctx, pts, 7);
  ctx.lineWidth = 1;
  ctx.strokeStyle = o.accent && o.accent > 0.01 ? A(env, 0.15 + 0.6 * Math.min(1, o.accent)) : W(0.07);
  ctx.stroke();
}
