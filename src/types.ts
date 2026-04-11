import { type RoomType } from "@fishjam-cloud/react-client";

export type RoomForm = {
  roomName: string;
  peerName: string;
  roomType: RoomType;
  fishjamId: string;
};

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
