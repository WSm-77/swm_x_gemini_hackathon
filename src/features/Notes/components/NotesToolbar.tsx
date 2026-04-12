import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Italic,
  Underline,
} from "lucide-react";
import { type MouseEvent, type ReactNode } from "react";

import {
  type BlockFormat,
  type MarkFormat,
  type NotesEditorApi,
  type TextAlign,
} from "../types";

type NotesToolbarProps = {
  api: Pick<
    NotesEditorApi,
    | "isMarkActive"
    | "isBlockActive"
    | "isAlignActive"
    | "toggleMark"
    | "toggleBlockType"
    | "toggleAlign"
  >;
};

type ToolbarButtonProps = {
  title: string;
  active: boolean;
  onMouseDown: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
};

const ToolbarButton = ({
  title,
  active,
  onMouseDown,
  children,
}: ToolbarButtonProps) => {
  return (
    <button
      type="button"
      onMouseDown={onMouseDown}
      className={`rounded-md p-1.5 transition-colors ${
        active
          ? "bg-[#ffd6a8]/20 text-[#ffd6a8]"
          : "text-[#acaab0] hover:bg-[#2d2d34]"
      }`}
      title={title}
    >
      {children}
    </button>
  );
};

const stopDefault = (event: MouseEvent<HTMLButtonElement>) => {
  event.preventDefault();
};

const markButtons: Array<{ title: string; format: MarkFormat; icon: ReactNode }> = [
  { title: "Bold (Cmd/Ctrl+B)", format: "bold", icon: <Bold size={14} /> },
  { title: "Italic (Cmd/Ctrl+I)", format: "italic", icon: <Italic size={14} /> },
  {
    title: "Underline (Cmd/Ctrl+U)",
    format: "underline",
    icon: <Underline size={14} />,
  },
];

const headingButtons: Array<{ title: string; format: BlockFormat; icon: ReactNode }> = [
  { title: "Heading 1", format: "heading-one", icon: <Heading1 size={14} /> },
  { title: "Heading 2", format: "heading-two", icon: <Heading2 size={14} /> },
];

const alignButtons: Array<{ title: string; align: TextAlign; icon: ReactNode }> = [
  { title: "Align left", align: "left", icon: <AlignLeft size={14} /> },
  { title: "Align center", align: "center", icon: <AlignCenter size={14} /> },
  { title: "Align right", align: "right", icon: <AlignRight size={14} /> },
];

export const NotesToolbar = ({ api }: NotesToolbarProps) => {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[#202027] p-2">
      {headingButtons.map((button) => (
        <ToolbarButton
          key={button.format}
          title={button.title}
          active={api.isBlockActive(button.format)}
          onMouseDown={(event) => {
            stopDefault(event);
            api.toggleBlockType(button.format);
          }}
        >
          {button.icon}
        </ToolbarButton>
      ))}

      <span className="mx-1 h-4 w-px bg-[#3b3b42]" />

      {markButtons.map((button) => (
        <ToolbarButton
          key={button.format}
          title={button.title}
          active={api.isMarkActive(button.format)}
          onMouseDown={(event) => {
            stopDefault(event);
            api.toggleMark(button.format);
          }}
        >
          {button.icon}
        </ToolbarButton>
      ))}

      <span className="mx-1 h-4 w-px bg-[#3b3b42]" />

      {alignButtons.map((button) => (
        <ToolbarButton
          key={button.align}
          title={button.title}
          active={api.isAlignActive(button.align)}
          onMouseDown={(event) => {
            stopDefault(event);
            api.toggleAlign(button.align);
          }}
        >
          {button.icon}
        </ToolbarButton>
      ))}
    </div>
  );
};
