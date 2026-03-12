import { NextResponse } from "next/server";

import { isKnownSwedishParty, normalizeLanguage, normalizeMode } from "@/lib/polcomp";
import { createStoredResult, getAllResults, getCohortSummary } from "@/lib/results-store";

export const runtime = "nodejs";

function stripLLMFromRecord<T extends { analysis: Record<string, unknown> }>(record: T): T {
  const { llmProfile, ...analysisWithoutLLM } = record.analysis;
  void llmProfile;
  return {
    ...record,
    analysis: analysisWithoutLLM,
  } as T;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const full = searchParams.get("full") === "1";
  const category = searchParams.get("category") ?? undefined;
  const modeParam = searchParams.get("mode");
  const mode = modeParam ? normalizeMode(modeParam) : undefined;

  const records = await getAllResults(category, mode);
  const cohort = await getCohortSummary(category, mode);

  if (full) {
    return NextResponse.json({ records: records.map(stripLLMFromRecord), cohort });
  }

  return NextResponse.json({
    records: records.map((record) => ({
      id: record.id,
      createdAt: record.createdAt,
      analysis: stripLLMFromRecord(record).analysis,
    })),
    cohort,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    answers?: Record<string, number | string>;
    utmSource?: string;
    mode?: string;
    language?: string;
    respondentName?: string;
    selectedParty?: string;
    initialPosition?: { econ?: number; social?: number };
  };

  if (!body.answers || typeof body.answers !== "object") {
    return NextResponse.json({ error: "Missing answers payload" }, { status: 400 });
  }

  if (!body.selectedParty || !isKnownSwedishParty(body.selectedParty)) {
    return NextResponse.json({ error: "Missing or invalid selectedParty" }, { status: 400 });
  }

  const created = await createStoredResult(body.answers, {
    category: body.utmSource,
    mode: normalizeMode(body.mode),
    language: normalizeLanguage(body.language),
    respondentName: body.respondentName,
    selectedParty: body.selectedParty,
    initialPosition:
      typeof body.initialPosition?.econ === "number" && typeof body.initialPosition?.social === "number"
        ? { econ: body.initialPosition.econ, social: body.initialPosition.social }
        : null,
  });

  return NextResponse.json(
    {
      ...created,
      record: stripLLMFromRecord(created.record),
    },
    { status: 201 },
  );
}
