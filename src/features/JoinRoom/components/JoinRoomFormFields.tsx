import type { UseFormReturn } from "react-hook-form";

import type { RoomForm } from "@/types/room";
import { CameraSettings, MicrophoneSettings } from "@components/DeviceSettings";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@components/ui/accordion";
import { Button } from "@components/ui/button";
import { CardContent } from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";

type JoinRoomFormFieldsProps = {
  form: UseFormReturn<RoomForm>;
  isHost: boolean;
  onRoleChange: (isHost: boolean) => void;
  onGenerateRoomId: () => string;
  onCopyRoomId: () => Promise<void>;
  onRoomTypeChange: (value: string) => void;
};

export const JoinRoomFormFields = ({
  form,
  isHost,
  onRoleChange,
  onGenerateRoomId,
  onCopyRoomId,
  onRoomTypeChange,
}: JoinRoomFormFieldsProps) => {
  return (
    <CardContent>
      <div className="grid w-full items-center gap-6">
        <input type="hidden" {...form.register("fishjamId")} />

        <div className="flex flex-col space-y-6">
          <div className="flex flex-col space-y-2">
            <Label className="text-base text-[#fcf8fe]">Role</Label>

            <div className="flex gap-3">
              <Button
                type="button"
                variant={isHost ? "outline" : "default"}
                className="h-11 flex-1 text-base"
                onClick={() => onRoleChange(true)}
              >
                Host
              </Button>

              <Button
                type="button"
                variant={!isHost ? "outline" : "default"}
                className="h-11 flex-1 text-base"
                onClick={() => onRoleChange(false)}
              >
                Participant
              </Button>
            </div>
          </div>

          <div className="flex flex-col space-y-2">
            <Label htmlFor="roomName" className="text-base text-[#fcf8fe]">
              Room ID
            </Label>

            <div className="flex gap-3">
              <Input
                {...form.register("roomName", {
                  required: "Room ID is required",
                })}
                placeholder={isHost ? "Generated room ID" : "Paste shared room ID"}
                readOnly={false}
                className="h-11 rounded-none border-0 border-b border-[#48474c]/70 bg-[#131317] px-3 text-base text-[#fcf8fe] focus-visible:ring-1 focus-visible:ring-[#a8a4ff]"
              />

              {isHost && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 px-6"
                    onClick={() => form.setValue("roomName", onGenerateRoomId())}
                  >
                    New
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 px-6"
                    onClick={onCopyRoomId}
                  >
                    Copy
                  </Button>
                </>
              )}
            </div>
            {form.formState.errors.roomName && (
              <p className="text-sm text-[#ff6e84]">
                {form.formState.errors.roomName.message}
              </p>
            )}
          </div>

          <div className="flex flex-col space-y-2">
            <Label htmlFor="peerName" className="text-base text-[#fcf8fe]">
              User name
            </Label>

            <Input
              {...form.register("peerName", {
                required: "User name is required",
              })}
              placeholder="Your name"
              className="h-11 rounded-none border-0 border-b border-[#48474c]/70 bg-[#131317] px-3 text-base text-[#fcf8fe] focus-visible:ring-1 focus-visible:ring-[#a8a4ff]"
            />
            {form.formState.errors.peerName && (
              <p className="text-sm text-[#ff6e84]">
                {form.formState.errors.peerName.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col space-y-1.5">
          <Label htmlFor="roomType" className="text-[#fcf8fe]">
            Room type
          </Label>

          <Select value={form.watch("roomType")} onValueChange={onRoomTypeChange}>
            <SelectTrigger className="border-[#48474c]/70 bg-[#131317] text-[#fcf8fe] focus:ring-1 focus:ring-[#a8a4ff]">
              <SelectValue placeholder="Select room type" />
            </SelectTrigger>

            <SelectContent className="border-[#48474c]/80 bg-[#19191e] text-[#fcf8fe]">
              <SelectItem value="conference" className="focus:bg-[#25252b]">
                Conference
              </SelectItem>
              <SelectItem value="audio_only" className="focus:bg-[#25252b]">
                Audio conference
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Accordion type="single" collapsible className="mt-4">
        <AccordionItem value="item-1">
          <AccordionTrigger className="text-[#fcf8fe]">
            Camera settings
          </AccordionTrigger>
          <AccordionContent>
            <CameraSettings />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-2">
          <AccordionTrigger className="text-[#fcf8fe]">
            Microphone settings
          </AccordionTrigger>

          <AccordionContent>
            <MicrophoneSettings />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </CardContent>
  );
};
