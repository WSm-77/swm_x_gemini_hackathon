import { useDataChannel, usePeers } from "@fishjam-cloud/react-client";
import { Edit3, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { getPersistedFormValues } from "@/lib/utils";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

type NotesSyncMessage = {
  type: "notes-sync";
  roomId: string;
  notes: string;
  fromPeerId: string;
  fromDisplayName: string;
  revision: number;
};

type NotesSyncRequestMessage = {
  type: "notes-sync-request";
  roomId: string;
  fromPeerId: string;
};

type NotesMessage = NotesSyncMessage | NotesSyncRequestMessage;

const parseMessage = (payload: Uint8Array): NotesMessage | null => {
  try {
    const parsed = JSON.parse(decoder.decode(payload)) as NotesMessage;
    if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const InteractiveNotes = () => {
  const { localPeer, remotePeers } = usePeers<{ displayName: string }>();
  const {
    initializeDataChannel,
    publishData,
    subscribeData,
    dataChannelReady,
  } = useDataChannel();
  const [notes, setNotes] = useState("");
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [syncStatus, setSyncStatus] = useState<"local" | "syncing" | "live">(
    "local",
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const revisionRef = useRef<number>(0);
  const debounceTimerRef = useRef<number | null>(null);

  const localPeerId = localPeer?.id || "";
  const localDisplayName = localPeer?.metadata?.peer?.displayName || "You";
  const roomId = useMemo(
    () => getPersistedFormValues().roomName || "global-room",
    [],
  );

  // Initialize Fishjam data channels once we are in a room.
  useEffect(() => {
    if (!localPeer) {
      setSyncStatus("local");
      return;
    }
    void initializeDataChannel();
  }, [initializeDataChannel, localPeer]);

  useEffect(() => {
    if (dataChannelReady) {
      setSyncStatus("live");
    }
  }, [dataChannelReady]);

  const publishNotes = (nextNotes: string) => {
    if (!localPeerId || !dataChannelReady) return;

    const revision = Date.now();
    revisionRef.current = revision;

    const message: NotesSyncMessage = {
      type: "notes-sync",
      roomId,
      notes: nextNotes,
      fromPeerId: localPeerId,
      fromDisplayName: localDisplayName,
      revision,
    };

    publishData(encoder.encode(JSON.stringify(message)), { reliable: true });
    setSyncStatus("live");
  };

  useEffect(() => {
    if (!localPeerId) return;

    const unsubscribe = subscribeData(
      (payload) => {
        const message = parseMessage(payload);
        if (!message || message.roomId !== roomId) return;

        if (message.type === "notes-sync") {
          if (message.fromPeerId === localPeerId) return;
          if (message.revision <= revisionRef.current) return;

          revisionRef.current = message.revision;
          setNotes(message.notes);
          setLastUpdate(message.fromDisplayName);
          setSyncStatus("live");
          return;
        }

        if (message.type === "notes-sync-request") {
          if (message.fromPeerId === localPeerId) return;
          if (!notes.trim()) return;
          publishNotes(notes);
        }
      },
      { reliable: true },
    );

    return unsubscribe;
  }, [dataChannelReady, localPeerId, notes, publishData, roomId, subscribeData]);

  // Ask existing participants for latest snapshot after connecting.
  useEffect(() => {
    if (!dataChannelReady || !localPeerId) return;

    const message: NotesSyncRequestMessage = {
      type: "notes-sync-request",
      roomId,
      fromPeerId: localPeerId,
    };

    publishData(encoder.encode(JSON.stringify(message)), { reliable: true });
  }, [dataChannelReady, localPeerId, publishData, roomId]);

    const newNotes = slateValueToNotes(value);
    setNotesText(newNotes);

    if (!dataChannelReady) return;

    setSyncStatus("syncing");
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      publishNotes(newNotes);
    }, 120);
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const getSyncStatusText = () => {
    if (!localPeer) return "Local mode";
    if (syncStatus === "syncing") return "Syncing...";
    if (syncStatus === "live") return "Live collaboration";
    return "Connected (waiting for data channel)";
  };

  return (
    <section className="rounded-3xl border border-[#48474c]/35 bg-[#19191e]/90 p-4 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#ffd6a8]">
          <Edit3 size={16} />
          <h2 className="font-headline text-base">Collaborative Notes</h2>
        </div>
        <span className="rounded-lg bg-[#25252b] px-2 py-1 text-xs text-[#acaab0]">
          {getSyncStatusText()}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-[#acaab0]">
          <span>Everyone can edit at the same time</span>
          {lastUpdate && (
            <span className="text-[#8b8990]">Last edit: {lastUpdate}</span>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={notes}
          onChange={handleNotesChange}
          placeholder="Start typing your notes here..."
          className="font-body h-64 w-full resize-none rounded-xl bg-[#25252b] p-3 text-sm text-[#fcf8fe] placeholder:text-[#6b6a70] focus:outline-none focus:ring-2 focus:ring-[#ffd6a8]/30"
        />

        <div className="flex items-center gap-2 text-xs text-[#8b8990]">
          <Users size={12} />
          <span>
            {remotePeers.length + 1} participant
            {remotePeers.length !== 0 ? "s" : ""} in room
          </span>
        </div>
      </div>
    </section>
  );
};
