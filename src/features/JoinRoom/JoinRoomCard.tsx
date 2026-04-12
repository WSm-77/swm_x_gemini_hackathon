import { Loader2 } from "lucide-react";
import type { FC } from "react";

import { Button } from "@components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@components/ui/card";

import { JoinRoomFormFields } from "./components/JoinRoomFormFields";
import { useJoinRoom } from "./hooks/useJoinRoom";
import type { JoinRoomCardProps } from "./types";

export const JoinRoomCard: FC<JoinRoomCardProps> = ({ onFishjamIdChange, ...props }) => {
  const {
    form,
    isHost,
    setIsHost,
    generateRoomId,
    onCopyRoomId,
    onJoinRoom,
    setRoomType,
    error,
  } = useJoinRoom(onFishjamIdChange);

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
          {error && <CardFooter className="px-0 pb-0 text-[#ff6e84]">{error}</CardFooter>}
        </CardHeader>

        <JoinRoomFormFields
          form={form}
          isHost={isHost}
          onRoleChange={setIsHost}
          onGenerateRoomId={generateRoomId}
          onCopyRoomId={onCopyRoomId}
          onRoomTypeChange={setRoomType}
        />

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
