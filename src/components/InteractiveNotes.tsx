import { usePeers } from "@fishjam-cloud/react-client";
import { Edit3, Lock, Unlock, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const InteractiveNotes = () => {
  const { localPeer, remotePeers } = usePeers<{ displayName: string }>();
  const [notes, setNotes] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const localPeerId = localPeer?.id || "";
  const localDisplayName = localPeer?.metadata?.peer?.displayName || "You";
  const canEdit = !isLocked || lockedBy === localPeerId;

  // Set up data channel for real-time sync
  useEffect(() => {
    if (!localPeer) return;

    // Create a broadcast channel for notes synchronization
    const channel = new BroadcastChannel(`notes-${localPeer.id}`);

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;

      if (data.type === "notes-update") {
        setNotes(data.notes);
        setLastUpdate(data.from);
      } else if (data.type === "lock-toggle") {
        setIsLocked(data.locked);
        setLockedBy(data.locked ? data.peerId : null);
      }
    };

    channel.addEventListener("message", handleMessage);

    return () => {
      channel.close();
    };
  }, [localPeer]);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newNotes = e.target.value;
    setNotes(newNotes);

    // Broadcast the update to other peers
    if (localPeer) {
      const channel = new BroadcastChannel(`notes-${localPeer.id}`);
      channel.postMessage({
        type: "notes-update",
        notes: newNotes,
        from: localDisplayName,
        timestamp: Date.now(),
      });
      channel.close();
    }
  };

  const toggleLock = () => {
    const newLockedState = !isLocked;
    setIsLocked(newLockedState);
    setLockedBy(newLockedState ? localPeerId : null);

    // Broadcast lock state
    if (localPeer) {
      const channel = new BroadcastChannel(`notes-${localPeer.id}`);
      channel.postMessage({
        type: "lock-toggle",
        locked: newLockedState,
        peerId: localPeerId,
        displayName: localDisplayName,
      });
      channel.close();
    }
  };

  const getLockStatus = () => {
    if (!isLocked) return "Collaborative mode";
    if (lockedBy === localPeerId) return "Locked by you";
    const lockerPeer = remotePeers.find((p) => p.id === lockedBy);
    const lockerName = lockerPeer?.metadata?.peer?.displayName || "Someone";
    return `Locked by ${lockerName}`;
  };

  return (
    <section className="rounded-3xl border border-[#48474c]/35 bg-[#19191e]/90 p-4 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#ffd6a8]">
          <Edit3 size={16} />
          <h2 className="font-headline text-base">Collaborative Notes</h2>
        </div>
        <button
          onClick={toggleLock}
          className="flex items-center gap-1.5 rounded-lg bg-[#25252b] px-2 py-1 text-xs transition-colors hover:bg-[#2d2d34]"
          title={isLocked ? "Unlock notes" : "Lock notes (take control)"}
        >
          {isLocked ? (
            <>
              <Lock size={12} className="text-yellow-400" />
              <span className="text-[#acaab0]">Unlock</span>
            </>
          ) : (
            <>
              <Unlock size={12} className="text-green-400" />
              <span className="text-[#acaab0]">Lock</span>
            </>
          )}
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-[#acaab0]">
          <span>{getLockStatus()}</span>
          {lastUpdate && (
            <span className="text-[#8b8990]">Last edit: {lastUpdate}</span>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={notes}
          onChange={handleNotesChange}
          disabled={!canEdit}
          placeholder={
            canEdit
              ? "Start typing your notes here..."
              : "Notes are locked by another user"
          }
          className="font-body h-64 w-full resize-none rounded-xl bg-[#25252b] p-3 text-sm text-[#fcf8fe] placeholder:text-[#6b6a70] focus:outline-none focus:ring-2 focus:ring-[#ffd6a8]/30 disabled:cursor-not-allowed disabled:opacity-50"
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
