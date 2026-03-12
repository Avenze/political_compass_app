"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, type MouseEvent, useEffect, useMemo, useState } from "react";

import {
  type Analysis,
  type AnswerMap,
  type ComparativeMetrics,
  type LanguageCode,
  SCALE_LABELS,
  buildNarrative,
  computeAnalysis,
  getQuestions,
  getSwedishParties,
} from "@/lib/polcomp";
import { pingAppwrite } from "@/lib/appwrite";

type SaveResponse = {
  record: {
    id: string;
    createdAt: string;
    answers: AnswerMap;
    analysis: Analysis;
    respondentName: string;
    language: LanguageCode;
    selectedParty: string;
    initialEcon: number | null;
    initialSocial: number | null;
  };
  comparative: ComparativeMetrics;
};

type InitialPoint = {
  econ: number;
  social: number;
};

const COMPASS_SIZE = 220;
const COMPASS_CENTER = COMPASS_SIZE / 2;
const COMPASS_AXIS_MAX = 10;
const PX_PER_AXIS_UNIT = COMPASS_CENTER / COMPASS_AXIS_MAX;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function colorForValue(value: number | undefined): string {
  if (value === undefined) {
    return "#eceff5";
  }
  if (value === 0) {
    return "#d8dde7";
  }
  if (value > 0) {
    return value >= 1.5 ? "#e63946" : "#f28482";
  }
  return value <= -1.5 ? "#1d3557" : "#457b9d";
}

function scoreColor(value: number): string {
  const normalized = clamp((value + 2) / 4, 0, 1);
  const red = Math.round(255 * normalized);
  const blue = Math.round(255 * (1 - normalized));
  return `rgb(${red}, 90, ${blue})`;
}

function compassToSvgX(econ: number): number {
  return COMPASS_CENTER + econ * PX_PER_AXIS_UNIT;
}

function compassToSvgY(social: number): number {
  return COMPASS_CENTER - social * PX_PER_AXIS_UNIT;
}

function shuffleArray<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

