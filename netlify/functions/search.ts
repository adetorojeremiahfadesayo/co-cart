import { handleLiveSearch } from "../../server/liveSearch.ts";

export default async (request: Request) => handleLiveSearch(request);
