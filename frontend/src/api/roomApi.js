const BASE_URL = (process.env.REACT_APP_SERVER_URL || "http://localhost:5001");

export const getRooms = async () => {
  const res = await fetch(`${BASE_URL}/api/rooms`);
  return res.json();
};

export const getSingleRoom = async (id) => {
  const res = await fetch(`${BASE_URL}/api/rooms/${id}`);
  return res.json();
};