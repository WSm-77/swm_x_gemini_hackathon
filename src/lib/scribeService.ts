import { SCRIBE_SERVICE_URL } from "./consts";

const buildScribeUrl = (path: string): string => {
  const base = SCRIBE_SERVICE_URL.endsWith("/")
    ? SCRIBE_SERVICE_URL.slice(0, -1)
    : SCRIBE_SERVICE_URL;

  return `${base}${path}`;
};

export const joinScribeSession = async (): Promise<void> => {
  const response = await fetch(buildScribeUrl("/sessions/join"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (response.ok) return;

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
