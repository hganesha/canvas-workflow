import { Copy, Link2, Sparkles, Trash2, Unlink, X } from "lucide-react";
import type { Engine } from "../lib/engine";
import { useEngine } from "../hooks/useEngine";
import { ACCENTS, NODE_DEFS } from "../lib/types";
import { IconTile } from "./Palette";

const shell =
  "glass fade-up absolute right-4 top-[72px] z-10 w-[288px] max-h-[calc(100%-160px)] overflow-y-auto thin-scroll rounded-2xl p-4 " +
  "max-md:left-3 max-md:right-3 max-md:top-auto max-md:bottom-16 max-md:w-auto max-md:max-h-[46%]";

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="relative h-[22px] w-[38px] shrink-0 rounded-full border border-white/10 transition-colors"
      style={{ background: on ? "var(--accent)" : "rgba(255,255,255,0.08)" }}
    >
      <span
        className="absolute top-[2px] h-4 w-4 rounded-full bg-white shadow transition-all"
        style={{ left: on ? 18 : 2, background: on ? "#06120d" : "#cfcfd2" }}
      />
    </button>
  );
}

function Shortcut({ keys, label }: { keys: string[]; label: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1">
      <span className="text-[12px] text-white/45">{label}</span>
      <span className="flex gap-1">
        {keys.map((k) => (
          <span key={k} className="kbd">
            {k}
          </span>
        ))}
      </span>
    </li>
  );
}

