import { ILLU_H, NodeType, PORT_Y } from "../types";
import {
  A,
  Env,
  FONT,
  Pt,
  W,
  bar,
  dot,
  hex,
  icon,
  noShadow,
  rr,
  shadow,
  spot,
  tile,
  wire,
} from "./primitives";

const PY = PORT_Y;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/* ─────────────────────────── Capture Inputs ─────────────────────────── */
function capture(env: Env) {
  const { ctx, t, e, w } = env;
  const cx = w / 2;

  // faint converging lines
  ctx.save();
  ctx.strokeStyle = W(0.035);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 150);
  ctx.lineTo(cx - 40, 112);
  ctx.moveTo(w, 150);
  ctx.lineTo(cx + 40, 112);
  ctx.moveTo(-10, 215);
  ctx.lineTo(cx - 70, 160);
  ctx.moveTo(w + 10, 215);
  ctx.lineTo(cx + 70, 160);
  ctx.stroke();
  ctx.restore();

  // wires first (tiles cover their ends)
  const xs = [50, 90, w - 90, w - 50];
  const L1: Pt[] = [[xs[0], 39], [xs[0], 50], [cx - 8, 50], [cx - 8, 80]];
  const L2: Pt[] = [[xs[1], 39], [xs[1], 59], [cx - 8, 59]];
  const R1: Pt[] = [[xs[3], 39], [xs[3], 50], [cx + 8, 50], [cx + 8, 80]];
  const R2: Pt[] = [[xs[2], 39], [xs[2], 59], [cx + 8, 59]];
  wire(env, L1, { phase: 0.0, len: 18 });
  wire(env, L2, { phase: 0.35, len: 16 });
  wire(env, R1, { phase: 0.5, len: 18 });
  wire(env, R2, { phase: 0.8, len: 16 });
  wire(env, [[0, PY], [cx - 26, PY]], { phase: 0.15 });
  wire(env, [[cx + 26, PY], [w, PY]], { phase: 0.6 });
  wire(env, [[cx, PY + 26], [cx, 151]], { len: 10, speed: 30 });

  // tiny file tiles
  xs.forEach((x, i) => {
    const ph = (((t * 0.3 + i * 0.24) % 1) + 1) % 1;
    const lit = clamp(1 - ph * 5) * e;
    tile(env, x - 11, 17, 22, 22, 6, { accent: lit, top: "#282829", bottom: "#1a1a1c" });
    icon(env, "doc", x, 28, 12, lit > 0.03 ? A(env, 0.35 + 0.65 * lit) : W(0.3));
  });

  // main upload tile
  const pulse = env.active ? 0.5 + 0.5 * Math.sin(t * 6) : 0;
  tile(env, cx - 26, 80 - 2, 52, 52, 13, { shadow: true, accent: pulse });
  icon(env, "upload", cx, PY, 26, env.active ? A(env, 0.5 + 0.5 * pulse) : W(0.3));

  // highlighted add-file tile
  spot(env, cx, 176, 70, 0.1 + 0.1 * e);
  tile(env, cx - 25, 151, 50, 50, 13, { shadow: true, accent: 0.35 + 0.4 * e, top: "#2e2e31", bottom: "#19191b" });
  icon(env, "addfile", cx, 176, 27, A(env, 1), 9 + 6 * e);
}

