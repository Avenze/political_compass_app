export type LanguageCode = "en" | "sv";

export type AnswerValue = -2 | -1 | 0 | 1 | 2;

export type QuestionCategory = "general" | "single_priority" | "left_leaning" | "right_leaning";

export type LocalizedText = {
  en: string;
  sv: string;
};

export type LLMConfidenceLevel = "low" | "medium" | "high";

export type LLMProcessedOutput = {
  respondent_summary: {
    profile_name: string;
    confidence_level: LLMConfidenceLevel;
    core_identity: string;
    economic_position: string;
    social_position: string;
  };
  axis_scores: {
    econ: number;
    social: number;
    extremity_pct: number;
    coherence_pct: number;
    conviction_pct: number;
  };
  dominant_patterns: Array<{
    pattern: string;
    evidence_question_ids: string[];
    interpretation: string;
  }>;
  tensions_and_contradictions: Array<{
    tension: string;
    question_pair: [string, string];
    severity: "low" | "medium" | "high";
  }>;
  policy_priorities_inferred: Array<{
    priority: string;
    direction: "expand" | "reform" | "reduce";
    confidence: number;
  }>;
  communication_strategy: {
    framing_style: string;
    messages_to_avoid: string[];
    likely_resonant_themes: string[];
  };
  machine_checks: {
    used_all_questions: boolean;
    hallucination_free: boolean;
    language_neutrality_observed: boolean;
  };
};

type CondensedProfileName =
  | "Välfärdsprogressiv"
  | "Marknadsliberal"
  | "Ordningskonservativ"
  | "Grön reformist"
  | "Socialliberal"
  | "Nationell konservativ"
  | "Pragmatisk mitten"
  | "Demokratisk decentralist";

export type LikertQuestion = {
  id: string;
  kind: "likert";
  category: Exclude<QuestionCategory, "single_priority">;
  text: LocalizedText;
  econTilt: number;
  socialTilt: number;
};

export type SingleChoiceOption = {
  id: string;
  text: LocalizedText;
  econ: number;
  social: number;
  emphasis: number;
};

export type SingleChoiceQuestion = {
  id: string;
  kind: "single";
  category: "single_priority";
  text: LocalizedText;
  options: SingleChoiceOption[];
};

export type Question = LikertQuestion | SingleChoiceQuestion;

export type AnswerMap = Record<string, AnswerValue | string>;

export type Statement = {
  id: string;
  text: string;
  col: number;
  row: number;
  x: number;
  y: number;
};

export type ResponsePoint = {
  questionId: string;
  category: QuestionCategory;
  kind: "likert" | "single";
  text: LocalizedText;
  answer: LocalizedText;
  numericValue: number;
  econContribution: number;
  socialContribution: number;
  emphasis: number;
};

export type Analysis = {
  econ: number;
  social: number;
  intensityPct: number;
  distanceFromCenter: number;
  extremityPct: number;
  variance: number;
  stdDev: number;
  entropyPct: number;
  coherenceX: number;
  coherenceY: number;
  coherenceOverall: number;
  polarizationIndex: number;
  responseSkew: number;
  responseKurtosis: number;
  convictionIndex: number;
  predictabilityIndex: number;
  axisAlignment: number;
  categoryScores: Record<QuestionCategory, number>;
  categoryIntensities: Record<QuestionCategory, number>;
  topAgreements: Array<Statement & { value: number }>;
  topDisagreements: Array<Statement & { value: number }>;
  econLabel: string;
  socialLabel: string;
  nearestArchetype: {
    name: string;
    description: string;
    distance: number;
    similarityPct: number;
  };
  quadrantBalance: {
    authLeft: number;
    authRight: number;
    libLeft: number;
    libRight: number;
  };
  rowAverages: number[];
  colAverages: number[];
  responsePoints: ResponsePoint[];
  llmProfile?: LLMProcessedOutput;
};

export type CohortSummary = {
  sampleSize: number;
  econMean: number;
  econStd: number;
  socialMean: number;
  socialStd: number;
  intensityMean: number;
  intensityStd: number;
  extremityMean: number;
  extremityStd: number;
  entropyMean: number;
  entropyStd: number;
  convictionMean: number;
  convictionStd: number;
  alignmentMean: number;
  alignmentStd: number;
  llmProfilesCount: number;
  llmCoveragePct: number;
  llmConfidenceCounts: Record<LLMConfidenceLevel, number>;
  llmAxisDeltaMean: number;
  llmAxisDeltaStd: number;
  categoryMeans: Record<QuestionCategory, number>;
  categoryStd: Record<QuestionCategory, number>;
  statementAverages: Array<{ id: string; text: string; avg: number }>;
  statementStdDev: Array<{ id: string; stdDev: number }>;
  quadrantCounts: {
    authLeft: number;
    authRight: number;
    libLeft: number;
    libRight: number;
    centrist: number;
  };
  econSocialCorrelation: number;
};

export type ComparativeMetrics = {
  econPercentile: number;
  socialPercentile: number;
  intensityPercentile: number;
  extremityPercentile: number;
  entropyPercentile: number;
  econZ: number;
  socialZ: number;
  intensityZ: number;
  extremityZ: number;
};

export type QuestionnaireMode = "advanced";

export function normalizeMode(input: string | undefined): QuestionnaireMode {
  void input;
  return "advanced";
}

export function normalizeLanguage(input?: string): LanguageCode {
  return input === "sv" ? "sv" : "en";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.filter((item): item is string => typeof item === "string");
}

function condenseProfileName(
  rawName: string,
  axis: { econ: number; social: number; conviction_pct: number; coherence_pct: number },
): string {
  const trimmed = rawName.trim();
  const compact = trimmed
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const ruleMap: Array<{ re: RegExp; bucket: CondensedProfileName }> = [
    { re: /(welfare|social|equality|redistrib|left|worker)/, bucket: "Välfärdsprogressiv" },
    { re: /(market|liberal|entrepreneur|deregulat|business|right)/, bucket: "Marknadsliberal" },
    { re: /(order|security|authority|law|discipline)/, bucket: "Ordningskonservativ" },
    { re: /(green|climate|sustain|ecolog)/, bucket: "Grön reformist" },
    { re: /(civil|rights|plural|open|integration|libert)/, bucket: "Socialliberal" },
    { re: /(national|tradition|sovereign|patriot|culture)/, bucket: "Nationell konservativ" },
    { re: /(decentral|local|referendum|participat)/, bucket: "Demokratisk decentralist" },
  ];

  for (const rule of ruleMap) {
    if (rule.re.test(compact)) {
      return rule.bucket;
    }
  }

  if (axis.social >= 4.5) {
    return axis.econ >= 2 ? "Ordningskonservativ" : "Nationell konservativ";
  }
  if (axis.social <= -4.5) {
    return axis.econ <= -2 ? "Välfärdsprogressiv" : "Socialliberal";
  }
  if (axis.econ <= -4.5) {
    return "Välfärdsprogressiv";
  }
  if (axis.econ >= 4.5) {
    return "Marknadsliberal";
  }
  if (axis.conviction_pct >= 70 && axis.coherence_pct >= 65) {
    return "Grön reformist";
  }

  return "Pragmatisk mitten";
}

