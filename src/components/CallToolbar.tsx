import {
  useCamera,
  useConnection,
  useMicrophone,
  useScreenShare,
} from "@fishjam-cloud/react-client";
import {
  Mic,
  MicOff,
  MessageSquareText,
  MonitorOff,
  MonitorUp,
  PhoneOff,
  Settings,
  Share2,
  Video,
  VideoOff,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";

import { useRoom } from "@/context/RoomContext";
import { INVITABLE_AGENTS, type InvitableAgentId } from "@/types/agents";
import { SettingsSheet } from "./SettingsSheet";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { Switch } from "./ui/switch";

type CallToolbarProps = {
  asideToggle?: {
    isOpen: boolean;
    onToggle: () => void;
  };
  onInviteAgents?: (agents: InvitableAgentId[]) => Promise<void>;
};

export const CallToolbar = ({ asideToggle, onInviteAgents }: CallToolbarProps) => {
  const { roomName } = useRoom();
  const { leaveRoom } = useConnection();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<InvitableAgentId[]>([]);

  const {
    startStreaming,
    stream: screenStream,
    stopStreaming,
  } = useScreenShare();

  const { toggleCamera, isCameraOn } = useCamera();

  const {
    toggleMicrophoneMute,
    isMicrophoneMuted,
    toggleMicrophone,
    isMicrophoneOn,
  } = useMicrophone();

  const toggleMicrophoneState = () => {
    if (isMicrophoneOn) {
      toggleMicrophoneMute();
    } else {
      toggleMicrophone();
    }
  };

  const onHangUp = async () => {
    leaveRoom();
  };

  const MicIcon = !isMicrophoneMuted ? Mic : MicOff;
  // CameraIcon: pokazuje VideoOff tylko gdy kamera jest wyłączona
  const CameraIcon = isCameraOn ? Video : VideoOff;
  // Ikona shareowania: MonitorUp (nieprzekreślony) gdy trwa udostępnianie, MonitorOff (przekreślony) gdy nie udostępniasz
  const ScreenshareIcon = screenStream ? MonitorUp : MonitorOff;

  const toggleScreenShare = async () => {
    if (screenStream) return stopStreaming();
    try {
      await startStreaming();
    } catch (error) {
      if (error instanceof Error && error.name === "NotAllowedError") return;
      console.error(error);
    }
  };

  const selectedSet = useMemo(() => new Set(selectedAgents), [selectedAgents]);

  const toggleAgent = (agentId: InvitableAgentId, checked: boolean) => {
    setSelectedAgents((current) => {
      if (checked) {
        if (current.includes(agentId)) return current;
        return [...current, agentId];
      }

      return current.filter((id) => id !== agentId);
    });
  };

  const onConfirmInvite = async () => {
    if (selectedAgents.length === 0) {
      toast.error("Select at least one agent", {
        position: "top-center",
      });
      return;
    }

    if (!onInviteAgents) return;

    try {
      await onInviteAgents(selectedAgents);
      setIsInviteOpen(false);
      setSelectedAgents([]);
    } catch {
      // Invite errors are surfaced by the room-level handler.
    }
  };

  const onShareRoom = async () => {
    if (!roomName) {
      toast.error("No room ID available to share", {
        position: "top-center",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(roomName);
      toast.success("Room ID copied! Share it with others to join.", {
        position: "top-center",
        description: `${roomName}`
      });
    } catch {
      toast.error("Could not copy room ID", {
        position: "top-center",
      });
    }
  };

  const controlClass =
    "h-11 w-11 rounded-full border border-[#48474c]/50 bg-[#25252b]/80 text-[#fcf8fe] shadow-none hover:bg-[#2c2b32]";

  const activeControlClass =
    "h-11 w-11 rounded-full border border-[#a8a4ff]/45 bg-[#3e1bff]/35 text-[#fcf8fe] shadow-none hover:bg-[#3e1bff]/55";

  return (
    <footer className="pointer-events-none fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-[#48474c]/45 bg-[#131317]/75 px-3 py-2 backdrop-blur-2xl">
        <SettingsSheet>
          <Button className={controlClass} variant="ghost" asChild>
            <div>
              <Settings size={20} strokeWidth={"1.5px"} />
            </div>
          </Button>
        </SettingsSheet>

        <Button
          className={controlClass}
          variant="ghost"
          onClick={onShareRoom}
          title="Share room ID"
        >
          <Share2 size={20} strokeWidth={"1.5px"} />
        </Button>

        <Sheet open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <SheetTrigger asChild>
            <Button
              className="h-11 w-11 rounded-full border border-[#48474c]/50 bg-[#25252b]/80 text-[#a8a4ff] shadow-none hover:bg-[#2c2b32] hover:text-[#a8a4ff]"
              variant="ghost"
              title="Invite agents"
            >
              <UserPlus size={20} strokeWidth={"1.5px"} />
            </Button>
          </SheetTrigger>

          <SheetContent
            className="border-l border-[#48474c]/45 bg-[#131317] text-[#fcf8fe] sm:max-w-md"
            side="right"
          >
            <SheetHeader>
              <SheetTitle className="font-headline text-xl text-[#fcf8fe]">
                Invite Agents
              </SheetTitle>
              <SheetDescription className="font-body text-[#acaab0]">
                Select one or more AI agents to join this call.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-3">
              {INVITABLE_AGENTS.map((agent) => {
                const isSelected = selectedSet.has(agent.id);

                return (
                  <div
                    key={agent.id}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                      isSelected
                        ? "border-[#a8a4ff]/60 bg-[#251d52]/40"
                        : "border-[#48474c]/40 bg-[#1a1a21] hover:bg-[#21212a]"
                    }`}
                    onClick={() => toggleAgent(agent.id, !isSelected)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === " " || event.key === "Enter") {
                        event.preventDefault();
                        toggleAgent(agent.id, !isSelected);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-body text-sm font-semibold text-[#fcf8fe]">
                          {agent.label}
                        </p>
                        <p className="mt-1 text-xs text-[#8b8990]">{agent.description}</p>
                      </div>

                      <Switch
                        checked={isSelected}
                        className="data-[state=checked]:bg-[#a8a4ff] data-[state=unchecked]:bg-[#3b3a42]"
                        onClick={(event) => event.stopPropagation()}
                        onCheckedChange={(checked) => toggleAgent(agent.id, checked)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <SheetFooter className="mt-6 gap-2">
              <Button
                className="border-[#48474c]/50 bg-transparent text-[#acaab0] hover:bg-[#25252b] hover:text-[#fcf8fe]"
                onClick={() => {
                  setIsInviteOpen(false);
                  setSelectedAgents([]);
                }}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                className="bg-[#a8a4ff] text-[#1a1138] hover:bg-[#b8b4ff]"
                onClick={onConfirmInvite}
                type="button"
              >
                Confirm invite
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <Button
          className={!isMicrophoneMuted && isMicrophoneOn ? activeControlClass : controlClass}
          variant="ghost"
          onClick={toggleMicrophoneState}
        >
          <MicIcon size={20} strokeWidth={"1.5px"} />
        </Button>

        <Button
          className={isCameraOn ? activeControlClass : controlClass}
          variant="ghost"
          onClick={toggleCamera}
        >
          <CameraIcon size={20} strokeWidth={"1.5px"} />
        </Button>

        <Button
          className={screenStream ? activeControlClass : controlClass}
          variant="ghost"
          onClick={toggleScreenShare}
        >
          <ScreenshareIcon size={20} strokeWidth={"1.5px"} />
        </Button>

        {asideToggle && (
          <Button
            className={asideToggle.isOpen ? activeControlClass : controlClass}
            variant="ghost"
            onClick={asideToggle.onToggle}
            title={asideToggle.isOpen ? "Hide side panel" : "Show side panel"}
          >
            <MessageSquareText size={20} strokeWidth={"1.5px"} />
          </Button>
        )}

        <Button
          className="h-11 gap-2 rounded-full bg-[#ff6e84] px-4 text-xs font-semibold text-[#490013] hover:bg-[#ff8396]"
          variant="ghost"
          onClick={onHangUp}
        >
          <PhoneOff size={18} strokeWidth={"1.75px"} />
          <span>Leave</span>
        </Button>
      </div>
    </footer>
  );
};
