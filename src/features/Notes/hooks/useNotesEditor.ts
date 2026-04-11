import { useMemo } from "react";
import {
  BaseEditor,
  createEditor,
  type Descendant,
  Editor,
  Element as SlateElement,
  Transforms,
} from "slate";
import { withReact } from "slate-react";

import {
  type BlockFormat,
  type MarkFormat,
  type NotesEditorApi,
  type TextAlign,
} from "../types";

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

const EMPTY_VALUE: Descendant[] = [
  { type: "paragraph", children: [{ text: "" }] },
];

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

const normalizeSlateValue = (value: Descendant[] | undefined): Descendant[] => {
  if (!value || value.length === 0) return EMPTY_VALUE;
  return value;
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

export const useNotesEditor = (): NotesEditorApi => {
  const editor = useMemo(() => withReact(createEditor()), []);

  const isMarkActive = (format: MarkFormat): boolean => {
    const marks = Editor.marks(editor);
    return marks ? marks[format] === true : false;
  };

  const toggleMark = (format: MarkFormat): void => {
    const active = isMarkActive(format);
    if (active) {
      Editor.removeMark(editor, format);
      return;
    }
    Editor.addMark(editor, format, true);
  };

  const isBlockActive = (format: BlockFormat): boolean => {
    const [match] = Editor.nodes(editor, {
      match: (node) => SlateElement.isElement(node) && node.type === format,
    });

    return !!match;
  };

  const toggleBlockType = (format: BlockFormat): void => {
    const isActive = isBlockActive(format);
    Transforms.setNodes(
      editor,
      { type: isActive ? "paragraph" : format },
      { match: (node) => SlateElement.isElement(node) },
    );
  };

  const isAlignActive = (align: TextAlign): boolean => {
    const [match] = Editor.nodes(editor, {
      match: (node) => SlateElement.isElement(node) && node.align === align,
    });

    return !!match;
  };

  const toggleAlign = (align: TextAlign): void => {
    const isActive = isAlignActive(align);
    Transforms.setNodes(
      editor,
      { align: isActive || align === "left" ? undefined : align },
      { match: (node) => SlateElement.isElement(node) },
    );
  };

  return {
    editor,
    isMarkActive,
    isBlockActive,
    isAlignActive,
    toggleMark,
    toggleBlockType,
    toggleAlign,
    notesToSlateValue,
    normalizeSlateValue,
    slateValueToNotes,
  };
};
