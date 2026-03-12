"use client";

import { useMemo, useState } from "react";

type LLMProfileAdminProps = {
  recordId: string;
  existingProfile?: unknown;
};

function pretty(value: unknown): string {
  if (!value) {
    return "";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

export function LLMProfileAdmin({ recordId, existingProfile }: LLMProfileAdminProps) {
  const initial = useMemo(() => pretty(existingProfile), [existingProfile]);
  const [jsonText, setJsonText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const parsed = JSON.parse(jsonText);
      const response = await fetch(`/api/results/${encodeURIComponent(recordId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ llmProfile: parsed }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save LLM profile");
      }

      setMessage("LLM profile saved. Reloading stats...");
      window.location.reload();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Unable to save profile";
      setError(text);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-300 bg-white p-4">
      <p className="mb-2 text-sm font-semibold">Attach LLM processed output to this profile</p>
      <p className="mb-3 text-xs text-slate-600">Paste strict JSON output and save to store it on this record in Appwrite.</p>
      <textarea
        value={jsonText}
        onChange={(event) => setJsonText(event.target.value)}
        placeholder="Paste LLM JSON output here"
        className="h-80 w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !jsonText.trim()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {saving ? "Saving..." : "Save LLM Profile"}
        </button>
        {message && <p className="text-xs text-emerald-700">{message}</p>}
        {error && <p className="text-xs text-red-700">{error}</p>}
      </div>
    </div>
  );
}
