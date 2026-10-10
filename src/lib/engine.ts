import {
  NODE_DEFS,
  NODE_H,
  NodeDef,
  NodeType,
  PORT_Y,
  WFEdge,
  WFNode,
  WorkflowData,
} from "./types";
import {
  A,
  Env,
  Pt,
  RGB,
  W,
  dotTile,
  hexToRgb,
  noShadow,
  polyLen,
  shadow,
  strokePoly,
  subPoly,
} from "./draw/primitives";
import { DESC_FONT, NodeFlags, RunStatus, TITLE_FONT, drawNode } from "./draw/node";
import { pillRect } from "./draw/illustrations";

const STORAGE_KEY = "relay.workflow.v1";
const ACCENT_KEY = "relay.accent.v1";
const NODE_DUR = 1.7;
const EDGE_DUR = 0.8;
const MIN_K = 0.15;
const MAX_K = 2.2;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;
const snap = (v: number, on = true) => (on ? Math.round(v / 10) * 10 : v);

interface Rt {
  e: number;
  genStart: number;
  textKey: string;
  title: string;
  lines: string[];
}

type Hit =
  | { t: "none" }
  | { t: "node"; id: string }
  | { t: "pill"; id: string }
  | { t: "port"; id: string; side: "in" | "out" }
  | { t: "edge"; id: string }
  | { t: "edgebtn"; id: string };

type Drag =
  | { kind: "pan"; sx: number; sy: number; vx: number; vy: number; moved: boolean }
  | {
      kind: "nodes";
      id: string;
      sx: number;
      sy: number;
      origins: Map<string, { x: number; y: number }>;
      moved: boolean;
      cp: boolean;
      shift: boolean;
    }
  | { kind: "connect"; id: string; side: "in" | "out" }
  | { kind: "marquee"; x0: number; y0: number; x1: number; y1: number; base: Set<string> };

interface RunInfo {
  t0: number;
  starts: Map<string, number>;
  ends: Map<string, number>;
  total: number;
  finished: boolean;
}

/** cubic bezier between two ports, sampled */
function bez(p0: Pt, p1: Pt, n = 44): Pt[] {
  const dx = Math.max(70, Math.abs(p1[0] - p0[0]) * 0.5);
  const c1: Pt = [p0[0] + dx, p0[1]];
  const c2: Pt = [p1[0] - dx, p1[1]];
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const m = 1 - u;
    const a = m * m * m;
    const b = 3 * m * m * u;
    const c = 3 * m * u * u;
    const d = u * u * u;
    pts.push([a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0], a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1]]);
  }
  return pts;
}

function distSeg(p: { x: number; y: number }, a: Pt, b: Pt) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let u = l2 === 0 ? 0 : ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / l2;
  u = clamp(u, 0, 1);
  return Math.hypot(p.x - (a[0] + dx * u), p.y - (a[1] + dy * u));
}

export function demoWorkflow(): WorkflowData {
  const mk = (id: string, type: NodeType, x: number, y: number): WFNode => ({
    id,
    type,
    x,
    y,
    title: NODE_DEFS[type].title,
    description: NODE_DEFS[type].description,
    bypass: false,
  });
  return {
    nodes: [
      mk("n_capture", "capture", 0, 0),
      mk("n_process", "process", 370, 0),
      mk("n_automate", "automate", 740, 0),
      mk("n_monitor", "monitor", 1110, -190),
      mk("n_collab", "collaborate", 1110, 200),
      mk("n_generate", "generate", 1640, 0),
    ],
    edges: [
      { id: "e1", from: "n_capture", to: "n_process" },
      { id: "e2", from: "n_process", to: "n_automate" },
      { id: "e3", from: "n_automate", to: "n_monitor" },
      { id: "e4", from: "n_automate", to: "n_collab" },
      { id: "e5", from: "n_monitor", to: "n_generate" },
      { id: "e6", from: "n_collab", to: "n_generate" },
    ],
  };
}

export class Engine {
  nodes: WFNode[] = [];
  edges: WFEdge[] = [];
  view = { x: 0, y: 0, k: 1 };
  selection = new Set<string>();
  selEdge: string | null = null;
  accentHex = "#5bf5b8";

  private canvas: HTMLCanvasElement | null = null;
  private container: HTMLElement | null = null;
  private ctx!: CanvasRenderingContext2D;
  private env!: Env;
  private ro: ResizeObserver | null = null;
  private raf = 0;
  private dpr = 1;
  private cw = 0;
  private ch = 0;
  private acc: RGB = hexToRgb("#5bf5b8");
  private rt = new Map<string, Rt>();
  private listeners = new Set<() => void>();
  private version = 0;
  private lastZoomPct = 100;
  private viewTarget: { x: number; y: number; k: number } | null = null;
  private fitted = false;
  private hover: Hit = { t: "none" };
  private hoverEdge: string | null = null;
  private pointer = { x: 0, y: 0 };
  private drag: Drag | null = null;
  private space = false;
  private run: RunInfo | null = null;
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private saveTimer = 0;
  private coalesceKey = "";
  private coalesceAt = 0;
  private last = 0;
  private now = 0;
  private bgPatterns = new Map<number, CanvasPattern | null>();
  private cardPatterns = new Map<number, CanvasPattern | null>();
  private cleanup: (() => void)[] = [];