export function parseLLMProcessedOutput(input: unknown): LLMProcessedOutput | null {
  if (!isRecord(input)) {
    return null;
  }

  const summary = input.respondent_summary;
  const axisScores = input.axis_scores;
  const communication = input.communication_strategy;
  const checks = input.machine_checks;

  if (!isRecord(summary) || !isRecord(axisScores) || !isRecord(communication) || !isRecord(checks)) {
    return null;
  }

  const confidence = summary.confidence_level;
  if (confidence !== "low" && confidence !== "medium" && confidence !== "high") {
    return null;
  }

  const rawDominant = Array.isArray(input.dominant_patterns) ? input.dominant_patterns : [];
  const dominant_patterns = rawDominant
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => ({
      pattern: typeof item.pattern === "string" ? item.pattern : "",
      evidence_question_ids: asStringArray(item.evidence_question_ids),
      interpretation: typeof item.interpretation === "string" ? item.interpretation : "",
    }))
    .filter((item) => item.pattern && item.interpretation);

  const rawTensions = Array.isArray(input.tensions_and_contradictions) ? input.tensions_and_contradictions : [];
  const tensions_and_contradictions = rawTensions
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => {
      const pair = Array.isArray(item.question_pair) ? item.question_pair : [];
      const severityRaw = item.severity;
      const severity: "low" | "medium" | "high" =
        severityRaw === "low" || severityRaw === "medium" || severityRaw === "high" ? severityRaw : "low";
      return {
        tension: typeof item.tension === "string" ? item.tension : "",
        question_pair: [String(pair[0] ?? ""), String(pair[1] ?? "")] as [string, string],
        severity,
      };
    })
    .filter((item) => item.tension && item.question_pair[0] && item.question_pair[1]);

  const rawPriorities = Array.isArray(input.policy_priorities_inferred) ? input.policy_priorities_inferred : [];
  const policy_priorities_inferred = rawPriorities
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => {
      const directionRaw = item.direction;
      const direction: "expand" | "reform" | "reduce" =
        directionRaw === "expand" || directionRaw === "reform" || directionRaw === "reduce" ? directionRaw : "reform";
      return {
        priority: typeof item.priority === "string" ? item.priority : "",
        direction,
        confidence: typeof item.confidence === "number" ? clamp(item.confidence, 0, 1) : 0,
      };
    })
    .filter((item) => item.priority);

  const result: LLMProcessedOutput = {
    respondent_summary: {
      profile_name: condenseProfileName(
        typeof summary.profile_name === "string" ? summary.profile_name : "",
        {
          econ: typeof axisScores.econ === "number" ? clamp(axisScores.econ, -10, 10) : 0,
          social: typeof axisScores.social === "number" ? clamp(axisScores.social, -10, 10) : 0,
          coherence_pct: typeof axisScores.coherence_pct === "number" ? clamp(axisScores.coherence_pct, 0, 100) : 0,
          conviction_pct: typeof axisScores.conviction_pct === "number" ? clamp(axisScores.conviction_pct, 0, 100) : 0,
        },
      ),
      confidence_level: confidence,
      core_identity: typeof summary.core_identity === "string" ? summary.core_identity : "",
      economic_position: typeof summary.economic_position === "string" ? summary.economic_position : "",
      social_position: typeof summary.social_position === "string" ? summary.social_position : "",
    },
    axis_scores: {
      econ: typeof axisScores.econ === "number" ? clamp(axisScores.econ, -10, 10) : 0,
      social: typeof axisScores.social === "number" ? clamp(axisScores.social, -10, 10) : 0,
      extremity_pct: typeof axisScores.extremity_pct === "number" ? clamp(axisScores.extremity_pct, 0, 100) : 0,
      coherence_pct: typeof axisScores.coherence_pct === "number" ? clamp(axisScores.coherence_pct, 0, 100) : 0,
      conviction_pct: typeof axisScores.conviction_pct === "number" ? clamp(axisScores.conviction_pct, 0, 100) : 0,
    },
    dominant_patterns,
    tensions_and_contradictions,
    policy_priorities_inferred,
    communication_strategy: {
      framing_style: typeof communication.framing_style === "string" ? communication.framing_style : "",
      messages_to_avoid: asStringArray(communication.messages_to_avoid),
      likely_resonant_themes: asStringArray(communication.likely_resonant_themes),
    },
    machine_checks: {
      used_all_questions: checks.used_all_questions === true,
      hallucination_free: checks.hallucination_free === true,
      language_neutrality_observed: checks.language_neutrality_observed === true,
    },
  };

  if (!result.respondent_summary.profile_name || !result.respondent_summary.core_identity) {
    return null;
  }

  return result;
}

export const SCALE_LABELS: Record<LanguageCode, Array<{ label: string; value: AnswerValue }>> = {
  en: [
    { label: "Strongly disagree", value: -2 },
    { label: "Disagree", value: -1 },
    { label: "Neutral", value: 0 },
    { label: "Agree", value: 1 },
    { label: "Strongly agree", value: 2 },
  ],
  sv: [
    { label: "Instämmer inte alls", value: -2 },
    { label: "Instämmer inte", value: -1 },
    { label: "Neutral", value: 0 },
    { label: "Instämmer", value: 1 },
    { label: "Instämmer helt", value: 2 },
  ],
};

export const SWEDISH_RIKSDAG_PARTIES: Array<{ id: string; text: LocalizedText }> = [
  { id: "socialdemokraterna", text: { en: "Social Democrats", sv: "Socialdemokraterna" } },
  { id: "moderaterna", text: { en: "Moderates", sv: "Moderaterna" } },
  { id: "sverigedemokraterna", text: { en: "Sweden Democrats", sv: "Sverigedemokraterna" } },
  { id: "centerpartiet", text: { en: "Centre Party", sv: "Centerpartiet" } },
  { id: "vansterpartiet", text: { en: "Left Party", sv: "Vänsterpartiet" } },
  { id: "kristdemokraterna", text: { en: "Christian Democrats", sv: "Kristdemokraterna" } },
  { id: "liberalerna", text: { en: "Liberals", sv: "Liberalerna" } },
  { id: "miljopartiet", text: { en: "Green Party", sv: "Miljöpartiet de gröna" } },
  { id: "feministiskt_initiativ", text: { en: "Feminist Initiative", sv: "Feministiskt initiativ" } },
  { id: "piratpartiet", text: { en: "Pirate Party", sv: "Piratpartiet" } },
  { id: "partiet_nyans", text: { en: "Nyans", sv: "Partiet Nyans" } },
  { id: "medborgerlig_samling", text: { en: "Citizens' Coalition", sv: "Medborgerlig Samling" } },
  { id: "alternativ_for_sverige", text: { en: "Alternative for Sweden", sv: "Alternativ för Sverige" } },
  { id: "direktdemokraterna", text: { en: "Direct Democrats", sv: "Direktdemokraterna" } },
  { id: "enhet", text: { en: "Unity", sv: "Enhet" } },
  { id: "klassiska_liberala_partiet", text: { en: "Classical Liberal Party", sv: "Klassiska liberala partiet" } },
  { id: "knapptryckarna", text: { en: "Button Pressers", sv: "Knapptryckarna" } },
  { id: "mod", text: { en: "MoD", sv: "MoD" } },
  { id: "spi_valfarden", text: { en: "SPI Welfare", sv: "SPI Välfärden" } },
  { id: "sveriges_kommunistiska_parti", text: { en: "Communist Party of Sweden", sv: "Sveriges Kommunistiska Parti" } },
  { id: "basinkomstpartiet", text: { en: "Basic Income Party", sv: "Basinkomstpartiet" } },
  { id: "klimatalliansen", text: { en: "Climate Alliance", sv: "Klimatalliansen" } },
  { id: "nya_nybrottspartiet", text: { en: "New New Deal Party", sv: "Nya Nybrottspartiet" } },
  { id: "oberoende_realister", text: { en: "Independent Realists", sv: "Oberoende Realister" } },
];

