import { Maximize2, Minus, Plus } from "lucide-react";
import type { Engine } from "../lib/engine";
import { useEngine } from "../hooks/useEngine";

export function BottomBar({ engine }: { engine: Engine }) {
  useEngine(engine);
  return (
    <>
      <div className="glass absolute bottom-4 left-4 z-10 flex items-center gap-0.5 rounded-2xl p-1.5 max-md:left-3">
        <button className="btn-ghost" onClick={() => engine.zoomBy(1 / 1.25)} title="Zoom out (−)">
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-12 select-none text-center text-[12px] font-medium tabular-nums text-white/70">
          {engine.zoomPct}%
        </span>
        <button className="btn-ghost" onClick={() => engine.zoomBy(1.25)} title="Zoom in (+)">
          <Plus className="h-4 w-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-white/10" />
        <button className="btn-ghost" onClick={() => engine.fit(true)} title="Fit to view (F)">
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2 max-lg:hidden">
        <div className="flex items-center gap-3 rounded-full border border-white/[0.06] bg-black/40 px-4 py-1.5 text-[11.5px] text-white/35 backdrop-blur">
          <span>Drag from a port to connect</span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span>Scroll to zoom</span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span>Drag canvas to pan</span>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-5 right-5 z-10 text-[11.5px] tabular-nums text-white/30 max-md:hidden">
        {engine.nodes.length} nodes · {engine.edges.length} connections
      </div>
    </>
  );
}