export function Inspector({
  engine,
  overviewOpen,
  onCloseOverview,
}: {
  engine: Engine;
  overviewOpen: boolean;
  onCloseOverview: () => void;
}) {
  useEngine(engine);
  const node = engine.selectedNode;

  /* ── a connection is selected ── */
  if (engine.selEdge) {
    const ed = engine.edges.find((e) => e.id === engine.selEdge);
    const a = ed && engine.getNode(ed.from);
    const b = ed && engine.getNode(ed.to);
    return (
      <aside className={shell} key={engine.selEdge}>
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-[var(--accent)]" />
          <span className="label">Connection</span>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-white/70">
          <span className="text-white">{a?.title}</span>
          <span className="mx-1.5 text-[var(--accent)]">→</span>
          <span className="text-white">{b?.title}</span>
        </p>
        <button
          className="btn-ghost mt-4 w-full !border !border-white/10 !text-red-300 hover:!bg-red-500/10"
          onClick={() => engine.deleteEdge(engine.selEdge!)}
        >
          <Unlink className="h-4 w-4" /> Remove connection
        </button>
      </aside>
    );
  }

  /* ── single node ── */
  if (node) {
    const def = NODE_DEFS[node.type];
    const { inc, out } = engine.connCount(node.id);
    return (
      <aside className={shell} key={node.id}>
        <div className="flex items-center gap-3">
          <IconTile type={node.type} size={40} />
          <div className="min-w-0 flex-1">
            <div className="label">{def.name} node</div>
            <div className="truncate text-[13.5px] font-medium text-white">{node.title || "Untitled"}</div>
          </div>
          <button className="btn-ghost !h-7 !min-w-7 !px-0" onClick={() => engine.clearSelection()} title="Deselect">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="hairline-t my-4" />

        <label className="label mb-1.5 block">Title</label>
        <input
          className="field"
          value={node.title}
          maxLength={40}
          onChange={(e) => engine.updateNode(node.id, { title: e.target.value })}
          placeholder="Node title"
        />

        <label className="label mb-1.5 mt-3.5 block">Description</label>
        <textarea
          className="field resize-none leading-relaxed"
          rows={3}
          value={node.description}
          maxLength={120}
          onChange={(e) => engine.updateNode(node.id, { description: e.target.value })}
          placeholder="What does this step do?"
        />
        <div className="mt-1 text-right text-[10.5px] text-white/25">{node.description.length}/120</div>

        <div className="mt-2 flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
          <div>
            <div className="text-[12.5px] font-medium text-white/85">Bypass</div>
            <div className="text-[11px] text-white/35">Skip this step when running</div>
          </div>
          <Switch on={node.bypass} onChange={(v) => engine.updateNode(node.id, { bypass: v })} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
            <div className="label">Incoming</div>
            <div className="mt-0.5 text-[15px] font-medium text-white">{def.hasInput ? inc : "—"}</div>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
            <div className="label">Outgoing</div>
            <div className="mt-0.5 text-[15px] font-medium text-white">{def.hasOutput ? out : "—"}</div>
          </div>
        </div>

        {node.type === "generate" && (
          <button className="btn-accent mt-3 w-full justify-center" onClick={() => engine.generateNow(node.id)}>
            <Sparkles className="h-4 w-4" /> Generate now
          </button>
        )}

        <div className="mt-3 flex gap-2">
          <button
            className="btn-ghost flex-1 !border !border-white/10"
            onClick={() => engine.duplicateSelection()}
          >
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </button>
          <button
            className="btn-ghost flex-1 !border !border-white/10 !text-red-300 hover:!bg-red-500/10"
            onClick={() => engine.deleteSelection()}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </aside>
    );
  }

  /* ── multi-selection ── */
  if (engine.selection.size > 1) {
    return (
      <aside className={shell} key="multi">
        <div className="flex items-center justify-between">
          <span className="label">Selection</span>
          <button className="btn-ghost !h-7 !min-w-7 !px-0" onClick={() => engine.clearSelection()}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 text-[22px] font-medium text-white">
          {engine.selection.size} <span className="text-[13px] text-white/40">nodes selected</span>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="btn-ghost flex-1 !border !border-white/10" onClick={() => engine.duplicateSelection()}>
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </button>
          <button
            className="btn-ghost flex-1 !border !border-white/10 !text-red-300 hover:!bg-red-500/10"
            onClick={() => engine.deleteSelection()}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </aside>
    );
  }

  /* ── nothing selected: workflow overview ── */
  if (!overviewOpen) return null;
  const entries = engine.nodes.filter((n) => NODE_DEFS[n.type].hasInput && !engine.edges.some((e) => e.to === n.id));
  const triggers = engine.nodes.filter((n) => !NODE_DEFS[n.type].hasInput).length;
  return (
    <aside className={shell + " help-pop"} key="overview">
      <div className="flex items-center justify-between">
        <span className="label">Workflow</span>
        <span className="flex items-center gap-2 text-[10.5px] text-white/35">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
            Autosaved
          </span>
          <button className="btn-ghost !h-6 !min-w-6 !px-0" onClick={onCloseOverview} title="Close">
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          ["Nodes", engine.nodes.length],
          ["Links", engine.edges.length],
          ["Triggers", triggers],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
            <div className="label !text-[9.5px]">{l}</div>
            <div className="mt-0.5 text-[17px] font-medium text-white">{v}</div>
          </div>
        ))}
      </div>
      {entries.length > 0 && (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-200/60">
          {entries.length} node{entries.length > 1 ? "s have" : " has"} no incoming connection.
        </p>
      )}

      <div className="hairline-t my-4" />

      <div className="label mb-2.5">Highlight colour</div>
      <div className="flex gap-2">
        {ACCENTS.map((a) => {
          const active = engine.accentHex.toLowerCase() === a.hex;
          return (
            <button
              key={a.hex}
              title={a.name}
              onClick={() => engine.setAccent(a.hex)}
              className="relative h-8 w-8 rounded-full transition-transform hover:scale-110"
              style={{
                background: `radial-gradient(circle at 30% 25%, #fff6 0, transparent 45%), ${a.hex}`,
                boxShadow: active ? `0 0 0 2px #121214, 0 0 0 3.5px ${a.hex}, 0 0 18px ${a.hex}88` : "0 0 0 1px #ffffff22",
              }}
            />
          );
        })}
      </div>

      <div className="hairline-t my-4" />

      <div className="label mb-1.5">Shortcuts</div>
      <ul>
        <Shortcut keys={["Del"]} label="Delete selection" />
        <Shortcut keys={["⌘", "Z"]} label="Undo / redo (⇧)" />
        <Shortcut keys={["⌘", "D"]} label="Duplicate" />
        <Shortcut keys={["Shift", "drag"]} label="Marquee select" />
        <Shortcut keys={["Space", "drag"]} label="Pan canvas" />
        <Shortcut keys={["F"]} label="Fit to view" />
      </ul>

      <div className="mt-3 flex gap-2">
        <button className="btn-ghost flex-1 !border !border-white/10" onClick={() => engine.loadDemo()}>
          <Sparkles className="h-3.5 w-3.5" /> Demo
        </button>
        <button
          className="btn-ghost flex-1 !border !border-white/10 !text-red-300 hover:!bg-red-500/10"
          onClick={() => engine.clearAll()}
          disabled={!engine.nodes.length}
        >
          <Trash2 className="h-3.5 w-3.5" /> Clear
        </button>
      </div>
    </aside>
  );
}
