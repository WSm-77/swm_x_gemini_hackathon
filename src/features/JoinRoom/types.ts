import type { RoomForm } from "@/types/room";

export type JoinRoomCardProps = React.HTMLAttributes<HTMLDivElement> & {
  onFishjamIdChange: (fishjamId: string) => void;
};

export type JoinRoomSubmitInput = RoomForm;
