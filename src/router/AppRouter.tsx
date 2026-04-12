import { useConnection } from "@fishjam-cloud/react-client";
import { Suspense, lazy } from "react";

import { RoomLoadingSkeleton } from "@components/RoomLoadingSkeleton";
import { LandingPage } from "@pages/LandingPage";

type AppRouterProps = {
  onFishjamIdChange: (fishjamId: string) => void;
};

const RoomPage = lazy(() =>
  import("@pages/RoomPage").then((module) => ({ default: module.RoomPage })),
);

export default function AppRouter({ onFishjamIdChange }: AppRouterProps) {
  const { peerStatus } = useConnection();
  const isConnected = peerStatus === "connected";

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#0e0e12] text-[#fcf8fe]">
      {isConnected ? (
        <Suspense fallback={<RoomLoadingSkeleton />}>
          <RoomPage />
        </Suspense>
      ) : (
        <LandingPage onFishjamIdChange={onFishjamIdChange} />
      )}
    </main>
  );
}
