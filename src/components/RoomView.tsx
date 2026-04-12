import { usePeers } from "@fishjam-cloud/react-client";
import { AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ScribeServiceUnavailableError, inviteAgents } from "@/services/scribeService";
import { useRoom } from "@/context/RoomContext";
import { INVITABLE_AGENTS, type InvitableAgentId } from "@/types/agents";
import { CallToolbar } from "./CallToolbar";
import { RoomHeader } from "./room-view/RoomHeader";
import { RoomSidebar, type RoomSidebarTab } from "./room-view/RoomSidebar";
import { VideoStage } from "./room-view/VideoStage";
import { useAiNotesFeed } from "./room-view/useAiNotesFeed";
import { useFactCheckFeed } from "./room-view/useFactCheckFeed";
import { type CameraTile } from "./room-view/types";

const CAMERAS_PER_PAGE = 4;
const FACT_CHECK_TOAST_MAX_CHARS = 180;

const toFactCheckPreview = (text: string): string => {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= FACT_CHECK_TOAST_MAX_CHARS) return compact;
  return `${compact.slice(0, FACT_CHECK_TOAST_MAX_CHARS - 1)}...`;
};

export const RoomView = () => {
  const { localPeer, remotePeers } = usePeers<{ displayName?: string }>();
  const { roomId } = useRoom();
  const { aiNotes, aiNotesStatus } = useAiNotesFeed(roomId);
  const [activeAgents, setActiveAgents] = useState<Set<InvitableAgentId>>(new Set());
  const isFactCheckerEnabled = activeAgents.has("factChecker");
  const { factCheckItems, factCheckStatus } = useFactCheckFeed(
    roomId,
    isFactCheckerEnabled,
  );
  const [currentPage, setCurrentPage] = useState(0);
  const [isAsideOpen, setIsAsideOpen] = useState(true);
  const [activeAsideTab, setActiveAsideTab] = useState<RoomSidebarTab>("notes");
  const notifiedFactCheckIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (factCheckItems.length === 0) return;

    const nextReports = [...factCheckItems]
      .reverse()
      .filter((item) => !notifiedFactCheckIdsRef.current.has(item.id));

    if (nextReports.length === 0) return;

    nextReports.forEach((item) => {
      notifiedFactCheckIdsRef.current.add(item.id);

      if (item.verdict !== "refuted") return;

      toast.error("Refuted claim detected", {
        position: "top-center",
        description: toFactCheckPreview(item.text),
        duration: 8000,
        icon: <AlertTriangle className="h-4 w-4 text-rose-200" />,
        style: {
          border: "1px solid rgba(251, 113, 133, 0.45)",
          background: "rgba(76, 5, 25, 0.92)",
          color: "#ffe4e6",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.35)",
        },
      });
    });

    if (notifiedFactCheckIdsRef.current.size > 300) {
      notifiedFactCheckIdsRef.current = new Set(
        factCheckItems.slice(0, 100).map((item) => item.id),
      );
    }
  }, [factCheckItems]);

  const remoteStreamingPeer = remotePeers.find((peer) => peer.screenShareVideoTrack);

  const isLocalStreaming = localPeer?.screenShareVideoTrack;
  const isAnyoneStreaming = isLocalStreaming || remoteStreamingPeer;

  const allCameraTiles = (() => {
    const tiles: CameraTile[] = [];

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
  })();

  // Determine spotlight tile and top bar tiles based on streaming status
  let spotlightTile = null;
  let pipTile = null;
  let topBarTiles: CameraTile[] = [];
  let gridTiles: CameraTile[] = [];

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
      audioTrack:
        remoteStreamingPeer.screenShareAudioTrack ??
        remoteStreamingPeer.microphoneTrack,
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

  const handlePrevPage = (): void => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = (): void => {
    if (isAnyoneStreaming && currentPage < topBarPageCount - 1) {
      setCurrentPage(currentPage + 1);
    } else if (!isAnyoneStreaming && currentPage < gridPageCount - 1) {
      setCurrentPage(currentPage + 1);
    }
  };
  const participantCount = (localPeer ? 1 : 0) + remotePeers.length;

  const onInviteAgents = async (agentIds: InvitableAgentId[]): Promise<void> => {
    try {
      const invited = await inviteAgents(agentIds, roomId || undefined);
      setActiveAgents((current) => {
        const next = new Set(current);
        invited.forEach((agentId) => next.add(agentId));
        return next;
      });

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
          description: `${error.message}. Run pnpm scribe:dev and pnpm fact-checker:dev, then try again.`,
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

      <RoomHeader roomId={roomId} participantCount={participantCount} />

      <section
        className={`relative grid flex-1 min-h-0 gap-4 overflow-hidden px-4 pt-4 lg:px-6 ${
          isAsideOpen ? "lg:grid-cols-[minmax(0,1fr)_360px]" : "lg:grid-cols-[minmax(0,1fr)]"
        }`}
      >
        <VideoStage
          spotlightTile={spotlightTile}
          pipTile={pipTile}
          isAnyoneStreaming={Boolean(isAnyoneStreaming)}
          currentTopBarTiles={currentTopBarTiles}
          currentGridTiles={currentGridTiles}
          currentPage={currentPage}
          topBarPageCount={topBarPageCount}
          gridPageCount={gridPageCount}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
          onSelectGridPage={setCurrentPage}
        />

        <RoomSidebar
          isOpen={isAsideOpen}
          aiNotesStatus={aiNotesStatus}
          aiNotes={aiNotes}
          factCheckStatus={factCheckStatus}
          factCheckItems={factCheckItems}
          activeTab={activeAsideTab}
          onTabChange={setActiveAsideTab}
        />
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
