export type ModelId =
  | "reverb-apex"
  | "reverb-core"
  | "reverb-pulse"
  | "reverb-tuned";

export interface Model {
  id: ModelId;
  name: string;
  label: string;
  description: string;
  badge?: string;
  speed: "Fast" | "Balanced" | "Powerful";
  color: string;
  glow: string;
}

export const MODELS: Model[] = [
  {
    id: "reverb-apex",
    name: "Apex",
    label: "Apex",
    description: "Flagship intelligence. Designed for executive-level strategy, complex multi-channel briefs, and deep competitive analysis.",
    badge: "Flagship",
    speed: "Powerful",
    color: "text-violet-700",
    glow: "from-violet-500/20 to-fuchsia-500/20",
  },
  {
    id: "reverb-core",
    name: "Core",
    label: "Core",
    description: "The balanced workhorse. Calibrated for daily campaign generation, trend analysis, and content strategy.",
    badge: "Recommended",
    speed: "Balanced",
    color: "text-[#c14a2a]",
    glow: "from-[#d8593a]/25 to-[#b03e21]/25",
  },
  {
    id: "reverb-pulse",
    name: "Pulse",
    label: "Pulse",
    description: "Sub-second responses for quick ad copy, subject lines, and high-volume content iteration.",
    speed: "Fast",
    color: "text-emerald-700",
    glow: "from-emerald-500/20 to-teal-500/20",
  },
  {
    id: "reverb-tuned",
    name: "Tuned",
    label: "Tuned",
    description: "Your fine-tuned model — trained on your brand voice and approved campaign data. Available after running the Kaggle pipeline.",
    badge: "Custom",
    speed: "Fast",
    color: "text-amber-700",
    glow: "from-amber-500/25 to-orange-500/25",
  },
];

export const DEFAULT_MODEL: ModelId = "reverb-core";

export function getModel(id: ModelId): Model {
  return MODELS.find((m) => m.id === id) ?? MODELS[1];
}