/* ─────────────────────────── Collaborate ─────────────────────────── */
function collaborate(env: Env) {
  const { t, e, w } = env;
  const cx = w / 2;
  const cy = PY;
  const R = 32;
  const fx = 72;

  spot(env, cx, cy, 150, 0.04 + 0.09 * e);

  wire(env, [[0, cy], [fx - 31, cy]], { phase: 0.0 });
  wire(env, [[fx + 31, cy], [cx - 60 - 29, cy]], { phase: 0.25 });
  wire(env, [[cx + 60 + 29, cy], [w - fx - 31, cy]], { phase: 0.55 });
  wire(env, [[w - fx + 31, cy], [w, cy]], { phase: 0.8 });

  const ringLight = (i: number) => {
    if (!env.active) return 0;
    const p = (((t * 3 - i) % 6) + 6) % 6;
    return p < 3 ? 1 - p / 3 : 0;
  };

  const ring: { x: number; y: number; i: number; top?: boolean }[] = [
    { x: cx - 30, y: cy - 52, i: 0, top: true },
    { x: cx + 30, y: cy - 52, i: 1, top: true },
    { x: cx + 60, y: cy, i: 2 },
    { x: cx + 30, y: cy + 52, i: 3 },
    { x: cx - 30, y: cy + 52, i: 4 },
    { x: cx - 60, y: cy, i: 5 },
  ];

  // far hexes
  for (const side of [-1, 1]) {
    const x = cx + side * (cx - fx);
    hex(env, x, cy, 36, { shadow: true, accent: 0.22 + 0.2 * e, top: "#2c2c2f", bottom: "#19191b" });
    icon(env, "user", x, cy + 1, 24, W(0.26));
  }

  // ring (top row first so it sits behind)
  const ordered = [...ring].sort((a, b) => (a.top ? 0 : 1) - (b.top ? 0 : 1));
  for (const c of ordered) {
    const L = ringLight(c.i);
    const shimmer = 0.5 + 0.5 * Math.sin(t * 1.1 - c.i * 1.05);
    hex(env, c.x, c.y, R, { shadow: true, accent: L * 0.9, top: "#2b2b2d", bottom: "#1a1a1c" });
    const base = (c.top ? 0.14 : 0.22) + 0.14 * shimmer;
    icon(env, "user", c.x, c.y + 1, 20, L > 0.05 ? A(env, 0.4 + 0.6 * L) : W(base));
  }

  // centre – lit
  const breathe = 0.7 + 0.3 * Math.sin(t * 2);
  spot(env, cx, cy, 60, 0.12 + 0.18 * e * breathe);
  hex(env, cx, cy, R + 1, { shadow: true, accent: 0.8 * breathe + 0.2, top: "#313134", bottom: "#1b1b1d" });
  icon(env, "user", cx, cy + 1, 24, A(env, 1), 10 + 8 * e);
}

