import {
  type RoomType,
  useConnection,
  useInitializeDevices,
  useSandbox,
} from "@fishjam-cloud/react-client";
import { Loader2, MessageCircleWarning } from "lucide-react";
import type { FC } from "react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { DEFAULT_FISHJAM_ID } from "@/lib/consts";
import { joinScribeSession } from "@/lib/scribeService";
import { getPersistedFormValues, persistFormValues } from "@/lib/utils";
import type { RoomForm } from "@/types";

import { CameraSettings, MicrophoneSettings } from "./DeviceSettings";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  onFishjamIdChange: (fishjamId: string) => void;
};

export const JoinRoomCard: FC<Props> = ({ onFishjamIdChange, ...props }) => {
  const { initializeDevices } = useInitializeDevices();

  const { joinRoom } = useConnection();

  const persistedValues = getPersistedFormValues();

  const defaultValues: RoomForm = {
    roomName: "",
    peerName: "",
    roomType: "conference",
    fishjamId: DEFAULT_FISHJAM_ID,
    ...persistedValues,
  };

  const form = useForm<RoomForm>({
    defaultValues,
    mode: "onSubmit",
  });
  const formFishjamId = form.watch("fishjamId");

  useEffect(() => {
    onFishjamIdChange(formFishjamId);
  }, [formFishjamId, onFishjamIdChange]);

  const { getSandboxPeerToken } = useSandbox();
  const [isHost, setIsHost] = useState(true);

  const generateRoomId = useCallback(() => {
    return crypto.randomUUID();
  }, []);

  const initializeAndReport = useCallback(async () => {
    const { errors } = await initializeDevices({
      enableVideo: true,
      enableAudio: true,
    });
    if (!errors) return;

    const devices = [];
    if (errors.video) devices.push("camera");
    if (errors.audio) devices.push("microphone");

    toast.error(`Failed to initialize ${devices.join(" and ")}`, {
      icon: <MessageCircleWarning size={20} />,
      position: "top-center",
    });
  }, [initializeDevices]);

  useEffect(() => {
    initializeAndReport();
  }, [initializeAndReport]);

  useEffect(() => {
    if (!isHost) return;

    form.setValue("roomName", generateRoomId(), {
      shouldDirty: true,
      shouldTouch: true,
    });
  }, [form, generateRoomId, isHost]);

  const onCopyRoomId = async () => {
    const roomId = form.getValues("roomName");

    if (!roomId) {
      toast.error("No room ID to copy yet");
      return;
    }

    try {
      await navigator.clipboard.writeText(roomId);
      toast.success("Room ID copied. Share it with participants.", {
        position: "top-center",
      });
    } catch {
      toast.error("Could not copy room ID", { position: "top-center" });
    }
  };

  const onJoinRoom = async ({
    roomName,
    peerName,
    roomType,
    fishjamId,
  }: RoomForm) => {
    console.log("Form submitted:", { roomName, peerName, roomType, fishjamId });

    if (!roomName) {
      form.setError("root", { message: "Room ID is required" });
      return;
    }

    if (!peerName) {
      form.setError("root", { message: "User name is required" });
      return;
    }

    if (!roomType) {
      form.setError("root", { message: "Room type is required" });
      return;
    }

    try {
      const peerToken = await getSandboxPeerToken(roomName, peerName, roomType);

      persistFormValues({
        roomName,
        peerName,
        roomType,
        fishjamId,
      });

      await joinRoom({
        peerToken,
        peerMetadata: { displayName: peerName },
      });

      try {
        await joinScribeSession();
      } catch (error) {
        console.error("Failed to start scribe session:", error);
        toast.warning("Joined the room, but could not start scribe agent", {
          position: "top-center",
          description:
            error instanceof Error
              ? error.message
              : "Check scribe service availability",
        });
      }
    } catch (error) {
      console.error("Failed to join room:", error);
      form.setError("root", {
        message: error instanceof Error ? error.message : "Failed to join room"
      });
    }
  };

  const error = form.formState.errors.root?.message;

  return (
    <Card
      {...props}
      className={`border-[#48474c]/30 bg-[#25252b]/70 text-[#fcf8fe] shadow-[0_20px_80px_rgba(102,91,255,0.14)] backdrop-blur-xl ${props.className ?? ""}`}
    >
      <form onSubmit={form.handleSubmit(onJoinRoom)}>
        <CardHeader>
          <p className="font-body text-xs uppercase tracking-[0.2em] text-[#acaab0]">
            Join Meeting
          </p>
          <CardTitle className="font-headline text-3xl text-[#fcf8fe]">
            Start your session
          </CardTitle>
          <CardDescription className="font-body text-[#acaab0]">
            Configure room details and connect to your team workspace.
          </CardDescription>
          {error && (
            <CardFooter className="px-0 pb-0 text-[#ff6e84]">
              {error}
            </CardFooter>
          )}
        </CardHeader>

        <CardContent>
          <div className="grid w-full items-center gap-6">
            <input type="hidden" {...form.register("fishjamId")} />

            <div className="flex flex-col space-y-6">
              <div className="flex flex-col space-y-2">
                <Label className="text-[#fcf8fe] text-base">Role</Label>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant={isHost ? "outline" : "default"}
                    className="h-11 flex-1 text-base"
                    onClick={() => setIsHost(true)}
                  >
                    Host
                  </Button>

                  <Button
                    type="button"
                    variant={!isHost ? "outline" : "default"}
                    className="h-11 flex-1 text-base"
                    onClick={() => setIsHost(false)}
                  >
                    Participant
                  </Button>
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                <Label htmlFor="roomName" className="text-[#fcf8fe] text-base">
                  Room ID
                </Label>

                <div className="flex gap-3">
                  <Input
                    {...form.register("roomName", {
                      required: "Room ID is required"
                    })}
                    placeholder={isHost ? "Generated room ID" : "Paste shared room ID"}
                    readOnly={isHost}
                    className="border-0 border-b border-[#48474c]/70 rounded-none bg-[#131317] px-3 text-[#fcf8fe] h-11 text-base focus-visible:ring-1 focus-visible:ring-[#a8a4ff]"
                  />

                  {isHost && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 px-6"
                        onClick={() => form.setValue("roomName", generateRoomId())}
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
                <Label htmlFor="peerName" className="text-[#fcf8fe] text-base">
                  User name
                </Label>

                <Input
                  {...form.register("peerName", {
                    required: "User name is required"
                  })}
                  placeholder="Your name"
                  className="border-0 border-b border-[#48474c]/70 rounded-none bg-[#131317] px-3 text-[#fcf8fe] h-11 text-base focus-visible:ring-1 focus-visible:ring-[#a8a4ff]"
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

              <Select
                value={form.watch("roomType")}
                onValueChange={(value) =>
                  form.setValue("roomType", value as RoomType)
                }
              >
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

        <CardFooter className="flex justify-end">
          <Button
            disabled={form.formState.isSubmitting}
            type="submit"
            className="font-body w-36 rounded-full bg-gradient-to-r from-[#a8a4ff] to-[#9995ff] text-[#1e009f] shadow-[0_10px_30px_rgba(102,91,255,0.35)] transition-transform hover:scale-[1.02] hover:brightness-110"
          >
            {form.formState.isSubmitting ? (
              <Loader2 className="animate-spin" />
            ) : (
              <span>Join room</span>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};