export function getSwedishParties() {
  return SWEDISH_RIKSDAG_PARTIES;
}

export function isKnownSwedishParty(input: string): boolean {
  return SWEDISH_RIKSDAG_PARTIES.some((party) => party.id === input);
}

const QUESTIONS: Question[] = [
  {
    id: "g1",
    kind: "likert",
    category: "general",
    text: {
      en: "The state should guarantee equal quality welfare in every municipality.",
      sv: "Staten bör garantera likvärdig välfärd i varje kommun.",
    },
    econTilt: -1.4,
    socialTilt: 0.3,
  },
  {
    id: "g2",
    kind: "likert",
    category: "general",
    text: {
      en: "Regions should have more freedom even if national policy becomes less uniform.",
      sv: "Regioner bör få större frihet aven om nationell politik blir mindre tydlig.",
    },
    econTilt: 0.6,
    socialTilt: -0.8,
  },
  {
    id: "g3",
    kind: "likert",
    category: "general",
    text: {
      en: "Public finances should prioritize low debt even if reforms are delayed.",
      sv: "Offentliga finanser bör prioritera låg skuld även om ändring försenas.",
    },
    econTilt: 1.5,
    socialTilt: 0.4,
  },
  {
    id: "g4",
    kind: "likert",
    category: "general",
    text: {
      en: "The state should actively reduce income and wealth gaps.",
      sv: "Staten bör aktivt minska inkomst- och förmögenhetsklyftor.",
    },
    econTilt: -1.9,
    socialTilt: -0.1,
  },
  {
    id: "g5",
    kind: "likert",
    category: "general",
    text: {
      en: "Sweden should tighten laws quickly when public order is threatened.",
      sv: "Sverige bör snabbt skärpa lagar när allmän ordning hotas.",
    },
    econTilt: 0.1,
    socialTilt: 1.8,
  },
  {
    id: "g6",
    kind: "likert",
    category: "general",
    text: {
      en: "Freedom of speech should be protected strongly, even for offensive opinions.",
      sv: "Yttrandefriheten bör skyddas starkt, även för ståndpunkter som uppfattas stötande.",
    },
    econTilt: 0,
    socialTilt: -1.8,
  },
  {
    id: "g7",
    kind: "likert",
    category: "general",
    text: {
      en: "More major political decisions should be made through referendums.",
      sv: "Fler stora politiska beslut bör avgöras genom folkomröstningar.",
    },
    econTilt: -0.1,
    socialTilt: -1.2,
  },
  {
    id: "g8",
    kind: "likert",
    category: "general",
    text: {
      en: "The state should monitor critical infrastructure in real time to prevent attacks.",
      sv: "Staten bör övervaka kritisk infrastruktur i realtid for att förebygga attacker.",
    },
    econTilt: -0.2,
    socialTilt: 1.5,
  },
  {
    id: "g9",
    kind: "likert",
    category: "general",
    text: {
      en: "EU cooperation should have higher priority than absolute national sovereignty.",
      sv: "EU-samarbete bör prioriteras högre än absolut nationell suveränitet.",
    },
    econTilt: -0.2,
    socialTilt: -0.8,
  },
  {
    id: "g10",
    kind: "likert",
    category: "general",
    text: {
      en: "Sweden should prioritize self-sufficiency in essential goods over cheapest imports.",
      sv: "Sverige bör prioritera självförsörjning av samhällsviktiga varor framför billigaste import.",
    },
    econTilt: -0.7,
    socialTilt: 1.1,
  },
  {
    id: "p1",
    kind: "single",
    category: "single_priority",
    text: {
      en: "If the state gets 20 billion SEK extra, where should it go first?",
      sv: "Om staten får 20 miljarder kronor extra, vart bör de gå först?",
    },
    options: [
      {
        id: "healthcare_staffing",
        text: { en: "Hire more healthcare staff", sv: "Anställa fler i sjukvården" },
        econ: -1.9,
        social: -0.1,
        emphasis: 1,
      },
      {
        id: "defense_readiness",
        text: { en: "Military and civil defense readiness", sv: "Militär och civil beredskap" },
        econ: 0.8,
        social: 1.7,
        emphasis: 1,
      },
      {
        id: "tax_cut_work_income",
        text: { en: "Lower taxes on work income", sv: "Sänkt skatt på arbete" },
        econ: 1.8,
        social: 0.1,
        emphasis: 1,
      },
      {
        id: "municipal_equalization",
        text: { en: "Equalize welfare between municipalities", sv: "Jämna ut välfarden mellan kommuner" },
        econ: -1.7,
        social: 0.5,
        emphasis: 1,
      },
    ],
  },
  {
    id: "p2",
    kind: "single",
    category: "single_priority",
    text: {
      en: "How should Sweden handle high inflation and weak growth at the same time?",
      sv: "Hur bör Sverige hantera hög inflation och svag tillväxt samtidigt?",
    },
    options: [
      {
        id: "tight_budget",
        text: { en: "Tight fiscal policy and spending restraint", sv: "Stram finanspolitik och utgiftskontroll" },
        econ: 1.1,
        social: 0.6,
        emphasis: 1,
      },
      {
        id: "targeted_cost_relief",
        text: { en: "Targeted support to vulnerable households", sv: "Riktat stöd till utsatta hushåll" },
        econ: -1.4,
        social: -0.1,
        emphasis: 1,
      },
      {
        id: "temporary_price_caps",
        text: { en: "Temporary price caps on essential goods", sv: "Tillfälliga pristak på nödvändiga varor" },
        econ: -1.9,
        social: 1,
        emphasis: 1,
      },
      {
        id: "growth_reforms",
        text: { en: "Deregulation and growth-oriented tax reforms", sv: "Avreglering och tillväxtinriktade skattereformer" },
        econ: 1.8,
        social: 0.2,
        emphasis: 1,
      },
    ],
  },
  {
    id: "p3",
    kind: "single",
    category: "single_priority",
    text: {
      en: "What should housing policy focus on first?",
      sv: "Vad bör bostadspolitiken fokusera pa först?",
    },
    options: [
      {
        id: "state_backed_rentals",
        text: { en: "Expand municipally owned rentals", sv: "Bygg ut allmännyttiga hyresrätter" },
        econ: -1.8,
        social: 0,
        emphasis: 1,
      },
      {
        id: "faster_permits",
        text: { en: "Faster permits and simpler planning rules", sv: "Snabbare tillstånd och enklare planregler" },
        econ: 1.3,
        social: -0.1,
        emphasis: 1,
      },
      {
        id: "stronger_rent_controls",
        text: { en: "Stronger rent regulation", sv: "Starkare hyresreglering" },
        econ: -2,
        social: 0.6,
        emphasis: 1,
      },
      {
        id: "ownership_market",
        text: { en: "Support private ownership and market rents", sv: "Stöd privat ägande och mer marknadshyror" },
        econ: 1.4,
        social: 0.4,
        emphasis: 1,
      },
    ],
  },
  {
    id: "p4",
    kind: "single",
    category: "single_priority",
    text: {
      en: "Which migration line should Sweden prioritize now?",
      sv: "Vilken migrationslinje bör Sverige prioritera nu?",
    },
    options: [
      {
        id: "integration_investment",
        text: { en: "Higher investment in integration and legal routes", sv: "Större satsning på integration och lagliga vägar" },
        econ: -0.9,
        social: -1.6,
        emphasis: 1,
      },
      {
        id: "balanced_quota",
        text: { en: "Balanced yearly refugee and labor quotas", sv: "Balanserad årlig flykting- och arbetskraftskvot" },
        econ: 0,
        social: -0.3,
        emphasis: 1,
      },
      {
        id: "strict_border_policy",
        text: { en: "Stricter borders and lower asylum intake", sv: "Striktare gränser och lägre asylmottagande" },
        econ: 0.7,
        social: 1.7,
        emphasis: 1,
      },
      {
        id: "skills_points_system",
        text: { en: "Skills-based points system with strict requirements", sv: "Kompetensbaserat poängsystem med tydliga krav" },
        econ: 1.1,
        social: 0.6,
        emphasis: 1,
      },
    ],
  },
  {
    id: "p5",
    kind: "single",
    category: "single_priority",
    text: {
      en: "What should come first to reduce gang violence?",
      sv: "Vad bör komma först for att minska gängvåld?",
    },
    options: [
      {
        id: "social_prevention",
        text: { en: "Large prevention programs in schools and neighborhoods", sv: "Stora förebyggande insatser i skola och bostadsområden" },
        econ: -0.9,
        social: -1.1,
        emphasis: 1,
      },
      {
        id: "targeted_policing",
        text: { en: "Targeted policing and witness protection", sv: "Riktat polisarbete och starkare vittnesskydd" },
        econ: 0.1,
        social: 0.9,
        emphasis: 1,
      },
      {
        id: "harsher_sentences",
        text: { en: "Longer sentences and lower age thresholds", sv: "Längre straff och lägre myndighetsålder i straffrätt" },
        econ: 0.5,
        social: 1.8,
        emphasis: 1,
      },
      {
        id: "expanded_surveillance",
        text: { en: "Expanded surveillance and data-driven control", sv: "Utbyggd övervakning och datadriven kontroll" },
        econ: 0.2,
        social: 0.9,
        emphasis: 1,
      },
    ],
  },
  {
    id: "p6",
    kind: "single",
    category: "single_priority",
    text: {
      en: "Which climate and energy strategy should lead?",
      sv: "Vilken klimat- och energistrategi bör leda?",
    },
    options: [
      {
        id: "state_green_investment",
        text: { en: "Large state-led green investments", sv: "Stora statligt ledda gröna investeringar" },
        econ: -1.7,
        social: -0.4,
        emphasis: 1,
      },
      {
        id: "carbon_pricing_rebate",
        text: { en: "Higher carbon pricing with household rebates", sv: "Högre koldioxidpris med återbäring till hushåll" },
        econ: -0.2,
        social: -0.3,
        emphasis: 1,
      },
      {
        id: "market_innovation",
        text: { en: "Market-led innovation with fewer subsidies", sv: "Marknadsdriven innovation med mindre subventioner" },
        econ: 1.7,
        social: -0.1,
        emphasis: 1,
      },
      {
        id: "security_and_nuclear",
        text: { en: "Energy security first, including faster nuclear expansion", sv: "Energisäkerhet först, inklusive snabbare kärnkraftsutbyggnad" },
        econ: 1.2,
        social: 1.2,
        emphasis: 1,
      },
    ],
  },
  {
    id: "p7",
    kind: "single",
    category: "single_priority",
    text: {
      en: "What should schools prioritize most?",
      sv: "Vad bör skolan prioritera mest?",
    },
    options: [
      {
        id: "equity_support",
        text: { en: "Equal resources and stronger support for weak schools", sv: "Likvärdiga resurser och starkare stöd till svaga skolor" },
        econ: -1.2,
        social: -0.7,
        emphasis: 1,
      },
      {
        id: "knowledge_and_order",
        text: { en: "Clear knowledge goals and stronger classroom order", sv: "Tydliga kunskapsmål och starkare klassrumsordning" },
        econ: 0.1,
        social: 0.8,
        emphasis: 1,
      },
      {
        id: "school_choice_market",
        text: { en: "School choice and competition between providers", sv: "Skolval och konkurrens mellan utförare" },
        econ: 1.6,
        social: 0.3,
        emphasis: 1,
      },
      {
        id: "nationalized_school_model",
        text: { en: "A more centralized, national school model", sv: "En mer centraliserad nationell skolmodell" },
        econ: -0.8,
        social: 1.2,
        emphasis: 1,
      },
    ],
  },
  {
    id: "p8",
    kind: "single",
    category: "single_priority",
    text: {
      en: "How should digital policy handle platforms and privacy?",
      sv: "Hur bör digitalpolitiken hantera plattformar och integritet?",
    },
    options: [
      {
        id: "strict_platform_rules",
        text: { en: "Strong regulation and algorithm audits", sv: "Stark reglering och algoritmgranskning" },
        econ: -1.5,
        social: 0.7,
        emphasis: 1,
      },
      {
        id: "privacy_rights",
        text: { en: "Prioritize user privacy and digital rights", sv: "Prioritera användarintegritet och digitala rättigheter" },
        econ: -0.4,
        social: -1.7,
        emphasis: 1,
      },
      {
        id: "industry_self_regulation",
        text: { en: "Mostly industry self-regulation", sv: "Främst branschens självreglering" },
        econ: 1.7,
        social: 0.3,
        emphasis: 1,
      },
      {
        id: "state_control_online",
        text: { en: "Expanded state control over online harmful content", sv: "Utökad statlig kontroll över skadligt onlineinnehåll" },
        econ: -0.6,
        social: 1.9,
        emphasis: 1,
      },
    ],
  },
  {
    id: "p9",
    kind: "single",
    category: "single_priority",
    text: {
      en: "Which tax reform should come first?",
      sv: "Vilken skattereform bör komma först?",
    },
    options: [
      {
        id: "wealth_and_capital_tax",
        text: { en: "Higher tax on large wealth and capital", sv: "Högre skatt på stora förmögenheter och kapital" },
        econ: -2,
        social: 0.1,
        emphasis: 1,
      },
      {
        id: "earned_income_relief",
        text: { en: "Lower tax for low and middle earned incomes", sv: "Lägre skatt på låga och medelhöga arbetsinkomster" },
        econ: -0.6,
        social: -0.1,
        emphasis: 1,
      },
      {
        id: "entrepreneurship_tax_relief",
        text: { en: "Lower tax for entrepreneurs and investors", sv: "Lägre skatt för entreprenörer och investerare" },
        econ: 1.8,
        social: 0.1,
        emphasis: 1,
      },
      {
        id: "flat_broad_tax",
        text: { en: "Simpler broad tax base with flatter rates", sv: "Enklare bred skattebas med plattare skattesatser" },
        econ: 0.2,
        social: 0.5,
        emphasis: 1,
      },
    ],
  },
  {
    id: "p10",
    kind: "single",
    category: "single_priority",
    text: {
      en: "What should be the first democratic reform?",
      sv: "Vad bör vara första demokratiska reformen?",
    },
    options: [
      {
        id: "citizens_assemblies",
        text: { en: "Citizen assemblies tied to parliament", sv: "Medborgarförsamlingar kopplade till riksdagen" },
        econ: -0.4,
        social: -1.5,
        emphasis: 1,
      },
      {
        id: "stronger_anti_corruption",
        text: { en: "Stronger anti-corruption and transparency watchdogs", sv: "Starkare antikorruption och transparensgranskning" },
        econ: -0.2,
        social: -0.7,
        emphasis: 1,
      },
      {
        id: "executive_capacity",
        text: { en: "Stronger executive powers for faster decisions", sv: "Starkare regeringsmakt for snabbare beslut" },
        econ: 0.4,
        social: 1.5,
        emphasis: 1,
      },
      {
        id: "constitutional_stability",
        text: { en: "Keep constitutional rules stable and difficult to change", sv: "Hålla grundlagens regler stabila och svåra att ändra" },
        econ: 0.6,
        social: 1.2,
        emphasis: 1,
      },
    ],
  },
  {
    id: "l1",
    kind: "likert",
    category: "left_leaning",
    text: {
      en: "Profit in tax-funded welfare should be strictly limited.",
      sv: "Vinster i skattefinansierad välfärd bör begransas kraftigt.",
    },
    econTilt: -2,
    socialTilt: 0.2,
  },
  {
    id: "l2",
    kind: "likert",
    category: "left_leaning",
    text: {
      en: "Union influence should increase in wage-setting and labor law.",
      sv: "Fackligt inflytande bör oka i lönebildning och arbetsrätt.",
    },
    econTilt: -1.7,
    socialTilt: -0.2,
  },
  {
    id: "l3",
    kind: "likert",
    category: "left_leaning",
    text: {
      en: "The state should build large amounts of affordable rental housing.",
      sv: "Staten bör bygga stora mängder prisvärda hyresrätter.",
    },
    econTilt: -1.7,
    socialTilt: 0,
  },
  {
    id: "l4",
    kind: "likert",
    category: "left_leaning",
    text: {
      en: "Progressive taxation should increase to finance welfare expansion.",
      sv: "Progressiv beskattning bör öka for att finansiera utbyggd välfärd.",
    },
    econTilt: -1.9,
    socialTilt: 0,
  },
  {
    id: "l5",
    kind: "likert",
    category: "left_leaning",
    text: {
      en: "Public ownership should expand in rail, energy grids, and critical infrastructure.",
      sv: "Offentligt ägande bör öka inom järnväg, elnät och kritisk infrastruktur.",
    },
    econTilt: -1.8,
    socialTilt: 0.5,
  },
  {
    id: "l6",
    kind: "likert",
    category: "left_leaning",
    text: {
      en: "A six-hour workday should be tested nationally in public sectors.",
      sv: "Sex timmars arbetsdag bör provas nationellt i offentlig sektor.",
    },
    econTilt: -1.3,
    socialTilt: -0.4,
  },
  {
    id: "l7",
    kind: "likert",
    category: "left_leaning",
    text: {
      en: "Climate transition costs should be borne primarily by high emitters and high-income groups.",
      sv: "Klimatomställningens kostnader bör bäras främst av stora utsläppare och höginkomsttagare.",
    },
    econTilt: -1.4,
    socialTilt: -0.4,
  },
  {
    id: "l8",
    kind: "likert",
    category: "left_leaning",
    text: {
      en: "Sick leave and unemployment insurance should be expanded even with higher taxes.",
      sv: "Sjukförsäkring och a-kassa bör byggas ut även med högre skattetryck.",
    },
    econTilt: -1.8,
    socialTilt: -0.1,
  },
  {
    id: "l9",
    kind: "likert",
    category: "left_leaning",
    text: {
      en: "The state should reintroduce stronger taxes on large inheritances and capital.",
      sv: "Staten bör återinföra starkare beskattning av stora arv och kapital.",
    },
    econTilt: -1.9,
    socialTilt: 0.2,
  },
  {
    id: "l10",
    kind: "likert",
    category: "left_leaning",
    text: {
      en: "The public sector should be the default provider for core welfare services.",
      sv: "Offentlig sektor bör vara huvudalternativet for central välfärd.",
    },
    econTilt: -1.6,
    socialTilt: 0.3,
  },
  {
    id: "r1",
    kind: "likert",
    category: "right_leaning",
    text: {
      en: "Lower taxes and stronger market incentives are the best path to growth.",
      sv: "Lägre skatter och starkare marknadsincitament är bästa vägen till tillväxt.",
    },
    econTilt: 2,
    socialTilt: 0.2,
  },
  {
    id: "r2",
    kind: "likert",
    category: "right_leaning",
    text: {
      en: "Labor law should be made more flexible for employers.",
      sv: "Arbetsrätten bör bli mer flexibel för arbetsgivare.",
    },
    econTilt: 1.8,
    socialTilt: 0.1,
  },
  {
    id: "r3",
    kind: "likert",
    category: "right_leaning",
    text: {
      en: "Criminal policy should prioritize punishment and deterrence over rehabilitation.",
      sv: "Kriminalpolitiken bör prioritera straff och avskräckning framför rehabilitering.",
    },
    econTilt: 0.3,
    socialTilt: 1.8,
  },
  {
    id: "r4",
    kind: "likert",
    category: "right_leaning",
    text: {
      en: "Border controls should remain strict even if labor shortages increase.",
      sv: "Gränskontroller bör förbli strikta även om arbetskraftsbrist ökar.",
    },
    econTilt: 0.5,
    socialTilt: 1.9,
  },
  {
    id: "r5",
    kind: "likert",
    category: "right_leaning",
    text: {
      en: "Energy reliability and industrial competitiveness should come before stricter climate goals.",
      sv: "Trygg energiförsörjning och industrins konkurrenskraft bör gå före skarpta klimatmål.",
    },
    econTilt: 1.2,
    socialTilt: 1.1,
  },
  {
    id: "r6",
    kind: "likert",
    category: "right_leaning",
    text: {
      en: "Free school choice and independent schools should be protected and expanded.",
      sv: "Fritt skolval och friskolor bör skyddas och byggas ut.",
    },
    econTilt: 1.7,
    socialTilt: 0.6,
  },
  {
    id: "r7",
    kind: "likert",
    category: "right_leaning",
    text: {
      en: "Regulation should be reduced even if it weakens some labor and environmental protections.",
      sv: "Regler bör minskas aven om vissa arbets- och miljöskydd forsvagas.",
    },
    econTilt: 1.8,
    socialTilt: 0.7,
  },
  {
    id: "r8",
    kind: "likert",
    category: "right_leaning",
    text: {
      en: "Policy should actively defend Swedish cultural traditions in public institutions.",
      sv: "Politiken bör aktivt forsvara svenska kulturtraditioner i offentliga institutioner.",
    },
    econTilt: 0.2,
    socialTilt: 1.7,
  },
  {
    id: "r9",
    kind: "likert",
    category: "right_leaning",
    text: {
      en: "Public benefits should require stricter activity and residency conditions.",
      sv: "Offentliga bidrag bör kräva strängare aktivitets- och bosättningsvillkor.",
    },
    econTilt: 1.3,
    socialTilt: 1.1,
  },
  {
    id: "r10",
    kind: "likert",
    category: "right_leaning",
    text: {
      en: "National defense and domestic control should outweigh supranational constraints.",
      sv: "Nationellt försvar och inhemsk kontroll bör väga tyngre än överstatliga begränsningar.",
    },
    econTilt: 0.9,
    socialTilt: 1.8,
  },
];

