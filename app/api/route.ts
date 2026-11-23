// GET /api lists every endpoint, so a person or an AI can see what the dashboard can answer.
import { NextResponse } from "next/server";
import { ENDPOINTS } from "@/lib/api";

import { requireWorkOSLauncher } from "@/lib/workos/launcher-only";
export const dynamic = "force-dynamic";
export function GET() {
  if (process.env.WORKOS_LOCAL_CLIENT === "1") return requireWorkOSLauncher();
  return NextResponse.json({ name: "AI-Dashboard", note: "Every page has its own endpoint. All are read from this computer only.", endpoints: ENDPOINTS.map(([path, about]) => ({ path: "/api/" + path, about })) });
}
