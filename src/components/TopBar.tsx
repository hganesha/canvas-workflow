import { useRef, useState } from "react";
import { Download, HelpCircle, PanelLeft, Play, Redo2, Square, Undo2, Upload } from "lucide-react";
import type { Engine } from "../lib/engine";
import { useEngine } from "../hooks/useEngine";
import { ACCENTS } from "../lib/types";

function Logo() {
  return (
    <span className="relative grid h-8 w-8 place-items-center rounded-[10px] border border-white/10 bg-gradient-to-b from-[#343437] to-[#18181a] shadow-[0_6px_16px_-6px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)]">
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none">
        <path
          d="M12 2.8 20 7.4v9.2l-8 4.6-8-4.6V7.4z"
          stroke="var(--accent)"
          strokeWidth="1.7"
          strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 0 4px rgba(var(--accent-rgb) / 0.8))" }}
        />
        <circle cx="12" cy="12" r="2.6" fill="var(--accent)" />
      </svg>
    </span>
  );
}

export function TopBar({
  engine,
  paletteOpen,
  onTogglePalette,
  helpOpen,
  onToggleHelp,
}: {
  engine: Engine;
  paletteOpen: boolean;
  onTogglePalette: () => void;
  helpOpen: boolean;
  onToggleHelp: () => void;
}) {
  useEngine(engine);
  const fileRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  };

  const exportFile = () => {
    const blob = new Blob([engine.exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relay-workflow.json";
    a.click();
    URL.revokeObjectURL(url);
    flash("Workflow exported");
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    flash(engine.importJSON(text) ? "Workflow imported" : "Couldn't read that file");
    if (fileRef.current) fileRef.current.value = "";
  };

  const running = engine.running;

  return (
    <>
      <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex items-center justify-between max-md:inset-x-3">
        {/* brand */}
        <div className="glass pointer-events-auto flex items-center gap-2.5 rounded-2xl py-1.5 pl-1.5 pr-3">
          <button
            onClick={onTogglePalette}
            className="btn-ghost !h-8 !min-w-8 !px-0"
            title="Toggle node dock"
            style={paletteOpen ? { color: "var(--accent)" } : undefined}
          >
            <PanelLeft className="h-4 w-4" />
          </button>
          <Logo />
          <div className="leading-tight max-sm:hidden">
            <div className="text-[13.5px] font-semibold tracking-tight text-white">Relay</div>
            <div className="text-[10.5px] text-white/35">Workflow studio</div>
          </div>
        </div>

        {/* centre: history + run */}
        <div className="glass pointer-events-auto absolute left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-2xl p-1.5 max-sm:static max-sm:translate-x-0">
          <button className="btn-ghost" disabled={!engine.canUndo} onClick={() => engine.undo()} title="Undo (⌘Z)">
            <Undo2 className="h-4 w-4" />
          </button>
          <button className="btn-ghost" disabled={!engine.canRedo} onClick={() => engine.redo()} title="Redo (⇧⌘Z)">
            <Redo2 className="h-4 w-4" />
          </button>
          <span className="mx-1 h-5 w-px bg-white/10" />
          <button
            className="btn-accent"
            onClick={() => (running ? engine.stopRun() : engine.runWorkflow())}
            style={engine.nodes.length === 0 ? { opacity: 0.4, pointerEvents: "none" } : undefined}
          >
            {running ? (
              <>
                <Square className="h-3.5 w-3.5" fill="currentColor" />
                <span>Running…</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" fill="currentColor" />
                <span>Run workflow</span>
              </>
            )}
          </button>
        </div>

        {/* right: accent, io, help */}
        <div className="glass pointer-events-auto flex items-center gap-0.5 rounded-2xl p-1.5 max-sm:hidden">
          <div className="flex items-center gap-1.5 px-2" title="Highlight colour">
            {ACCENTS.map((a) => {
              const active = engine.accentHex.toLowerCase() === a.hex;
              return (
                <button
                  key={a.hex}
                  aria-label={`${a.name} highlight`}
                  title={a.name}
                  onClick={() => engine.setAccent(a.hex)}
                  className="h-[15px] w-[15px] rounded-full transition-transform hover:scale-125"
                  style={{
                    background: a.hex,
                    boxShadow: active ? `0 0 0 2px #151517, 0 0 0 3.5px ${a.hex}, 0 0 12px ${a.hex}99` : "0 0 0 1px #ffffff22",
                  }}
                />
              );
            })}
          </div>
          <span className="mx-1 h-5 w-px bg-white/10" />
          <button className="btn-ghost" onClick={() => fileRef.current?.click()} title="Import JSON">
            <Upload className="h-4 w-4" />
            <span className="max-xl:hidden">Import</span>
          </button>
          <button className="btn-ghost" onClick={exportFile} title="Export JSON">
            <Download className="h-4 w-4" />
            <span className="max-xl:hidden">Export</span>
          </button>
          <button
            className="btn-ghost help-btn"
            onClick={onToggleHelp}
            title="Workflow info & shortcuts"
            style={helpOpen ? { color: "var(--accent)" } : undefined}
          >
            <HelpCircle className="h-4 w-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => importFile(e.target.files?.[0])}
          />
        </div>
      </div>

      {toast && (
        <div className="fade-up glass pointer-events-none absolute left-1/2 top-[76px] z-30 -translate-x-1/2 rounded-xl px-3.5 py-2 text-[12.5px] text-white/80">
          {toast}
        </div>
      )}
    </>
  );
}
