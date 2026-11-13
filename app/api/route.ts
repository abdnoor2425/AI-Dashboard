// GET /api lists every endpoint, so a person or an AI can see what the dashboard can answer.
import { NextResponse } from "next/server";
import { ENDPOINTS } from "@/lib/api";

export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json({ name: "Keystone", note: "Every page has its own endpoint. All are read from this laptop only.", endpoints: ENDPOINTS.map(([path, about]) => ({ path: "/api/" + path, about })) });
}
