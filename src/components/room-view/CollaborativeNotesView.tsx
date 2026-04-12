import { Edit3, Lock, LockOpen } from "lucide-react";
import { useState } from "react";

import { InteractiveNotes } from "@components/InteractiveNotes";

export const CollaborativeNotesView = () => {
  const [isLocked, setIsLocked] = useState(false);

  const handleToggleLock = () => {
    setIsLocked((prev) => !prev);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <section className="rounded-3xl border border-[#48474c]/35 bg-[#19191e]/90 p-4 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[#ffd6a8]">
            <Edit3 size={16} />
            <h2 className="font-headline text-base">Collaborative Notes</h2>
          </div>
          <button
            onClick={handleToggleLock}
            className="rounded-lg p-1.5 text-[#ffd6a8] transition-colors hover:bg-[#25252b]"
            title={isLocked ? "Unlock notes" : "Lock notes"}
          >
            {isLocked ? <Lock size={16} /> : <LockOpen size={16} />}
          </button>
        </div>

        <p className="text-xs text-[#8b8990]">
          {isLocked ? "Locked by you" : "Collaborative mode"}
        </p>
      </section>

      <section className="rounded-3xl border border-[#48474c]/35 bg-[#19191e]/90 p-4 backdrop-blur-xl lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
        <div className="overflow-x-hidden overflow-y-auto lg:min-h-0 lg:flex-1">
          <InteractiveNotes isLocked={!isLocked} />
        </div>
      </section>
    </div>
  );
};
