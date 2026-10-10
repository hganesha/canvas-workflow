import { useEffect, useMemo, useState } from "react";
import { Engine } from "./lib/engine";
import { CanvasStage } from "./components/CanvasStage";
import { TopBar } from "./components/TopBar";
import { Palette } from "./components/Palette";
import { Inspector } from "./components/Inspector";
import { BottomBar } from "./components/BottomBar";
import { useEngine } from "./hooks/useEngine";

export default function App() {
  const engine = useMemo(() => new Engine(), []);
  useEngine(engine);
  const [paletteOpen, setPaletteOpen] = useState(() => window.innerWidth >= 760);
  const [helpOpen, setHelpOpen] = useState(false);

  const hasSelection = engine.selection.size > 0 || !!engine.selEdge;

  // close the overview popover when clicking elsewhere
  useEffect(() => {
    if (!helpOpen) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest(".help-pop, .help-btn")) return;
      setHelpOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [helpOpen]);

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-[#0a0a0b] text-white">
      <CanvasStage engine={engine} />
      <TopBar
        engine={engine}
        paletteOpen={paletteOpen}
        onTogglePalette={() => setPaletteOpen((v) => !v)}
        helpOpen={helpOpen && !hasSelection}
        onToggleHelp={() => {
          if (hasSelection) engine.clearSelection();
          setHelpOpen((v) => !v);
        }}
      />
      {paletteOpen && <Palette engine={engine} />}
      <Inspector engine={engine} overviewOpen={helpOpen && !hasSelection} onCloseOverview={() => setHelpOpen(false)} />
      <BottomBar engine={engine} />
    </div>
  );
}
