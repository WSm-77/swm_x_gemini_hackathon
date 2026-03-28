import {
  useCamera,
  useConnection,
  useMicrophone,
  useScreenShare,
} from "@fishjam-cloud/react-client";
import {
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  PhoneOff,
  Settings,
  Video,
  VideoOff,
} from "lucide-react";

import { SettingsSheet } from "./SettingsSheet";
import { Button } from "./ui/button";

export const CallToolbar = () => {
  const { leaveRoom } = useConnection();

  const {
    startStreaming,
    stream: screenStream,
    stopStreaming,
  } = useScreenShare();

  const { toggleCamera, isCameraOn } = useCamera();

  const {
    toggleMicrophoneMute,
    isMicrophoneMuted,
    toggleMicrophone,
    isMicrophoneOn,
  } = useMicrophone();

  const toggleMicrophoneState = () => {
    if (isMicrophoneOn) {
      toggleMicrophoneMute();
    } else {
      toggleMicrophone();
    }
  };

  const onHangUp = async () => {
    leaveRoom();
  };

  const MicIcon = !isMicrophoneMuted ? Mic : MicOff;
  // CameraIcon: pokazuje VideoOff tylko gdy kamera jest wyłączona
  const CameraIcon = isCameraOn ? Video : VideoOff;
  const ScreenshareIcon = screenStream ? MonitorOff : MonitorUp;

  const toggleScreenShare = async () => {
    if (screenStream) return stopStreaming();
    try {
      await startStreaming();
    } catch (error) {
      if (error instanceof Error && error.name === "NotAllowedError") return;
      console.error(error);
    }
  };

  const controlClass =
    "h-11 w-11 rounded-full border border-[#48474c]/50 bg-[#25252b]/80 text-[#fcf8fe] shadow-none hover:bg-[#2c2b32]";

  const activeControlClass =
    "h-11 w-11 rounded-full border border-[#a8a4ff]/45 bg-[#3e1bff]/35 text-[#fcf8fe] shadow-none hover:bg-[#3e1bff]/55";

  return (
    <footer className="pointer-events-none fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-[#48474c]/45 bg-[#131317]/75 px-3 py-2 backdrop-blur-2xl">
        <SettingsSheet>
          <Button className={controlClass} variant="ghost" asChild>
            <div>
              <Settings size={20} strokeWidth={"1.5px"} />
            </div>
          </Button>
        </SettingsSheet>

        <Button
          className={!isMicrophoneMuted && isMicrophoneOn ? activeControlClass : controlClass}
          variant="ghost"
          onClick={toggleMicrophoneState}
        >
          <MicIcon size={20} strokeWidth={"1.5px"} />
        </Button>

        <Button
          className={isCameraOn ? activeControlClass : controlClass}
          variant="ghost"
          onClick={toggleCamera}
        >
          <CameraIcon size={20} strokeWidth={"1.5px"} />
        </Button>

        <Button
          className={screenStream ? activeControlClass : controlClass}
          variant="ghost"
          onClick={toggleScreenShare}
        >
          <ScreenshareIcon size={20} strokeWidth={"1.5px"} />
        </Button>

        <Button
          className="h-11 gap-2 rounded-full bg-[#ff6e84] px-4 text-xs font-semibold text-[#490013] hover:bg-[#ff8396]"
          variant="ghost"
          onClick={onHangUp}
        >
          <PhoneOff size={18} strokeWidth={"1.75px"} />
          <span>Leave</span>
        </Button>
      </div>
    </footer>
  );
};
