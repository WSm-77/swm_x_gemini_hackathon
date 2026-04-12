import { type PeerId, type Track, useVAD } from "@fishjam-cloud/react-client";
import { AudioLines, Mic, MicOff, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";

import AudioPlayer from "./AudioPlayer";
import { Badge } from "./ui/badge";
import VideoPlayer from "./VideoPlayer";

type Props = {
  id: PeerId;
  name: string;
  videoTrack?: Track;
  audioTrack?: Track;
  isLocal?: boolean;
  className?: string;
};

export function Tile({
  videoTrack,
  audioTrack,
  name,
  id,
  isLocal = false,
  className,
}: Props) {
  const isMuted = !audioTrack || audioTrack.metadata?.paused;
  const { [id]: isSpeaking } = useVAD({ peerIds: [id] });

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden rounded-2xl border border-[#48474c]/40 bg-[#131317]",
        className,
      )}
    >
      <div className="relative h-full w-full">
        {videoTrack && !videoTrack.metadata?.paused && (
          <VideoPlayer
            className="z-20 h-full w-full object-cover"
            stream={videoTrack.stream}
            peerId={id}
            muted={isLocal}
          />
        )}

        {(!videoTrack || videoTrack.metadata?.paused) && (
          <div className="grid h-full w-full place-items-center bg-[#19191e]">
            <span className="font-body text-sm text-[#acaab0]">Camera off</span>
          </div>
        )}

        {!isLocal && <AudioPlayer stream={audioTrack?.stream} />}

        <Badge className="absolute bottom-2 left-2 z-30 flex items-center gap-3 border-[#48474c]/50 bg-[#0e0e12]/80 px-3 py-1.5 text-[#fcf8fe] backdrop-blur-xl">
          <span className="font-body text-sm">{name}</span>

          {isMuted ? (
            <span
              title="Muted"
              className="grid h-5 w-5 place-items-center rounded-full bg-rose-500/20 text-rose-300"
            >
              <MicOff size={12} />
            </span>
          ) : (
            <span
              title="Unmuted"
              className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500/20 text-emerald-300"
            >
              <Mic size={12} />
            </span>
          )}

          {isSpeaking ? (
            <span
              title="Speaking"
              className="grid h-5 w-5 place-items-center rounded-full bg-cyan-500/20 text-cyan-300"
            >
              <AudioLines size={12} />
            </span>
          ) : (
            <span
              title="Silent"
              className="grid h-5 w-5 place-items-center rounded-full bg-[#2a2a30] text-[#9f9ca6]"
            >
              <VolumeX size={12} />
            </span>
          )}
        </Badge>
      </div>
    </div>
  );
}
