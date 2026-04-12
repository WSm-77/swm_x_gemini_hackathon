import { MessageSquareText, Sparkles } from "lucide-react";

import { InteractiveNotes } from "@components/InteractiveNotes";

import { toTimeLabel } from "./useAiNotesFeed";
import { type AiNoteItem } from "./types";

type RoomSidebarProps = {
  isOpen: boolean;
  aiNotesStatus: "connecting" | "connected" | "disconnected";
  aiNotes: AiNoteItem[];
};

export const RoomSidebar = ({ isOpen, aiNotesStatus, aiNotes }: RoomSidebarProps) => {
  if (!isOpen) return null;

  return (
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
  );
};
