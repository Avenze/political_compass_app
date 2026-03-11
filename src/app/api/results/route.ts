import { NextResponse } from "next/server";

import { normalizeMode } from "@/lib/polcomp";
import { createStoredResult, getAllResults, getCohortSummary } from "@/lib/results-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const full = searchParams.get("full") === "1";
  const category = searchParams.get("category") ?? undefined;
  const modeParam = searchParams.get("mode");
  const mode = modeParam ? normalizeMode(modeParam) : undefined;

  const records = await getAllResults(category, mode);
  const cohort = await getCohortSummary(category, mode);

  if (full) {
    return NextResponse.json({ records, cohort });
  }

  return NextResponse.json({
    records: records.map((record) => ({
      id: record.id,
      createdAt: record.createdAt,
      analysis: record.analysis,
    })),
    cohort,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    answers?: Record<string, number>;
    utmSource?: string;
    mode?: string;
    respondentName?: string;
    guess?: { econ?: number; social?: number };
  };

  if (!body.answers || typeof body.answers !== "object") {
    return NextResponse.json({ error: "Missing answers payload" }, { status: 400 });
  }

  const created = await createStoredResult(body.answers, {
    category: body.utmSource,
    mode: normalizeMode(body.mode),
    respondentName: body.respondentName,
    guess:
      typeof body.guess?.econ === "number" && typeof body.guess?.social === "number"
        ? { econ: body.guess.econ, social: body.guess.social }
        : null,
  });

  return NextResponse.json(created, { status: 201 });
}