export default function Home() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [language, setLanguage] = useState<LanguageCode>("sv");
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingById, setLoadingById] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadId, setLoadId] = useState("");
  const [savedResultId, setSavedResultId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [respondentName, setRespondentName] = useState("");
  const [selectedParty, setSelectedParty] = useState("");
  const [initialPosition, setInitialPosition] = useState<InitialPoint | null>(null);
  const [comparative, setComparative] = useState<ComparativeMetrics | null>(null);
  const partyOptions = useMemo(() => getSwedishParties(), []);
  const questions = useMemo(() => shuffleArray(getQuestions()), []);

  useEffect(() => {
    pingAppwrite().catch(() => {
      // Ignore ping failures in UI.
    });
  }, []);

  const current = questions[currentIndex];
  const answeredCount = questions.filter((question) => {
    const value = answers[question.id];
    if (question.kind === "likert") {
      return typeof value === "number";
    }
    return typeof value === "string" && value.length > 0;
  }).length;

  const allAnswered = answeredCount === questions.length;
  const analysis = useMemo(() => computeAnalysis(answers, "advanced"), [answers]);
  const narrative = useMemo(() => buildNarrative(analysis, comparative ?? undefined), [analysis, comparative]);
  const initialDistance = useMemo(() => {
    if (!initialPosition) {
      return null;
    }
    return Math.sqrt((analysis.econ - initialPosition.econ) ** 2 + (analysis.social - initialPosition.social) ** 2);
  }, [analysis.econ, analysis.social, initialPosition]);

  async function saveAndFinish() {
    if (!onboardingComplete || !selectedParty) {
      setError(language === "sv" ? "Välj parti och bekräfta startval innan du fortsatter." : "Choose a party and confirm your start choices before continuing.");
      return;
    }

    if (!allAnswered) {
      setError(language === "sv" ? "Besvara alla frågor innan analysen genereras." : "Please answer all questions before generating analysis.");
      return;
    }

    if (!respondentName.trim()) {
      setError(language === "sv" ? "Ange ett visningsnamn innan du sparar." : "Please enter a display name before saving.");
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
          utmSource: "direct",
          mode: "advanced",
          language,
          respondentName,
          selectedParty,
          initialPosition,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save result (${response.status})`);
      }

      const payload = (await response.json()) as SaveResponse;
      setSavedResultId(payload.record.id);
      setSavedAt(payload.record.createdAt);
      setRespondentName(payload.record.respondentName);
      setLanguage(payload.record.language ?? "sv");
      setSelectedParty(payload.record.selectedParty);
      setInitialPosition(
        typeof payload.record.initialEcon === "number" && typeof payload.record.initialSocial === "number"
          ? { econ: payload.record.initialEcon, social: payload.record.initialSocial }
          : null,
      );
      setOnboardingComplete(true);
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
        throw new Error(language === "sv" ? "Sparat resultat hittades inte." : "Saved result not found");
      }

      const payload = (await response.json()) as {
        record: {
          id: string;
          createdAt: string;
          answers: AnswerMap;
          respondentName?: string;
          language?: LanguageCode;
          selectedParty?: string;
          initialEcon?: number | null;
          initialSocial?: number | null;
        };
      };

      setAnswers(payload.record.answers);
      setSavedResultId(payload.record.id);
      setSavedAt(payload.record.createdAt);
      setRespondentName(payload.record.respondentName ?? "");
      setLanguage(payload.record.language ?? "sv");
      setSelectedParty(payload.record.selectedParty ?? "");
      setInitialPosition(
        typeof payload.record.initialEcon === "number" && typeof payload.record.initialSocial === "number"
          ? { econ: payload.record.initialEcon, social: payload.record.initialSocial }
          : null,
      );
      setOnboardingComplete(true);
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

  function setInitialPositionFromClick(event: MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    const econ = Number(((x * (COMPASS_AXIS_MAX * 2)) - COMPASS_AXIS_MAX).toFixed(2));
    const social = Number((((1 - y) * (COMPASS_AXIS_MAX * 2)) - COMPASS_AXIS_MAX).toFixed(2));
    setInitialPosition({ econ, social });
  }

  function completeOnboarding() {
    if (!selectedParty) {
      setError(language === "sv" ? "Välj ett parti innan du fortsatter." : "Select a party before continuing.");
      return;
    }
    setError(null);
    setOnboardingComplete(true);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#fef3c7_0%,_#f8fafc_45%,_#e0f2fe_100%)] px-4 py-8 text-slate-900 sm:px-6">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-xl backdrop-blur sm:p-8">
        <header className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Political Compass Profiler</h1>
          <p className="max-w-3xl text-sm text-slate-700 sm:text-base">
            {language === "sv"
              ? "40-fragorsprofil med djupanalys: 10 allmanna, 10 prioriteringsfragor, 10 vansterlutande och 10 hogerlutande." 
              : "40-question deep profile: 10 general, 10 priority selection, 10 left-leaning, and 10 right-leaning items."}
          </p>

          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-sm font-semibold">{language === "sv" ? "Språk" : "Language"}</p>
              <p className="text-xs text-slate-600">
                {language === "sv"
                  ? "Fragorna har semantiskt identiska formuleringar pa svenska och engelska."
                  : "Questions are semantically identical in Swedish and English."}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`rounded-lg border px-3 py-2 text-sm ${language === "en" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"}`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage("sv")}
                className={`rounded-lg border px-3 py-2 text-sm ${language === "sv" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"}`}
              >
                Svenska
              </button>
            </div>
          </div>

          {!onboardingComplete && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-sm font-semibold">
                {language === "sv" ? "Steg 1: Välj parti (obligatoriskt)" : "Step 1: Select party (required)"}
              </p>
              <select
                value={selectedParty}
                onChange={(event) => setSelectedParty(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">{language === "sv" ? "Välj parti..." : "Choose party..."}</option>
                {partyOptions.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.text[language]}
                  </option>
                ))}
              </select>

              <p className="mb-2 mt-4 text-sm font-semibold">
                {language === "sv"
                  ? "Steg 2: Valfri startplacering pa kompassen"
                  : "Step 2: Optional initial compass position"}
              </p>
              <svg viewBox="0 0 220 220" className="w-full max-w-xs cursor-crosshair rounded-lg border border-slate-300" onClick={setInitialPositionFromClick}>
                <rect x="0" y="0" width="110" height="110" fill="#fee2e2" />
                <rect x="110" y="0" width="110" height="110" fill="#dbeafe" />
                <rect x="0" y="110" width="110" height="110" fill="#dcfce7" />
                <rect x="110" y="110" width="110" height="110" fill="#ffedd5" />
                <line x1="110" y1="0" x2="110" y2="220" stroke="#0f172a" strokeWidth="1" />
                <line x1="0" y1="110" x2="220" y2="110" stroke="#0f172a" strokeWidth="1" />
                {initialPosition && <circle cx={compassToSvgX(initialPosition.econ)} cy={compassToSvgY(initialPosition.social)} r="6" fill="#2563eb" />}
              </svg>
              <p className="mt-2 text-xs text-slate-600">
                {initialPosition
                  ? `${language === "sv" ? "Vald startposition" : "Selected initial position"}: econ ${initialPosition.econ.toFixed(2)}, social ${initialPosition.social.toFixed(2)}`
                  : language === "sv"
                    ? "Ingen startposition vald (frivilligt)."
                    : "No initial position selected (optional)."}
              </p>

              <button
                type="button"
                onClick={completeOnboarding}
                className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
              >
                {language === "sv" ? "Las val och starta fragorna" : "Lock choices and start questionnaire"}
              </button>
            </div>
          )}

          {onboardingComplete && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
              <p className="font-semibold">
                {language === "sv" ? "Lasning aktiv" : "Choices locked"}
              </p>
              <p>
                {language === "sv" ? "Valt parti" : "Selected party"}: {partyOptions.find((party) => party.id === selectedParty)?.text[language] ?? selectedParty}
              </p>
              <p>
                {language === "sv" ? "Startposition" : "Initial position"}: {initialPosition ? `econ ${initialPosition.econ.toFixed(2)}, social ${initialPosition.social.toFixed(2)}` : language === "sv" ? "Ingen vald" : "Not set"}
              </p>
            </div>
          )}


          <div className="grid gap-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm sm:grid-cols-3">
            <span>{language === "sv" ? "Framsteg" : "Progress"}: {answeredCount}/{questions.length}</span>
            <span>{language === "sv" ? "Fråga" : "Question"}: {currentIndex + 1}/{questions.length}</span>
            <span>{language === "sv" ? "Status" : "Status"}: {!onboardingComplete ? (language === "sv" ? "Vantar pa startval" : "Waiting for onboarding") : allAnswered ? (language === "sv" ? "Klar" : "Complete") : (language === "sv" ? "Pågår" : "In progress")}</span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-sm font-semibold">{language === "sv" ? "Ladda tidigare resultat" : "Load a previous result"}</p>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={loadId}
                onChange={(event) => setLoadId(event.target.value)}
                placeholder={language === "sv" ? "Klistra in sparat resultat-ID" : "Paste saved result ID"}
                className="min-w-[260px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={loadById}
                disabled={loadingById}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingById ? (language === "sv" ? "Laddar..." : "Loading...") : language === "sv" ? "Ladda" : "Load"}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}
        </header>

        {!finished && onboardingComplete && (
          <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-2 text-2xl font-semibold leading-tight">{current.text[language]}</h2>
              <p className="mb-5 text-xs text-slate-500">{language === "sv" ? "Välj det svar som passar bäst." : "Choose the answer that fits best."}</p>

              {current.kind === "likert" && (
                <div className="grid gap-3">
                  {SCALE_LABELS[language].map((option) => {
                    const isSelected = answers[current.id] === option.value;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [current.id]: option.value }))}
                        className={`rounded-xl border px-4 py-3 text-left text-sm transition sm:text-base ${
                          isSelected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white hover:border-slate-500"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {current.kind === "single" && (
                <div className="grid gap-3">
                  {current.options.map((option) => {
                    const isSelected = answers[current.id] === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [current.id]: option.id }))}
                        className={`rounded-xl border px-4 py-3 text-left text-sm transition sm:text-base ${
                          isSelected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white hover:border-slate-500"
                        }`}
                      >
                        {option.text[language]}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                  disabled={currentIndex === 0}
                  className="rounded-lg border border-slate-300 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {language === "sv" ? "Föra" : "Previous"}
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentIndex((index) => Math.min(questions.length - 1, index + 1))}
                  disabled={currentIndex === questions.length - 1}
                  className="rounded-lg border border-slate-300 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {language === "sv" ? "Nästa" : "Next"}
                </button>
                <button
                  type="button"
                  onClick={saveAndFinish}
                  disabled={!allAnswered || saving}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {saving ? (language === "sv" ? "Sparar..." : "Saving...") : language === "sv" ? "Generera och spara profil" : "Generate + Save Profile"}
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label className="block text-sm font-medium text-slate-700" htmlFor="respondentName">
                  {language === "sv" ? "Visningsnamn" : "Display name"}
                </label>
                <input
                  id="respondentName"
                  type="text"
                  value={respondentName}
                  onChange={(event) => setRespondentName(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder={language === "sv" ? "Ange ditt namn" : "Enter your name"}
                  maxLength={120}
                />
              </div>
            </div>

            <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-lg font-semibold">{language === "sv" ? "Referenskompass" : "Reference Compass"}</h3>
              <Image
                src="/funny-2.webp"
                alt="Reference political compass"
                width={480}
                height={480}
                className="h-auto w-full rounded-xl border border-slate-200"
              />
              <p className="mt-3 text-xs text-slate-600">
                {language === "sv"
                  ? "Placeringen beräknas utifrån hela svarsmatrisen och viktade bidrag per frågetyp."
                  : "Placement is calculated from full response matrix and weighted contributions per question type."}
              </p>
            </aside>
          </section>
        )}

        {finished && (
          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="mb-3 text-2xl font-semibold">{language === "sv" ? "Sparat resultat" : "Saved Result"}</h2>
              <p className="text-sm text-slate-700">Result ID: <span className="font-mono">{savedResultId ?? "unsaved-local"}</span></p>
              <p className="text-sm text-slate-700">{language === "sv" ? "Namn" : "Name"}: {respondentName || "Anonymous"}</p>
              <p className="text-sm text-slate-700">
                {language === "sv" ? "Valt parti" : "Selected party"}: {partyOptions.find((party) => party.id === selectedParty)?.text[language] ?? selectedParty}
              </p>
              <p className="text-sm text-slate-700">
                {language === "sv" ? "Startposition" : "Initial position"}: {initialPosition ? `econ ${initialPosition.econ.toFixed(2)}, social ${initialPosition.social.toFixed(2)}` : language === "sv" ? "Ingen vald" : "Not set"}
              </p>
              <p className="text-sm text-slate-700">{language === "sv" ? "Språk" : "Language"}: {language === "sv" ? "Svenska" : "English"}</p>
              <p className="text-sm text-slate-700">Saved at: {savedAt ? new Date(savedAt).toLocaleString() : "N/A"}</p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-2xl font-semibold">{language === "sv" ? "Svarskarta" : "Answer Heatmap"}</h2>
              <div className="grid grid-cols-10 gap-1 rounded-xl bg-slate-100 p-2">
                {analysis.responsePoints.map((point) => (
                  <div
                    key={point.questionId}
                    title={`${point.questionId}: ${point.numericValue.toFixed(2)}`}
                    className="aspect-square rounded-sm"
                    style={{ backgroundColor: colorForValue(point.numericValue) }}
                  />
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-2xl font-semibold">{language === "sv" ? "Kompassplacering" : "Compass Placement"}</h2>
              <div className="mb-4 rounded-xl bg-slate-100 p-4 text-sm">
                <p>Economic axis: <strong>{analysis.econ.toFixed(2)}</strong></p>
                <p>Authority axis: <strong>{analysis.social.toFixed(2)}</strong></p>
                <p>Distance from center: <strong>{analysis.distanceFromCenter.toFixed(2)}</strong></p>
                <p>Extremity: <strong>{analysis.extremityPct.toFixed(1)}%</strong></p>
              </div>

              <div className="mb-5 rounded-xl border border-slate-300 bg-white p-3">
                <svg viewBox="0 0 220 220" className="w-full">
                  <rect x="0" y="0" width="110" height="110" fill="#fee2e2" />
                  <rect x="110" y="0" width="110" height="110" fill="#ffedd5" />
                  <rect x="0" y="110" width="110" height="110" fill="#dbeafe" />
                  <rect x="110" y="110" width="110" height="110" fill="#dcfce7" />
                  <line x1="110" y1="0" x2="110" y2="220" stroke="#0f172a" strokeWidth="1" />
                  <line x1="0" y1="110" x2="220" y2="110" stroke="#0f172a" strokeWidth="1" />
                  {initialPosition && <circle cx={compassToSvgX(initialPosition.econ)} cy={compassToSvgY(initialPosition.social)} r="6" fill="#2563eb" />}
                  <circle cx={compassToSvgX(analysis.econ)} cy={compassToSvgY(analysis.social)} r="6" fill="#111827" />
                </svg>
              </div>

              {initialPosition && (
                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p>{language === "sv" ? "Start econ" : "Initial econ"}: {initialPosition.econ.toFixed(2)}</p>
                  <p>{language === "sv" ? "Start authority" : "Initial authority"}: {initialPosition.social.toFixed(2)}</p>
                  <p>{language === "sv" ? "Avstånd till utfall" : "Distance to outcome"}: {(initialDistance ?? 0).toFixed(2)}</p>
                </div>
              )}

              <p className="text-sm">Nearest archetype: <strong>{analysis.nearestArchetype.name}</strong> ({analysis.nearestArchetype.similarityPct.toFixed(1)}% similarity)</p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="mb-4 text-2xl font-semibold">{language === "sv" ? "Djupanalys" : "Deep Personal Analysis"}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl bg-slate-100 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Intensity</p><p className="text-xl font-semibold">{analysis.intensityPct.toFixed(1)}%</p></div>
                <div className="rounded-xl bg-slate-100 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Polarization</p><p className="text-xl font-semibold">{analysis.polarizationIndex.toFixed(1)}</p></div>
                <div className="rounded-xl bg-slate-100 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Entropy</p><p className="text-xl font-semibold">{analysis.entropyPct.toFixed(1)}%</p></div>
                <div className="rounded-xl bg-slate-100 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Conviction</p><p className="text-xl font-semibold">{analysis.convictionIndex.toFixed(1)}%</p></div>
                <div className="rounded-xl bg-slate-100 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Predictability</p><p className="text-xl font-semibold">{analysis.predictabilityIndex.toFixed(1)}%</p></div>
                <div className="rounded-xl bg-slate-100 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Coherence X</p><p className="text-xl font-semibold">{analysis.coherenceX.toFixed(1)}%</p></div>
                <div className="rounded-xl bg-slate-100 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Coherence Y</p><p className="text-xl font-semibold">{analysis.coherenceY.toFixed(1)}%</p></div>
                <div className="rounded-xl bg-slate-100 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Axis alignment</p><p className="text-xl font-semibold">{analysis.axisAlignment.toFixed(1)}%</p></div>
                <div className="rounded-xl bg-slate-100 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Skew</p><p className="text-xl font-semibold">{analysis.responseSkew.toFixed(3)}</p></div>
                <div className="rounded-xl bg-slate-100 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Kurtosis</p><p className="text-xl font-semibold">{analysis.responseKurtosis.toFixed(3)}</p></div>
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
                  <h3 className="mb-2 text-lg font-semibold">Category intensity and direction</h3>
                  <p className="text-sm">General: {analysis.categoryScores.general.toFixed(2)} | {analysis.categoryIntensities.general.toFixed(1)}%</p>
                  <p className="text-sm">Priority: {analysis.categoryScores.single_priority.toFixed(2)} | {analysis.categoryIntensities.single_priority.toFixed(1)}%</p>
                  <p className="text-sm">Left-set: {analysis.categoryScores.left_leaning.toFixed(2)} | {analysis.categoryIntensities.left_leaning.toFixed(1)}%</p>
                  <p className="text-sm">Right-set: {analysis.categoryScores.right_leaning.toFixed(2)} | {analysis.categoryIntensities.right_leaning.toFixed(1)}%</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <h3 className="mb-2 text-lg font-semibold">Narrative findings</h3>
                  <div className="space-y-2 text-sm text-slate-700">
                    {narrative.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 p-4">
                <h3 className="mb-2 text-lg font-semibold">Response matrix</h3>
                <div className="grid grid-cols-10 gap-1">
                  {analysis.responsePoints.map((entry) => (
                    <div
                      key={entry.questionId}
                      title={`${entry.questionId}: ${entry.numericValue.toFixed(2)}`}
                      className="flex aspect-square items-center justify-center rounded text-[10px] font-semibold"
                      style={{ backgroundColor: scoreColor(entry.numericValue), color: "#fff" }}
                    >
                      {entry.numericValue.toFixed(1)}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 p-4">
                <h3 className="mb-2 text-lg font-semibold">Raw response audit trail</h3>
                <div className="max-h-72 overflow-auto text-sm">
                  <table className="w-full table-auto border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-left">
                        <th className="py-1">ID</th>
                        <th className="py-1">Question</th>
                        <th className="py-1">Answer</th>
                        <th className="py-1">Econ</th>
                        <th className="py-1">Social</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.responsePoints.map((entry) => (
                        <tr key={entry.questionId} className="border-b border-slate-100 align-top">
                          <td className="py-1 pr-2 font-mono text-xs">{entry.questionId}</td>
                          <td className="py-1 pr-2">{entry.text[language]}</td>
                          <td className="py-1 pr-2">{entry.answer[language]}</td>
                          <td className="py-1 pr-2">{entry.econContribution.toFixed(2)}</td>
                          <td className="py-1">{entry.socialContribution.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="mt-5 text-xs text-slate-500">The profile is än exploratory statistical model, not a diagnostic label or professional evaluation.</p>
            </article>

            <button
              type="button"
              onClick={() => setFinished(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 lg:col-span-2 lg:justify-self-start"
            >
              {language === "sv" ? "Tillbaka till frågor" : "Back to Questions"}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

function HomeFallback() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#fef3c7_0%,_#f8fafc_45%,_#e0f2fe_100%)] px-4 py-8 text-slate-900 sm:px-6">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-xl backdrop-blur sm:p-8">
        <header className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Political Compass Profiler</h1>
          <p className="max-w-3xl text-sm text-slate-700 sm:text-base">Loading questionnaire...</p>
        </header>
      </main>
    </div>
  );
}