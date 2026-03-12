import { NextResponse } from "next/server";

import { getResultById, updateStoredResultLLMProfile } from "@/lib/results-store";

export const runtime = "nodejs";

function stripLLMProfile(record: Awaited<ReturnType<typeof getResultById>>) {
  if (!record) {
    return record;
  }

  const { llmProfile, ...analysisWithoutLLM } = record.analysis;
  void llmProfile;
  return {
    ...record,
    analysis: analysisWithoutLLM,
  };
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const record = await getResultById(params.id);

  if (!record) {
    return NextResponse.json({ error: "Result not found" }, { status: 404 });
  }

  return NextResponse.json({ record: stripLLMProfile(record) });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const body = (await request.json()) as {
    llmProfile?: unknown;
    llmOutputText?: string;
  };

  let payload: unknown = body.llmProfile;
  if (!payload && typeof body.llmOutputText === "string") {
    try {
      payload = JSON.parse(body.llmOutputText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON string in llmOutputText" }, { status: 400 });
    }
  }

  if (!payload) {
    return NextResponse.json({ error: "Missing llmProfile payload" }, { status: 400 });
  }

  try {
    const updated = await updateStoredResultLLMProfile(params.id, payload);
    if (!updated) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }
    return NextResponse.json({ record: stripLLMProfile(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update LLM profile";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
