export type NodeType =
  | "capture"
  | "process"
  | "automate"
  | "monitor"
  | "collaborate"
  | "generate";

export interface NodeDef {
  type: NodeType;
  name: string;
  blurb: string;
  title: string;
  description: string;
  w: number;
  hasInput: boolean;
  hasOutput: boolean;
}

/** Card height (world units) */
export const NODE_H = 322;
/** Height of the illustration area on each card */
export const ILLU_H = 220;
/** Y of the input/output ports (aligned with the illustration "wires") */
export const PORT_Y = 104;

export const NODE_DEFS: Record<NodeType, NodeDef> = {
  capture: {
    type: "capture",
    name: "Capture",
    blurb: "Trigger · files & sources",
    title: "Capture Inputs",
    description: "Users add data, upload files, or integrate sources instantly",
    w: 280,
    hasInput: false,
    hasOutput: true,
  },
  process: {
    type: "process",
    name: "Process",
    blurb: "Clean & structure data",
    title: "Process Data",
    description: "Your system organizes, cleans and structures everything automatically",
    w: 280,
    hasInput: true,
    hasOutput: true,
  },
  automate: {
    type: "automate",
    name: "Automate",
    blurb: "Rules, actions & triggers",
    title: "Automate Tasks",
    description: "Smart rules trigger actions, notifications, and workflows",
    w: 280,
    hasInput: true,
    hasOutput: true,
  },
  monitor: {
    type: "monitor",
    name: "Monitor",
    blurb: "Live metrics & activity",
    title: "Monitor Activity",
    description: "Real-time tracking of updates, tasks, and performance",
    w: 280,
    hasInput: true,
    hasOutput: true,
  },
  collaborate: {
    type: "collaborate",
    name: "Collaborate",
    blurb: "Review with your team",
    title: "Collaborate in Real Time",
    description: "Teams work together with synced updates and shared views",
    w: 440,
    hasInput: true,
    hasOutput: true,
  },
  generate: {
    type: "generate",
    name: "Generate",
    blurb: "AI reports & insights",
    title: "Generate Insights",
    description: "AI produces reports, summaries and recommendations",
    w: 280,
    hasInput: true,
    hasOutput: true,
  },
};

export const NODE_ORDER: NodeType[] = [
  "capture",
  "process",
  "automate",
  "monitor",
  "collaborate",
  "generate",
];

export interface WFNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  title: string;
  description: string;
  bypass: boolean;
}

export interface WFEdge {
  id: string;
  from: string;
  to: string;
}

export interface WorkflowData {
  nodes: WFNode[];
  edges: WFEdge[];
}

export const ACCENTS: { name: string; hex: string }[] = [
  { name: "Mint", hex: "#5bf5b8" },
  { name: "Amber", hex: "#ffd84d" },
  { name: "Cyan", hex: "#52cfff" },
  { name: "Violet", hex: "#a98bff" },
  { name: "Coral", hex: "#ff7a66" },
];
