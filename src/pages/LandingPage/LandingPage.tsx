import {
  Globe,
  ShieldCheck,
  Sparkles,
  SquareArrowOutUpRight,
  Volume2,
} from "lucide-react";

import { JoinRoomCard } from "@components/JoinRoomCard";

type LandingPageProps = {
  onFishjamIdChange: (fishjamId: string) => void;
};

const pillars = [
  {
    icon: SquareArrowOutUpRight,
    title: "Get a link you can share",
    body: "Start instantly and invite stakeholders in seconds with one shareable room link.",
  },
  {
    icon: Globe,
    title: "Join from anywhere",
    body: "Consistent conferencing experience across desktop and mobile for distributed teams.",
  },
  {
    icon: ShieldCheck,
    title: "Your safety is priority",
    body: "Privacy-first defaults and secure collaboration patterns for business-critical calls.",
  },
] as const;

const capabilities = [
  "Studio quality audio",
  "Live transcriptions",
  "Speaker focus cues",
  "4K screen share",
] as const;

export default function LandingPage({ onFishjamIdChange }: LandingPageProps) {
  return (
    <section className="relative flex h-full w-full flex-col overflow-y-auto lg:overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-8 h-72 w-72 rounded-full bg-[#7000ff]/35 blur-3xl" />
        <div className="absolute right-0 top-16 h-80 w-80 rounded-full bg-[#00eefc]/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-[#3e1bff]/25 blur-3xl" />
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl gap-8 px-6 py-8 lg:h-full lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-12">
        <div className="space-y-8">
          <header className="space-y-5">
            <p className="font-body text-sm uppercase tracking-[0.24em] text-[#acaab0]">
              When future comes
            </p>

            <h1 className="font-headline text-5xl leading-[0.95] text-[#fcf8fe] sm:text-6xl lg:text-7xl">
              AIMeet
            </h1>

            <p className="font-body max-w-2xl text-base text-[#acaab0] sm:text-lg">
              Collaborate in a high-fidelity workspace designed for modern
              business calls. Crystal clear audio, immersive video, and AI
              productivity assistance that moves with your meeting.
            </p>

            <div className="inline-flex items-center gap-2 rounded-full border border-[#48474c]/40 bg-[#25252b]/60 px-4 py-2 text-sm text-[#a8a4ff] backdrop-blur-md">
              <Sparkles size={16} />
              Built for high-performance teams
            </div>
          </header>

          <div className="grid gap-4 sm:grid-cols-3">
            {pillars.map(({ icon: Icon, title, body }) => (
              <article
                key={title}
                className="rounded-3xl bg-[#131317]/80 p-4 backdrop-blur-md"
              >
                <Icon className="mb-3 text-[#a8a4ff]" size={18} />
                <h2 className="font-headline mb-2 text-base text-[#fcf8fe]">
                  {title}
                </h2>
                <p className="font-body text-sm text-[#acaab0]">{body}</p>
              </article>
            ))}
          </div>

          <div className="rounded-3xl bg-[#25252b]/60 p-5 backdrop-blur-xl">
            <div className="mb-3 flex items-center gap-2 text-[#a8a4ff]">
              <Volume2 size={18} />
              <span className="font-body text-sm uppercase tracking-[0.2em]">
                Designed for high-performance teams
              </span>
            </div>

            <ul className="grid gap-2 text-sm text-[#fcf8fe] sm:grid-cols-2">
              {capabilities.map((item) => (
                <li
                  key={item}
                  className="font-body rounded-xl bg-[#19191e] px-3 py-2"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <JoinRoomCard
          className="w-full lg:max-w-xl lg:justify-self-end"
          onFishjamIdChange={onFishjamIdChange}
        />
      </div>
    </section>
  );
}
