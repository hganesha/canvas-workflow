import { Activity, Database, Sparkles, Upload, Users, Zap, type LucideIcon } from "lucide-react";
import type { Engine } from "../lib/engine";
import { NODE_DEFS, NODE_ORDER, NodeType } from "../lib/types";
import { DRAG_MIME } from "./CanvasStage";

export const NODE_ICONS: Record<NodeType, LucideIcon> = {
  capture: Upload,
  process: Database,
  automate: Zap,
  monitor: Activity,
  collaborate: Users,
  generate: Sparkles,
};

export function IconTile({ type, size = 40 }: { type: NodeType; size?: number }) {
  const Icon = NODE_ICONS[type];
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[11px] border border-white/10 bg-gradient-to-b from-[#323235] to-[#1a1a1c] text-[var(--accent)] shadow-[0_8px_18px_-8px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.07)]"
      style={{ width: size, height: size }}
    >
      <Icon
        style={{ width: size * 0.45, height: size * 0.45, filter: "drop-shadow(0 0 6px rgba(var(--accent-rgb) / 0.6))" }}
        strokeWidth={2}
      />
    </span>
  );
}

/** Slim vertical dock – drag a tile onto the canvas, or click to drop it in view. */
export function Palette({ engine }: { engine: Engine }) {
  return (
    <aside className="glass fade-up absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-2xl p-1.5 max-md:left-3">
      <ul className="flex flex-col gap-1.5">
        {NODE_ORDER.map((type) => {
          const def = NODE_DEFS[type];
          return (
            <li key={type} className="group relative">
              <button
                draggable
                aria-label={`Add ${def.name} node`}
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_MIME, type);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => engine.addNode(type)}
                className="block cursor-grab rounded-xl border border-transparent p-[3px] transition-all hover:border-[rgba(var(--accent-rgb)/0.35)] hover:bg-white/[0.04] active:scale-95 active:cursor-grabbing"
              >
                <IconTile type={type} size={44} />
              </button>

              <div className="pointer-events-none absolute left-full top-1/2 z-30 ml-3 -translate-y-1/2 translate-x-[-4px] whitespace-nowrap rounded-xl border border-white/10 bg-[#141416]/95 px-3 py-2 opacity-0 shadow-[0_14px_40px_-8px_rgba(0,0,0,0.9)] backdrop-blur transition-all group-hover:translate-x-0 group-hover:opacity-100">
                <div className="text-[12.5px] font-medium text-white">{def.name}</div>
                <div className="text-[11px] text-white/40">{def.blurb}</div>
                <div className="mt-1 text-[10px] text-[var(--accent)]/80">Drag onto canvas · or click</div>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
