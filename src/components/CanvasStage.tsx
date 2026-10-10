import { useEffect, useRef } from "react";
import type { Engine } from "../lib/engine";
import { NODE_DEFS, NodeType } from "../lib/types";
import { useEngine } from "../hooks/useEngine";
import { Sparkles } from "lucide-react";

export const DRAG_MIME = "application/x-relay-node";

export function CanvasStage({ engine }: { engine: Engine }) {
  useEngine(engine);
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!cv.current || !wrap.current) return;
    engine.attach(cv.current, wrap.current);
    return () => engine.detach();
  }, [engine]);

  return (
    <div
      ref={wrap}
      className="absolute inset-0"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DRAG_MIME)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(e) => {
        const type = e.dataTransfer.getData(DRAG_MIME) as NodeType;
        if (type && type in NODE_DEFS) {
          e.preventDefault();
          engine.addNode(type, engine.screenToWorld(e.clientX, e.clientY));
        }
      }}
    >
      <canvas ref={cv} className="block h-full w-full touch-none outline-none" />

      {engine.nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="fade-up flex max-w-sm flex-col items-center text-center">
            <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-gradient-to-b from-[#313134] to-[#1b1b1d] shadow-[0_18px_40px_-10px_rgba(0,0,0,0.8)]">
              <Sparkles className="h-7 w-7 text-[var(--accent)] drop-shadow-[0_0_10px_var(--accent)]" />
            </div>
            <h2 className="text-lg font-medium text-white">Your canvas is empty</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-white/40">
              Drag a node from the left panel, or start from a ready-made flow.
            </p>
            <button
              className="btn-accent pointer-events-auto mt-5"
              onClick={() => engine.loadDemo()}
            >
              <Sparkles className="h-4 w-4" />
              Load demo workflow
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
