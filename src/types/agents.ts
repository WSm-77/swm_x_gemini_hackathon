export type InvitableAgentId = "scribe" | "actionItems" | "summary";

export type InvitableAgent = {
  id: InvitableAgentId;
  label: string;
  description: string;
};

export const INVITABLE_AGENTS: InvitableAgent[] = [
  {
    id: "scribe",
    label: "Scribe",
    description: "Live notes and highlights during the call.",
  },
  {
    id: "actionItems",
    label: "Action Items",
    description: "Tracks owners and follow-ups from discussion points.",
  },
  {
    id: "summary",
    label: "Summary",
    description: "Builds concise meeting summaries in real time.",
  },
];
