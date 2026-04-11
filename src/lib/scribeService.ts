import { SCRIBE_SERVICE_URL } from "./consts";
import { type InvitableAgentId } from "@/types";

const buildScribeUrl = (path: string): string => {
  const base = SCRIBE_SERVICE_URL.endsWith("/")
    ? SCRIBE_SERVICE_URL.slice(0, -1)
    : SCRIBE_SERVICE_URL;

  return `${base}${path}`;
};

export class ScribeServiceUnavailableError extends Error {
  public constructor(message = "Local scribe service is unavailable") {
    super(message);
    this.name = "ScribeServiceUnavailableError";
  }
}

const createUnavailableError = (reason?: string): ScribeServiceUnavailableError => {
  const suffix = reason ? ` (${reason})` : "";
  return new ScribeServiceUnavailableError(`Local scribe service is unavailable${suffix}`);
};

export const joinScribeSession = async (roomId?: string): Promise<void> => {
  let response: Response;

  try {
    response = await fetch(buildScribeUrl("/sessions/join"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(roomId ? { room_id: roomId } : {}),
    });
  } catch {
    throw createUnavailableError("could not reach control API");
  }

  if (response.ok) return;

  if (response.status >= 500) {
    throw createUnavailableError(`status ${response.status}`);
  }

  let details = "";

  try {
    const payload = (await response.json()) as { error?: string };
    details = payload.error ?? "";
  } catch {
    details = "";
  }

  const suffix = details ? `: ${details}` : "";
  throw new Error(
    `Failed to start scribe session (status ${response.status})${suffix}`,
  );
};

export const inviteAgents = async (
  selectedAgentIds: InvitableAgentId[],
  roomId?: string,
): Promise<InvitableAgentId[]> => {
  const uniqueSelected = Array.from(new Set(selectedAgentIds));
  if (uniqueSelected.length === 0) return [];

  await joinScribeSession(roomId);
  return uniqueSelected;
};
