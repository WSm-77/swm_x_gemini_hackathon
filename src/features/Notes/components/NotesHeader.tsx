import { Edit3, Lock, Unlock } from "lucide-react";

type NotesHeaderProps = {
  isLocked: boolean;
  onToggleLock: () => void;
};

export const NotesHeader = ({ isLocked, onToggleLock }: NotesHeaderProps) => {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2 text-[#ffd6a8]">
        <Edit3 size={16} />
        <h2 className="font-headline text-base">Collaborative Notes</h2>
      </div>
      <button
        onClick={onToggleLock}
        className="flex items-center gap-1.5 rounded-lg bg-[#25252b] px-2 py-1 text-xs transition-colors hover:bg-[#2d2d34]"
        title={isLocked ? "Unlock notes" : "Lock notes (take control)"}
      >
        {isLocked ? (
          <>
            <Lock size={12} className="text-yellow-400" />
            <span className="text-[#acaab0]">Unlock</span>
          </>
        ) : (
          <>
            <Unlock size={12} className="text-green-400" />
            <span className="text-[#acaab0]">Lock</span>
          </>
        )}
      </button>
    </div>
  );
};
