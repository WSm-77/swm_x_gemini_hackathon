import { createContext, useContext, useState, type ReactNode } from "react";

interface RoomContextType {
  roomName: string | null;
  setRoomName: (name: string | null) => void;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export function RoomProvider({ children }: { children: ReactNode }) {
  const [roomName, setRoomName] = useState<string | null>(null);

  return (
    <RoomContext.Provider value={{ roomName, setRoomName }}>
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom() {
  const context = useContext(RoomContext);
  if (context === undefined) {
    throw new Error("useRoom must be used within RoomProvider");
  }
  return context;
}
