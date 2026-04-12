import { Users } from "lucide-react";

type RoomHeaderProps = {
  roomId: string | null;
  participantCount: number;
};

export const RoomHeader = ({ roomId, participantCount }: RoomHeaderProps) => {
  return (
    <header className="relative grid gap-3 border-b border-[#48474c]/35 bg-[#131317]/80 px-4 py-3 backdrop-blur-xl md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center lg:px-6">
      <div className="min-w-0">
        <p className="font-body text-xs uppercase tracking-[0.24em] text-[#acaab0]">
          When future comes
        </p>
        <h1 className="font-headline truncate text-2xl leading-none">AIMeet</h1>
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
  );
};
