"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type MouseEvent, useEffect, useMemo, useState } from "react";

import {
  type Analysis,
  type AnswerMap,
  type AnswerValue,
  type ComparativeMetrics,
  type QuestionnaireMode,
  buildNarrative,
  computeAnalysis,
  getStatements,
  normalizeMode,
} from "@/lib/polcomp";
import { pingAppwrite } from "@/lib/appwrite";

type ScaleOption = {
  label: string;
  value: AnswerValue;
};

const SCALE: ScaleOption[] = [
  { label: "Strongly Disagree", value: -2 },
  { label: "Disagree", value: -1 },
  { label: "Neutral", value: 0 },
  { label: "Agree", value: 1 },
  { label: "Strongly Agree", value: 2 },
];

type SaveResponse = {
  record: {
    id: string;
    createdAt: string;
    answers: AnswerMap;
    analysis: Analysis;
    mode: QuestionnaireMode;
    respondentName: string;
    guessEcon: number | null;
    guessSocial: number | null;
  };
  comparative: ComparativeMetrics;
};

type GuessPoint = {
  econ: number;
  social: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function colorForValue(value: AnswerValue | undefined): string {
  if (value === undefined) {
    return "#eceff5";
  }
  if (value === 0) {
    return "#d8dde7";
  }
  if (value > 0) {
    return value === 2 ? "#e63946" : "#f28482";
  }
  return value === -2 ? "#1d3557" : "#457b9d";
}

function scoreColor(value: number): string {
  const normalized = clamp((value + 2) / 4, 0, 1);
  const red = Math.round(255 * normalized);
  const blue = Math.round(255 * (1 - normalized));
  return `rgb(${red}, 90, ${blue})`;
}

function gridColsClass(count: number) {
  if (count <= 4) {
    return "grid-cols-4";
  }
  if (count <= 6) {
    return "grid-cols-6";
  }
  if (count <= 8) {
    return "grid-cols-8";
  }
  if (count <= 10) {
    return "grid-cols-10";
  }
  return "grid-cols-12";
}

export default function Home() {
  const searchParams = useSearchParams();
  const initialMode = normalizeMode(searchParams.get("mode") ?? undefined);
  const [mode, setMode] = useState<QuestionnaireMode>(initialMode);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingById, setLoadingById] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadId, setLoadId] = useState("");
  const [savedResultId, setSavedResultId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [respondentName, setRespondentName] = useState("");
  const [guess, setGuess] = useState<GuessPoint | null>(null);
  const [comparative, setComparative] = useState<ComparativeMetrics | null>(null);
  const utmSource = searchParams.get("utm_source")?.trim() || "direct";
  const statements = useMemo(() => getStatements(mode), [mode]);

  useEffect(() => {
    pingAppwrite().catch(() => {
      // Keep the UX uninterrupted even if ping fails.
    });
  }, []);

  const current = statements[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === statements.length;

  const analysis = useMemo(() => computeAnalysis(answers, mode), [answers, mode]);

  const narrative = useMemo(() => buildNarrative(analysis, comparative ?? undefined), [analysis, comparative]);

  const avgByStatement = useMemo(() => {
    return statements.map((statement) => ({
      ...statement,
      value: answers[statement.id] ?? 0,
    }));
  }, [answers, statements]);
  const maxCol = useMemo(() => statements.reduce((acc, statement) => Math.max(acc, statement.col), 1), [statements]);
  const guessDistance = useMemo(() => {
    if (!guess) {
      return null;
    }
    return Math.sqrt((analysis.econ - guess.econ) ** 2 + (analysis.social - guess.social) ** 2);
  }, [analysis.econ, analysis.social, guess]);

  useEffect(() => {
    setAnswers({});
    setCurrentIndex(0);
    setFinished(false);
    setComparative(null);
    setSavedResultId(null);
    setSavedAt(null);
    setRespondentName("");
    setGuess(null);
    setError(null);
  }, [mode]);

  useEffect(() => {
    setCurrentIndex((index) => Math.min(index, statements.length - 1));
  }, [statements.length]);

  async function saveAndFinish() {
    if (!allAnswered) {
      setError("Please answer every statement before generating your profile.");
      return;
    }

    if (!respondentName.trim()) {
      setError("Please enter a display name before saving your profile.");
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const response = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          utmSource,
          mode,
          respondentName,
          guess,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save result (${response.status})`);
      }

      const payload = (await response.json()) as SaveResponse;
      setSavedResultId(payload.record.id);
      setSavedAt(payload.record.createdAt);
      setRespondentName(payload.record.respondentName);
      setGuess(
        typeof payload.record.guessEcon === "number" && typeof payload.record.guessSocial === "number"
          ? { econ: payload.record.guessEcon, social: payload.record.guessSocial }
          : null,
      );
      setComparative(payload.comparative);
      setFinished(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save answers";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function loadById() {
    if (!loadId.trim()) {
      return;
    }

    setError(null);
    setLoadingById(true);

    try {
      const response = await fetch(`/api/results/${encodeURIComponent(loadId.trim())}`);
      if (!response.ok) {
        throw new Error("Saved result not found");
      }

      const payload = (await response.json()) as {
        record: {
          id: string;
          createdAt: string;
          answers: AnswerMap;
          analysis: Analysis;
          mode?: QuestionnaireMode;
          respondentName?: string;
          guessEcon?: number | null;
          guessSocial?: number | null;
        };
      };

      setMode(payload.record.mode ?? "advanced");
      setAnswers(payload.record.answers);
      setSavedResultId(payload.record.id);
      setSavedAt(payload.record.createdAt);
      setRespondentName(payload.record.respondentName ?? "");
      setGuess(
        typeof payload.record.guessEcon === "number" && typeof payload.record.guessSocial === "number"
          ? { econ: payload.record.guessEcon, social: payload.record.guessSocial }
          : null,
      );
      setComparative(null);
      setCurrentIndex(0);
      setFinished(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load saved result";
      setError(message);
    } finally {
      setLoadingById(false);
    }
  }

  function setGuessFromClick(event: MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    const econ = Number(((x * 20) - 10).toFixed(2));
    const social = Number((((1 - y) * 20) - 10).toFixed(2));
    setGuess({ econ, social });
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#fef3c7_0%,_#f8fafc_45%,_#e0f2fe_100%)] px-4 py-8 text-slate-900 sm:px-6">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-xl backdrop-blur sm:p-8">
        <header className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Political Compass Profiler</h1>
          <p className="max-w-3xl text-sm text-slate-700 sm:text-base">
            Choose a method, complete all statements, then generate and save your heatmap, coordinate analysis, and profile report.
          </p>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-sm font-semibold">Step 1: Place your guess on the compass</p>
            <p className="mb-3 text-xs text-slate-600">
              Click the map to predict your final position before answering questions.
            </p>
            <svg viewBox="0 0 220 220" className="w-full max-w-xs cursor-crosshair rounded-lg border border-slate-300" onClick={setGuessFromClick}>
              <rect x="0" y="0" width="110" height="110" fill="#fee2e2" />
              <rect x="110" y="0" width="110" height="110" fill="#ffedd5" />
              <rect x="0" y="110" width="110" height="110" fill="#dbeafe" />
              <rect x="110" y="110" width="110" height="110" fill="#dcfce7" />
              <line x1="110" y1="0" x2="110" y2="220" stroke="#0f172a" strokeWidth="1" />
              <line x1="0" y1="110" x2="220" y2="110" stroke="#0f172a" strokeWidth="1" />
              {guess && <circle cx={110 + guess.econ * 9} cy={110 - guess.social * 9} r="6" fill="#2563eb" />}
            </svg>
            <p className="mt-2 text-xs text-slate-600">
              {guess ? `Current guess: econ ${guess.econ.toFixed(2)}, social ${guess.social.toFixed(2)}` : "No guess yet (optional)."}
            </p>
          </div>
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("simple")}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                mode === "simple" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white hover:border-slate-500"
              }`}
            >
              <p className="text-sm font-semibold">Simple Method</p>
              <p className="text-xs opacity-90">24 broad questions, faster completion, full analysis output.</p>
            </button>
            <button
              type="button"
              onClick={() => setMode("advanced")}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                mode === "advanced" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white hover:border-slate-500"
              }`}
            >
              <p className="text-sm font-semibold">Advanced Method</p>
              <p className="text-xs opacity-90">Complete multi-item profile with simplified wording and deeper granularity.</p>
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/stats?mode=${mode}`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
              Open Population Stats
            </Link>
          </div>
          <div className="grid gap-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
            <span>
              Progress: {answeredCount}/{statements.length}
            </span>
            <span>Question {currentIndex + 1}</span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-sm font-semibold">Load a previous result</p>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={loadId}
                onChange={(event) => setLoadId(event.target.value)}
                placeholder="Paste saved result ID"
                className="min-w-[260px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={loadById}
                disabled={loadingById}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingById ? "Loading..." : "Load Result"}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}
        </header>

        {!finished && (
          <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{current?.id}</p>
              <h2 className="mb-5 text-2xl font-semibold leading-tight">{current?.text}</h2>

              <div className="grid gap-3">
                {SCALE.map((option) => {
                  const isSelected = current ? answers[current.id] === option.value : false;

                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => {
                        if (!current) {
                          return;
                        }
                        setAnswers((prev) => ({ ...prev, [current.id]: option.value }));
                      }}
                      className={`rounded-xl border px-4 py-3 text-left text-sm transition sm:text-base ${
                        isSelected
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-300 bg-white hover:border-slate-500"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                  disabled={currentIndex === 0}
                  className="rounded-lg border border-slate-300 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentIndex((index) => Math.min(statements.length - 1, index + 1))}
                  disabled={currentIndex === statements.length - 1}
                  className="rounded-lg border border-slate-300 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={saveAndFinish}
                  disabled={!allAnswered || saving}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {saving ? "Saving..." : "Generate + Save Profile"}
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label className="block text-sm font-medium text-slate-700" htmlFor="respondentName">
                  Display name (saved to stats)
                </label>
                <input
                  id="respondentName"
                  type="text"
                  value={respondentName}
                  onChange={(event) => setRespondentName(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="Enter your name"
                  maxLength={120}
                />
              </div>
            </div>

            <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-lg font-semibold">Reference Compass</h3>
              <Image
                src="/funny-2.webp"
                alt="Reference political compass"
                width={480}
                height={480}
                className="h-auto w-full rounded-xl border border-slate-200"
              />
              <p className="mt-3 text-xs text-slate-600">
                Final placement is calculated from your complete answer pattern across all selected statements.
              </p>
            </aside>
          </section>
        )}

        {finished && (
          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="mb-3 text-2xl font-semibold">Saved Result</h2>
              <p className="text-sm text-slate-700">
                Result ID: <span className="font-mono">{savedResultId ?? "unsaved-local"}</span>
              </p>
              <p className="text-sm text-slate-700">Name: {respondentName || "Anonymous"}</p>
              <p className="text-sm text-slate-700">Saved at: {savedAt ? new Date(savedAt).toLocaleString() : "N/A"}</p>
              <p className="mt-2 text-xs text-slate-500">
                Store this ID to load and view this exact result later from the input field at the top.
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-2xl font-semibold">Answer Heatmap</h2>
              <div className={`grid ${gridColsClass(maxCol)} gap-1 rounded-xl bg-slate-100 p-2`}>
                {statements.map((statement) => (
                  <div
                    key={statement.id}
                    title={`${statement.id}: ${statement.text}`}
                    className="aspect-square rounded-sm"
                    style={{ backgroundColor: colorForValue(answers[statement.id]) }}
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                <span className="rounded bg-slate-200 px-2 py-1">dark blue: strong disagree</span>
                <span className="rounded bg-[#457b9d] px-2 py-1 text-white">blue: disagree</span>
                <span className="rounded bg-[#d8dde7] px-2 py-1">gray: neutral</span>
                <span className="rounded bg-[#f28482] px-2 py-1">red: agree</span>
                <span className="rounded bg-[#e63946] px-2 py-1 text-white">dark red: strong agree</span>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-2xl font-semibold">Compass Placement</h2>
              <div className="mb-4 rounded-xl bg-slate-100 p-4 text-sm">
                <p>
                  Economic axis: <strong>{analysis.econ.toFixed(2)}</strong>
                </p>
                <p>
                  Authority axis: <strong>{analysis.social.toFixed(2)}</strong>
                </p>
                <p>
                  Distance from center: <strong>{analysis.distanceFromCenter.toFixed(2)}</strong>
                </p>
                <p>
                  Extremity: <strong>{analysis.extremityPct.toFixed(1)}%</strong>
                </p>
              </div>

              <div className="mb-5 rounded-xl border border-slate-300 bg-white p-3">
                <svg viewBox="0 0 220 220" className="w-full">
                  <rect x="0" y="0" width="110" height="110" fill="#fee2e2" />
                  <rect x="110" y="0" width="110" height="110" fill="#ffedd5" />
                  <rect x="0" y="110" width="110" height="110" fill="#dbeafe" />
                  <rect x="110" y="110" width="110" height="110" fill="#dcfce7" />
                  <line x1="110" y1="0" x2="110" y2="220" stroke="#0f172a" strokeWidth="1" />
                  <line x1="0" y1="110" x2="220" y2="110" stroke="#0f172a" strokeWidth="1" />
                  {guess && <circle cx={110 + guess.econ * 9} cy={110 - guess.social * 9} r="6" fill="#2563eb" />}
                  <circle cx={110 + analysis.econ * 9} cy={110 - analysis.social * 9} r="6" fill="#111827" />
                </svg>
              </div>

              {guess && (
                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p>Guessed econ: {guess.econ.toFixed(2)}</p>
                  <p>Guessed authority: {guess.social.toFixed(2)}</p>
                  <p>Guess error distance: {(guessDistance ?? 0).toFixed(2)}</p>
                </div>
              )}

              <p className="text-sm">
                Nearest archetype: <strong>{analysis.nearestArchetype.name}</strong> ({analysis.nearestArchetype.similarityPct.toFixed(1)}%
                similarity)
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="mb-4 text-2xl font-semibold">Deep Personal Analysis</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-slate-100 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Intensity</p>
                  <p className="text-xl font-semibold">{analysis.intensityPct.toFixed(1)}%</p>
                </div>
                <div className="rounded-xl bg-slate-100 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Polarization Index</p>
                  <p className="text-xl font-semibold">{analysis.polarizationIndex.toFixed(1)}</p>
                </div>
                <div className="rounded-xl bg-slate-100 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Response Entropy</p>
                  <p className="text-xl font-semibold">{analysis.entropyPct.toFixed(1)}%</p>
                </div>
                <div className="rounded-xl bg-slate-100 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Std Deviation</p>
                  <p className="text-xl font-semibold">{analysis.stdDev.toFixed(3)}</p>
                </div>
                <div className="rounded-xl bg-slate-100 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Coherence X</p>
                  <p className="text-xl font-semibold">{analysis.coherenceX.toFixed(1)}%</p>
                </div>
                <div className="rounded-xl bg-slate-100 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Coherence Y</p>
                  <p className="text-xl font-semibold">{analysis.coherenceY.toFixed(1)}%</p>
                </div>
                <div className="rounded-xl bg-slate-100 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Overall Coherence</p>
                  <p className="text-xl font-semibold">{analysis.coherenceOverall.toFixed(1)}%</p>
                </div>
                <div className="rounded-xl bg-slate-100 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Variance</p>
                  <p className="text-xl font-semibold">{analysis.variance.toFixed(3)}</p>
                </div>
              </div>

              {comparative && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <p className="mb-2 font-semibold">Cohort comparison percentiles</p>
                  <p>Economic percentile: {comparative.econPercentile.toFixed(1)}th</p>
                  <p>Authority percentile: {comparative.socialPercentile.toFixed(1)}th</p>
                  <p>Intensity percentile: {comparative.intensityPercentile.toFixed(1)}th</p>
                  <p>Extremity percentile: {comparative.extremityPercentile.toFixed(1)}th</p>
                  <p>Entropy percentile: {comparative.entropyPercentile.toFixed(1)}th</p>
                </div>
              )}

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <h3 className="mb-2 text-lg font-semibold">Quadrant Balance</h3>
                  <p className="text-sm">Authoritarian Left: {analysis.quadrantBalance.authLeft.toFixed(2)}</p>
                  <p className="text-sm">Authoritarian Right: {analysis.quadrantBalance.authRight.toFixed(2)}</p>
                  <p className="text-sm">Libertarian Left: {analysis.quadrantBalance.libLeft.toFixed(2)}</p>
                  <p className="text-sm">Libertarian Right: {analysis.quadrantBalance.libRight.toFixed(2)}</p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <h3 className="mb-2 text-lg font-semibold">Narrative Findings</h3>
                  <div className="space-y-2 text-sm text-slate-700">
                    {narrative.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <h3 className="mb-2 text-lg font-semibold">Top Agreements</h3>
                  <ul className="space-y-1 text-sm text-slate-700">
                    {analysis.topAgreements.length === 0 && <li>No strong agreement statements recorded.</li>}
                    {analysis.topAgreements.map((statement) => (
                      <li key={statement.id}>
                        {statement.id} ({statement.value}): {statement.text}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <h3 className="mb-2 text-lg font-semibold">Top Disagreements</h3>
                  <ul className="space-y-1 text-sm text-slate-700">
                    {analysis.topDisagreements.length === 0 && <li>No strong disagreement statements recorded.</li>}
                    {analysis.topDisagreements.map((statement) => (
                      <li key={statement.id}>
                        {statement.id} ({statement.value}): {statement.text}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 p-4">
                <h3 className="mb-2 text-lg font-semibold">Answer Matrix (Numeric)</h3>
                <div className={`grid ${gridColsClass(maxCol)} gap-1`}>
                  {avgByStatement.map((entry) => (
                    <div
                      key={entry.id}
                      title={`${entry.id}: ${entry.value}`}
                      className="flex aspect-square items-center justify-center rounded text-[10px] font-semibold"
                      style={{ backgroundColor: scoreColor(entry.value), color: "#fff" }}
                    >
                      {entry.value}
                    </div>
                  ))}
                </div>
              </div>

              <p className="mt-5 text-xs text-slate-500">
                The profile is an exploratory statistical model, not a diagnostic label or professional evaluation.
              </p>
            </article>

            <button
              type="button"
              onClick={() => setFinished(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 lg:col-span-2 lg:justify-self-start"
            >
              Back to Questions
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
