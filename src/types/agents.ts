export type InvitableAgentId = "scribe" | "factChecker";

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
    id: "factChecker",
    label: "Fact Checker",
    description: "Verifies factual claims in real time.",
  },
];
