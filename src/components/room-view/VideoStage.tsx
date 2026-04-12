import { ChevronLeft, ChevronRight } from "lucide-react";

import { Tile } from "@components/Tile";

import { type CameraTile } from "./types";

type VideoStageProps = {
  spotlightTile: CameraTile | null;
  pipTile: CameraTile | null;
  isAnyoneStreaming: boolean;
  currentTopBarTiles: CameraTile[];
  currentGridTiles: CameraTile[];
  currentPage: number;
  topBarPageCount: number;
  gridPageCount: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onSelectGridPage: (index: number) => void;
};

export const VideoStage = ({
  spotlightTile,
  pipTile,
  isAnyoneStreaming,
  currentTopBarTiles,
  currentGridTiles,
  currentPage,
  topBarPageCount,
  gridPageCount,
  onPrevPage,
  onNextPage,
  onSelectGridPage,
}: VideoStageProps) => {
  return (
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
            <div className="absolute bottom-4 right-4 z-50 h-28 w-40 overflow-hidden rounded-xl border-2 border-[#a8a4ff] bg-[#19191e] shadow-lg">
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
      ) : isAnyoneStreaming ? null : currentGridTiles.length > 0 ? (
        <div className="grid min-h-[300px] grid-cols-2 grid-rows-2 gap-4">
          {currentGridTiles.map((tile) => (
            <div
              key={tile.key}
              className="overflow-hidden rounded-[20px] border border-[#48474c]/40 bg-[#131317]/90"
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
      )}

      {isAnyoneStreaming && currentTopBarTiles.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={onPrevPage}
            disabled={currentPage === 0}
            className="flex-shrink-0 rounded-lg bg-[#25252b]/80 p-2 text-[#a8a4ff] transition-all hover:bg-[#25252b] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex flex-1 gap-3 overflow-hidden">
            {currentTopBarTiles.map((tile) => (
              <div
                key={tile.key}
                className="h-[130px] min-w-[200px] flex-shrink-0 overflow-hidden rounded-2xl border border-[#48474c]/40 bg-[#19191e]"
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
            onClick={onNextPage}
            disabled={currentPage >= topBarPageCount - 1}
            className="flex-shrink-0 rounded-lg bg-[#25252b]/80 p-2 text-[#a8a4ff] transition-all hover:bg-[#25252b] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {!isAnyoneStreaming && gridPageCount > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={onPrevPage}
            disabled={currentPage === 0}
            className="rounded-lg bg-[#25252b]/80 p-2 text-[#a8a4ff] transition-all hover:bg-[#25252b] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex gap-2">
            {Array.from({ length: gridPageCount }).map((_, index) => (
              <button
                key={index}
                onClick={() => onSelectGridPage(index)}
                className={`h-2 w-2 rounded-full transition-all ${
                  index === currentPage
                    ? "w-8 bg-[#a8a4ff]"
                    : "bg-[#48474c]/50 hover:bg-[#48474c]"
                }`}
              />
            ))}
          </div>

          <button
            onClick={onNextPage}
            disabled={currentPage >= gridPageCount - 1}
            className="rounded-lg bg-[#25252b]/80 p-2 text-[#a8a4ff] transition-all hover:bg-[#25252b] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
};
