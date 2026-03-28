import {
  type AgentCallbacks,
  FishjamClient,
  type PeerOptions,
  RoomId,
} from "@fishjam-cloud/js-server-sdk";


console.log("Clearing Fishjam rooms...", Bun.env.FISHJAM_ID, Bun.env.FISHJAM_MANAGEMENT_TOKEN);

const fishjamClient = new FishjamClient({
  fishjamId: Bun.env.FISHJAM_ID,
  managementToken: Bun.env.FISHJAM_MANAGEMENT_TOKEN,
});

const rooms = await fishjamClient.getAllRooms()

for (const room of rooms) {
  await fishjamClient.deleteRoom(room.id);
}