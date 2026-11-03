// RelayDaemon runs character and scan-code endpoints on the same origin.
// Reuse the verified request/body/signature adapter but expose ONLY these routes.
import { handleApiRequest } from "../../../netlify/functions/api.mjs";

export default handleApiRequest;
export const config = { path: ["/api/character", "/api/scan-code"] };
