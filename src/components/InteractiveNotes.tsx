import { usePeers } from "@fishjam-cloud/react-client";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Edit3,
  Heading1,
  Heading2,
  Italic,
  Lock,
  Underline,
  Unlock,
  Users,
} from "lucide-react";
import { KeyboardEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  BaseEditor,
  createEditor,
  Descendant,
  Editor,
  Element as SlateElement,
  Operation,
  Transforms,
} from "slate";
import {
  Editable,
  type RenderElementProps,
  type RenderLeafProps,
  Slate,
  withReact,
} from "slate-react";

type BlockFormat = "paragraph" | "heading-one" | "heading-two";
type TextAlign = "left" | "center" | "right";
type MarkFormat = "bold" | "italic" | "underline";

type CustomElement = {
  type: BlockFormat;
  align?: TextAlign;
  children: CustomText[];
};

type CustomText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

declare module "slate" {
  interface CustomTypes {
    Editor: BaseEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}

const notesToSlateValue = (notes: string): Descendant[] => {
  const lines = notes.split("\n");

  if (lines.length === 1 && lines[0] === "") {
    return [{ type: "paragraph", children: [{ text: "" }] }];
  }

  return lines.map((line) => ({
    type: "paragraph",
    children: [{ text: line }],
  }));
};

const EMPTY_VALUE: Descendant[] = [
  { type: "paragraph", children: [{ text: "" }] },
];

const normalizeSlateValue = (value: Descendant[] | undefined): Descendant[] => {
  if (!value || value.length === 0) return EMPTY_VALUE;
  return value;
};

const isMarkActive = (editor: Editor, format: MarkFormat) => {
  const marks = Editor.marks(editor);
  return marks ? marks[format] === true : false;
};

const toggleMark = (editor: Editor, format: MarkFormat): void => {
  const active = isMarkActive(editor, format);
  if (active) {
    Editor.removeMark(editor, format);
    return;
  }
  Editor.addMark(editor, format, true);
};

const isBlockActive = (
  editor: Editor,
  format: BlockFormat,
  blockKey: "type" | "align" = "type"
): boolean => {
  const [match] = Editor.nodes(editor, {
    match: (node) => {
      if (!SlateElement.isElement(node)) return false;
      if (blockKey === "type") return node.type === format;
      return false;
    },
  });
  return !!match;
};

const isAlignActive = (editor: Editor, align: TextAlign): boolean => {
  const [match] = Editor.nodes(editor, {
    match: (node) => SlateElement.isElement(node) && node.align === align,
  });
  return !!match;
};

const toggleBlockType = (editor: Editor, format: BlockFormat): void => {
  const isActive = isBlockActive(editor, format);
  Transforms.setNodes(
    editor,
    { type: isActive ? "paragraph" : format },
    { match: (node) => SlateElement.isElement(node) }
  );
};

const toggleAlign = (editor: Editor, align: TextAlign): void => {
  const isActive = isAlignActive(editor, align);
  Transforms.setNodes(
    editor,
    { align: isActive || align === "left" ? undefined : align },
    { match: (node) => SlateElement.isElement(node) }
  );
};

const slateValueToNotes = (value: Descendant[]): string => {
  return value
    .map((node) => {
      if (!("children" in node) || !Array.isArray(node.children)) return "";
      return node.children
        .map((child) => ("text" in child ? child.text : ""))
        .join("");
    })
    .join("\n");
};

export const InteractiveNotes = () => {
  const { localPeer, remotePeers } = usePeers<{ displayName?: string }>();
  const [notesText, setNotesText] = useState("");
  const [editorResetKey, setEditorResetKey] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const editor = useMemo(() => withReact(createEditor()), []);

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
        toggleMark(editor, "bold");
      } else if (key === "i") {
        event.preventDefault();
        toggleMark(editor, "italic");
      } else if (key === "u") {
        event.preventDefault();
        toggleMark(editor, "underline");
      }
    },
    [editor]
  );

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
    const hasDocumentChange = editor.operations.some(
      (operation: Operation) => operation.type !== "set_selection"
    );
    if (!hasDocumentChange) return;

    const newNotes = slateValueToNotes(value);
    setNotesText(newNotes);

    // Broadcast the update to other peers
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

  const getLockStatus = (): string => {
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

        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[#202027] p-2">
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              toggleBlockType(editor, "heading-one");
            }}
            className={`rounded-md p-1.5 transition-colors ${
              isBlockActive(editor, "heading-one")
                ? "bg-[#ffd6a8]/20 text-[#ffd6a8]"
                : "text-[#acaab0] hover:bg-[#2d2d34]"
            }`}
            title="Heading 1"
          >
            <Heading1 size={14} />
          </button>

          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              toggleBlockType(editor, "heading-two");
            }}
            className={`rounded-md p-1.5 transition-colors ${
              isBlockActive(editor, "heading-two")
                ? "bg-[#ffd6a8]/20 text-[#ffd6a8]"
                : "text-[#acaab0] hover:bg-[#2d2d34]"
            }`}
            title="Heading 2"
          >
            <Heading2 size={14} />
          </button>

          <span className="mx-1 h-4 w-px bg-[#3b3b42]" />

          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              toggleMark(editor, "bold");
            }}
            className={`rounded-md p-1.5 transition-colors ${
              isMarkActive(editor, "bold")
                ? "bg-[#ffd6a8]/20 text-[#ffd6a8]"
                : "text-[#acaab0] hover:bg-[#2d2d34]"
            }`}
            title="Bold (Cmd/Ctrl+B)"
          >
            <Bold size={14} />
          </button>

          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              toggleMark(editor, "italic");
            }}
            className={`rounded-md p-1.5 transition-colors ${
              isMarkActive(editor, "italic")
                ? "bg-[#ffd6a8]/20 text-[#ffd6a8]"
                : "text-[#acaab0] hover:bg-[#2d2d34]"
            }`}
            title="Italic (Cmd/Ctrl+I)"
          >
            <Italic size={14} />
          </button>

          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              toggleMark(editor, "underline");
            }}
            className={`rounded-md p-1.5 transition-colors ${
              isMarkActive(editor, "underline")
                ? "bg-[#ffd6a8]/20 text-[#ffd6a8]"
                : "text-[#acaab0] hover:bg-[#2d2d34]"
            }`}
            title="Underline (Cmd/Ctrl+U)"
          >
            <Underline size={14} />
          </button>

          <span className="mx-1 h-4 w-px bg-[#3b3b42]" />

          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              toggleAlign(editor, "left");
            }}
            className={`rounded-md p-1.5 transition-colors ${
              isAlignActive(editor, "left")
                ? "bg-[#ffd6a8]/20 text-[#ffd6a8]"
                : "text-[#acaab0] hover:bg-[#2d2d34]"
            }`}
            title="Align left"
          >
            <AlignLeft size={14} />
          </button>

          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              toggleAlign(editor, "center");
            }}
            className={`rounded-md p-1.5 transition-colors ${
              isAlignActive(editor, "center")
                ? "bg-[#ffd6a8]/20 text-[#ffd6a8]"
                : "text-[#acaab0] hover:bg-[#2d2d34]"
            }`}
            title="Align center"
          >
            <AlignCenter size={14} />
          </button>

          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              toggleAlign(editor, "right");
            }}
            className={`rounded-md p-1.5 transition-colors ${
              isAlignActive(editor, "right")
                ? "bg-[#ffd6a8]/20 text-[#ffd6a8]"
                : "text-[#acaab0] hover:bg-[#2d2d34]"
            }`}
            title="Align right"
          >
            <AlignRight size={14} />
          </button>
        </div>

        <div
          className={`h-64 w-full rounded-xl bg-[#25252b] p-3 text-sm text-[#fcf8fe] focus-within:ring-2 focus-within:ring-[#ffd6a8]/30 ${
            canEdit ? "" : "cursor-not-allowed opacity-50"
          }`}
        >
          <Slate
            editor={editor}
            initialValue={normalizeSlateValue(notesToSlateValue(notesText))}
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
