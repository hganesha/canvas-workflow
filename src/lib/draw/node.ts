import { ILLU_H, NODE_H, NodeDef, PORT_Y, WFNode } from "../types";
import { A, Env, FONT, W, icon, noShadow, rr, shadow } from "./primitives";
import { ILLUSTRATIONS } from "./illustrations";

export const TITLE_FONT = `500 16px ${FONT}`;
export const DESC_FONT = `400 12.5px ${FONT}`;

export type RunStatus = "idle" | "pending" | "active" | "done";

export interface NodeFlags {
  selected: boolean;
  hovered: boolean;
  status: RunStatus;
  showStatus: boolean;
  inConnected: boolean;
  outConnected: boolean;
  /** which port is hovered */
  portHover: "in" | "out" | null;
  /** while dragging a connection: whether this node's port is a valid target (null = not dragging) */
  inValid: boolean | null;
  outValid: boolean | null;
}

function port(env: Env, x: number, y: number, connected: boolean, hot: boolean, valid: boolean | null) {
  const { ctx } = env;
  const lit = connected || hot || valid === true;
  const r = 6.5 + (hot || valid === true ? 2.2 : 0);
  ctx.save();
  if (valid === false) ctx.globalAlpha *= 0.35;
  if (lit) shadow(env, A(env, 0.85), hot || valid ? 14 : 9);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "#0b0b0c";
  ctx.fill();
  noShadow(env);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = lit ? A(env, 0.95) : "#47474b";
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = lit ? A(env, 1) : "#78787d";
  ctx.fill();
  ctx.restore();
}

export function drawNode(
  env: Env,
  node: WFNode,
  def: NodeDef,
  f: NodeFlags,
  pattern: CanvasPattern | null,
  title: string,
  lines: string[],
  lod: boolean,
) {
  const { ctx, t } = env;
  const w = def.w;
  const h = NODE_H;
  const baseAlpha = ctx.globalAlpha;

  ctx.save();
  ctx.translate(node.x, node.y);
  if (node.bypass) ctx.globalAlpha = baseAlpha * 0.5;

  const activeGlow = f.status === "active" ? 0.55 + 0.35 * Math.sin(t * 6) : 0;

  /* body + drop shadow */
  ctx.save();
  if (f.selected) shadow(env, A(env, 0.3), 36, 0);
  else if (f.status === "active") shadow(env, A(env, 0.25 + 0.2 * activeGlow), 36, 0);
  else shadow(env, "rgba(0,0,0,0.7)", 44, 20);
  rr(ctx, 0, 0, w, h, 14);
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#1f1f21");
  bg.addColorStop(1, "#141416");
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.restore();

  /* clipped contents */
  ctx.save();
  rr(ctx, 0, 0, w, h, 14);
  ctx.clip();

  // dot-matrix texture, faded outward
  if (pattern && !lod) {
    ctx.save();
    ctx.globalAlpha *= 0.34;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, ILLU_H + 10);
    ctx.restore();
    const rg = ctx.createRadialGradient(w / 2, 104, 30, w / 2, 104, w * 0.78);
    rg.addColorStop(0, "rgba(26,26,28,0.15)");
    rg.addColorStop(1, "rgba(26,26,28,0.94)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, ILLU_H + 10);
    const bgf = ctx.createLinearGradient(0, ILLU_H - 50, 0, ILLU_H + 10);
    bgf.addColorStop(0, "rgba(24,24,26,0)");
    bgf.addColorStop(1, "rgba(24,24,26,1)");
    ctx.fillStyle = bgf;
    ctx.fillRect(0, ILLU_H - 50, w, 60);
  }

  // illustration (clipped to its own box)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, ILLU_H);
  ctx.clip();
  env.w = w;
  ILLUSTRATIONS[node.type](env);
  ctx.restore();

  // top edge highlight
  const hl = ctx.createLinearGradient(0, 0, w, 0);
  hl.addColorStop(0, "rgba(255,255,255,0)");
  hl.addColorStop(0.5, "rgba(255,255,255,0.16)");
  hl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hl;
  ctx.fillRect(0, 0, w, 1);

  // text
  if (!lod) {
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = TITLE_FONT;
    ctx.fillStyle = "#f4f4f5";
    ctx.fillText(title, 22, ILLU_H + 34);
    ctx.font = DESC_FONT;
    ctx.fillStyle = "#6a6a6f";
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], 22, ILLU_H + 58 + i * 16);
  } else {
    ctx.fillStyle = "#f4f4f5";
    rr(ctx, 22, ILLU_H + 20, w * 0.5, 12, 4);
    ctx.fill();
    ctx.fillStyle = "#3a3a3d";
    rr(ctx, 22, ILLU_H + 44, w * 0.7, 8, 4);
    ctx.fill();
  }

  // run-state wash
  if (f.status === "active") {
    const wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, A(env, 0.07 + 0.05 * activeGlow));
    wash.addColorStop(1, A(env, 0));
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();

  /* border */
  rr(ctx, 0.5, 0.5, w - 1, h - 1, 14);
  if (f.selected) {
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = A(env, 0.9);
  } else if (f.status === "active") {
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = A(env, 0.55 + 0.4 * activeGlow);
  } else {
    ctx.lineWidth = 1;
    const bgr = ctx.createLinearGradient(0, 0, 0, h);
    bgr.addColorStop(0, f.hovered ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.11)");
    bgr.addColorStop(1, f.hovered ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.045)");
    ctx.strokeStyle = bgr;
  }
  ctx.stroke();

  /* status badge */
  if (f.showStatus && (f.status === "active" || f.status === "done")) {
    const bx = w - 24;
    const by = 24;
    ctx.save();
    ctx.beginPath();
    ctx.arc(bx, by, 11, 0, Math.PI * 2);
    ctx.fillStyle = f.status === "done" ? A(env, 1) : "rgba(10,10,11,0.85)";
    if (f.status === "done") shadow(env, A(env, 0.7), 10);
    ctx.fill();
    noShadow(env);
    if (f.status === "done") {
      icon(env, "check", bx, by, 13, "#06120d");
    } else {
      ctx.strokeStyle = W(0.12);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bx, by, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = A(env, 1);
      ctx.lineCap = "round";
      ctx.beginPath();
      const a = t * 6;
      ctx.arc(bx, by, 8, a, a + Math.PI * 1.1);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (node.bypass) {
    ctx.save();
    ctx.globalAlpha = baseAlpha;
    rr(ctx, 14, 14, 62, 20, 10);
    ctx.fillStyle = "rgba(10,10,11,0.85)";
    ctx.fill();
    ctx.strokeStyle = W(0.15);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = `500 10px ${FONT}`;
    ctx.fillStyle = W(0.7);
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText("BYPASSED", 45, 24.5);
    ctx.restore();
  }

  /* ports */
  if (def.hasInput) port(env, 0, PORT_Y, f.inConnected, f.portHover === "in", f.inValid);
  if (def.hasOutput) port(env, w, PORT_Y, f.outConnected, f.portHover === "out", f.outValid);

  ctx.restore();
}
