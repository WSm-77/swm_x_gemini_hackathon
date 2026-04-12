import { type PeerId, type Track } from "@fishjam-cloud/react-client";

export type CameraTile = {
  key: string;
  id: PeerId;
  name: string;
  videoTrack?: Track;
  audioTrack?: Track;
  isLocal?: boolean;
};

export type AiNoteItem = {
  id: string;
  text: string;
  timestamp: string;
};