const ARCHETYPES = [
  { name: "Libertarian Left", description: "Socially libertarian with redistributive economics", x: -6.5, y: -6.5 },
  { name: "Libertarian Right", description: "Socially libertarian with free-market economics", x: 6.5, y: -6.5 },
  { name: "Authoritarian Left", description: "State-centered with egalitarian economics", x: -6.5, y: 6.5 },
  { name: "Authoritarian Right", description: "State-centered with market/tradition preference", x: 6.5, y: 6.5 },
  { name: "Centrist", description: "Mixed and moderate across both axes", x: 0, y: 0 },
  { name: "Left Populist", description: "Economically left with mixed social authority", x: -7, y: 0 },
  { name: "Right Populist", description: "Economically right with mixed social authority", x: 7, y: 0 },
  { name: "Civil Libertarian", description: "Strong anti-authoritarian preference", x: 0, y: -7 },
  { name: "Order Conservative", description: "Strong law/order preference", x: 0, y: 7 },
];

const CATEGORY_ORDER: QuestionCategory[] = ["general", "single_priority", "left_leaning", "right_leaning"];

const QUESTION_GRID: Record<string, { col: number; row: number }> = QUESTIONS.reduce((acc, question, index) => {
  acc[question.id] = {
    col: (index % 10) + 1,
    row: Math.floor(index / 10) + 1,
  };
  return acc;
}, {} as Record<string, { col: number; row: number }>);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length <= 1) {
    return 0;
  }
  const avg = mean(values);
  const variance = values.reduce((acc, value) => acc + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function percentile(values: number[], target: number): number {
  if (values.length === 0) {
    return 50;
  }
  const count = values.filter((value) => value <= target).length;
  return (count / values.length) * 100;
}

function zScore(value: number, avg: number, sigma: number): number {
  if (sigma === 0) {
    return 0;
  }
  return (value - avg) / sigma;
}

function axisDescriptor(score: number, left: string, right: string): string {
  if (score <= -3) {
    return left;
  }
  if (score >= 3) {
    return right;
  }
  return "centrist/mixed";
}

function nearestArchetype(econ: number, social: number) {
  const withDistance = ARCHETYPES.map((type) => {
    const distance = Math.sqrt((econ - type.x) ** 2 + (social - type.y) ** 2);
    return { ...type, distance };
  }).sort((a, b) => a.distance - b.distance);

  const winner = withDistance[0];
  const maxDistance = Math.sqrt(20 ** 2 + 20 ** 2);

  return {
    name: winner.name,
    description: winner.description,
    distance: winner.distance,
    similarityPct: clamp((1 - winner.distance / maxDistance) * 100, 0, 100),
  };
}

export function getQuestions(): Question[] {
  return QUESTIONS;
}

export function getStatements(mode: QuestionnaireMode = "advanced"): Statement[] {
  void mode;
  return QUESTIONS.map((question) => {
    const grid = QUESTION_GRID[question.id];
    const text = question.text.en;
    return {
      id: question.id,
      text,
      col: grid.col,
      row: grid.row,
      x: grid.col - 5.5,
      y: 2.5 - grid.row,
    };
  });
}

export function sanitizeAnswerValue(value: number): AnswerValue {
  const rounded = Math.round(value);
  return clamp(rounded, -2, 2) as AnswerValue;
}

function optionNumericValue(question: SingleChoiceQuestion, optionId: string): number {
  const index = question.options.findIndex((option) => option.id === optionId);
  if (index < 0) {
    return 0;
  }
  const center = (question.options.length - 1) / 2;
  return (index - center) * (4 / Math.max(question.options.length - 1, 1));
}

export function normalizeAnswers(
  input: Record<string, number | string | undefined>,
  mode: QuestionnaireMode = "advanced",
): AnswerMap {
  void mode;
  const out: AnswerMap = {};

  for (const question of QUESTIONS) {
    const raw = input[question.id];
    if (question.kind === "likert") {
      out[question.id] = sanitizeAnswerValue(typeof raw === "number" ? raw : 0);
      continue;
    }

    const selected = typeof raw === "string" ? raw : "";
    const isValid = question.options.some((option) => option.id === selected);
    out[question.id] = isValid ? selected : question.options[0].id;
  }

  return out;
}

function responseToPoint(question: Question, answer: AnswerValue | string): ResponsePoint {
  if (question.kind === "likert") {
    const value = typeof answer === "number" ? answer : 0;
    const label = SCALE_LABELS.en.find((scale) => scale.value === value)?.label ?? "Neutral";
    return {
      questionId: question.id,
      category: question.category,
      kind: "likert",
      text: question.text,
      answer: { en: label, sv: label },
      numericValue: value,
      econContribution: value * question.econTilt,
      socialContribution: value * question.socialTilt,
      emphasis: Math.abs(value),
    };
  }

  const option = question.options.find((item) => item.id === answer) ?? question.options[0];
  return {
    questionId: question.id,
    category: question.category,
    kind: "single",
    text: question.text,
    answer: option.text,
    numericValue: optionNumericValue(question, option.id),
    econContribution: option.econ,
    socialContribution: option.social,
    emphasis: option.emphasis,
  };
}

function moments(values: number[]) {
  if (values.length === 0) {
    return { skew: 0, kurtosis: 0 };
  }
  const avg = mean(values);
  const sigma = stdDev(values);
  if (sigma === 0) {
    return { skew: 0, kurtosis: 0 };
  }
  const skew = mean(values.map((value) => ((value - avg) / sigma) ** 3));
  const kurtosis = mean(values.map((value) => ((value - avg) / sigma) ** 4)) - 3;
  return { skew, kurtosis };
}

export function computeAnalysis(answers: AnswerMap, mode: QuestionnaireMode = "advanced"): Analysis {
  void mode;
  const responsePoints = QUESTIONS.map((question) => responseToPoint(question, answers[question.id]));

  const totalAbsEcon = responsePoints.reduce((acc, point) => acc + Math.abs(point.econContribution), 0);
  const totalAbsSocial = responsePoints.reduce((acc, point) => acc + Math.abs(point.socialContribution), 0);
  const rawX = responsePoints.reduce((acc, point) => acc + point.econContribution, 0);
  const rawY = responsePoints.reduce((acc, point) => acc + point.socialContribution, 0);
  const econ = totalAbsEcon === 0 ? 0 : clamp((rawX / totalAbsEcon) * 10, -10, 10);
  const social = totalAbsSocial === 0 ? 0 : clamp((rawY / totalAbsSocial) * 10, -10, 10);

  const numericValues = responsePoints.map((point) => point.numericValue);
  const intensityRaw = responsePoints.reduce((acc, point) => acc + point.emphasis, 0);
  const maxIntensity = responsePoints.reduce((acc, point) => acc + (point.kind === "likert" ? 2 : 1), 0);
  const intensityPct = maxIntensity === 0 ? 0 : (intensityRaw / maxIntensity) * 100;
  const distanceFromCenter = Math.sqrt(econ ** 2 + social ** 2);
  const extremityPct = (distanceFromCenter / Math.sqrt(10 ** 2 + 10 ** 2)) * 100;

  const avg = mean(numericValues);
  const variance = numericValues.reduce((acc, value) => acc + (value - avg) ** 2, 0) / Math.max(numericValues.length, 1);
  const stdDeviation = Math.sqrt(variance);

  const bins = new Map<string, number>();
  for (const point of responsePoints) {
    const key = point.kind === "likert" ? `lk:${point.numericValue}` : `sg:${point.answer.en}`;
    bins.set(key, (bins.get(key) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of bins.values()) {
    if (count === 0) {
      continue;
    }
    const p = count / responsePoints.length;
    entropy -= p * Math.log2(p);
  }
  const entropyMax = Math.log2(Math.max(bins.size, 1));
  const entropyPct = entropyMax === 0 ? 0 : (entropy / entropyMax) * 100;

  const coherenceX = totalAbsEcon === 0 ? 0 : (Math.abs(rawX) / totalAbsEcon) * 100;
  const coherenceY = totalAbsSocial === 0 ? 0 : (Math.abs(rawY) / totalAbsSocial) * 100;
  const coherenceOverall = (coherenceX + coherenceY) / 2;

  const polarizationIndex = clamp(intensityPct * 0.45 + extremityPct * 0.35 + coherenceOverall * 0.2, 0, 100);

  const moment = moments(numericValues);
  const convictionIndex = clamp(mean(responsePoints.map((point) => Math.abs(point.numericValue))) / 2 * 100, 0, 100);
  const predictabilityIndex = clamp((coherenceOverall * 0.6 + (100 - entropyPct) * 0.4), 0, 100);
  const axisAlignment = clamp(100 - Math.abs(Math.abs(econ) - Math.abs(social)) * 5, 0, 100);

  const categoryScores = CATEGORY_ORDER.reduce((acc, category) => {
    const bucket = responsePoints.filter((point) => point.category === category);
    const totalEcon = bucket.reduce((sum, point) => sum + point.econContribution, 0);
    const totalSocial = bucket.reduce((sum, point) => sum + point.socialContribution, 0);
    acc[category] = bucket.length === 0 ? 0 : (totalEcon + totalSocial) / bucket.length;
    return acc;
  }, {} as Record<QuestionCategory, number>);

  const categoryIntensities = CATEGORY_ORDER.reduce((acc, category) => {
    const bucket = responsePoints.filter((point) => point.category === category);
    const total = bucket.reduce((sum, point) => sum + point.emphasis, 0);
    const max = bucket.reduce((sum, point) => sum + (point.kind === "likert" ? 2 : 1), 0);
    acc[category] = max === 0 ? 0 : (total / max) * 100;
    return acc;
  }, {} as Record<QuestionCategory, number>);

  const statements = getStatements();
  const byId = new Map(statements.map((statement) => [statement.id, statement]));

  const scored = responsePoints.map((point) => {
    const statement = byId.get(point.questionId);
    return {
      id: point.questionId,
      text: point.text.en,
      value: point.numericValue,
      col: statement?.col ?? 1,
      row: statement?.row ?? 1,
      x: statement?.x ?? 0,
      y: statement?.y ?? 0,
    };
  });

  const topAgreements = scored
    .slice()
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .filter((item) => item.value > 0);
  const topDisagreements = scored
    .slice()
    .sort((a, b) => a.value - b.value)
    .slice(0, 8)
    .filter((item) => item.value < 0);

  let authLeft = 0;
  let authRight = 0;
  let libLeft = 0;
  let libRight = 0;
  for (const point of responsePoints) {
    if (point.econContribution < 0 && point.socialContribution > 0) {
      authLeft += point.emphasis;
    } else if (point.econContribution > 0 && point.socialContribution > 0) {
      authRight += point.emphasis;
    } else if (point.econContribution < 0 && point.socialContribution < 0) {
      libLeft += point.emphasis;
    } else if (point.econContribution > 0 && point.socialContribution < 0) {
      libRight += point.emphasis;
    }
  }

  const rowAverages = [
    mean(numericValues.slice(0, 10)),
    mean(numericValues.slice(10, 20)),
    mean(numericValues.slice(20, 30)),
    mean(numericValues.slice(30, 40)),
  ];

  const colAverages = Array.from({ length: 10 }, (_, index) =>
    mean([numericValues[index], numericValues[index + 10], numericValues[index + 20], numericValues[index + 30]]),
  );

  return {
    econ,
    social,
    intensityPct,
    distanceFromCenter,
    extremityPct,
    variance,
    stdDev: stdDeviation,
    entropyPct,
    coherenceX,
    coherenceY,
    coherenceOverall,
    polarizationIndex,
    responseSkew: moment.skew,
    responseKurtosis: moment.kurtosis,
    convictionIndex,
    predictabilityIndex,
    axisAlignment,
    categoryScores,
    categoryIntensities,
    topAgreements,
    topDisagreements,
    econLabel: axisDescriptor(econ, "left-leaning", "right-leaning"),
    socialLabel: axisDescriptor(social, "libertarian-leaning", "authoritarian-leaning"),
    nearestArchetype: nearestArchetype(econ, social),
    quadrantBalance: {
      authLeft,
      authRight,
      libLeft,
      libRight,
    },
    rowAverages,
    colAverages,
    responsePoints,
  };
}

export function buildCohortSummary(analyses: Analysis[], answers: AnswerMap[], mode?: QuestionnaireMode): CohortSummary {
  const statements = getStatements(mode ?? "advanced");
  if (analyses.length === 0) {
    return {
      sampleSize: 0,
      econMean: 0,
      econStd: 0,
      socialMean: 0,
      socialStd: 0,
      intensityMean: 0,
      intensityStd: 0,
      extremityMean: 0,
      extremityStd: 0,
      entropyMean: 0,
      entropyStd: 0,
      convictionMean: 0,
      convictionStd: 0,
      alignmentMean: 0,
      alignmentStd: 0,
      llmProfilesCount: 0,
      llmCoveragePct: 0,
      llmConfidenceCounts: {
        low: 0,
        medium: 0,
        high: 0,
      },
      llmAxisDeltaMean: 0,
      llmAxisDeltaStd: 0,
      categoryMeans: {
        general: 0,
        single_priority: 0,
        left_leaning: 0,
        right_leaning: 0,
      },
      categoryStd: {
        general: 0,
        single_priority: 0,
        left_leaning: 0,
        right_leaning: 0,
      },
      statementAverages: statements.map((statement) => ({ id: statement.id, text: statement.text, avg: 0 })),
      statementStdDev: statements.map((statement) => ({ id: statement.id, stdDev: 0 })),
      quadrantCounts: {
        authLeft: 0,
        authRight: 0,
        libLeft: 0,
        libRight: 0,
        centrist: 0,
      },
      econSocialCorrelation: 0,
    };
  }

  const econValues = analyses.map((analysis) => analysis.econ);
  const socialValues = analyses.map((analysis) => analysis.social);
  const intensityValues = analyses.map((analysis) => analysis.intensityPct);
  const extremityValues = analyses.map((analysis) => analysis.extremityPct);
  const entropyValues = analyses.map((analysis) => analysis.entropyPct);
  const convictionValues = analyses.map((analysis) => analysis.convictionIndex);
  const alignmentValues = analyses.map((analysis) => analysis.axisAlignment);
  const llmAnalyses = analyses.filter((analysis) => analysis.llmProfile);
  const llmAxisDeltas = llmAnalyses.map((analysis) => {
    const llm = analysis.llmProfile;
    if (!llm) {
      return 0;
    }
    const dx = analysis.econ - llm.axis_scores.econ;
    const dy = analysis.social - llm.axis_scores.social;
    return Math.sqrt(dx ** 2 + dy ** 2);
  });
  const llmConfidenceCounts = llmAnalyses.reduce(
    (acc, analysis) => {
      const level = analysis.llmProfile?.respondent_summary.confidence_level;
      if (level) {
        acc[level] += 1;
      }
      return acc;
    },
    { low: 0, medium: 0, high: 0 } as Record<LLMConfidenceLevel, number>,
  );

  const econAvg = mean(econValues);
  const socialAvg = mean(socialValues);

  let corrNumerator = 0;
  let econVar = 0;
  let socialVar = 0;
  for (let i = 0; i < analyses.length; i += 1) {
    const dx = econValues[i] - econAvg;
    const dy = socialValues[i] - socialAvg;
    corrNumerator += dx * dy;
    econVar += dx ** 2;
    socialVar += dy ** 2;
  }
  const econSocialCorrelation = econVar === 0 || socialVar === 0 ? 0 : corrNumerator / Math.sqrt(econVar * socialVar);

  const quadrantCounts = {
    authLeft: 0,
    authRight: 0,
    libLeft: 0,
    libRight: 0,
    centrist: 0,
  };
  for (const analysis of analyses) {
    if (Math.abs(analysis.econ) < 1.5 && Math.abs(analysis.social) < 1.5) {
      quadrantCounts.centrist += 1;
    } else if (analysis.econ < 0 && analysis.social > 0) {
      quadrantCounts.authLeft += 1;
    } else if (analysis.econ > 0 && analysis.social > 0) {
      quadrantCounts.authRight += 1;
    } else if (analysis.econ < 0 && analysis.social < 0) {
      quadrantCounts.libLeft += 1;
    } else if (analysis.econ > 0 && analysis.social < 0) {
      quadrantCounts.libRight += 1;
    }
  }

  const statementAverages = QUESTIONS.map((question) => {
    const values = answers.map((answerMap) => {
      const raw = answerMap[question.id];
      if (question.kind === "likert") {
        return typeof raw === "number" ? raw : 0;
      }
      return typeof raw === "string" ? optionNumericValue(question, raw) : 0;
    });
    return {
      id: question.id,
      text: question.text.en,
      avg: mean(values),
    };
  });

  const statementStdDev = QUESTIONS.map((question) => {
    const values = answers.map((answerMap) => {
      const raw = answerMap[question.id];
      if (question.kind === "likert") {
        return typeof raw === "number" ? raw : 0;
      }
      return typeof raw === "string" ? optionNumericValue(question, raw) : 0;
    });
    return {
      id: question.id,
      stdDev: stdDev(values),
    };
  });

  const categoryMeans = CATEGORY_ORDER.reduce((acc, category) => {
    const values = analyses.map((analysis) => analysis.categoryScores[category]);
    acc[category] = mean(values);
    return acc;
  }, {} as Record<QuestionCategory, number>);

  const categoryStd = CATEGORY_ORDER.reduce((acc, category) => {
    const values = analyses.map((analysis) => analysis.categoryScores[category]);
    acc[category] = stdDev(values);
    return acc;
  }, {} as Record<QuestionCategory, number>);

  return {
    sampleSize: analyses.length,
    econMean: econAvg,
    econStd: stdDev(econValues),
    socialMean: socialAvg,
    socialStd: stdDev(socialValues),
    intensityMean: mean(intensityValues),
    intensityStd: stdDev(intensityValues),
    extremityMean: mean(extremityValues),
    extremityStd: stdDev(extremityValues),
    entropyMean: mean(entropyValues),
    entropyStd: stdDev(entropyValues),
    convictionMean: mean(convictionValues),
    convictionStd: stdDev(convictionValues),
    alignmentMean: mean(alignmentValues),
    alignmentStd: stdDev(alignmentValues),
    llmProfilesCount: llmAnalyses.length,
    llmCoveragePct: analyses.length === 0 ? 0 : (llmAnalyses.length / analyses.length) * 100,
    llmConfidenceCounts,
    llmAxisDeltaMean: mean(llmAxisDeltas),
    llmAxisDeltaStd: stdDev(llmAxisDeltas),
    categoryMeans,
    categoryStd,
    statementAverages,
    statementStdDev,
    quadrantCounts,
    econSocialCorrelation,
  };
}

export function compareToCohort(analysis: Analysis, analyses: Analysis[]): ComparativeMetrics {
  const econValues = analyses.map((item) => item.econ);
  const socialValues = analyses.map((item) => item.social);
  const intensityValues = analyses.map((item) => item.intensityPct);
  const extremityValues = analyses.map((item) => item.extremityPct);
  const entropyValues = analyses.map((item) => item.entropyPct);

  return {
    econPercentile: percentile(econValues, analysis.econ),
    socialPercentile: percentile(socialValues, analysis.social),
    intensityPercentile: percentile(intensityValues, analysis.intensityPct),
    extremityPercentile: percentile(extremityValues, analysis.extremityPct),
    entropyPercentile: percentile(entropyValues, analysis.entropyPct),
    econZ: zScore(analysis.econ, mean(econValues), stdDev(econValues)),
    socialZ: zScore(analysis.social, mean(socialValues), stdDev(socialValues)),
    intensityZ: zScore(analysis.intensityPct, mean(intensityValues), stdDev(intensityValues)),
    extremityZ: zScore(analysis.extremityPct, mean(extremityValues), stdDev(extremityValues)),
  };
}

export function buildNarrative(analysis: Analysis, comparative?: ComparativeMetrics): string[] {
  const lines: string[] = [];

  lines.push(
    `You place ${analysis.econLabel} on economics (${analysis.econ.toFixed(2)}) and ${analysis.socialLabel} on social authority (${analysis.social.toFixed(2)}).`,
  );

  lines.push(
    `Your nearest archetype is ${analysis.nearestArchetype.name} with ${analysis.nearestArchetype.similarityPct.toFixed(1)}% geometric similarity.`,
  );

  if (analysis.extremityPct >= 70) {
    lines.push("Your ideological distance from center is high, indicating a strongly directional identity.");
  } else if (analysis.extremityPct <= 30) {
    lines.push("Your ideological distance from center is low, indicating a moderate or mixed orientation.");
  } else {
    lines.push("Your ideological distance from center is moderate, suggesting selective intensity.");
  }

  if (analysis.coherenceOverall >= 65) {
    lines.push("Cross-item directional coherence is high, suggesting internally consistent ideological structure.");
  } else {
    lines.push("Cross-item directional coherence is mixed, suggesting cross-pressured beliefs across issues.");
  }

  lines.push(`Conviction index: ${analysis.convictionIndex.toFixed(1)}%. Predictability index: ${analysis.predictabilityIndex.toFixed(1)}%.`);

  if (comparative) {
    lines.push(
      `Relative to the cohort, your intensity is at the ${comparative.intensityPercentile.toFixed(1)}th percentile and extremity at the ${comparative.extremityPercentile.toFixed(1)}th percentile.`,
    );
  }

  return lines;
}