import { type PeerId, type Track, usePeers } from "@fishjam-cloud/react-client";
import { MessageSquareText, Sparkles, Users } from "lucide-react";

import { CallToolbar } from "./CallToolbar";
import { InteractiveNotes } from "./InteractiveNotes";
import { Tile } from "./Tile";

export const RoomView = () => {
  const { localPeer, remotePeers } = usePeers<{ displayName: string }>();


  // Custom logic: if local user is sharing screen, show screen in spotlight, camera as PiP
  let spotlightTile = null;
  let pipTile = null;
  const secondaryTiles = [] as Array<{
    key: string;
    id: PeerId;
    name: string;
    videoTrack?: Track;
    audioTrack?: Track;
    isLocal?: boolean;
  }>;

  if (localPeer) {
    if (localPeer.screenShareVideoTrack) {
      // Screen share as main
      spotlightTile = {
        key: `local-screen-${localPeer.id}`,
        id: localPeer.id,
        name: "Your screen share",
        videoTrack: localPeer.screenShareVideoTrack,
        audioTrack: localPeer.screenShareAudioTrack,
        isLocal: true,
      };
      // Camera as PiP
      pipTile = {
        key: `local-${localPeer.id}`,
        id: localPeer.id,
        name: "You",
        videoTrack: localPeer.cameraTrack,
        audioTrack: localPeer.microphoneTrack,
        isLocal: true,
      };
    } else {
      // Camera as main
      spotlightTile = {
        key: `local-${localPeer.id}`,
        id: localPeer.id,
        name: "You",
        videoTrack: localPeer.cameraTrack,
        audioTrack: localPeer.microphoneTrack,
        isLocal: true,
      };
    }
  }

  // Add remote peers and their screen shares to secondaryTiles
  remotePeers.forEach((peer) => {
    const label = peer.metadata?.peer?.displayName ?? peer.id;

    secondaryTiles.push({
      key: `remote-${peer.id}`,
      id: peer.id,
      name: label,
      videoTrack: peer.cameraTrack,
      audioTrack: peer.microphoneTrack,
    });

    if (peer.screenShareVideoTrack) {
      secondaryTiles.push({
        key: `remote-screen-${peer.id}`,
        id: peer.id,
        name: `Screen share: ${label}`,
        videoTrack: peer.screenShareVideoTrack,
        audioTrack: peer.screenShareAudioTrack,
      });
    }
  });




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
          ) : (
            <div className="grid min-h-[300px] place-items-center rounded-[20px] border border-[#48474c]/40 bg-[#131317]/90 lg:min-h-[420px]">
              <p className="font-body text-sm text-[#acaab0]">
                Waiting for participants to join...
              </p>
            </div>
          )}

          {secondaryTiles.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {secondaryTiles.map((tile) => (
                <Tile
                  key={tile.key}
                  className="h-[130px] min-w-[220px] rounded-2xl border-[#48474c]/40 bg-[#19191e]"
                  id={tile.id}
                  name={tile.name}
                  videoTrack={tile.videoTrack}
                  audioTrack={tile.audioTrack}
                  isLocal={tile.isLocal}
                />
              ))}
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
