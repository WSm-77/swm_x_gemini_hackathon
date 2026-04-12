import { usePeers } from "@fishjam-cloud/react-client";
import { Users } from "lucide-react";
import { type KeyboardEvent, useCallback, useEffect, useMemo, useState } from "react";
import { type Descendant, type Operation } from "slate";
import {
  Editable,
  type RenderElementProps,
  type RenderLeafProps,
  Slate,
} from "slate-react";

import { NotesHeader } from "./components/NotesHeader";
import { NotesToolbar } from "./components/NotesToolbar";
import { useNotesEditor } from "./hooks/useNotesEditor";

export const InteractiveNotes = () => {
  const { localPeer, remotePeers } = usePeers<{ displayName?: string }>();
  const [notesText, setNotesText] = useState("");
  const [editorResetKey, setEditorResetKey] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState("");

  const api = useNotesEditor();

  const localPeerId = localPeer?.id || "";
  const localDisplayName = localPeer?.metadata?.peer?.displayName || "You";
  const canEdit = !isLocked || lockedBy === localPeerId;

  const renderElement = useCallback(({ attributes, children, element }: RenderElementProps) => {
    const style = { textAlign: element.align || "left" } as const;

    switch (element.type) {
      case "heading-one":
        return (
          <h1
            {...attributes}
            style={style}
            className="font-headline text-2xl font-semibold tracking-tight"
          >
            {children}
          </h1>
        );
      case "heading-two":
        return (
          <h2
            {...attributes}
            style={style}
            className="font-headline text-xl font-semibold tracking-tight"
          >
            {children}
          </h2>
        );
      default:
        return (
          <p {...attributes} style={style} className="font-body leading-relaxed">
            {children}
          </p>
        );
    }
  }, []);

  const renderLeaf = useCallback(({ attributes, children, leaf }: RenderLeafProps) => {
    let renderedChildren = children;
    if (leaf.bold) renderedChildren = <strong>{renderedChildren}</strong>;
    if (leaf.italic) renderedChildren = <em>{renderedChildren}</em>;
    if (leaf.underline) renderedChildren = <u>{renderedChildren}</u>;

    return <span {...attributes}>{renderedChildren}</span>;
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!event.metaKey && !event.ctrlKey) return;

      const key = event.key.toLowerCase();
      if (key === "b") {
        event.preventDefault();
        api.toggleMark("bold");
      } else if (key === "i") {
        event.preventDefault();
        api.toggleMark("italic");
      } else if (key === "u") {
        event.preventDefault();
        api.toggleMark("underline");
      }
    },
    [api],
  );

  useEffect(() => {
    if (!localPeer) return;

    const channel = new BroadcastChannel(`notes-${localPeer.id}`);

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;

      if (data.type === "notes-update") {
        if (data.peerId === localPeerId) return;
        setNotesText(typeof data.notes === "string" ? data.notes : "");
        setEditorResetKey((current) => current + 1);
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
  }, [localPeer, localPeerId]);

  const handleNotesChange = (value: Descendant[]): void => {
    const hasDocumentChange = api.editor.operations.some(
      (operation: Operation) => operation.type !== "set_selection",
    );
    if (!hasDocumentChange) return;

    const newNotes = api.slateValueToNotes(value);
    setNotesText(newNotes);

    if (localPeer) {
      const channel = new BroadcastChannel(`notes-${localPeer.id}`);
      channel.postMessage({
        type: "notes-update",
        notes: newNotes,
        peerId: localPeerId,
        from: localDisplayName,
        timestamp: Date.now(),
      });
      channel.close();
    }
  };

  const toggleLock = (): void => {
    const newLockedState = !isLocked;
    setIsLocked(newLockedState);
    setLockedBy(newLockedState ? localPeerId : null);

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

  const lockStatus = useMemo(() => {
    if (!isLocked) return "Collaborative mode";
    if (lockedBy === localPeerId) return "Locked by you";
    const lockerPeer = remotePeers.find((p) => p.id === lockedBy);
    const lockerName = lockerPeer?.metadata?.peer?.displayName || "Someone";
    return `Locked by ${lockerName}`;
  }, [isLocked, lockedBy, localPeerId, remotePeers]);

  return (
    <section className="rounded-3xl border border-[#48474c]/35 bg-[#19191e]/90 p-4 backdrop-blur-xl">
      <NotesHeader isLocked={isLocked} onToggleLock={toggleLock} />

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-[#acaab0]">
          <span>{lockStatus}</span>
          {lastUpdate && <span className="text-[#8b8990]">Last edit: {lastUpdate}</span>}
        </div>

        <NotesToolbar api={api} />

        <div
          className={`h-64 w-full rounded-xl bg-[#25252b] p-3 text-sm text-[#fcf8fe] focus-within:ring-2 focus-within:ring-[#ffd6a8]/30 ${
            canEdit ? "" : "cursor-not-allowed opacity-50"
          }`}
        >
          <Slate
            editor={api.editor}
            initialValue={api.normalizeSlateValue(api.notesToSlateValue(notesText))}
            key={`${localPeerId || "local"}-${editorResetKey}`}
            onChange={handleNotesChange}
          >
            <Editable
              readOnly={!canEdit}
              placeholder={
                canEdit
                  ? "Start typing your notes here..."
                  : "Notes are locked by another user"
              }
              renderElement={renderElement}
              renderLeaf={renderLeaf}
              onKeyDown={handleKeyDown}
              className="font-body h-full overflow-y-auto whitespace-pre-wrap break-words focus:outline-none"
            />
          </Slate>
        </div>

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
