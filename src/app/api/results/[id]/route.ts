import { NextResponse } from "next/server";

import { getResultById } from "@/lib/results-store";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const record = await getResultById(params.id);

  if (!record) {
    return NextResponse.json({ error: "Result not found" }, { status: 404 });
  }

  return NextResponse.json({ record });
}
