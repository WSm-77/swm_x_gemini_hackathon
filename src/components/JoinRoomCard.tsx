import {
  type RoomType,
  useConnection,
  useInitializeDevices,
  useSandbox,
} from "@fishjam-cloud/react-client";
import { Loader2, MessageCircleWarning } from "lucide-react";
import type { FC } from "react";
import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { DEFAULT_FISHJAM_ID } from "@/lib/consts";
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

  const defaultValues = {
    ...persistedValues,
    fishjamId: DEFAULT_FISHJAM_ID,
  };

  const form = useForm<RoomForm>({
    defaultValues,
  });
  const formFishjamId = form.watch("fishjamId");

  useEffect(() => {
    onFishjamIdChange(formFishjamId);
  }, [formFishjamId, onFishjamIdChange]);

  const { getSandboxPeerToken } = useSandbox();

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

  const onJoinRoom = async ({
    roomName,
    peerName,
    roomType,
    fishjamId,
  }: RoomForm) => {
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
            <CardFooter className="px-0 pb-0 text-[#ff6e84]">{error}</CardFooter>
          )}
        </CardHeader>

        <CardContent>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="fishjamId" className="text-[#fcf8fe]">
                Fishjam ID
              </Label>

              <Input
                key="fishjamId"
                {...form.register("fishjamId")}
                placeholder="Fishjam ID"
                className="border-0 border-b border-[#48474c]/70 rounded-none bg-[#131317] px-3 text-[#fcf8fe] focus-visible:ring-1 focus-visible:ring-[#a8a4ff]"
              />
            </div>

            <div className="flex flex-row space-x-2">
              <div className="flex flex-1 flex-col space-y-1.5">
                <Label htmlFor="roomName" className="text-[#fcf8fe]">
                  Room name
                </Label>

                <Input
                  {...form.register("roomName")}
                  placeholder="Name of your room"
                  className="border-0 border-b border-[#48474c]/70 rounded-none bg-[#131317] px-3 text-[#fcf8fe] focus-visible:ring-1 focus-visible:ring-[#a8a4ff]"
                />
              </div>

              <div className="flex flex-1 flex-col space-y-1.5">
                <Label htmlFor="peerName" className="text-[#fcf8fe]">
                  User name
                </Label>

                <Input
                  {...form.register("peerName")}
                  placeholder="Your name"
                  className="border-0 border-b border-[#48474c]/70 rounded-none bg-[#131317] px-3 text-[#fcf8fe] focus-visible:ring-1 focus-visible:ring-[#a8a4ff]"
                />
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
            className="w-36 rounded-full bg-gradient-to-r from-[#a8a4ff] to-[#9995ff] font-body text-[#1e009f] shadow-[0_10px_30px_rgba(102,91,255,0.35)] transition-transform hover:scale-[1.02] hover:brightness-110"
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
