import { MessageSquareText, ShieldCheck } from "lucide-react";

import { getVerdictLabel, getVerdictTone } from "./factCheckUtils";
import { toTimeLabel } from "./useAiNotesFeed";
import { type FactCheckItem } from "./types";

type ChatViewProps = {
  factCheckItems: FactCheckItem[];
};

export const ChatView = ({ factCheckItems }: ChatViewProps) => {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <section className="rounded-3xl border border-[#48474c]/35 bg-[#19191e]/90 p-4 backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-2 text-[#a8a4ff]">
          <MessageSquareText size={16} />
          <h2 className="font-headline text-base">Chat</h2>
        </div>

        <p className="text-xs text-[#8b8990]">Live discussion</p>
      </section>

      <section className="rounded-3xl border border-[#48474c]/35 bg-[#19191e]/90 p-4 backdrop-blur-xl lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
        <div className="space-y-3 text-sm overflow-x-hidden overflow-y-auto lg:min-h-0 lg:flex-1">
          {factCheckItems.map((item) => {
            const verdictLabel = getVerdictLabel(item.verdict);
            const tone = getVerdictTone(item.verdict);

            return (
              <article key={item.id} className="rounded-xl border border-[#3f3d45] bg-[#1e1e24] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 font-body text-[#fcf8fe]">
                    <ShieldCheck size={14} className={tone.textClassName} />
                    Fact Checker
                  </p>
                  <span className="text-[11px] text-[#8b8990]">
                    {toTimeLabel(item.timestamp)}
                  </span>
                </div>
                <div className="mb-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] ${tone.badgeClassName}`}
                  >
                    {verdictLabel}
                  </span>
                </div>
                <p className="font-body whitespace-pre-wrap text-[#d6d4db]">
                  {item.text}
                </p>
              </article>
            );
          })}

          {/* <article className="rounded-xl bg-[#25252b] p-3">
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
          </article> */}
        </div>
      </section>
    </div>
  );
};
