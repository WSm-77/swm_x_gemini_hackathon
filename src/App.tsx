import { FishjamProvider } from "@fishjam-cloud/react-client";
import { useState } from "react";

import { BlurProvider } from "./components/BlurToggle";
import { DEFAULT_FISHJAM_ID } from "./lib/consts";
import { RoomProvider } from "./context/RoomContext";
import AppRouter from "./router/AppRouter";

function App() {
  const [fishjamId, setFishjamId] = useState<string>(DEFAULT_FISHJAM_ID);

  return (
    <FishjamProvider fishjamId={fishjamId}>
      <BlurProvider>
        <RoomProvider>
          <AppRouter onFishjamIdChange={setFishjamId} />
        </RoomProvider>
      </BlurProvider>
    </FishjamProvider>
  );
}

export default App;
