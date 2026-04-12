import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { ScribeAgentType } from "../config";

const readPromptMarkdown = (relativePath: string): string => {
  const absolutePath = fileURLToPath(new URL(relativePath, import.meta.url));
  return readFileSync(absolutePath, "utf8").trim();
};

export const SCRIBE_SYSTEM_INSTRUCTION = readPromptMarkdown(
  "./prompts/scribe-system.md",
);

export const FACTCHECK_SYSTEM_INSTRUCTION = readPromptMarkdown(
  "./prompts/factcheck-system.md",
);

const SYSTEM_INSTRUCTIONS_BY_AGENT_TYPE: Record<ScribeAgentType, string> = {
  scribe: SCRIBE_SYSTEM_INSTRUCTION,
  factChecker: FACTCHECK_SYSTEM_INSTRUCTION,
};

export const getSystemInstructionForAgentType = (
  agentType: ScribeAgentType,
): string => SYSTEM_INSTRUCTIONS_BY_AGENT_TYPE[agentType];
