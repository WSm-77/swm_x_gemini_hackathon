import axios from "axios";

type BasicInfo = { id: string; name: string };
type RoomManagerResponse = {
  peerToken: string;
  url: string;
  room: BasicInfo;
  peer: BasicInfo;
};

export const getRoomCredentials = async (
  roomManagerUrl: string,
  roomName: string,
  peerName: string,
  roomType: string,
) => {
  // remove duplicate get params (in case user will just copy params from UI)
  const url = new URL(roomManagerUrl)!;
  url.searchParams.set("roomName", roomName);
  url.searchParams.set("peerName", peerName);
  url.searchParams.set("roomType", roomType);

  const res = await axios.get<RoomManagerResponse>(url.toString());

  return res.data;
};

export const deleteRoom = async (
  fishjamUrl: string,
  roomName: string,
  adminToken: string,
) => {
  try {
    const deleteUrl = new URL(fishjamUrl);
    deleteUrl.pathname = `/api/rooms/${roomName}`;

    await axios.delete(deleteUrl.toString(), {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
  } catch (error) {
    console.error("Failed to delete room:", error);
    // Don't throw - room deletion failure shouldn't crash the app
  }
};
