import { ID, Query, type Models } from "appwrite";

import {
  type Analysis,
  type AnswerMap,
  type CohortSummary,
  type QuestionnaireMode,
  buildCohortSummary,
  compareToCohort,
  computeAnalysis,
  normalizeMode,
  normalizeAnswers,
} from "@/lib/polcomp";
import { APPWRITE_DATABASE_ID, APPWRITE_RESULTS_COLLECTION_ID } from "@/lib/appwrite-ids";
import { getServerDatabases } from "@/lib/appwrite-server";

export type StoredResult = {
  id: string;
  createdAt: string;
  answers: AnswerMap;
  analysis: Analysis;
  category: string;
  userId: string;
  mode: QuestionnaireMode;
  respondentName: string;
  guessEcon: number | null;
  guessSocial: number | null;
};

type ResultDocument = Models.Document & {
  answersJson: string;
  analysisJson: string;
  category: string;
  createdAtIso: string;
  userId?: string;
  mode?: string;
  respondentName?: string;
  guessEcon?: number;
  guessSocial?: number;
};

function normalizeCategory(input?: string) {
  if (!input) {
    return "direct";
  }

  const normalized = input.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "-").slice(0, 64);
  return normalized || "direct";
}

function parseDocument(document: {
  $id: string;
  $createdAt: string;
  answersJson: string;
  analysisJson: string;
  category?: string;
  createdAtIso?: string;
  userId?: string;
  mode?: string;
  respondentName?: string;
  guessEcon?: number;
  guessSocial?: number;
}): StoredResult | null {
  try {
    const mode = normalizeMode(document.mode);
    const answers = JSON.parse(document.answersJson) as AnswerMap;
    const analysis = JSON.parse(document.analysisJson) as Analysis;
    return {
      id: document.$id,
      createdAt: document.createdAtIso ?? document.$createdAt,
      answers,
      analysis,
      category: normalizeCategory(document.category),
      userId: document.userId ?? "",
      mode,
      respondentName: (document.respondentName ?? "Anonymous").trim() || "Anonymous",
      guessEcon: typeof document.guessEcon === "number" ? document.guessEcon : null,
      guessSocial: typeof document.guessSocial === "number" ? document.guessSocial : null,
    };
  } catch {
    return null;
  }
}

export async function getAllResults(category?: string, mode?: QuestionnaireMode): Promise<StoredResult[]> {
  const databases = getServerDatabases();
  const all: StoredResult[] = [];
  let cursorAfter: string | undefined;

  while (true) {
    const queries = [Query.limit(100), Query.orderDesc("$createdAt")];

    if (category) {
      queries.push(Query.equal("category", [normalizeCategory(category)]));
    }

    if (mode) {
      queries.push(Query.equal("mode", [mode]));
    }

    if (cursorAfter) {
      queries.push(Query.cursorAfter(cursorAfter));
    }

    const page = await databases.listDocuments<ResultDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_RESULTS_COLLECTION_ID,
      queries,
    );

    for (const document of page.documents) {
      const parsed = parseDocument(document);
      if (parsed) {
        all.push(parsed);
      }
    }

    if (page.documents.length < 100) {
      break;
    }

    cursorAfter = page.documents[page.documents.length - 1]?.$id;
    if (!cursorAfter) {
      break;
    }
  }

  return all;
}

export async function createStoredResult(
  rawAnswers: Record<string, number | undefined>,
  options?: {
    category?: string;
    userId?: string;
    mode?: QuestionnaireMode;
    respondentName?: string;
    guess?: { econ: number; social: number } | null;
  },
) {
  const databases = getServerDatabases();
  const mode = normalizeMode(options?.mode);
  const answers = normalizeAnswers(rawAnswers, mode);
  const analysis = computeAnalysis(answers, mode);
  const category = normalizeCategory(options?.category);
  const respondentName = options?.respondentName?.trim() || "Anonymous";
  const guessEcon = typeof options?.guess?.econ === "number" ? options.guess.econ : null;
  const guessSocial = typeof options?.guess?.social === "number" ? options.guess.social : null;
  const createdAt = new Date().toISOString();

  const document = await databases.createDocument<ResultDocument>(
    APPWRITE_DATABASE_ID,
    APPWRITE_RESULTS_COLLECTION_ID,
    ID.unique(),
    {
      answersJson: JSON.stringify(answers),
      analysisJson: JSON.stringify(analysis),
      category,
      createdAtIso: createdAt,
      userId: options?.userId ?? "",
      mode,
      respondentName,
      guessEcon: guessEcon ?? undefined,
      guessSocial: guessSocial ?? undefined,
    },
  );

  const newRecord: StoredResult = {
    id: document.$id,
    createdAt,
    answers,
    analysis,
    category,
    userId: options?.userId ?? "",
    mode,
    respondentName,
    guessEcon,
    guessSocial,
  };

  const existing = await getAllResults();
  const next = [newRecord, ...existing];

  const cohort = buildCohortSummary(next.map((record) => record.analysis), next.map((record) => record.answers));
  const comparative = compareToCohort(analysis, next.map((record) => record.analysis));

  return {
    record: newRecord,
    cohort,
    comparative,
  };
}

export async function getResultById(id: string): Promise<StoredResult | null> {
  const databases = getServerDatabases();

  try {
    const document = await databases.getDocument<ResultDocument>(APPWRITE_DATABASE_ID, APPWRITE_RESULTS_COLLECTION_ID, id);
    return parseDocument(document);
  } catch {
    return null;
  }
}

export async function getCohortSummary(category?: string, mode?: QuestionnaireMode): Promise<CohortSummary> {
  const all = await getAllResults(category, mode);
  return buildCohortSummary(all.map((record) => record.analysis), all.map((record) => record.answers), mode);
}
