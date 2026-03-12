import Link from "next/link";

import { LLMProfileAdmin } from "@/components/llm-profile-admin";
import { LogoutButton } from "@/components/logout-button";
import { requireUser } from "@/lib/auth";
import { computeAnalysis, getQuestions, getSwedishParties } from "@/lib/polcomp";
import { getAllResults, getCohortSummary } from "@/lib/results-store";

function fmt(value: number, digits = 2) {
  return value.toFixed(digits);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function avg(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function compassBinIndex(value: number, bins = 20) {
  return clamp(Math.floor(((value + 10) / 20) * bins), 0, bins - 1);
}

function heatColor(intensity: number) {
  const t = clamp(intensity, 0, 1);
  const r = Math.round(252 - (1 - t) * 90);
  const g = Math.round(235 - t * 160);
  const b = Math.round(100 + t * 110);
  return `rgb(${r}, ${g}, ${b})`;
}

function toSvgX(econ: number) {
  return ((econ + 10) / 20) * 220;
}

function toSvgY(social: number) {
  return ((10 - social) / 20) * 220;
}

function CompassCornerSigns() {
  return (
    <g className="pointer-events-none select-none" fill="#334155" fontSize="8" fontFamily="monospace">
      <text x="4" y="10">(n,p)</text>
      <text x="188" y="10">(p,p)</text>
      <text x="4" y="216">(n,n)</text>
      <text x="188" y="216">(p,n)</text>
    </g>
  );
}

function buildLLMAdminPrompt(record: Awaited<ReturnType<typeof getAllResults>>[number]) {
  const analysis = record.analysis.responsePoints ? record.analysis : computeAnalysis(record.answers, "advanced");
  const questions = getQuestions();
  const outputContract = {
    respondent_summary: {
      profile_name: "string",
      confidence_level: "low|medium|high",
      core_identity: "string",
      economic_position: "left|center-left|center|center-right|right",
      social_position: "libertarian|mixed|authoritarian",
    },
    axis_scores: {
      econ: "number(-10..10)",
      social: "number(-10..10)",
      extremity_pct: "number(0..100)",
      coherence_pct: "number(0..100)",
      conviction_pct: "number(0..100)",
    },
    dominant_patterns: [
      {
        pattern: "string",
        evidence_question_ids: ["string"],
        interpretation: "string",
      },
    ],
    tensions_and_contradictions: [
      {
        tension: "string",
        question_pair: ["string", "string"],
        severity: "low|medium|high",
      },
    ],
    policy_priorities_inferred: [
      {
        priority: "string",
        direction: "expand|reform|reduce",
        confidence: "number(0..1)",
      },
    ],
    communication_strategy: {
      framing_style: "string",
      messages_to_avoid: ["string"],
      likely_resonant_themes: ["string"],
    },
    machine_checks: {
      used_all_questions: true,
      hallucination_free: true,
      language_neutrality_observed: true,
    },
  };

  const rawPayload = {
    record: {
      id: record.id,
      createdAt: record.createdAt,
      respondentName: record.respondentName,
      language: record.language,
      category: record.category,
      selectedParty: record.selectedParty,
      initialPosition: {
        econ: record.initialEcon,
        social: record.initialSocial,
      },
    },
    computedAnalysis: {
      econ: analysis.econ,
      social: analysis.social,
      intensityPct: analysis.intensityPct,
      extremityPct: analysis.extremityPct,
      entropyPct: analysis.entropyPct,
      coherenceOverall: analysis.coherenceOverall,
      convictionIndex: analysis.convictionIndex,
      predictabilityIndex: analysis.predictabilityIndex,
      responseSkew: analysis.responseSkew,
      responseKurtosis: analysis.responseKurtosis,
      categoryScores: analysis.categoryScores,
      categoryIntensities: analysis.categoryIntensities,
    },
    questionResponses: analysis.responsePoints.map((point) => ({
      questionId: point.questionId,
      questionEn: point.text.en,
      questionSv: point.text.sv,
      answerEn: point.answer.en,
      answerSv: point.answer.sv,
      category: point.category,
      kind: point.kind,
      numericValue: point.numericValue,
      econContribution: point.econContribution,
      socialContribution: point.socialContribution,
    })),
    questionnaireMetadata: {
      count: questions.length,
      languageParity: "Questions are semantically equivalent in EN and SV.",
    },
  };

  return [
    "You are a political-profile analysis engine.",
    "Use ONLY the provided raw data. Do not invent data. Do not omit any question.",
    "Derive your own axis score independently from computedAnalysis values; do not copy econ/social from computedAnalysis.",
    "Condense profile_name into one of these canonical buckets: Välfärdsprogressiv, Marknadsliberal, Ordningskonservativ, Grön reformist, Socialliberal, Nationell konservativ, Pragmatisk mitten, Demokratisk decentralist.",
    "Return STRICT JSON only. No markdown. No explanation outside JSON.",
    "If uncertain, lower confidence but still return valid JSON with all keys.",
    "",
    "RAW_INPUT_JSON:",
    JSON.stringify(rawPayload, null, 2),
    "",
    "REQUIRED_OUTPUT_SCHEMA:",
    JSON.stringify(outputContract, null, 2),
    "",
    "VALIDATION_RULES:",
    "1) Must include all top-level keys exactly as schema.",
    "2) Must include at least 5 dominant_patterns.",
    "3) Must include at least 3 tensions_and_contradictions.",
    "4) policy_priorities_inferred must include at least 6 items.",
    "5) machine_checks flags must all be true.",
    "6) axis_scores.econ and axis_scores.social must be meaningfully independent and within [-10,10].",
    "7) profile_name must be one canonical bucket exactly.",
  ].join("\n");
}

type StatsPageProps = {
  searchParams?: Promise<{ category?: string; selected?: string }>;
};

export default async function StatsPage({ searchParams }: StatsPageProps) {
  const user = await requireUser();
  const resolvedSearchParams = (await searchParams) ?? {};
  const selectedCategory = resolvedSearchParams.category?.trim() || "";
  const selectedRecordId = resolvedSearchParams.selected?.trim() || "";

  const allRecords = await getAllResults(selectedCategory || undefined, "advanced");
  const cohort = await getCohortSummary(selectedCategory || undefined, "advanced");
  const categoryCounts = allRecords.reduce<Record<string, number>>((acc, record) => {
    acc[record.category] = (acc[record.category] ?? 0) + 1;
    return acc;
  }, {});
  const categories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);

  const partyNameById = new Map(getSwedishParties().map((party) => [party.id, party.text.sv]));
  const partyCounts = allRecords.reduce<Record<string, number>>((acc, record) => {
    acc[record.selectedParty] = (acc[record.selectedParty] ?? 0) + 1;
    return acc;
  }, {});
  const topPartySelections = Object.entries(partyCounts).sort((a, b) => b[1] - a[1]);

  const initializedRecords = allRecords.filter((record) => typeof record.initialEcon === "number" && typeof record.initialSocial === "number");
  const avgInitialError =
    initializedRecords.length === 0
      ? 0
      : initializedRecords.reduce((acc, record) => {
          const dx = record.analysis.econ - (record.initialEcon ?? 0);
          const dy = record.analysis.social - (record.initialSocial ?? 0);
          return acc + Math.sqrt(dx * dx + dy * dy);
        }, 0) / initializedRecords.length;

  const statementByStd = cohort.statementStdDev.slice().sort((a, b) => b.stdDev - a.stdDev);
  const topContested = statementByStd.slice(0, 12).map((item) => {
    const avg = cohort.statementAverages.find((entry) => entry.id === item.id)?.avg ?? 0;
    const text = cohort.statementAverages.find((entry) => entry.id === item.id)?.text ?? item.id;
    return { id: item.id, text, stdDev: item.stdDev, avg };
  });

  const strongestAgreement = cohort.statementAverages.slice().sort((a, b) => b.avg - a.avg).slice(0, 10);
  const strongestDisagreement = cohort.statementAverages.slice().sort((a, b) => a.avg - b.avg).slice(0, 10);

  const selectedRecord = selectedRecordId ? allRecords.find((record) => record.id === selectedRecordId) ?? null : allRecords[allRecords.length - 1] ?? null;
  const llmPrompt = selectedRecord ? buildLLMAdminPrompt(selectedRecord) : "";
  const llmRecords = allRecords.filter((record) => record.analysis.llmProfile);
  const llmProfileCounts = llmRecords.reduce<Record<string, number>>((acc, record) => {
    const name = record.analysis.llmProfile?.respondent_summary.profile_name || "Unknown";
    acc[name] = (acc[name] ?? 0) + 1;
    return acc;
  }, {});
  const topLLMProfiles = Object.entries(llmProfileCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const llmPatternCounts = llmRecords
    .flatMap((record) => record.analysis.llmProfile?.dominant_patterns ?? [])
    .reduce<Record<string, number>>((acc, item) => {
      const key = item.pattern.trim();
      if (!key) {
        return acc;
      }
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  const topPatterns = Object.entries(llmPatternCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  const llmTensionCounts = llmRecords
    .flatMap((record) => record.analysis.llmProfile?.tensions_and_contradictions ?? [])
    .reduce<Record<string, { count: number; weighted: number }>>((acc, item) => {
      const key = item.tension.trim();
      if (!key) {
        return acc;
      }
      const weight = item.severity === "high" ? 3 : item.severity === "medium" ? 2 : 1;
      const current = acc[key] ?? { count: 0, weighted: 0 };
      acc[key] = { count: current.count + 1, weighted: current.weighted + weight };
      return acc;
    }, {});
  const topTensions = Object.entries(llmTensionCounts)
    .sort((a, b) => b[1].weighted - a[1].weighted)
    .slice(0, 12);

  const llmPriorityCounts = llmRecords
    .flatMap((record) => record.analysis.llmProfile?.policy_priorities_inferred ?? [])
    .reduce<Record<string, { count: number; confidence: number; expand: number; reform: number; reduce: number }>>((acc, item) => {
      const key = item.priority.trim();
      if (!key) {
        return acc;
      }
      const current = acc[key] ?? { count: 0, confidence: 0, expand: 0, reform: 0, reduce: 0 };
      current.count += 1;
      current.confidence += item.confidence;
      current[item.direction] += 1;
      acc[key] = current;
      return acc;
    }, {});
  const topPriorities = Object.entries(llmPriorityCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 12);

  const partyPointMap = allRecords.reduce<
    Record<string, Array<{ econ: number; social: number; guessEcon: number | null; guessSocial: number | null }>>
  >((acc, record) => {
    if (!acc[record.selectedParty]) {
      acc[record.selectedParty] = [];
    }
    acc[record.selectedParty].push({
      econ: record.analysis.econ,
      social: record.analysis.social,
      guessEcon: record.initialEcon,
      guessSocial: record.initialSocial,
    });
    return acc;
  }, {});

  const partyCentroids = Object.entries(partyPointMap)
    .map(([partyId, points]) => ({
      partyId,
      count: points.length,
      econ: avg(points.map((point) => point.econ)),
      social: avg(points.map((point) => point.social)),
      guessEcon: avg(points.map((point) => (typeof point.guessEcon === "number" ? point.guessEcon : 0))),
      guessSocial: avg(points.map((point) => (typeof point.guessSocial === "number" ? point.guessSocial : 0))),
      guessedCount: points.filter((point) => typeof point.guessEcon === "number" && typeof point.guessSocial === "number").length,
    }))
    .sort((a, b) => b.count - a.count);

  const heatmapBins = 20;
  const partyHeatmap = Array.from({ length: heatmapBins * heatmapBins }, () => 0);
  for (const record of allRecords) {
    const x = compassBinIndex(record.analysis.econ, heatmapBins);
    const y = compassBinIndex(record.analysis.social, heatmapBins);
    partyHeatmap[y * heatmapBins + x] += 1;
  }
  const maxPartyHeat = Math.max(...partyHeatmap, 1);

  const answerHeatmap = Array.from({ length: heatmapBins * heatmapBins }, () => 0);
  for (const record of allRecords) {
    for (const point of record.analysis.responsePoints) {
      const x = compassBinIndex(point.econContribution * 2.5, heatmapBins);
      const y = compassBinIndex(point.socialContribution * 2.5, heatmapBins);
      answerHeatmap[y * heatmapBins + x] += 1;
    }
  }
  const maxAnswerHeat = Math.max(...answerHeatmap, 1);

  const guessMean = {
    econ: avg(initializedRecords.map((record) => record.initialEcon ?? 0)),
    social: avg(initializedRecords.map((record) => record.initialSocial ?? 0)),
  };
  const algorithmMean = {
    econ: avg(allRecords.map((record) => record.analysis.econ)),
    social: avg(allRecords.map((record) => record.analysis.social)),
  };
  const llmMean = {
    econ: avg(llmRecords.map((record) => record.analysis.llmProfile?.axis_scores.econ ?? 0)),
    social: avg(llmRecords.map((record) => record.analysis.llmProfile?.axis_scores.social ?? 0)),
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#e0f2fe_0%,_#f8fafc_45%,_#fef3c7_100%)] px-4 py-8 text-slate-900 sm:px-6">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 rounded-3xl border border-slate-200/70 bg-white/85 p-5 shadow-xl backdrop-blur sm:p-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Population Statistics Dashboard</h1>
            <p className="mt-1 text-sm text-slate-700">Advanced aggregate analysis across all saved 40-question results.</p>
            <p className="mt-1 text-xs text-slate-500">Signed in as {user.email}</p>
            <p className="mt-1 text-xs text-slate-500">Category: {selectedCategory || "all"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-50">
              Back to Questionnaire
            </Link>
            <LogoutButton />
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Sample Size</p><p className="text-2xl font-semibold">{cohort.sampleSize}</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Economic Mean</p><p className="text-2xl font-semibold">{fmt(cohort.econMean)}</p><p className="text-xs text-slate-600">Std: {fmt(cohort.econStd)}</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Authority Mean</p><p className="text-2xl font-semibold">{fmt(cohort.socialMean)}</p><p className="text-xs text-slate-600">Std: {fmt(cohort.socialStd)}</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Conviction Mean</p><p className="text-2xl font-semibold">{fmt(cohort.convictionMean)}%</p><p className="text-xs text-slate-600">Std: {fmt(cohort.convictionStd)}</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Econ/Social Corr.</p><p className="text-2xl font-semibold">{fmt(cohort.econSocialCorrelation, 3)}</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Avg Initial Position Error</p><p className="text-2xl font-semibold">{fmt(avgInitialError)}</p><p className="text-xs text-slate-600">based on {initializedRecords.length} initialized profiles</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Alignment Mean</p><p className="text-2xl font-semibold">{fmt(cohort.alignmentMean)}%</p><p className="text-xs text-slate-600">Std: {fmt(cohort.alignmentStd)}</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Intensity Mean</p><p className="text-2xl font-semibold">{fmt(cohort.intensityMean)}%</p><p className="text-xs text-slate-600">Std: {fmt(cohort.intensityStd)}</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">LLM Coverage</p><p className="text-2xl font-semibold">{fmt(cohort.llmCoveragePct)}%</p><p className="text-xs text-slate-600">{cohort.llmProfilesCount} enriched profiles</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Model/Human Axis Delta</p><p className="text-2xl font-semibold">{fmt(cohort.llmAxisDeltaMean)}</p><p className="text-xs text-slate-600">Std: {fmt(cohort.llmAxisDeltaStd)}</p></article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold">How to Read the Three Axis Types</h2>
          <div className="grid gap-3 text-sm text-slate-700 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold">Guess Axis (Self-Placement)</p>
              <p>User-selected starting point before answering any questions. Captures perceived position.</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold">Algorithm Axis (Model Score)</p>
              <p>Deterministic score from weighted responses. Captures measured position from all 40 items.</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold">PolComp Axis (LLM Inference)</p>
              <p>Manual/LLM interpretive estimate from the full answer trace. Captures inferred ideological profile.</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Coordinate signs: positive econ = market-oriented, negative econ = redistribution-oriented; positive social = authority/order oriented, negative social = liberty/pluralism oriented.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xl font-semibold">Three-Axis System Comparison (Cohort Means)</h2>
            <svg viewBox="0 0 220 220" className="w-full max-w-xl rounded-lg border border-slate-300 bg-white">
              <rect x="0" y="0" width="110" height="110" fill="#fee2e2" />
              <rect x="110" y="0" width="110" height="110" fill="#ffedd5" />
              <rect x="0" y="110" width="110" height="110" fill="#dbeafe" />
              <rect x="110" y="110" width="110" height="110" fill="#dcfce7" />
              <line x1="110" y1="0" x2="110" y2="220" stroke="#0f172a" strokeWidth="1" />
              <line x1="0" y1="110" x2="220" y2="110" stroke="#0f172a" strokeWidth="1" />
              <CompassCornerSigns />
              <line x1={toSvgX(guessMean.econ)} y1={toSvgY(guessMean.social)} x2={toSvgX(algorithmMean.econ)} y2={toSvgY(algorithmMean.social)} stroke="#2563eb" strokeWidth="1.5" strokeDasharray="3 2" />
              <line x1={toSvgX(algorithmMean.econ)} y1={toSvgY(algorithmMean.social)} x2={toSvgX(llmMean.econ)} y2={toSvgY(llmMean.social)} stroke="#d946ef" strokeWidth="1.5" strokeDasharray="3 2" />
              {initializedRecords.length > 0 && <circle cx={toSvgX(guessMean.econ)} cy={toSvgY(guessMean.social)} r="6" fill="#2563eb" />}
              {allRecords.length > 0 && <circle cx={toSvgX(algorithmMean.econ)} cy={toSvgY(algorithmMean.social)} r="6" fill="#0f172a" />}
              {llmRecords.length > 0 && <circle cx={toSvgX(llmMean.econ)} cy={toSvgY(llmMean.social)} r="6" fill="#d946ef" />}
            </svg>
            <div className="mt-2 text-xs text-slate-600">
              <p>Blue: mean self-placed guess. Black: mean algorithm score. Magenta: mean PolComp (LLM) score.</p>
              <p>Dashed lines show displacement between systems.</p>
            </div>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xl font-semibold">Axis Difference Summary</h2>
            <div className="space-y-2 text-sm text-slate-700">
              <p>Mean Guess Axis: ({fmt(guessMean.econ)}, {fmt(guessMean.social)}) from {initializedRecords.length} records</p>
              <p>Mean Algorithm Axis: ({fmt(algorithmMean.econ)}, {fmt(algorithmMean.social)}) from {allRecords.length} records</p>
              <p>Mean PolComp Axis: ({fmt(llmMean.econ)}, {fmt(llmMean.social)}) from {llmRecords.length} LLM-enriched records</p>
              <p>
                Guess vs Algorithm distance: {fmt(
                  Math.sqrt((guessMean.econ - algorithmMean.econ) ** 2 + (guessMean.social - algorithmMean.social) ** 2),
                )}
              </p>
              <p>
                Algorithm vs PolComp distance: {fmt(
                  Math.sqrt((algorithmMean.econ - llmMean.econ) ** 2 + (algorithmMean.social - llmMean.social) ** 2),
                )}
              </p>
              <p>
                Guess vs PolComp distance: {fmt(
                  Math.sqrt((guessMean.econ - llmMean.econ) ** 2 + (guessMean.social - llmMean.social) ** 2),
                )}
              </p>
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold">UTM Source Categories</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            <Link href="/stats" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium transition hover:bg-slate-50">All categories</Link>
            {categories.map(([category]) => (
              <Link key={category} href={`/stats?category=${encodeURIComponent(category)}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium transition hover:bg-slate-50">
                {category}
              </Link>
            ))}
          </div>
          {categories.length === 0 && <p className="text-sm text-slate-700">No categorized records yet.</p>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold">Selected Parties</h2>
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {topPartySelections.length === 0 && <p>No saved party selections yet.</p>}
            {topPartySelections.map(([partyId, count]) => (
              <div key={partyId} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="font-medium">{partyNameById.get(partyId) ?? partyId}</p>
                <p className="text-xs text-slate-600">{count} profiles</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xl font-semibold">Quadrant Distribution</h2>
            <div className="space-y-2 text-sm">
              <p>Authoritarian Left: {cohort.quadrantCounts.authLeft}</p>
              <p>Authoritarian Right: {cohort.quadrantCounts.authRight}</p>
              <p>Libertarian Left: {cohort.quadrantCounts.libLeft}</p>
              <p>Libertarian Right: {cohort.quadrantCounts.libRight}</p>
              <p>Centrist: {cohort.quadrantCounts.centrist}</p>
            </div>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xl font-semibold">Category Means</h2>
            <div className="space-y-2 text-sm">
              <p>General: {fmt(cohort.categoryMeans.general)} (std {fmt(cohort.categoryStd.general)})</p>
              <p>Single-priority: {fmt(cohort.categoryMeans.single_priority)} (std {fmt(cohort.categoryStd.single_priority)})</p>
              <p>Left set: {fmt(cohort.categoryMeans.left_leaning)} (std {fmt(cohort.categoryStd.left_leaning)})</p>
              <p>Right set: {fmt(cohort.categoryMeans.right_leaning)} (std {fmt(cohort.categoryStd.right_leaning)})</p>
            </div>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xl font-semibold">LLM Confidence Distribution</h2>
            <div className="space-y-2 text-sm">
              <p>High: {cohort.llmConfidenceCounts.high}</p>
              <p>Medium: {cohort.llmConfidenceCounts.medium}</p>
              <p>Low: {cohort.llmConfidenceCounts.low}</p>
            </div>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xl font-semibold">Top LLM Profile Archetypes</h2>
            <ul className="space-y-2 text-sm text-slate-700">
              {topLLMProfiles.length === 0 && <li>No LLM profiles attached yet.</li>}
              {topLLMProfiles.map(([name, count]) => (
                <li key={name}>{name}: {count}</li>
              ))}
            </ul>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
            <h2 className="mb-3 text-xl font-semibold">LLM Dominant Patterns</h2>
            <ul className="space-y-2 text-sm text-slate-700">
              {topPatterns.length === 0 && <li>No LLM pattern data yet.</li>}
              {topPatterns.map(([pattern, count]) => (
                <li key={pattern}>{pattern}: {count}</li>
              ))}
            </ul>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
            <h2 className="mb-3 text-xl font-semibold">LLM Tensions and Contradictions</h2>
            <ul className="space-y-2 text-sm text-slate-700">
              {topTensions.length === 0 && <li>No LLM contradiction data yet.</li>}
              {topTensions.map(([tension, score]) => (
                <li key={tension}>{tension}: {score.count} (severity score {score.weighted})</li>
              ))}
            </ul>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
            <h2 className="mb-3 text-xl font-semibold">LLM Policy Priorities</h2>
            <ul className="space-y-2 text-sm text-slate-700">
              {topPriorities.length === 0 && <li>No LLM policy-priority data yet.</li>}
              {topPriorities.map(([priority, meta]) => (
                <li key={priority}>
                  {priority}: {meta.count} (avg conf {fmt(meta.confidence / Math.max(meta.count, 1), 2)}; expand {meta.expand}, reform {meta.reform}, reduce {meta.reduce})
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xl font-semibold">Party Respondent Compass Heatmap</h2>
            <svg viewBox="0 0 220 220" className="w-full max-w-xl rounded-lg border border-slate-300 bg-white">
              {Array.from({ length: heatmapBins }).map((_, row) =>
                Array.from({ length: heatmapBins }).map((__, col) => {
                  const index = row * heatmapBins + col;
                  const intensity = partyHeatmap[index] / maxPartyHeat;
                  return (
                    <rect
                      key={`party-cell-${row}-${col}`}
                      x={(col * 220) / heatmapBins}
                      y={(row * 220) / heatmapBins}
                      width={220 / heatmapBins}
                      height={220 / heatmapBins}
                      fill={heatColor(intensity)}
                      opacity={0.85}
                    />
                  );
                }),
              )}
              <line x1="110" y1="0" x2="110" y2="220" stroke="#0f172a" strokeWidth="1" />
              <line x1="0" y1="110" x2="220" y2="110" stroke="#0f172a" strokeWidth="1" />
              <CompassCornerSigns />
              {partyCentroids.slice(0, 15).map((party) => (
                <g key={`centroid-${party.partyId}`}>
                  <circle cx={toSvgX(party.econ)} cy={toSvgY(party.social)} r={Math.max(3, Math.min(10, party.count / 3))} fill="#0f172a" fillOpacity="0.75" />
                  <title>{`${partyNameById.get(party.partyId) ?? party.partyId}: n=${party.count}, econ=${party.econ.toFixed(2)}, social=${party.social.toFixed(2)}`}</title>
                </g>
              ))}
            </svg>
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              <p>What this is based on: one point per respondent, using final algorithm axis (econ/social).</p>
              <p>Cell color = local density (warmer = more respondents). Dark circles = party mean positions (top 15 by sample size).</p>
              <p>Use this map to compare where party supporters cluster and where parties overlap.</p>
            </div>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xl font-semibold">All Answers Contribution Heatmap</h2>
            <svg viewBox="0 0 220 220" className="w-full max-w-xl rounded-lg border border-slate-300 bg-white">
              {Array.from({ length: heatmapBins }).map((_, row) =>
                Array.from({ length: heatmapBins }).map((__, col) => {
                  const index = row * heatmapBins + col;
                  const intensity = answerHeatmap[index] / maxAnswerHeat;
                  return (
                    <rect
                      key={`answer-cell-${row}-${col}`}
                      x={(col * 220) / heatmapBins}
                      y={(row * 220) / heatmapBins}
                      width={220 / heatmapBins}
                      height={220 / heatmapBins}
                      fill={heatColor(intensity)}
                      opacity={0.85}
                    />
                  );
                }),
              )}
              <line x1="110" y1="0" x2="110" y2="220" stroke="#0f172a" strokeWidth="1" />
              <line x1="0" y1="110" x2="220" y2="110" stroke="#0f172a" strokeWidth="1" />
              <CompassCornerSigns />
            </svg>
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              <p>What this is based on: every single answer contribution from every respondent (not just final profile points).</p>
              <p>Each answer contributes a local econ/social vector; bins show where response forces accumulate across the cohort.</p>
              <p>Use this map to identify which ideological directions are most frequently reinforced by specific answers.</p>
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold">Party Compass Midpoints</h2>
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {partyCentroids.length === 0 && <p>No party response centroids yet.</p>}
            {partyCentroids.map((party) => (
              <div key={party.partyId} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-medium">{partyNameById.get(party.partyId) ?? party.partyId}</p>
                <p className="text-xs text-slate-600">Respondents: {party.count}</p>
                <p className="text-xs text-slate-600">Algorithm midpoint: ({fmt(party.econ)}, {fmt(party.social)})</p>
                <p className="text-xs text-slate-600">
                  Guess midpoint: {party.guessedCount > 0 ? `(${fmt(party.guessEcon)}, ${fmt(party.guessSocial)})` : "no guesses"}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
            <h2 className="mb-3 text-xl font-semibold">Strongest Mean Agreements</h2>
            <ul className="space-y-2 text-sm text-slate-700">
              {strongestAgreement.map((item) => (
                <li key={item.id}><span className="font-medium">{item.id}</span> ({fmt(item.avg)}): {item.text}</li>
              ))}
            </ul>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
            <h2 className="mb-3 text-xl font-semibold">Strongest Mean Disagreements</h2>
            <ul className="space-y-2 text-sm text-slate-700">
              {strongestDisagreement.map((item) => (
                <li key={item.id}><span className="font-medium">{item.id}</span> ({fmt(item.avg)}): {item.text}</li>
              ))}
            </ul>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
            <h2 className="mb-3 text-xl font-semibold">Most Contested Statements</h2>
            <ul className="space-y-2 text-sm text-slate-700">
              {topContested.map((item) => (
                <li key={item.id}><span className="font-medium">{item.id}</span> (std {fmt(item.stdDev)}; avg {fmt(item.avg)}): {item.text}</li>
              ))}
            </ul>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold">Saved Results and AI Prompt Generator</h2>
          {allRecords.length === 0 && <p className="text-sm text-slate-700">No saved profiles yet.</p>}
          {allRecords.length > 0 && (
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {allRecords
                .slice()
                .reverse()
                .map((record) => (
                  <Link
                    key={record.id}
                    href={`/stats${selectedCategory ? `?category=${encodeURIComponent(selectedCategory)}&selected=${encodeURIComponent(record.id)}` : `?selected=${encodeURIComponent(record.id)}`}`}
                    className={`rounded-lg border p-3 ${selectedRecord?.id === record.id ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-slate-50"}`}
                  >
                    <p className="font-medium">{record.respondentName}</p>
                    <p className="font-mono text-xs break-all">{record.id}</p>
                    <p className="text-xs text-slate-600">{new Date(record.createdAt).toLocaleString()}</p>
                    <p className="text-xs text-slate-600">Language: {record.language}</p>
                    <p className="text-xs text-slate-600">Party: {partyNameById.get(record.selectedParty) ?? record.selectedParty}</p>
                    <p className="text-xs text-slate-600">
                      Initial: {typeof record.initialEcon === "number" && typeof record.initialSocial === "number" ? `(${record.initialEcon.toFixed(2)}, ${record.initialSocial.toFixed(2)})` : "none"}
                    </p>
                    <p className="text-xs text-slate-600">Axes: ({record.analysis.econ.toFixed(2)}, {record.analysis.social.toFixed(2)})</p>
                  </Link>
                ))}
            </div>
          )}

          {selectedRecord && (
            <div className="mt-5 rounded-xl border border-slate-300 bg-slate-50 p-4">
              <p className="mb-2 text-sm font-semibold">AI prompt package for {selectedRecord.respondentName}</p>
              <p className="mb-3 text-xs text-slate-600">Contains raw question/answer data, computed metrics, and strict JSON output schema for external LLM profiling.</p>
              <textarea
                readOnly
                value={llmPrompt}
                className="h-96 w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs"
              />

              <LLMProfileAdmin
                recordId={selectedRecord.id}
                existingProfile={selectedRecord.analysis.llmProfile}
              />

              {selectedRecord.analysis.llmProfile && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                  <p className="font-semibold">Attached LLM profile snapshot</p>
                  <p className="text-xs text-slate-600">{selectedRecord.analysis.llmProfile.respondent_summary.profile_name}</p>
                  <p className="text-xs text-slate-600">Confidence: {selectedRecord.analysis.llmProfile.respondent_summary.confidence_level}</p>
                  <p className="text-xs text-slate-600">LLM axis: ({fmt(selectedRecord.analysis.llmProfile.axis_scores.econ)}, {fmt(selectedRecord.analysis.llmProfile.axis_scores.social)})</p>
                  <p className="text-xs text-slate-600">Top priorities inferred: {selectedRecord.analysis.llmProfile.policy_priorities_inferred.length}</p>

                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-700">Three-point axis comparison</p>
                    <svg viewBox="0 0 220 220" className="mt-2 w-full rounded border border-slate-300 bg-white">
                      <rect x="0" y="0" width="110" height="110" fill="#fee2e2" />
                      <rect x="110" y="0" width="110" height="110" fill="#ffedd5" />
                      <rect x="0" y="110" width="110" height="110" fill="#dbeafe" />
                      <rect x="110" y="110" width="110" height="110" fill="#dcfce7" />
                      <line x1="110" y1="0" x2="110" y2="220" stroke="#0f172a" strokeWidth="1" />
                      <line x1="0" y1="110" x2="220" y2="110" stroke="#0f172a" strokeWidth="1" />
                      <CompassCornerSigns />
                      {typeof selectedRecord.initialEcon === "number" && typeof selectedRecord.initialSocial === "number" && (
                        <circle cx={toSvgX(selectedRecord.initialEcon)} cy={toSvgY(selectedRecord.initialSocial)} r="6" fill="#2563eb" />
                      )}
                      <circle cx={toSvgX(selectedRecord.analysis.econ)} cy={toSvgY(selectedRecord.analysis.social)} r="6" fill="#0f172a" />
                      <circle
                        cx={toSvgX(selectedRecord.analysis.llmProfile.axis_scores.econ)}
                        cy={toSvgY(selectedRecord.analysis.llmProfile.axis_scores.social)}
                        r="6"
                        fill="#d946ef"
                      />
                    </svg>
                    <p className="mt-2 text-xs text-slate-600">Blue: guessed position, black: algorithm axis, magenta: LLM axis.</p>
                    <p className="text-xs text-slate-600">This per-user map compares perceived position, measured model result, and interpretive PolComp/LLM estimate.</p>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-3">
                    <div className="rounded border border-slate-200 p-2">
                      <p className="text-xs font-semibold">Dominant patterns</p>
                      <ul className="mt-1 space-y-1 text-xs text-slate-600">
                        {selectedRecord.analysis.llmProfile.dominant_patterns.map((item, index) => (
                          <li key={`${item.pattern}-${index}`}>{item.pattern}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded border border-slate-200 p-2">
                      <p className="text-xs font-semibold">Tensions</p>
                      <ul className="mt-1 space-y-1 text-xs text-slate-600">
                        {selectedRecord.analysis.llmProfile.tensions_and_contradictions.map((item, index) => (
                          <li key={`${item.tension}-${index}`}>{item.tension} ({item.severity})</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded border border-slate-200 p-2">
                      <p className="text-xs font-semibold">Policy priorities</p>
                      <ul className="mt-1 space-y-1 text-xs text-slate-600">
                        {selectedRecord.analysis.llmProfile.policy_priorities_inferred.map((item, index) => (
                          <li key={`${item.priority}-${index}`}>{item.priority} ({item.direction}, {fmt(item.confidence, 2)})</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}