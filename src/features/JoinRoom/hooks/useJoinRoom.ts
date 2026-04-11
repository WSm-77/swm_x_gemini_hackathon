import { type RoomType, useConnection, useInitializeDevices } from "@fishjam-cloud/react-client";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { useRoom } from "@/context/RoomContext";
import { DEFAULT_FISHJAM_ID } from "@/lib/consts";
import { getPersistedFormValues, persistFormValues } from "@/lib/utils";
import { getRoomCredentials } from "@/services/roomManager";
import type { RoomForm } from "@/types/room";

export const useJoinRoom = (onFishjamIdChange: (fishjamId: string) => void) => {
  const { initializeDevices } = useInitializeDevices();
  const { joinRoom } = useConnection();
  const { setRoomId, setRoomName } = useRoom();

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

  const [isHost, setIsHost] = useState(true);
  const formFishjamId = form.watch("fishjamId");

  const generateRoomId = useCallback((): string => crypto.randomUUID(), []);

  useEffect(() => {
    onFishjamIdChange(formFishjamId);
  }, [formFishjamId, onFishjamIdChange]);

  const initializeAndReport = useCallback(async () => {
    const { errors } = await initializeDevices({
      enableVideo: true,
      enableAudio: true,
    });
    if (!errors) return;

    const devices = [] as string[];
    if (errors.video) devices.push("camera");
    if (errors.audio) devices.push("microphone");

    toast.error(`Failed to initialize ${devices.join(" and ")}`, {
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

  const onCopyRoomId = async (): Promise<void> => {
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
  }: RoomForm): Promise<void> => {
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
      const fishjamUrl = /^https?:\/\//.test(fishjamId)
        ? new URL(fishjamId).href
        : `https://fishjam.io/api/v1/connect/${fishjamId}`;

      const { peerToken, room } = await getRoomCredentials(
        `${fishjamUrl}/room-manager`,
        roomName,
        peerName,
        roomType,
      );

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

      setRoomName(roomName);
      setRoomId(room.id);
    } catch (error) {
      console.error("Failed to join room:", error);
      form.setError("root", {
        message: error instanceof Error ? error.message : "Failed to join room",
      });
    }
  };

  const setRoomType = (value: string): void => {
    form.setValue("roomType", value as RoomType);
  };

  return {
    form,
    isHost,
    setIsHost,
    generateRoomId,
    onCopyRoomId,
    onJoinRoom,
    setRoomType,
    error: form.formState.errors.root?.message,
  };
};
