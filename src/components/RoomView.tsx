import { type PeerId, type Track, useConnection, usePeers } from "@fishjam-cloud/react-client";
import { ChevronLeft, ChevronRight, MessageSquareText, Sparkles, Users } from "lucide-react";
import { useState, useMemo, useEffect } from "react";

import { CallToolbar } from "./CallToolbar";
import { InteractiveNotes } from "./InteractiveNotes";
import { Tile } from "./Tile";
import { useRoom } from "@/context/RoomContext";
import { deleteRoom } from "@/lib/roomManager";
import { DEFAULT_FISHJAM_ID } from "@/lib/consts";

const CAMERAS_PER_PAGE = 4;

export const RoomView = () => {
  const { localPeer, remotePeers } = usePeers<{ displayName: string }>();
  const [currentPage, setCurrentPage] = useState(0);

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

  return (
    <div className="relative flex h-full w-full flex-col bg-[#0e0e12] text-[#fcf8fe]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-16 h-72 w-72 rounded-full bg-[#7000ff]/25 blur-3xl" />
        <div className="absolute right-8 top-10 h-80 w-80 rounded-full bg-[#00eefc]/10 blur-3xl" />
      </div>

      <header className="relative flex items-center justify-between border-b border-[#48474c]/35 bg-[#131317]/80 px-4 py-3 backdrop-blur-xl lg:px-6">
        <div>
          <p className="font-body text-xs uppercase tracking-[0.24em] text-[#acaab0]">
            Neon Nocturne
          </p>
          <h1 className="font-headline text-2xl leading-none">Project Sync</h1>
        </div>

        <div className="flex items-center gap-2 rounded-full bg-[#25252b]/80 px-4 py-2 text-sm text-[#a8a4ff]">
          <span className="h-2 w-2 rounded-full bg-[#a8a4ff]" />
          LIVE
          <span className="mx-1 text-[#48474c]">|</span>
          <Users size={16} />
          {participantCount} Participants active
        </div>
      </header>

      <section className="relative grid flex-1 gap-4 overflow-y-auto px-4 pb-28 pt-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-6">
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
              <h2 className="font-headline text-base">AI Cues</h2>
            </div>

            <ul className="font-body space-y-2 text-sm text-[#acaab0]">
              <li className="rounded-xl bg-[#25252b] p-3">
                The client seems hesitant about budget. Clarify expected ROI
                timeline now.
              </li>
              <li className="rounded-xl bg-[#25252b] p-3">
                Strong engagement on automation. Ask a follow-up about rollout
                milestones.
              </li>
            </ul>
          </section>
        </aside>
      </section>

      <CallToolbar />
    </div>
  );
};
