import { handleRealtimeSession } from "../../server/realtimeSession.ts";

export default async (request: Request) => handleRealtimeSession(request);
