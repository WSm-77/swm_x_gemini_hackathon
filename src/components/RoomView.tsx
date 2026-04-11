import { type PeerId, type Track, usePeers } from "@fishjam-cloud/react-client";
import { ChevronLeft, ChevronRight, MessageSquareText, Sparkles, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { SCRIBE_SERVICE_URL } from "@/lib/consts";
import { ScribeServiceUnavailableError, inviteAgents } from "@/lib/scribeService";
import { useRoom } from "@/context/RoomContext";
import { INVITABLE_AGENTS, type InvitableAgentId } from "@/types";
import { CallToolbar } from "./CallToolbar";
import { InteractiveNotes } from "./InteractiveNotes";
import { Tile } from "./Tile";

const CAMERAS_PER_PAGE = 4;

type ScribeNotePayload = {
  type?: "ai_note_text";
  roomId?: string;
  text?: string;
  timestamp?: string;
};

type AiNoteItem = {
  id: string;
  text: string;
  timestamp: string;
};

const MAX_AI_NOTES = 8;

const buildNotesWsUrl = (): string => {
  const explicitUrl = import.meta.env.VITE_SCRIBE_NOTES_WS_URL;
  if (typeof explicitUrl === "string" && explicitUrl.trim().length > 0) {
    return explicitUrl.trim();
  }

  try {
    const serviceUrl = new URL(SCRIBE_SERVICE_URL);
    serviceUrl.protocol = serviceUrl.protocol === "https:" ? "wss:" : "ws:";
    serviceUrl.pathname = "/ws/notes";
    serviceUrl.search = "";
    serviceUrl.hash = "";
    return serviceUrl.toString();
  } catch {
    return "ws://localhost:8787/ws/notes";
  }
};

const NOTES_WS_URL = buildNotesWsUrl();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseScribeNotePayload = (value: unknown): ScribeNotePayload | null => {
  if (!isRecord(value)) return null;

  const type = value.type;
  const text = value.text;
  const roomId = value.roomId;
  const timestamp = value.timestamp;

  if (type !== "ai_note_text") return null;
  if (typeof text !== "string" || text.trim().length === 0) return null;

  return {
    type,
    text,
    roomId: typeof roomId === "string" ? roomId : undefined,
    timestamp: typeof timestamp === "string" ? timestamp : undefined,
  };
};

const toTimeLabel = (isoDate: string): string => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "just now";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const RoomView = () => {
  const { localPeer, remotePeers } = usePeers<{ displayName: string }>();
  const { roomId } = useRoom();
  const [aiNotes, setAiNotes] = useState<AiNoteItem[]>([]);
  const [aiNotesStatus, setAiNotesStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");

  useEffect(() => {
    let isDisposed = false;
    let isIntentionalClose = false;
    let socket: WebSocket | undefined;
    let reconnectTimer: number | undefined;
    let reconnectAttempt = 0;

    const connect = () => {
      if (isDisposed) return;

      isIntentionalClose = false;
      console.info(
        `[AI notes] Opening websocket connection to ${NOTES_WS_URL} (attempt ${reconnectAttempt + 1})`,
      );

      setAiNotesStatus("connecting");
      socket = new WebSocket(NOTES_WS_URL);

      socket.onopen = () => {
        reconnectAttempt = 0;
        setAiNotesStatus("connected");
        console.info("[AI notes] Websocket connected");
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data as string) as unknown;
          const payload = parseScribeNotePayload(parsed);

          if (!payload) return;
          if (roomId && payload.roomId && payload.roomId !== roomId) return;

          const text = payload.text?.trim();
          if (!text) return;

          const timestamp = payload.timestamp ?? new Date().toISOString();
          const nextItem: AiNoteItem = {
            id: crypto.randomUUID(),
            text,
            timestamp,
          };

          setAiNotes((current) => [nextItem, ...current].slice(0, MAX_AI_NOTES));
        } catch {
          // Ignore malformed websocket payloads.
        }
      };

      socket.onerror = () => {
        if (isDisposed || isIntentionalClose) return;
        setAiNotesStatus("disconnected");
        console.warn(`[AI notes] Websocket error for ${NOTES_WS_URL}`);
      };

      socket.onclose = (event) => {
        if (isDisposed || isIntentionalClose) return;

        setAiNotesStatus("disconnected");
        console.warn(
          `[AI notes] Websocket closed (${event.code}) ${event.reason || ""}`,
        );

        const reconnectDelayMs = reconnectAttempt === 0 ? 2_000 : 10_000;
        reconnectAttempt += 1;

        console.info(
          `[AI notes] Reconnecting in ${reconnectDelayMs / 1000}s (retry ${reconnectAttempt})`,
        );

        reconnectTimer = window.setTimeout(connect, reconnectDelayMs);
      };
    };

    connect();

    return () => {
      isDisposed = true;

      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer);
      }

      if (socket) {
        isIntentionalClose = true;
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;

        if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
          socket.close(1000, "Room view unmounted");
        }
      }
    };
  }, [roomId]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isAsideOpen, setIsAsideOpen] = useState(true);

  // Detect if anyone is streaming
  const remoteStreamingPeer = useMemo(() => {
    return remotePeers.find((peer) => peer.screenShareVideoTrack);
  }, [remotePeers]);

  const isLocalStreaming = localPeer?.screenShareVideoTrack;
  const isAnyoneStreaming = isLocalStreaming || remoteStreamingPeer;

  // Build camera tiles for different layout modes
  const allCameraTiles = useMemo(() => {
    const tiles = [] as Array<{
      key: string;
      id: PeerId;
      name: string;
      videoTrack?: Track;
      audioTrack?: Track;
      isLocal?: boolean;
    }>;

    if (localPeer) {
      tiles.push({
        key: `local-${localPeer.id}`,
        id: localPeer.id,
        name: "You",
        videoTrack: localPeer.cameraTrack,
        audioTrack: localPeer.microphoneTrack,
        isLocal: true,
      });
    }

    remotePeers.forEach((peer) => {
      const label = peer.metadata?.peer?.displayName ?? peer.id;
      tiles.push({
        key: `remote-${peer.id}`,
        id: peer.id,
        name: label,
        videoTrack: peer.cameraTrack,
        audioTrack: peer.microphoneTrack,
      });
    });

    return tiles;
  }, [localPeer, remotePeers]);

  // Determine spotlight tile and top bar tiles based on streaming status
  let spotlightTile = null;
  let pipTile = null;
  let topBarTiles = [] as typeof allCameraTiles;
  let gridTiles = [] as typeof allCameraTiles;

  if (isLocalStreaming) {
    // Local user is streaming: screen as main, camera as PiP, remote cameras in top bar
    spotlightTile = {
      key: `local-screen-${localPeer!.id}`,
      id: localPeer!.id,
      name: "Your screen share",
      videoTrack: localPeer!.screenShareVideoTrack,
      audioTrack: localPeer!.screenShareAudioTrack,
      isLocal: true,
    };

    pipTile = {
      key: `local-${localPeer!.id}`,
      id: localPeer!.id,
      name: "You",
      videoTrack: localPeer!.cameraTrack,
      audioTrack: localPeer!.microphoneTrack,
      isLocal: true,
    };

    // Top bar shows only remote cameras with pagination
    topBarTiles = remotePeers.map((peer) => {
      const label = peer.metadata?.peer?.displayName ?? peer.id;
      return {
        key: `remote-${peer.id}`,
        id: peer.id,
        name: label,
        videoTrack: peer.cameraTrack,
        audioTrack: peer.microphoneTrack,
      };
    });
  } else if (remoteStreamingPeer) {
    // Remote user is streaming: their screen as main, local + other cameras in top bar
    spotlightTile = {
      key: `remote-screen-${remoteStreamingPeer.id}`,
      id: remoteStreamingPeer.id,
      name: `Screen share: ${remoteStreamingPeer.metadata?.peer?.displayName ?? remoteStreamingPeer.id}`,
      videoTrack: remoteStreamingPeer.screenShareVideoTrack,
      audioTrack: remoteStreamingPeer.screenShareAudioTrack,
    };

    // Top bar shows local camera + other remote cameras (excluding the streaming peer)
    topBarTiles = allCameraTiles.filter(
      (tile) => tile.id !== remoteStreamingPeer.id
    );
  } else {
    // No one streaming: 2x2 grid layout with all cameras
    gridTiles = allCameraTiles;
  }

  // Calculate pagination for top bar
  const topBarPages = Math.ceil(topBarTiles.length / CAMERAS_PER_PAGE);
  const topBarPageCount = topBarTiles.length > 0 ? topBarPages : 0;
  const topBarStart = currentPage * CAMERAS_PER_PAGE;
  const topBarEnd = Math.min(topBarStart + CAMERAS_PER_PAGE, topBarTiles.length);
  const currentTopBarTiles = topBarTiles.slice(topBarStart, topBarEnd);

  // Calculate pagination for grid layout (2x2 = 4 cameras per page)
  const gridPages = Math.ceil(gridTiles.length / 4);
  const gridPageCount = gridTiles.length > 0 ? gridPages : 0;
  const gridStart = currentPage * 4;
  const gridEnd = Math.min(gridStart + 4, gridTiles.length);
  const currentGridTiles = gridTiles.slice(gridStart, gridEnd);

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (isAnyoneStreaming && currentPage < topBarPageCount - 1) {
      setCurrentPage(currentPage + 1);
    } else if (!isAnyoneStreaming && currentPage < gridPageCount - 1) {
      setCurrentPage(currentPage + 1);
    }
  };


  const participantCount = (localPeer ? 1 : 0) + remotePeers.length;

  const onInviteAgents = async (agentIds: InvitableAgentId[]) => {
    try {
      const invited = await inviteAgents(agentIds, roomId || undefined);
      const invitedLabel = invited
        .map((id) => INVITABLE_AGENTS.find((agent) => agent.id === id)?.label ?? id)
        .join(", ");

      toast.success(
        invited.length === 1 ? "Agent invited" : `Invited ${invited.length} agents`,
        {
          position: "top-center",
          description: invitedLabel,
        },
      );
    } catch (error) {
      if (error instanceof ScribeServiceUnavailableError) {
        toast.error("Could not invite agents", {
          position: "top-center",
          description: "Local scribe service is unavailable. Run pnpm scribe:dev and try again.",
        });
        return;
      }

      toast.error("Failed to invite agents", {
        position: "top-center",
        description:
          error instanceof Error
            ? error.message
            : "Unexpected error while inviting agents",
      });
    }
  };

  return (
    <div className="relative flex h-full w-full flex-col bg-[#0e0e12] text-[#fcf8fe]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-16 h-72 w-72 rounded-full bg-[#7000ff]/25 blur-3xl" />
        <div className="absolute right-8 top-10 h-80 w-80 rounded-full bg-[#00eefc]/10 blur-3xl" />
      </div>

      <header className="relative grid gap-3 border-b border-[#48474c]/35 bg-[#131317]/80 px-4 py-3 backdrop-blur-xl md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center lg:px-6">
        <div className="min-w-0">
          <p className="font-body text-xs uppercase tracking-[0.24em] text-[#acaab0]">
            Neon Nocturne
          </p>
          <h1 className="font-headline truncate text-2xl leading-none">Project Sync</h1>
        </div>

        <div className="flex min-w-0 items-center justify-center">
          <div className="flex max-w-full items-center gap-2 rounded-full border border-[#48474c]/40 bg-[#25252b]/85 px-4 py-2 text-xs text-[#a8a4ff] md:text-sm">
            <span className="font-body uppercase tracking-[0.18em] text-[#acaab0]">
              Fishjam room
            </span>
            <span className="text-[#48474c]">|</span>
            <span className="max-w-[42vw] truncate font-mono text-[#fcf8fe]">
              {roomId ?? "Room id unavailable"}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <div className="flex items-center gap-2 rounded-full bg-[#25252b]/80 px-4 py-2 text-sm text-[#a8a4ff]">
            <span className="h-2 w-2 rounded-full bg-[#a8a4ff]" />
            LIVE
            <span className="mx-1 text-[#48474c]">|</span>
            <Users size={16} />
            {participantCount} Participants active
          </div>
        </div>
      </header>

      <section
        className={`relative grid flex-1 gap-4 overflow-y-auto px-4 pb-28 pt-4 lg:px-6 ${
          isAsideOpen ? "lg:grid-cols-[minmax(0,1fr)_360px]" : "lg:grid-cols-[minmax(0,1fr)]"
        }`}
      >
        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-4">
          {/* MAIN SPOTLIGHT AREA */}
          {spotlightTile ? (
            <div className="relative min-h-[300px] rounded-[20px] border-[#48474c]/40 bg-[#131317]/90 lg:min-h-[420px]">
              <Tile
                id={spotlightTile.id}
                name={spotlightTile.name}
                videoTrack={spotlightTile.videoTrack}
                audioTrack={spotlightTile.audioTrack}
                isLocal={spotlightTile.isLocal}
                className="h-full w-full"
              />
              {/* PiP for local camera when streaming own screen */}
              {pipTile && pipTile.videoTrack && (
                <div className="absolute bottom-4 right-4 z-50 w-40 h-28 rounded-xl border-2 border-[#a8a4ff] bg-[#19191e] shadow-lg overflow-hidden">
                  <Tile
                    id={pipTile.id}
                    name={pipTile.name}
                    videoTrack={pipTile.videoTrack}
                    audioTrack={pipTile.audioTrack}
                    isLocal={pipTile.isLocal}
                    className="h-full w-full"
                  />
                </div>
              )}
            </div>
          ) : isAnyoneStreaming ? null : (
            // No streaming: Show 2x2 grid or empty state
            currentGridTiles.length > 0 ? (
              <div className="grid gap-4 grid-cols-2 grid-rows-2 min-h-[300px]">
                {currentGridTiles.map((tile) => (
                  <div
                    key={tile.key}
                    className="rounded-[20px] border border-[#48474c]/40 bg-[#131317]/90 overflow-hidden"
                  >
                    <Tile
                      id={tile.id}
                      name={tile.name}
                      videoTrack={tile.videoTrack}
                      audioTrack={tile.audioTrack}
                      isLocal={tile.isLocal}
                      className="h-full w-full"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid min-h-[300px] place-items-center rounded-[20px] border border-[#48474c]/40 bg-[#131317]/90 lg:min-h-[420px]">
                <p className="font-body text-sm text-[#acaab0]">
                  Waiting for participants to join...
                </p>
              </div>
            )
          )}

          {/* TOP BAR: When streaming (shows 4 cameras with pagination) */}
          {isAnyoneStreaming && currentTopBarTiles.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 0}
                className="flex-shrink-0 p-2 rounded-lg bg-[#25252b]/80 text-[#a8a4ff] hover:bg-[#25252b] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="flex gap-3 flex-1 overflow-hidden">
                {currentTopBarTiles.map((tile) => (
                  <div
                    key={tile.key}
                    className="h-[130px] min-w-[200px] flex-shrink-0 rounded-2xl border border-[#48474c]/40 bg-[#19191e] overflow-hidden"
                  >
                    <Tile
                      id={tile.id}
                      name={tile.name}
                      videoTrack={tile.videoTrack}
                      audioTrack={tile.audioTrack}
                      isLocal={tile.isLocal}
                      className="h-full w-full"
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={handleNextPage}
                disabled={currentPage >= topBarPageCount - 1}
                className="flex-shrink-0 p-2 rounded-lg bg-[#25252b]/80 text-[#a8a4ff] hover:bg-[#25252b] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}

          {/* BOTTOM: Grid pagination controls when no streaming */}
          {!isAnyoneStreaming && gridPageCount > 1 && (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 0}
                className="p-2 rounded-lg bg-[#25252b]/80 text-[#a8a4ff] hover:bg-[#25252b] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="flex gap-2">
                {Array.from({ length: gridPageCount }).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentPage(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentPage
                        ? "bg-[#a8a4ff] w-8"
                        : "bg-[#48474c]/50 hover:bg-[#48474c]"
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={handleNextPage}
                disabled={currentPage >= gridPageCount - 1}
                className="p-2 rounded-lg bg-[#25252b]/80 text-[#a8a4ff] hover:bg-[#25252b] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>

        {isAsideOpen && (
          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <InteractiveNotes />

          <section className="rounded-3xl border border-[#48474c]/35 bg-[#19191e]/90 p-4 backdrop-blur-xl">
            <div className="mb-3 flex items-center gap-2 text-[#a8a4ff]">
              <MessageSquareText size={16} />
              <h2 className="font-headline text-base">Team Chat</h2>
            </div>

            <div className="space-y-3 text-sm">
              <article className="rounded-xl bg-[#25252b] p-3">
                <p className="font-body text-[#fcf8fe]">
                  Elena R. <span className="text-[#acaab0]">10:42 AM</span>
                </p>
                <p className="font-body text-[#acaab0]">
                  The new motion guidelines look incredible. Can we review
                  transition curves?
                </p>
              </article>
              <article className="rounded-xl bg-[#25252b] p-3">
                <p className="font-body text-[#fcf8fe]">
                  Marcus T. <span className="text-[#acaab0]">10:45 AM</span>
                </p>
                <p className="font-body text-[#acaab0]">
                  Uploaded the latest deck. We should align the ROI narrative
                  before client Q&A.
                </p>
              </article>
            </div>
          </section>

          <section className="rounded-3xl border border-[#48474c]/35 bg-[#19191e]/90 p-4 backdrop-blur-xl">
            <div className="mb-3 flex items-center gap-2 text-[#8ff5ff]">
              <Sparkles size={16} />
              <h2 className="font-headline text-base">AI notes</h2>
            </div>

            <div className="mb-3 text-xs text-[#8b8990]">
              {aiNotesStatus === "connected" && "Live sync enabled"}
              {aiNotesStatus === "connecting" && "Connecting to notes stream..."}
              {aiNotesStatus === "disconnected" && "Disconnected from notes stream"}
            </div>

            {aiNotes.length === 0 ? (
              <p className="font-body text-sm text-[#acaab0]">
                Waiting for AI notes from scribe...
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                {aiNotes.map((note) => (
                  <article key={note.id} className="rounded-xl bg-[#25252b] p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-[#2c2d34] px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] text-[#8ff5ff]">
                        AI update
                      </span>
                      <span className="text-[11px] text-[#8b8990]">
                        {toTimeLabel(note.timestamp)}
                      </span>
                    </div>

                    <p className="font-body whitespace-pre-wrap text-[#d6d4db]">
                      {note.text}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
          </aside>
        )}
      </section>

      <CallToolbar
        asideToggle={{
          isOpen: isAsideOpen,
          onToggle: () => setIsAsideOpen((prev) => !prev),
        }}
        onInviteAgents={onInviteAgents}
      />
    </div>
  );
};
