import { useSyncExternalStore } from "react";
import type { Engine } from "../lib/engine";

/** Re-render whenever the engine reports a state change. */
export function useEngine(engine: Engine) {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot);
}
