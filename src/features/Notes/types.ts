import { type Descendant } from "slate";
import { type ReactEditor } from "slate-react";

export type BlockFormat = "paragraph" | "heading-one" | "heading-two";
export type TextAlign = "left" | "center" | "right";
export type MarkFormat = "bold" | "italic" | "underline";

export type NotesChannelMessage =
  | {
      type: "notes-update";
      notes: string;
      peerId: string;
      from: string;
      timestamp: number;
    }
  | {
      type: "lock-toggle";
      locked: boolean;
      peerId: string;
      displayName: string;
    };

export type NotesEditorApi = {
  editor: ReactEditor;
  isMarkActive: (format: MarkFormat) => boolean;
  isBlockActive: (format: BlockFormat) => boolean;
  isAlignActive: (align: TextAlign) => boolean;
  toggleMark: (format: MarkFormat) => void;
  toggleBlockType: (format: BlockFormat) => void;
  toggleAlign: (align: TextAlign) => void;
  notesToSlateValue: (notes: string) => Descendant[];
  normalizeSlateValue: (value: Descendant[] | undefined) => Descendant[];
  slateValueToNotes: (value: Descendant[]) => string;
};