  constructor() {
    let loaded = false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) loaded = this.importData(JSON.parse(raw), false);
      const acc = localStorage.getItem(ACCENT_KEY);
      if (acc && /^#[0-9a-f]{6}$/i.test(acc)) this.accentHex = acc;
    } catch {
      /* ignore */
    }
    if (!loaded) {
      const d = demoWorkflow();
      this.nodes = d.nodes;
      this.edges = d.edges;
    }
    this.acc = hexToRgb(this.accentHex);
    this.applyCss();
  }

  /* ───────────── React bridge ───────────── */
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = () => this.version;
  private emit() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  get zoomPct() {
    return Math.round(this.view.k * 100);
  }
  get canUndo() {
    return this.undoStack.length > 0;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }
  get running() {
    return !!this.run && !this.run.finished;
  }
  get selectedNode(): WFNode | null {
    if (this.selection.size !== 1) return null;
    return this.getNode([...this.selection][0]) ?? null;
  }
  connCount(id: string) {
    return {
      inc: this.edges.filter((e) => e.to === id).length,
      out: this.edges.filter((e) => e.from === id).length,
    };
  }

  private applyCss() {
    const r = document.documentElement.style;
    r.setProperty("--accent", this.accentHex);
    r.setProperty("--accent-rgb", `${this.acc[0]} ${this.acc[1]} ${this.acc[2]}`);
  }

  setAccent(hex: string) {
    this.accentHex = hex;
    this.acc = hexToRgb(hex);
    this.applyCss();
    try {
      localStorage.setItem(ACCENT_KEY, hex);
    } catch {
      /* ignore */
    }
    this.emit();
  }

  /* ───────────── lifecycle ───────────── */
  attach(canvas: HTMLCanvasElement, container: HTMLElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    this.canvas = canvas;
    this.container = container;
    this.ctx = ctx;
    this.env = {
      ctx,
      s: 1,
      acc: this.acc,
      t: 0,
      e: 0.4,
      active: false,
      done: false,
      prog: 0,
      w: 280,
      gen: -1,
      pillHover: false,
    };
    this.bgPatterns.clear();
    this.cardPatterns.clear();

    const on = (el: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions) => {
      el.addEventListener(type, fn, opts);
      this.cleanup.push(() => el.removeEventListener(type, fn, opts));
    };
    on(canvas, "pointerdown", this.onDown as EventListener);
    on(canvas, "pointermove", this.onMove as EventListener);
    on(canvas, "pointerup", this.onUp as EventListener);
    on(canvas, "pointercancel", this.onUp as EventListener);
    on(canvas, "pointerleave", this.onLeave as EventListener);
    on(canvas, "wheel", this.onWheel as EventListener, { passive: false });
    on(canvas, "contextmenu", ((e: Event) => e.preventDefault()) as EventListener);
    on(window, "keydown", this.onKey as EventListener);
    on(window, "keyup", this.onKeyUp as EventListener);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    document.fonts?.ready.then(() => this.rt.forEach((r) => (r.textKey = "")));
    if (document.fonts) {
      Promise.all([
        document.fonts.load(TITLE_FONT),
        document.fonts.load(DESC_FONT),
        document.fonts.load('450 11px "Inter"'),
        document.fonts.load('600 13px "Inter"'),
      ])
        .then(() => this.rt.forEach((r) => (r.textKey = "")))
        .catch(() => undefined);
    }
    this.last = performance.now() / 1000;
    this.raf = requestAnimationFrame(this.frame);
  }

  detach() {
    cancelAnimationFrame(this.raf);
    this.cleanup.forEach((c) => c());
    this.cleanup = [];
    this.ro?.disconnect();
    this.ro = null;
    this.canvas = null;
    this.fitted = false;
  }

  private resize() {
    if (!this.canvas || !this.container) return;
    const r = this.container.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.cw = r.width;
    this.ch = r.height;
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
    if (!this.fitted && r.width > 0) {
      this.fit(false);
      this.fitted = true;
    }
  }

  /* ───────────── helpers ───────────── */
  getNode(id: string) {
    return this.nodes.find((n) => n.id === id);
  }
  private def(n: WFNode): NodeDef {
    return NODE_DEFS[n.type];
  }
  private rtOf(id: string): Rt {
    let r = this.rt.get(id);
    if (!r) {
      r = { e: 0.38, genStart: 0, textKey: "", title: "", lines: [] };
      this.rt.set(id, r);
    }
    return r;
  }
  portPos(n: WFNode, side: "in" | "out"): Pt {
    return [side === "in" ? n.x : n.x + this.def(n).w, n.y + PORT_Y];
  }
  private edgePts(e: WFEdge): Pt[] | null {
    const a = this.getNode(e.from);
    const b = this.getNode(e.to);
    if (!a || !b) return null;
    return bez(this.portPos(a, "out"), this.portPos(b, "in"));
  }
  private toScreen(e: { clientX: number; clientY: number }) {
    const r = this.canvas!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  private toWorld(s: { x: number; y: number }) {
    return { x: (s.x - this.view.x) / this.view.k, y: (s.y - this.view.y) / this.view.k };
  }
  screenToWorld(clientX: number, clientY: number) {
    if (!this.canvas) return { x: 0, y: 0 };
    return this.toWorld(this.toScreen({ clientX, clientY }));
  }
  private insets() {
    const mid = this.cw >= 760;
    return { l: mid ? 96 : 12, r: mid ? 28 : 12, t: 84, b: 84 };
  }

  /* ───────────── history / persistence ───────────── */
  private snap() {
    return JSON.stringify({ nodes: this.nodes, edges: this.edges });
  }
  private checkpoint() {
    this.undoStack.push(this.snap());
    if (this.undoStack.length > 120) this.undoStack.shift();
    this.redoStack = [];
  }
  private restore(s: string) {
    const d = JSON.parse(s) as WorkflowData;
    this.nodes = d.nodes;
    this.edges = d.edges;
    for (const id of [...this.selection]) if (!this.getNode(id)) this.selection.delete(id);
    if (this.selEdge && !this.edges.some((e) => e.id === this.selEdge)) this.selEdge = null;
    this.save();
    this.emit();
  }
  undo() {
    const s = this.undoStack.pop();
    if (!s) return;
    this.redoStack.push(this.snap());
    this.restore(s);
  }
  redo() {
    const s = this.redoStack.pop();
    if (!s) return;
    this.undoStack.push(this.snap());
    this.restore(s);
  }
  private save() {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, this.snap());
      } catch {
        /* ignore */
      }
    }, 250);
  }

  private importData(d: unknown, strict = true): boolean {
    try {
      const data = d as WorkflowData;
      if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) return false;
      const nodes: WFNode[] = [];
      for (const n of data.nodes) {
        if (!n || !(n.type in NODE_DEFS) || typeof n.id !== "string") continue;
        nodes.push({
          id: n.id,
          type: n.type,
          x: Number(n.x) || 0,
          y: Number(n.y) || 0,
          title: String(n.title ?? NODE_DEFS[n.type].title),
          description: String(n.description ?? NODE_DEFS[n.type].description),
          bypass: !!n.bypass,
        });
      }
      const ids = new Set(nodes.map((n) => n.id));
      const edges = data.edges.filter(
        (e) => e && ids.has(e.from) && ids.has(e.to) && e.from !== e.to && typeof e.id === "string",
      );
      if (strict && nodes.length === 0) return false;
      this.nodes = nodes;
      this.edges = edges;
      return true;
    } catch {
      return false;
    }
  }

  exportJSON() {
    return JSON.stringify({ app: "relay", version: 1, nodes: this.nodes, edges: this.edges }, null, 2);
  }
  importJSON(text: string) {
    try {
      const d = JSON.parse(text);
      this.checkpoint();
      if (!this.importData(d)) {
        this.undoStack.pop();
        return false;
      }
      this.selection.clear();
      this.selEdge = null;
      this.run = null;
      this.save();
      this.fit(true);
      this.emit();
      return true;
    } catch {
      return false;
    }
  }
  loadDemo() {
    this.checkpoint();
    const d = demoWorkflow();
    this.nodes = d.nodes;
    this.edges = d.edges;
    this.selection.clear();
    this.selEdge = null;
    this.run = null;
    this.save();
    this.fit(true);
    this.emit();
  }
  clearAll() {
    if (!this.nodes.length) return;
    this.checkpoint();
    this.nodes = [];
    this.edges = [];
    this.selection.clear();
    this.selEdge = null;
    this.run = null;
    this.save();
    this.emit();
  }

  /* ───────────── graph operations ───────────── */
  addNode(type: NodeType, at?: { x: number; y: number }) {
    const def = NODE_DEFS[type];
    let cx: number;
    let cy: number;
    if (at) {
      cx = at.x;
      cy = at.y;
    } else {
      const ins = this.insets();
      const c = this.toWorld({ x: ins.l + (this.cw - ins.l - ins.r) / 2, y: ins.t + (this.ch - ins.t - ins.b) / 2 });
      cx = c.x;
      cy = c.y;
    }
    const pos = { x: snap(cx - def.w / 2), y: snap(cy - NODE_H / 2) };
    while (this.nodes.some((n) => Math.abs(n.x - pos.x) < 30 && Math.abs(n.y - pos.y) < 30)) {
      pos.x += 40;
      pos.y += 40;
    }
    this.checkpoint();
    const node: WFNode = {
      id: uid("n"),
      type,
      x: pos.x,
      y: pos.y,
      title: def.title,
      description: def.description,
      bypass: false,
    };
    this.nodes.push(node);
    this.selection = new Set([node.id]);
    this.selEdge = null;
    this.save();
    this.emit();
    return node.id;
  }

  updateNode(id: string, patch: Partial<Pick<WFNode, "title" | "description" | "bypass">>) {
    const n = this.getNode(id);
    if (!n) return;
    const key = id + Object.keys(patch).join(",");
    const t = performance.now();
    if (key !== this.coalesceKey || t - this.coalesceAt > 1200) this.checkpoint();
    this.coalesceKey = key;
    this.coalesceAt = t;
    Object.assign(n, patch);
    this.save();
    this.emit();
  }

  deleteSelection() {
    if (this.selEdge) {
      this.deleteEdge(this.selEdge);
      return;
    }
    if (!this.selection.size) return;
    this.checkpoint();
    const ids = this.selection;
    this.nodes = this.nodes.filter((n) => !ids.has(n.id));
    this.edges = this.edges.filter((e) => !ids.has(e.from) && !ids.has(e.to));
    ids.forEach((id) => this.rt.delete(id));
    this.selection = new Set();
    this.save();
    this.emit();
  }

  deleteEdge(id: string) {
    this.checkpoint();
    this.edges = this.edges.filter((e) => e.id !== id);
    if (this.selEdge === id) this.selEdge = null;
    this.hoverEdge = null;
    this.save();
    this.emit();
  }

  duplicateSelection() {
    if (!this.selection.size) return;
    this.checkpoint();
    const map = new Map<string, string>();
    const copies: WFNode[] = [];
    for (const n of this.nodes) {
      if (!this.selection.has(n.id)) continue;
      const id = uid("n");
      map.set(n.id, id);
      copies.push({ ...n, id, x: n.x + 40, y: n.y + 40 });
    }
    this.nodes.push(...copies);
    for (const e of [...this.edges]) {
      const a = map.get(e.from);
      const b = map.get(e.to);
      if (a && b) this.edges.push({ id: uid("e"), from: a, to: b });
    }
    this.selection = new Set(copies.map((c) => c.id));
    this.selEdge = null;
    this.save();
    this.emit();
  }

  selectAll() {
    this.selection = new Set(this.nodes.map((n) => n.id));
    this.selEdge = null;
    this.emit();
  }
  clearSelection() {
    if (!this.selection.size && !this.selEdge) return;
    this.selection = new Set();
    this.selEdge = null;
    this.emit();
  }

  private reaches(a: string, b: string): boolean {
    const seen = new Set<string>();
    const stack = [a];
    while (stack.length) {
      const id = stack.pop()!;
      if (id === b) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const e of this.edges) if (e.from === id) stack.push(e.to);
    }
    return false;
  }

  canConnect(from: string, to: string) {
    if (from === to) return false;
    const a = this.getNode(from);
    const b = this.getNode(to);
    if (!a || !b) return false;
    if (!this.def(a).hasOutput || !this.def(b).hasInput) return false;
    if (this.edges.some((e) => e.from === from && e.to === to)) return false;
    if (this.reaches(to, from)) return false;
    return true;
  }

  /* ───────────── view control ───────────── */
  fit(animate = true) {
    const ins = this.insets();
    let target: { x: number; y: number; k: number };
    if (!this.nodes.length) {
      target = { x: this.cw / 2, y: this.ch / 2, k: 1 };
    } else {
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const n of this.nodes) {
        x0 = Math.min(x0, n.x);
        y0 = Math.min(y0, n.y);
        x1 = Math.max(x1, n.x + this.def(n).w);
        y1 = Math.max(y1, n.y + NODE_H);
      }
      const bw = x1 - x0;
      const bh = y1 - y0;
      const aw = Math.max(100, this.cw - ins.l - ins.r);
      const ah = Math.max(100, this.ch - ins.t - ins.b);
      const k = clamp(Math.min(aw / bw, ah / bh), MIN_K, 1);
      target = {
        k,
        x: ins.l + (aw - bw * k) / 2 - x0 * k,
        y: ins.t + (ah - bh * k) / 2 - y0 * k,
      };
    }
    if (animate) this.viewTarget = target;
    else {
      this.viewTarget = null;
      this.view = target;
    }
  }

  private zoomAt(sx: number, sy: number, f: number) {
    const v = this.view;
    const k1 = clamp(v.k * f, MIN_K, MAX_K);
    const wx = (sx - v.x) / v.k;
    const wy = (sy - v.y) / v.k;
    v.k = k1;
    v.x = sx - wx * k1;
    v.y = sy - wy * k1;
  }

  zoomBy(f: number) {
    const ins = this.insets();
    const sx = ins.l + (this.cw - ins.l - ins.r) / 2;
    const sy = ins.t + (this.ch - ins.t - ins.b) / 2;
    const v = this.view;
    const k1 = clamp(v.k * f, MIN_K, MAX_K);
    const wx = (sx - v.x) / v.k;
    const wy = (sy - v.y) / v.k;
    this.viewTarget = { k: k1, x: sx - wx * k1, y: sy - wy * k1 };
  }

  /* ───────────── run simulation ───────────── */
  runWorkflow() {
    if (!this.nodes.length) return;
    const incoming = new Map<string, string[]>();
    const indeg = new Map<string, number>();
    this.nodes.forEach((n) => {
      incoming.set(n.id, []);
      indeg.set(n.id, 0);
    });
    this.edges.forEach((e) => {
      incoming.get(e.to)?.push(e.from);
      indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
    });
    const order: string[] = [];
    const queue = this.nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
    const deg = new Map(indeg);
    while (queue.length) {
      const id = queue.shift()!;
      order.push(id);
      for (const e of this.edges) {
        if (e.from !== id) continue;
        deg.set(e.to, (deg.get(e.to) ?? 1) - 1);
        if (deg.get(e.to) === 0) queue.push(e.to);
      }
    }
    const starts = new Map<string, number>();
    const ends = new Map<string, number>();
    let total = 0;
    const place = (id: string) => {
      const n = this.getNode(id)!;
      const parents = (incoming.get(id) ?? []).filter((p) => ends.has(p));
      const s = parents.length ? Math.max(...parents.map((p) => ends.get(p)! + EDGE_DUR)) : 0.25;
      const e = s + (n.bypass ? 0.3 : NODE_DUR);
      starts.set(id, s);
      ends.set(id, e);
      total = Math.max(total, e);
    };
    order.forEach(place);
    this.nodes.forEach((n) => {
      if (!starts.has(n.id)) place(n.id);
    });
    this.run = { t0: this.now || performance.now() / 1000, starts, ends, total, finished: false };
    this.nodes.forEach((n) => {
      const r = this.rtOf(n.id);
      r.genStart = 0;
    });
    this.emit();
  }

  stopRun() {
    if (!this.run) return;
    this.run = null;
    this.emit();
  }

  /** click on the "Click to generate" pill (or the inspector button) */
  generateNow(id: string) {
    this.rtOf(id).genStart = this.now || performance.now() / 1000;
  }

  /* ───────────── hit testing ───────────── */
  private hit(p: { x: number; y: number }): Hit {
    const k = this.view.k;
    if (this.hoverEdge) {
      const ed = this.edges.find((e) => e.id === this.hoverEdge);
      const pts = ed && this.edgePts(ed);
      if (pts) {
        const m = pts[Math.floor(pts.length / 2)];
        if (Math.hypot(p.x - m[0], p.y - m[1]) < Math.max(11, 12 / k)) return { t: "edgebtn", id: ed!.id };
      }
    }
    const pr = Math.max(14, 10 / k);
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      const d = this.def(n);
      if (d.hasOutput) {
        const o = this.portPos(n, "out");
        if (Math.hypot(p.x - o[0], p.y - o[1]) < pr) return { t: "port", id: n.id, side: "out" };
      }
      if (d.hasInput) {
        const o = this.portPos(n, "in");
        if (Math.hypot(p.x - o[0], p.y - o[1]) < pr) return { t: "port", id: n.id, side: "in" };
      }
    }
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      const d = this.def(n);
      if (p.x >= n.x && p.x <= n.x + d.w && p.y >= n.y && p.y <= n.y + NODE_H) {
        if (n.type === "generate") {
          const r = pillRect(d.w);
          const lx = p.x - n.x;
          const ly = p.y - n.y;
          if (lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h) return { t: "pill", id: n.id };
        }
        return { t: "node", id: n.id };
      }
    }
    const thr = Math.max(6, 9 / k);
    for (let i = this.edges.length - 1; i >= 0; i--) {
      const pts = this.edgePts(this.edges[i]);
      if (!pts) continue;
      for (let j = 0; j < pts.length - 1; j++) {
        if (distSeg(p, pts[j], pts[j + 1]) < thr) return { t: "edge", id: this.edges[i].id };
      }
    }
    return { t: "none" };
  }

  private connectCandidate(): { id: string } | null {
    const d = this.drag;
    if (!d || d.kind !== "connect") return null;
    const h = this.hover;
    let other: string | null = null;
    if (h.t === "port" && h.side !== d.side) other = h.id;
    else if (h.t === "node" || h.t === "pill") other = h.id;
    if (!other) return null;
    const ok = d.side === "out" ? this.canConnect(d.id, other) : this.canConnect(other, d.id);
    return ok ? { id: other } : null;
  }

  /* ───────────── pointer handling ───────────── */
  private cursor() {
    if (!this.canvas) return;
    const d = this.drag;
    let c = "default";
    if (d) {
      c = d.kind === "pan" || d.kind === "nodes" ? "grabbing" : "crosshair";
    } else if (this.space) c = "grab";
    else {
      switch (this.hover.t) {
        case "port":
          c = "crosshair";
          break;
        case "pill":
        case "edgebtn":
        case "edge":
          c = "pointer";
          break;
        case "node":
          c = "default";
          break;
        default:
          c = "grab";
      }
    }
    this.canvas.style.cursor = c;
  }

  private onDown = (e: PointerEvent) => {
    const canvas = this.canvas!;
    const ae = document.activeElement as HTMLElement | null;
    if (ae && ae !== document.body && ae !== canvas) ae.blur?.();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const s = this.toScreen(e);
    const p = this.toWorld(s);
    this.pointer = p;
    this.viewTarget = null;

    if (e.button === 1 || e.button === 2 || (e.button === 0 && this.space)) {
      this.drag = { kind: "pan", sx: s.x, sy: s.y, vx: this.view.x, vy: this.view.y, moved: true };
      this.cursor();
      return;
    }
    if (e.button !== 0) return;

    this.hover = this.hit(p);
    const h = this.hover;
    switch (h.t) {
      case "edgebtn":
        this.deleteEdge(h.id);
        break;
      case "pill": {
        this.selection = new Set([h.id]);
        this.selEdge = null;
        this.generateNow(h.id);
        this.emit();
        break;
      }
      case "port":
        this.drag = { kind: "connect", id: h.id, side: h.side };
        break;
      case "node": {
        let startDrag = true;
        if (e.shiftKey) {
          if (this.selection.has(h.id)) {
            this.selection.delete(h.id);
            startDrag = false;
          } else this.selection.add(h.id);
          this.selection = new Set(this.selection);
        } else if (!this.selection.has(h.id)) {
          this.selection = new Set([h.id]);
        }
        this.selEdge = null;
        const idx = this.nodes.findIndex((n) => n.id === h.id);
        if (idx >= 0 && idx !== this.nodes.length - 1) {
          const [n] = this.nodes.splice(idx, 1);
          this.nodes.push(n);
        }
        if (startDrag) {
          const origins = new Map<string, { x: number; y: number }>();
          this.nodes.forEach((n) => {
            if (this.selection.has(n.id)) origins.set(n.id, { x: n.x, y: n.y });
          });
          this.drag = {
            kind: "nodes",
            id: h.id,
            sx: p.x,
            sy: p.y,
            origins,
            moved: false,
            cp: false,
            shift: e.shiftKey,
          };
        }
        this.emit();
        break;
      }
      case "edge":
        this.selEdge = h.id;
        this.selection = new Set();
        this.emit();
        break;
      default:
        if (e.shiftKey) {
          this.drag = {
            kind: "marquee",
            x0: s.x,
            y0: s.y,
            x1: s.x,
            y1: s.y,
            base: new Set(this.selection),
          };
        } else {
          this.drag = { kind: "pan", sx: s.x, sy: s.y, vx: this.view.x, vy: this.view.y, moved: false };
        }
    }
    this.cursor();
  };

  private onMove = (e: PointerEvent) => {
    const s = this.toScreen(e);
    const p = this.toWorld(s);
    this.pointer = p;
    const d = this.drag;
    if (!d) {
      this.hover = this.hit(p);
      this.hoverEdge = this.hover.t === "edge" || this.hover.t === "edgebtn" ? this.hover.id : null;
      this.cursor();
      return;
    }
    switch (d.kind) {
      case "pan":
        if (Math.hypot(s.x - d.sx, s.y - d.sy) > 3) d.moved = true;
        this.view.x = d.vx + (s.x - d.sx);
        this.view.y = d.vy + (s.y - d.sy);
        break;
      case "nodes": {
        const dx = p.x - d.sx;
        const dy = p.y - d.sy;
        if (!d.moved && Math.hypot(dx, dy) * this.view.k < 3) break;
        if (!d.cp) {
          // nothing has moved yet, so this snapshot holds the pre-drag positions
          this.checkpoint();
          d.cp = true;
        }
        d.moved = true;
        d.origins.forEach((o, id) => {
          const n = this.getNode(id);
          if (!n) return;
          n.x = snap(o.x + dx, !e.altKey);
          n.y = snap(o.y + dy, !e.altKey);
        });
        break;
      }
      case "connect":
        this.hover = this.hit(p);
        break;
      case "marquee": {
        d.x1 = s.x;
        d.y1 = s.y;
        const a = this.toWorld({ x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1) });
        const b = this.toWorld({ x: Math.max(d.x0, d.x1), y: Math.max(d.y0, d.y1) });
        const sel = new Set(d.base);
        for (const n of this.nodes) {
          const w = this.def(n).w;
          if (n.x < b.x && n.x + w > a.x && n.y < b.y && n.y + NODE_H > a.y) sel.add(n.id);
        }
        const same = sel.size === this.selection.size && [...sel].every((id) => this.selection.has(id));
        if (!same) {
          this.selection = sel;
          this.emit();
        }
        break;
      }
    }
    this.cursor();
  };

  private onUp = (e: PointerEvent) => {
    const d = this.drag;
    this.drag = null;
    try {
      this.canvas?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!d) return;
    const s = this.toScreen(e);
    const p = this.toWorld(s);
    switch (d.kind) {
      case "pan":
        if (!d.moved && e.button === 0) this.clearSelection();
        break;
      case "nodes":
        if (d.moved) {
          this.save();
          this.emit();
        } else if (!d.shift && this.selection.size > 1) {
          this.selection = new Set([d.id]);
          this.emit();
        }
        break;
      case "connect": {
        this.hover = this.hit(p);
        const cand = this.connectCandidate();
        if (cand) {
          const from = d.side === "out" ? d.id : cand.id;
          const to = d.side === "out" ? cand.id : d.id;
          this.checkpoint();
          this.edges.push({ id: uid("e"), from, to });
          this.selEdge = null;
          this.save();
          this.emit();
        }
        break;
      }
      case "marquee":
        this.emit();
        break;
    }
    this.hover = this.hit(p);
    this.hoverEdge = this.hover.t === "edge" || this.hover.t === "edgebtn" ? this.hover.id : null;
    this.cursor();
  };

  private onLeave = () => {
    if (this.drag) return;
    this.hover = { t: "none" };
    this.hoverEdge = null;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.viewTarget = null;
    const s = this.toScreen(e);
    let dy = e.deltaY;
    let dx = e.deltaX;
    if (e.deltaMode === 1) {
      dy *= 16;
      dx *= 16;
    } else if (e.deltaMode === 2) {
      dy *= 100;
      dx *= 100;
    }
    const trackpad = !e.ctrlKey && !e.metaKey && e.deltaMode === 0 && (dx !== 0 || Math.abs(dy) < 40);
    if (e.shiftKey && !e.ctrlKey) {
      this.view.x -= dx || dy;
      return;
    }
    if (trackpad) {
      this.view.x -= dx;
      this.view.y -= dy;
      return;
    }
    this.zoomAt(s.x, s.y, Math.exp(-dy * (e.ctrlKey ? 0.012 : 0.0017)));
  };

  private onKey = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    if (e.code === "Space") {
      if (el === document.body || el === this.canvas) {
        e.preventDefault();
        this.space = true;
        this.cursor();
      }
      return;
    }
    if (mod && key === "z") {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
    } else if (mod && key === "y") {
      e.preventDefault();
      this.redo();
    } else if (mod && key === "d") {
      e.preventDefault();
      this.duplicateSelection();
    } else if (mod && key === "a") {
      e.preventDefault();
      this.selectAll();
    } else if (key === "delete" || key === "backspace") {
      e.preventDefault();
      this.deleteSelection();
    } else if (key === "escape") {
      if (this.drag?.kind === "connect") this.drag = null;
      this.clearSelection();
    } else if (!mod && key === "f") {
      this.fit(true);
    } else if (!mod && (key === "+" || key === "=")) {
      this.zoomBy(1.25);
    } else if (!mod && (key === "-" || key === "_")) {
      this.zoomBy(1 / 1.25);
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "Space") {
      this.space = false;
      this.cursor();
    }
  };

  /* ───────────── frame loop ───────────── */
  private frame = (ms: number) => {
    const now = ms / 1000;
    const dt = clamp(now - this.last, 0, 0.1);
    this.last = now;
    this.now = now;

    if (this.viewTarget) {
      const f = 1 - Math.exp(-dt * 9);
      const v = this.view;
      const t = this.viewTarget;
      v.x += (t.x - v.x) * f;
      v.y += (t.y - v.y) * f;
      v.k += (t.k - v.k) * f;
      if (Math.abs(t.x - v.x) < 0.3 && Math.abs(t.y - v.y) < 0.3 && Math.abs(t.k - v.k) < 0.0008) {
        this.view = { ...t };
        this.viewTarget = null;
      }
    }

    if (this.run) {
      const el = now - this.run.t0;
      if (!this.run.finished && el > this.run.total) {
        this.run.finished = true;
        this.emit();
      }
      if (el > this.run.total + 3.6) {
        this.run = null;
        this.emit();
      }
    }

    if (this.canvas && this.cw > 0) this.draw(now, dt);

    const z = this.zoomPct;
    if (z !== this.lastZoomPct) {
      this.lastZoomPct = z;
      this.emit();
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private statusOf(id: string, now: number): { status: RunStatus; prog: number } {
    const r = this.run;
    if (!r) return { status: "idle", prog: 0 };
    const el = now - r.t0;
    const s = r.starts.get(id) ?? 0;
    const e = r.ends.get(id) ?? 0;
    if (el < s) return { status: "pending", prog: 0 };
    if (el < e) return { status: "active", prog: (el - s) / (e - s) };
    return { status: "done", prog: 1 };
  }

  private ensureText(n: WFNode, def: NodeDef, r: Rt) {
    const key = `${n.title}\u0000${n.description}\u0000${def.w}`;
    if (r.textKey === key) return;
    r.textKey = key;
    const ctx = this.ctx;
    ctx.font = TITLE_FONT;
    const maxT = def.w - 70;
    let title = n.title;
    if (ctx.measureText(title).width > maxT) {
      while (title.length > 1 && ctx.measureText(title + "…").width > maxT) title = title.slice(0, -1);
      title = title.trimEnd() + "…";
    }
    r.title = title;
    ctx.font = DESC_FONT;
    const maxD = def.type === "collaborate" ? 250 : def.w - 44;
    const words = n.description.trim().split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (ctx.measureText(test).width <= maxD || !cur) cur = test;
      else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    if (lines.length > 3) {
      lines.length = 3;
      let last = lines[2];
      while (last.length > 1 && ctx.measureText(last + "…").width > maxD) last = last.slice(0, -1);
      lines[2] = last.trimEnd() + "…";
    }
    r.lines = lines;
  }

  private drawBackdrop() {
    const { ctx, dpr, view } = this;
    const Wd = this.cw * dpr;
    const Hd = this.ch * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const g = ctx.createRadialGradient(Wd * 0.5, Hd * 0.42, 0, Wd * 0.5, Hd * 0.42, Math.max(Wd, Hd) * 0.7);
    g.addColorStop(0, "rgba(255,255,255,0.055)");
    g.addColorStop(0.5, "rgba(255,255,255,0.016)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, Wd, Hd);

    const g2 = ctx.createRadialGradient(Wd * 0.5, -Hd * 0.1, 0, Wd * 0.5, -Hd * 0.1, Hd * 0.9);
    g2.addColorStop(0, `rgba(${this.acc[0]},${this.acc[1]},${this.acc[2]},0.06)`);
    g2.addColorStop(1, `rgba(${this.acc[0]},${this.acc[1]},${this.acc[2]},0)`);
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, Wd, Hd);

    {
      let mult = 1;
      while (32 * mult * view.k < 20) mult *= 2;
      const tileTrue = 32 * mult * view.k * dpr;
      const px = Math.max(8, Math.round(tileTrue));
      let pat = this.bgPatterns.get(px);
      if (pat === undefined) {
        if (this.bgPatterns.size > 80) this.bgPatterns.clear();
        pat = dotTile(px, clamp(px * 0.045, 0.8, 2.4), "rgba(255,255,255,0.15)");
        this.bgPatterns.set(px, pat);
      }
      if (pat) {
        const sc = tileTrue / px;
        const ox = (view.x - 16 * mult * view.k) * dpr;
        const oy = (view.y - 16 * mult * view.k) * dpr;
        pat.setTransform(new DOMMatrix([sc, 0, 0, sc, ox, oy]));
        ctx.globalAlpha = clamp(view.k * 1.2, 0.35, 1);
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, Wd, Hd);
        ctx.globalAlpha = 1;
      }
    }

    const vg = ctx.createRadialGradient(Wd / 2, Hd / 2, Math.min(Wd, Hd) * 0.35, Wd / 2, Hd / 2, Math.hypot(Wd, Hd) * 0.55);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.62)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, Wd, Hd);
  }

  private drawEdge(
    pts: Pt[],
    o: { selected: boolean; hovered: boolean; progress: number; done: boolean; idx: number; now: number },
  ) {
    const { ctx } = this;
    const env = this.env;
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const L = polyLen(pts);

    ctx.strokeStyle = "#08080a";
    ctx.lineWidth = 6;
    strokePoly(ctx, pts);

    ctx.lineWidth = 2;
    ctx.strokeStyle = o.selected ? A(env, 0.9) : o.hovered ? "#58585d" : "#333336";
    if (o.selected) shadow(env, A(env, 0.6), 10);
    strokePoly(ctx, pts);
    noShadow(env);

    if (o.progress > 0 && o.progress < 1) {
      const sub = subPoly(pts, 0, L * o.progress);
      ctx.strokeStyle = A(env, 1);
      ctx.lineWidth = 2.4;
      shadow(env, A(env, 0.9), 10);
      strokePoly(ctx, sub);
      noShadow(env);
    } else if (o.done) {
      ctx.strokeStyle = A(env, 0.65);
      ctx.lineWidth = 2.2;
      shadow(env, A(env, 0.5), 8);
      strokePoly(ctx, pts);
      noShadow(env);
    }

    // ambient flow pulse
    const len = 38;
    const cycle = L + len + 60;
    const head = (((o.now * (this.run ? 150 : 70) + o.idx * 97) % cycle) + cycle) % cycle;
    const seg = subPoly(pts, head - len, head);
    if (seg.length > 1) {
      const a = seg[0];
      const b = seg[seg.length - 1];
      const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
      g.addColorStop(0, A(env, 0));
      g.addColorStop(1, A(env, 0.9));
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.4;
      shadow(env, A(env, 0.9), 9);
      strokePoly(ctx, seg);
    }
    ctx.restore();

    if (o.hovered || o.selected) {
      const m = pts[Math.floor(pts.length / 2)];
      ctx.save();
      shadow(env, "rgba(0,0,0,0.7)", 8, 2);
      ctx.beginPath();
      ctx.arc(m[0], m[1], 10, 0, Math.PI * 2);
      ctx.fillStyle = "#17171a";
      ctx.fill();
      noShadow(env);
      ctx.lineWidth = 1;
      ctx.strokeStyle = this.hover.t === "edgebtn" ? A(env, 0.9) : W(0.25);
      ctx.stroke();
      ctx.strokeStyle = this.hover.t === "edgebtn" ? A(env, 1) : W(0.75);
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(m[0] - 3, m[1] - 3);
      ctx.lineTo(m[0] + 3, m[1] + 3);
      ctx.moveTo(m[0] + 3, m[1] - 3);
      ctx.lineTo(m[0] - 3, m[1] + 3);
      ctx.stroke();
      ctx.restore();
    }
  }

  private draw(now: number, dt: number) {
    const { ctx, dpr, cw, ch, view } = this;
    const k = view.k;
    const env = this.env;
    env.acc = this.acc;
    env.t = now;
    env.s = k * dpr;

    ctx.globalAlpha = 1;
    ctx.fillStyle = "#0a0a0b";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillRect(0, 0, cw * dpr, ch * dpr);
    this.drawBackdrop();

    ctx.setTransform(k * dpr, 0, 0, k * dpr, view.x * dpr, view.y * dpr);
    const vx0 = -view.x / k - 40;
    const vy0 = -view.y / k - 40;
    const vx1 = (cw - view.x) / k + 40;
    const vy1 = (ch - view.y) / k + 40;

    /* edges */
    const el = this.run ? now - this.run.t0 : 0;
    this.edges.forEach((ed, idx) => {
      const pts = this.edgePts(ed);
      if (!pts) return;
      let progress = 0;
      let done = false;
      if (this.run) {
        const es = this.run.ends.get(ed.from) ?? 0;
        const p = clamp((el - es) / EDGE_DUR, 0, 1);
        progress = p;
        done = p >= 1;
      }
      this.drawEdge(pts, {
        selected: this.selEdge === ed.id,
        hovered: this.hoverEdge === ed.id,
        progress,
        done,
        idx,
        now,
      });
    });

    /* live connection preview */
    if (this.drag?.kind === "connect") {
      const d = this.drag;
      const src = this.getNode(d.id);
      if (src) {
        const cand = this.connectCandidate();
        const tgt = cand ? this.getNode(cand.id) : null;
        const a: Pt = this.portPos(src, d.side);
        const b: Pt = tgt ? this.portPos(tgt, d.side === "out" ? "in" : "out") : [this.pointer.x, this.pointer.y];
        const pts = d.side === "out" ? bez(a, b) : bez(b, a);
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = A(env, cand ? 1 : 0.7);
        ctx.lineWidth = 2.2;
        ctx.setLineDash(cand ? [] : [6, 6]);
        ctx.lineDashOffset = -now * 30;
        shadow(env, A(env, 0.8), 10);
        strokePoly(ctx, pts);
        ctx.restore();
      }
    }

    /* nodes */
    const cd = this.drag?.kind === "connect" ? this.drag : null;
    const lod = k < 0.3;
    const cardPx = clamp(Math.round(8 * env.s), 4, 48);
    let cardPat = this.cardPatterns.get(cardPx);
    if (cardPat === undefined) {
      if (this.cardPatterns.size > 60) this.cardPatterns.clear();
      cardPat = dotTile(cardPx, Math.max(0.5, (cardPx * 0.62) / 8), "rgba(255,255,255,0.55)");
      cardPat?.setTransform(new DOMMatrix().scale(8 / cardPx));
      this.cardPatterns.set(cardPx, cardPat);
    }
    for (const n of this.nodes) {
      const def = this.def(n);
      if (n.x > vx1 || n.y > vy1 || n.x + def.w < vx0 || n.y + NODE_H < vy0) continue;
      const rt = this.rtOf(n.id);
      const { status, prog } = this.statusOf(n.id, now);
      const eff = n.bypass ? "idle" : status;

      // generate-pill state
      let gen = -1;
      if (n.type === "generate") {
        if (eff === "active") gen = prog;
        else if (rt.genStart > 0) {
          const gt = now - rt.genStart;
          if (gt < 2.4) gen = gt / 2.4;
          else if (gt < 4) gen = 1 + (gt - 2.4) / 1.6;
          else rt.genStart = 0;
        }
      }

      const target = eff === "active" || (gen >= 0 && gen < 1) ? 1 : eff === "done" ? 0.7 : 0.38;
      rt.e += (target - rt.e) * (1 - Math.exp(-dt * 6));
      this.ensureText(n, def, rt);

      env.e = rt.e;
      env.active = eff === "active";
      env.done = eff === "done";
      env.prog = prog;
      env.gen = gen;
      env.pillHover = this.hover.t === "pill" && this.hover.id === n.id;

      let inValid: boolean | null = null;
      let outValid: boolean | null = null;
      let portHover: "in" | "out" | null = null;
      if (cd) {
        if (n.id !== cd.id) {
          if (cd.side === "out" && def.hasInput) inValid = this.canConnect(cd.id, n.id);
          if (cd.side === "in" && def.hasOutput) outValid = this.canConnect(n.id, cd.id);
        } else portHover = cd.side;
      } else if (this.hover.t === "port" && this.hover.id === n.id) portHover = this.hover.side;

      const flags: NodeFlags = {
        selected: this.selection.has(n.id),
        hovered: (this.hover.t === "node" || this.hover.t === "pill") && this.hover.id === n.id,
        status: eff,
        showStatus: !!this.run && !n.bypass,
        inConnected: this.edges.some((e) => e.to === n.id),
        outConnected: this.edges.some((e) => e.from === n.id),
        portHover,
        inValid,
        outValid,
      };
      drawNode(env, n, def, flags, cardPat, rt.title, rt.lines, lod);
    }

    /* marquee */
    if (this.drag?.kind === "marquee") {
      const d = this.drag;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const x = Math.min(d.x0, d.x1);
      const y = Math.min(d.y0, d.y1);
      const w = Math.abs(d.x1 - d.x0);
      const h = Math.abs(d.y1 - d.y0);
      ctx.fillStyle = A(env, 0.06);
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = A(env, 0.6);
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x + 0.5, y + 0.5, w, h);
      ctx.setLineDash([]);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
