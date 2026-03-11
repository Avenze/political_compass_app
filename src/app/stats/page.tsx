import Link from "next/link";

import { LogoutButton } from "@/components/logout-button";
import { requireUser } from "@/lib/auth";
import { normalizeMode } from "@/lib/polcomp";
import { getAllResults, getCohortSummary } from "@/lib/results-store";

function fmt(value: number, digits = 2) {
  return value.toFixed(digits);
}

type StatsPageProps = {
  searchParams?: Promise<{ mode?: string; category?: string }>;
};

export default async function StatsPage({ searchParams }: StatsPageProps) {
  const user = await requireUser();
  const resolvedSearchParams = (await searchParams) ?? {};
  const mode = resolvedSearchParams.mode ? normalizeMode(resolvedSearchParams.mode) : undefined;
  const selectedCategory = resolvedSearchParams.category?.trim() || "";

  const allRecords = await getAllResults(undefined, mode);
  const records = await getAllResults(selectedCategory || undefined, mode);
  const cohort = await getCohortSummary(selectedCategory || undefined, mode);
  const categoryCounts = allRecords.reduce<Record<string, number>>((acc, record) => {
    acc[record.category] = (acc[record.category] ?? 0) + 1;
    return acc;
  }, {});
  const categories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  const guessedRecords = records.filter((record) => typeof record.guessEcon === "number" && typeof record.guessSocial === "number");
  const avgGuessError =
    guessedRecords.length === 0
      ? 0
      : guessedRecords.reduce((acc, record) => {
          const dx = record.analysis.econ - (record.guessEcon ?? 0);
          const dy = record.analysis.social - (record.guessSocial ?? 0);
          return acc + Math.sqrt(dx * dx + dy * dy);
        }, 0) / guessedRecords.length;

  const statementByStd = cohort.statementStdDev.slice().sort((a, b) => b.stdDev - a.stdDev);
  const topContested = statementByStd.slice(0, 12).map((item) => {
    const avg = cohort.statementAverages.find((entry) => entry.id === item.id)?.avg ?? 0;
    const text = cohort.statementAverages.find((entry) => entry.id === item.id)?.text ?? item.id;
    return {
      id: item.id,
      text,
      stdDev: item.stdDev,
      avg,
    };
  });

  const strongestAgreement = cohort.statementAverages
    .slice()
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 10);

  const strongestDisagreement = cohort.statementAverages
    .slice()
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#e0f2fe_0%,_#f8fafc_45%,_#fef3c7_100%)] px-4 py-8 text-slate-900 sm:px-6">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 rounded-3xl border border-slate-200/70 bg-white/85 p-5 shadow-xl backdrop-blur sm:p-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Population Statistics Dashboard</h1>
            <p className="mt-1 text-sm text-slate-700">Aggregate analysis across all saved questionnaire results.</p>
            <p className="mt-1 text-xs text-slate-500">Signed in as {user.email}</p>
            <p className="mt-1 text-xs text-slate-500">Mode: {mode ?? "combined"}</p>
            <p className="mt-1 text-xs text-slate-500">Category: {selectedCategory || "all"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/${mode ? `?mode=${mode}` : ""}`}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-50"
            >
              Back to Questionnaire
            </Link>
            <Link
              href={selectedCategory ? `/stats?mode=simple&category=${encodeURIComponent(selectedCategory)}` : "/stats?mode=simple"}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-50"
            >
              Simple Stats
            </Link>
            <Link
              href={selectedCategory ? `/stats?mode=advanced&category=${encodeURIComponent(selectedCategory)}` : "/stats?mode=advanced"}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-50"
            >
              Advanced Stats
            </Link>
            <Link
              href={selectedCategory ? `/stats?category=${encodeURIComponent(selectedCategory)}` : "/stats"}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-50"
            >
              Combined Stats
            </Link>
            <LogoutButton />
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Sample Size</p>
            <p className="text-2xl font-semibold">{cohort.sampleSize}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Economic Mean</p>
            <p className="text-2xl font-semibold">{fmt(cohort.econMean)}</p>
            <p className="text-xs text-slate-600">Std: {fmt(cohort.econStd)}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Authority Mean</p>
            <p className="text-2xl font-semibold">{fmt(cohort.socialMean)}</p>
            <p className="text-xs text-slate-600">Std: {fmt(cohort.socialStd)}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Intensity Mean</p>
            <p className="text-2xl font-semibold">{fmt(cohort.intensityMean)}%</p>
            <p className="text-xs text-slate-600">Std: {fmt(cohort.intensityStd)}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Econ/Social Corr.</p>
            <p className="text-2xl font-semibold">{fmt(cohort.econSocialCorrelation, 3)}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Avg Guess Error</p>
            <p className="text-2xl font-semibold">{fmt(avgGuessError)}</p>
            <p className="text-xs text-slate-600">based on {guessedRecords.length} guessed profiles</p>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold">UTM Source Categories</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            <Link
              href={mode ? `/stats?mode=${mode}` : "/stats"}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium transition hover:bg-slate-50"
            >
              All categories
            </Link>
            {categories.map(([category]) => (
              <Link
                key={category}
                href={mode ? `/stats?mode=${mode}&category=${encodeURIComponent(category)}` : `/stats?category=${encodeURIComponent(category)}`}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium transition hover:bg-slate-50"
              >
                {category}
              </Link>
            ))}
          </div>
          {categories.length === 0 && <p className="text-sm text-slate-700">No categorized records yet.</p>}
          {categories.length > 0 && (
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {categories.map(([category, count]) => (
                <div key={category} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="font-medium">{category}</p>
                  <p className="text-xs text-slate-600">{count} responses</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {cohort.statementAverages.length > 0 && (
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
            <h2 className="mb-3 text-xl font-semibold">Average Answer Heatmap</h2>
            <div className="grid grid-cols-12 gap-1 rounded-xl bg-slate-100 p-2">
              {cohort.statementAverages.map((item) => {
                const normalized = (item.avg + 2) / 4;
                const red = Math.round(255 * normalized);
                const blue = Math.round(255 * (1 - normalized));
                return (
                  <div
                    key={item.id}
                    title={`${item.id}: ${item.avg.toFixed(2)}`}
                    className="aspect-square rounded-sm"
                    style={{ backgroundColor: `rgb(${red}, 90, ${blue})` }}
                  />
                );
              })}
            </div>
          </article>
          </section>
        )}

        {cohort.statementAverages.length === 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
            Statement-level heatmaps are hidden in combined mode. Switch to Simple Stats or Advanced Stats to inspect per-question aggregates.
          </section>
        )}

        {cohort.statementAverages.length > 0 && (
          <section className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
            <h2 className="mb-3 text-xl font-semibold">Strongest Mean Agreements</h2>
            <ul className="space-y-2 text-sm text-slate-700">
              {strongestAgreement.map((item) => (
                <li key={item.id}>
                  <span className="font-medium">{item.id}</span> ({fmt(item.avg)}): {item.text}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
            <h2 className="mb-3 text-xl font-semibold">Strongest Mean Disagreements</h2>
            <ul className="space-y-2 text-sm text-slate-700">
              {strongestDisagreement.map((item) => (
                <li key={item.id}>
                  <span className="font-medium">{item.id}</span> ({fmt(item.avg)}): {item.text}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
            <h2 className="mb-3 text-xl font-semibold">Most Contested Statements</h2>
            <ul className="space-y-2 text-sm text-slate-700">
              {topContested.map((item) => (
                <li key={item.id}>
                  <span className="font-medium">{item.id}</span> (std {fmt(item.stdDev)}; avg {fmt(item.avg)}): {item.text}
                </li>
              ))}
            </ul>
          </article>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold">Saved Results</h2>
          {records.length === 0 && <p className="text-sm text-slate-700">No saved profiles yet.</p>}
          {records.length > 0 && (
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {records
                .slice()
                .reverse()
                .map((record) => (
                  <div key={record.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="font-medium">{record.respondentName}</p>
                    <p className="font-mono text-xs break-all">{record.id}</p>
                    <p className="text-xs text-slate-600">{new Date(record.createdAt).toLocaleString()}</p>
                    <p className="text-xs text-slate-600">Mode: {record.mode}</p>
                    {typeof record.guessEcon === "number" && typeof record.guessSocial === "number" && (
                      <p className="text-xs text-slate-600">
                        Guess: ({record.guessEcon.toFixed(2)}, {record.guessSocial.toFixed(2)})
                      </p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