/* ─────────────────────────── Monitor Activity ─────────────────────────── */
function monitor(env: Env) {
  const { ctx, t, e, w } = env;

  wire(env, [[0, PY], [62, PY]], { phase: 0.1 });
  wire(env, [[218, PY], [w, PY]], { phase: 0.55 });

  // device body
  tile(env, 62, 56, 156, 96, 12, { shadow: true, top: "#2c2c2e", bottom: "#161618" });
  rr(ctx, 68, 62, 144, 84, 7);
  ctx.fillStyle = "#0d0d0f";
  ctx.fill();
  ctx.strokeStyle = W(0.05);
  ctx.lineWidth = 1;
  ctx.stroke();

  const panel = (x: number, y: number, pw: number, ph: number) => {
    rr(ctx, x, y, pw, ph, 4);
    ctx.fillStyle = "#18181a";
    ctx.fill();
    ctx.strokeStyle = W(0.045);
    ctx.stroke();
  };
  panel(73, 67, 58, 32);
  panel(135, 67, 26, 32);
  panel(165, 67, 42, 74);
  panel(73, 103, 88, 38);

  // headline metric
  const val = env.active ? Math.round(env.prog * 100) : env.done ? 100 : 60;
  ctx.save();
  ctx.font = `600 13px ${FONT}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = A(env, 1);
  shadow(env, A(env, 0.7), 8);
  ctx.fillText(`${val}%`, 79, 83);
  ctx.restore();
  bar(env, 79, 87.5, 46, 1.8, W(0.08));
  bar(env, 79, 87.5, Math.max(2, (46 * val) / 100), 1.8, A(env, 0.95));
  bar(env, 79, 92.5, 40, 1.6, W(0.16));
  bar(env, 79, 96, 26, 1.6, W(0.1));

  // mid panel
  [14, 18, 10, 16].forEach((lw, i) => bar(env, 139, 73 + i * 6.5, lw, 1.6, W(0.14)));

  // right column "log"
  const widths = [30, 24, 32, 18, 28, 22, 30, 16, 26, 20];
  const hot = Math.floor(t * 2) % widths.length;
  widths.forEach((lw, i) => {
    const lit = i === 3 || (env.active && i === hot);
    bar(env, 169, 72 + i * 6.4, lw, 1.5, lit ? A(env, 0.4 + 0.5 * e) : W(0.12));
  });

  // bottom panel
  bar(env, 79, 110, 30, 1.8, W(0.15));
  bar(env, 79, 116, 20, 1.8, W(0.1));
  bar(env, 79, 122, 36, 1.8, W(0.12));
  bar(env, 79, 128, 14, 1.8, W(0.1));
  const rcx = 143;
  const rcy = 122;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = W(0.1);
  ctx.beginPath();
  ctx.arc(rcx, rcy, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = A(env, 0.9);
  shadow(env, A(env, 0.6), 6);
  ctx.beginPath();
  const a0 = -Math.PI / 2 + t * (env.active ? 3 : 0.6);
  ctx.arc(rcx, rcy, 10, a0, a0 + Math.PI * 2 * clamp(val / 100) * 0.9);
  ctx.stroke();
  ctx.restore();

  // flashlight + beam
  const dir: Pt = [-0.8, 0.6];
  const perp: Pt = [0.6, 0.8];
  const torch: Pt = [252, 24];
  const apex: Pt = [torch[0] + dir[0] * 10, torch[1] + dir[1] * 10];
  const far: Pt = [apex[0] + dir[0] * 230, apex[1] + dir[1] * 230];
  const flick = (0.8 + 0.2 * (0.5 + 0.5 * Math.sin(t * 2.3))) * (0.55 + 0.6 * e);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createLinearGradient(apex[0], apex[1], far[0], far[1]);
  g.addColorStop(0, A(env, 0.4 * flick));
  g.addColorStop(0.5, A(env, 0.1 * flick));
  g.addColorStop(1, A(env, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(apex[0] - perp[0] * 6, apex[1] - perp[1] * 6);
  ctx.lineTo(apex[0] + perp[0] * 6, apex[1] + perp[1] * 6);
  ctx.lineTo(far[0] + perp[0] * 95, far[1] + perp[1] * 95);
  ctx.lineTo(far[0] - perp[0] * 95, far[1] - perp[1] * 95);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  spot(env, apex[0], apex[1], 46, 0.35 * flick);

  ctx.save();
  ctx.translate(torch[0], torch[1]);
  ctx.rotate(Math.atan2(dir[1], dir[0]));
  const bg = ctx.createLinearGradient(0, -6, 0, 6);
  bg.addColorStop(0, "#f4f4f5");
  bg.addColorStop(1, "#8d8d90");
  ctx.fillStyle = bg;
  shadow(env, "rgba(0,0,0,0.5)", 6, 2);
  rr(ctx, -15, -4.5, 17, 9, 3);
  ctx.fill();
  noShadow(env);
  ctx.beginPath();
  ctx.moveTo(1, -4.5);
  ctx.lineTo(11, -7.5);
  ctx.lineTo(11, 7.5);
  ctx.lineTo(1, 4.5);
  ctx.closePath();
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = A(env, 0.95);
  shadow(env, A(env, 1), 8);
  ctx.beginPath();
  ctx.ellipse(11, 0, 1.6, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ─────────────────────────── Automate Tasks ─────────────────────────── */
function automate(env: Env) {
  const { ctx, t, e, w } = env;
  const cx = w / 2;

  // vents
  const widths = [70, 88, 106, 124, 142];
  widths.forEach((vw, i) => {
    const p = (t * 3.2) % 9;
    const light = env.active ? clamp(1 - Math.abs(p - i) / 1.6) : 0;
    bar(env, cx - vw / 2, 22 + i * 7, vw, 1.6, light > 0.02 ? A(env, 0.15 + 0.75 * light) : W(0.05 + 0.014 * i));
  });

  wire(env, [[0, PY], [50, PY]], { phase: 0.1, len: 16 });
  wire(env, [[230, PY], [w, PY]], { phase: 0.6, len: 16 });

  // side panels
  tile(env, -14, 60, 34, 88, 12, { top: "#252527", bottom: "#161618" });
  tile(env, w - 20, 60, 34, 88, 12, { top: "#252527", bottom: "#161618" });
  [12, 9, 12, 8].forEach((lw, i) => {
    bar(env, 4, 90 + i * 7, lw, 1.6, W(0.2));
    bar(env, w - 4 - lw, 90 + i * 7, lw, 1.6, W(0.2));
  });

  // control bar
  tile(env, 50, 75, 180, 58, 11, { shadow: true, top: "#272729", bottom: "#161618" });
  const dots: Pt[] = [[64, 87], [216, 87], [64, 121], [216, 121]];
  dots.forEach(([x, y]) => dot(env, x, y, 1.8, env.active ? A(env, 0.95) : W(0.8), env.active ? 5 : 0));

  // bolt button
  const pulse = 0.5 + 0.5 * Math.sin(t * (env.active ? 8 : 1.6));
  spot(env, cx, PY, 54, 0.08 + 0.2 * e * (0.5 + 0.5 * pulse));
  ctx.save();
  shadow(env, "rgba(0,0,0,0.6)", 12, 5);
  const g = ctx.createRadialGradient(cx, PY - 8, 2, cx, PY, 26);
  g.addColorStop(0, "#38383b");
  g.addColorStop(1, "#18181a");
  ctx.beginPath();
  ctx.arc(cx, PY, 25, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, PY, 24.5, 0, Math.PI * 2);
  ctx.lineWidth = 1;
  ctx.strokeStyle = A(env, 0.1 + 0.4 * e * pulse);
  ctx.stroke();
  icon(env, "bolt", cx, PY, 24, A(env, 1), 8 + 10 * e * pulse);
}

/* ─────────────────────────── Process Data ─────────────────────────── */
function process(env: Env) {
  const { ctx, t, e, w } = env;
  const cx = w / 2;

  // big arc
  ctx.save();
  ctx.strokeStyle = W(0.05);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, 170, 124, 100, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  wire(env, [[0, PY], [40, PY]], { phase: 0.1, len: 14 });
  wire(env, [[w - 40, PY], [w, PY]], { phase: 0.6, len: 14 });

  // side plates
  tile(env, 40, 80, 26, 56, 8, { shadow: true, top: "#2a2a2c", bottom: "#161618" });
  tile(env, w - 66, 80, 26, 56, 8, { shadow: true, top: "#2a2a2c", bottom: "#161618" });
  [92, 124].forEach((y) => {
    dot(env, 53, y, 1.7, W(0.85));
    dot(env, w - 53, y, 1.7, W(0.85));
  });

  // folder
  const fg = ctx.createLinearGradient(0, 50, 0, 120);
  fg.addColorStop(0, "#2d2d2f");
  fg.addColorStop(1, "#1a1a1c");
  rr(ctx, 82, 49, 44, 18, 6);
  ctx.fillStyle = "#2a2a2c";
  ctx.fill();
  rr(ctx, 82, 58, 116, 62, 8);
  ctx.fillStyle = fg;
  ctx.fill();
  ctx.strokeStyle = W(0.06);
  ctx.stroke();

  // gold document peeking out
  spot(env, 174, 54, 52, 0.07 + 0.2 * e);
  ctx.save();
  ctx.translate(176, 68);
  ctx.rotate(0.12);
  const dg = ctx.createLinearGradient(0, -26, 0, 24);
  dg.addColorStop(0, A(env, 0.8));
  dg.addColorStop(1, A(env, 0.22));
  rr(ctx, -20, -26, 40, 50, 4);
  ctx.fillStyle = dg;
  ctx.fill();
  ctx.strokeStyle = A(env, 0.5);
  ctx.stroke();
  ctx.restore();

  // screen
  tile(env, 70, 72, 140, 72, 10, { shadow: true, top: "#2b2b2d", bottom: "#141416" });
  rr(ctx, 76, 78, 128, 60, 5);
  ctx.fillStyle = "#0c0c0e";
  ctx.fill();

  const cur = env.active ? 82 + env.prog * 116 : 139;
  type Seg = [number, number, boolean];
  const rows: Seg[][] = [
    [[84, 18, true], [106, 24, false], [146, 30, true]],
    [[84, 34, false], [146, 20, false]],
    [[84, 24, false], [112, 14, false], [146, 36, false]],
    [[84, 16, true], [104, 28, false], [146, 14, false], [164, 22, true]],
    [[84, 22, false], [146, 28, false]],
  ];
  rows.forEach((row, i) => {
    const y = 86 + i * 9.5;
    row.forEach(([x, lw, acc]) => {
      const processed = env.active && x + lw / 2 < cur;
      const col = acc
        ? A(env, processed ? 1 : 0.5 + 0.3 * e)
        : processed
          ? W(0.45)
          : W(0.15);
      bar(env, x, y, lw, 1.8, col);
    });
  });
  // cursor
  const blink = env.active ? 0.95 : 0.55 + 0.3 * Math.sin(t * 2.6);
  ctx.save();
  ctx.strokeStyle = W(blink);
  ctx.lineWidth = 1.5;
  shadow(env, W(0.6), 5);
  ctx.beginPath();
  ctx.moveTo(cur, 82);
  ctx.lineTo(cur, 134);
  ctx.stroke();
  ctx.restore();
  bar(env, cx - 8, 145.5, 16, 2.2, W(0.5));
}

/* ─────────────────────────── Generate Insights ─────────────────────────── */
function generate(env: Env) {
  const { ctx, t, e, w } = env;
  const cx = w / 2;
  const gen = env.gen;
  const generating = gen >= 0 && gen < 1;
  const ready = gen >= 1;

  // perspective floor
  ctx.save();
  const fg = ctx.createLinearGradient(0, 124, 0, ILLU_H);
  fg.addColorStop(0, W(0.04));
  fg.addColorStop(1, W(0.0));
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(62, 124);
  ctx.lineTo(w - 62, 124);
  ctx.lineTo(w + 24, ILLU_H);
  ctx.lineTo(-24, ILLU_H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  wire(env, [[0, PY], [30, PY]], { phase: 0.1, len: 12 });
  wire(env, [[66, PY], [cx - 32, PY]], { phase: 0.35, len: 16 });
  wire(env, [[cx + 32, PY], [w - 66, PY]], { phase: 0.65, len: 16 });
  wire(env, [[w - 30, PY], [w, PY]], { phase: 0.9, len: 12 });

  // side tiles
  tile(env, 28, PY - 19, 38, 38, 11, { shadow: true, top: "#2c2c2e", bottom: "#19191b" });
  icon(env, "doc", 47, PY, 17, W(0.38));
  tile(env, w - 66, PY - 19, 38, 38, 11, { shadow: true, top: "#2c2c2e", bottom: "#19191b" });
  icon(env, "folder", w - 47, PY, 18, W(0.4));

  // centre AI tile
  const pulse = 0.5 + 0.5 * Math.sin(t * (generating ? 7 : 1.8));
  spot(env, cx, PY, 70, 0.07 + 0.2 * e * (0.6 + 0.4 * pulse) + (generating ? 0.1 : 0));
  tile(env, cx - 32, PY - 32, 64, 64, 17, {
    shadow: true,
    accent: generating || ready ? 0.9 : 0.25 + 0.2 * e,
    top: "#333336",
    bottom: "#19191b",
  });
  icon(env, "sparkle", cx, PY - 3, 32, A(env, 1), 10 + 10 * e * pulse);

  // progress dots
  const cur = generating ? Math.floor(t * 8) % 5 : Math.floor(t * 2) % 5;
  for (let i = 0; i < 5; i++) {
    const on = i === cur;
    const fill = ready ? true : generating ? i <= Math.floor(gen * 5) : false;
    dot(
      env,
      cx - 14 + i * 7,
      PY + 22,
      1.4,
      on || fill ? A(env, on ? 1 : 0.65) : W(0.35),
      on ? 4 : 0,
    );
  }

  // orbiting sparks while generating
  if (generating) {
    for (let i = 0; i < 8; i++) {
      const a = t * 1.8 + (i * Math.PI) / 4;
      const r = 46 + 7 * Math.sin(t * 3 + i * 2);
      const x = cx + Math.cos(a) * r * 1.15;
      const y = PY + Math.sin(a) * r * 0.8;
      dot(env, x, y, 1.2 + (i % 3) * 0.5, A(env, 0.45 + 0.4 * Math.sin(t * 5 + i)), 6);
    }
  }

  // stem + pill
  ctx.save();
  ctx.strokeStyle = W(0.5);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, PY + 32);
  ctx.lineTo(cx, 163);
  ctx.stroke();
  ctx.restore();

  const px = cx - 54;
  const py = 163;
  const pw = 108;
  const ph = 27;
  ctx.save();
  if (env.pillHover || generating || ready) shadow(env, generating || ready ? A(env, 0.5) : W(0.25), 12);
  rr(ctx, px, py, pw, ph, ph / 2);
  ctx.fillStyle = "rgba(14,14,16,0.92)";
  ctx.fill();
  ctx.restore();
  rr(ctx, px + 0.5, py + 0.5, pw - 1, ph - 1, ph / 2);
  ctx.lineWidth = 1;
  if (generating) {
    ctx.strokeStyle = W(0.18);
    ctx.stroke();
    ctx.save();
    ctx.setLineDash([26, 100]);
    ctx.lineDashOffset = -t * 90;
    ctx.strokeStyle = A(env, 1);
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.strokeStyle = ready ? A(env, 0.9) : env.pillHover ? W(0.95) : W(0.6);
    ctx.stroke();
  }
  ctx.save();
  ctx.font = `450 11px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = ready ? A(env, 1) : W(0.92);
  const label = generating
    ? "Generating" + ".".repeat(1 + (Math.floor(t * 3) % 3))
    : ready
      ? "Insight ready"
      : "Click to generate";
  ctx.fillText(label, cx + (generating ? -6 : 0), py + ph / 2 + 0.5);
  ctx.restore();
}

export const ILLUSTRATIONS: Record<NodeType, (env: Env) => void> = {
  capture,
  collaborate,
  monitor,
  automate,
  process,
  generate,
};

/** Local-space rect of the "Click to generate" pill on a generate node */
export function pillRect(w: number) {
  return { x: w / 2 - 54, y: 163, w: 108, h: 27 };
}
