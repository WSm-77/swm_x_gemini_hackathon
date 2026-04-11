import { UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { INVITABLE_AGENTS, type InvitableAgentId } from "@/types/agents";
import { Button } from "@components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@components/ui/sheet";
import { Switch } from "@components/ui/switch";

type AgentInviteSheetProps = {
  onInviteAgents?: (agents: InvitableAgentId[]) => Promise<void>;
};

export const AgentInviteSheet = ({ onInviteAgents }: AgentInviteSheetProps) => {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<InvitableAgentId[]>([]);

  const selectedSet = useMemo(() => new Set(selectedAgents), [selectedAgents]);

  const toggleAgent = (agentId: InvitableAgentId, checked: boolean): void => {
    setSelectedAgents((current) => {
      if (checked) {
        if (current.includes(agentId)) return current;
        return [...current, agentId];
      }

      return current.filter((id) => id !== agentId);
    });
  };

  const onConfirmInvite = async (): Promise<void> => {
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

  return (
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
  );
};
