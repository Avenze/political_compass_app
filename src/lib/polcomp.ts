export type AnswerValue = -2 | -1 | 0 | 1 | 2;

export type Statement = {
  id: string;
  text: string;
  col: number;
  row: number;
  x: number;
  y: number;
};

export type AnswerMap = Record<string, AnswerValue>;

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
  topAgreements: Array<Statement & { value: AnswerValue }>;
  topDisagreements: Array<Statement & { value: AnswerValue }>;
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

export type QuestionnaireMode = "simple" | "advanced";

export function normalizeMode(input?: string): QuestionnaireMode {
  return input === "simple" ? "simple" : "advanced";
}

const LETTERS = "abcdefghijkl";

const ADVANCED_RAW_STATEMENTS = `
a1|Essential industries should be publicly owned and centrally planned.
b1|Major investment decisions should be directed by national economic plans.
c1|The state should cap executive pay in large companies.
d1|Price controls are justified during economic shocks.
e1|Strong industrial policy is better than market competition alone.
f1|National security should justify strict control of private capital.
g1|A strong state should enforce a shared moral framework.
h1|Public order should take priority over protest rights.
i1|Mass surveillance is acceptable to prevent serious threats.
j1|Courts should defer to elected leaders during crises.
k1|National unity is more important than regional autonomy.
l1|Emergency powers should be easy for governments to activate.
a2|Large firms should be converted into worker-run cooperatives.
b2|Public banks should direct credit toward social priorities.
c2|The government should tightly regulate rents and housing prices.
d2|Inheritance should be heavily taxed to reduce class privilege.
e2|Strategic sectors should receive permanent state subsidies.
f2|Governments should set wages through national bargaining frameworks.
g2|Online platforms should remove destabilizing political content quickly.
h2|Schools should emphasize civic duty over personal self-expression.
i2|Military service or national service should be mandatory.
j2|Strong border controls are necessary even in peacetime.
k2|Traditional institutions should be protected from rapid social change.
l2|A nation should prioritize cultural conformity over pluralism.
a3|Private ownership of natural resources should be phased out.
b3|Essential utilities should never operate for profit.
c3|Governments should guarantee employment through public works.
d3|Tax policy should aim to compress income differences dramatically.
e3|International trade should be limited to protect domestic workers.
f3|The state should be able to direct production in key industries.
g3|Political dissent that threatens stability should face legal limits.
h3|Public broadcasters should promote national values over neutrality.
i3|Immigration should be restricted to preserve social cohesion.
j3|Police should have broad discretion to maintain order.
k3|Patriotism should be a central part of school curricula.
l3|Leaders should have authority to override local governments.
a4|Land value gains should be socialized through taxation.
b4|Public procurement should favor unionized and cooperative firms.
c4|Government should set maximum prices for basic necessities.
d4|A universal basic services model is better than private provision.
e4|Corporate governance should include mandatory worker representation.
f4|National development goals should outweigh investor preferences.
g4|Hate speech bans are necessary even if they limit expression.
h4|Religious symbols should be restricted in state institutions.
i4|Public morality laws are needed to protect social stability.
j4|Referendums should be limited on sensitive constitutional issues.
k4|Civil liberties can be curtailed when security risks increase.
l4|Central authorities should coordinate media messaging during crises.
a5|Public ownership should expand in transportation and energy.
b5|Progressive taxes should fund broad social guarantees.
c5|Government should subsidize childcare as core infrastructure.
d5|Housing should be treated primarily as a social good.
e5|Monopolies should be broken up even at economic cost.
f5|Workers should have strong rights to strike and bargain.
g5|Content moderation should balance safety and open debate.
h5|Counterterror policies should include strict judicial oversight.
i5|Schools should teach national history from multiple perspectives.
j5|Prison sentences should focus more on rehabilitation than punishment.
k5|Religion and state should remain institutionally separate.
l5|Public institutions should accommodate diverse cultural practices.
a6|Universal healthcare should be publicly financed and guaranteed.
b6|Higher education should be low-cost or free at point of use.
c6|A strong welfare state improves long-term economic resilience.
d6|Government should intervene quickly to prevent mass layoffs.
e6|Competition policy should prevent excessive corporate concentration.
f6|Financial markets need tighter public oversight.
g6|Freedom of expression should include unpopular political views.
h6|Police powers should be constrained by independent review.
i6|Drug policy should prioritize harm reduction over punishment.
j6|Immigration policy should combine legal pathways with fair enforcement.
k6|Election systems should maximize participation and representativeness.
l6|Constitutions should strongly limit executive authority.
a7|Income redistribution is necessary for democratic stability.
b7|Public pensions should be expanded to reduce elder poverty.
c7|Climate policy should include strong worker transition programs.
d7|Labor law should make union formation easier.
e7|Essential medicines should be affordable through public negotiation.
f7|Governments should use antitrust law aggressively.
g7|Community safety can improve without expanding incarceration.
h7|Personal lifestyle choices should be protected from state interference.
i7|Adults should have broad bodily autonomy rights.
j7|Civil marriage law should be equal regardless of gender.
k7|Speech restrictions should be narrowly tailored and rare.
l7|Public policy should be based on evidence, not tradition alone.
a8|Worker-owned enterprises should receive tax advantages.
b8|Public investment should target underserved regions first.
c8|A living wage should be enforced nationally.
d8|Local governments should have flexibility in social policy design.
e8|Carbon pricing should be paired with rebates for low-income households.
f8|Digital infrastructure should be treated as a public utility.
g8|Government should be transparent by default.
h8|Whistleblower protections are essential for accountability.
i8|Decentralized decision-making usually improves public trust.
j8|Religious freedom includes freedom from religious coercion.
k8|Consenting adults should be free to make private choices.
l8|Peaceful protest should be protected even when disruptive.
a9|Strong social insurance reduces economic anxiety.
b9|Public development banks can support long-term innovation.
c9|Tax systems should close loopholes before raising rates.
d9|Public-private partnerships should include strict accountability rules.
e9|Competition and regulation should work together, not as opposites.
f9|Trade policy should protect labor and environmental standards.
g9|Police budgets should prioritize de-escalation and training.
h9|Data privacy should be a fundamental right.
i9|Citizens should have strong rights against unreasonable searches.
j9|Government should not police harmless personal behavior.
k9|Community organizations should share power in local governance.
l9|Migration policy should respect humanitarian obligations.
a10|Universal basic income should be tested at meaningful scale.
b10|Co-determination can improve firm productivity and fairness.
c10|Public transit should be prioritized over highway expansion.
d10|Patents should balance innovation incentives with public access.
e10|Central banks should consider employment alongside inflation.
f10|Fiscal policy should respond aggressively during recessions.
g10|Criminal justice should reduce pretrial detention.
h10|Jury and due-process protections should be strengthened.
i10|School curricula should encourage critical thinking about authority.
j10|Open government records should be easy to access.
k10|Municipal autonomy should be protected from central interference.
l10|Voluntary associations should solve problems before state coercion.
a11|Community land trusts can improve long-term housing affordability.
b11|Mutual aid networks should complement formal welfare systems.
c11|Smaller firms should face fewer barriers to market entry.
d11|Regulation should be simple, predictable, and easy to comply with.
e11|Innovation policy should support open standards and interoperability.
f11|People should be free to choose among diverse work arrangements.
g11|Nonviolent civil disobedience is sometimes morally justified.
h11|Drug decriminalization should be paired with treatment access.
i11|The state should not enforce a single moral doctrine.
j11|Individuals should control their personal data and digital identity.
k11|Voluntary civic service is preferable to compulsory service.
l11|Pluralism is a strength even when it creates social friction.
a12|Economic policy should favor decentralized cooperative experimentation.
b12|Local communities should control more public spending decisions.
c12|People should be free to start enterprises with minimal licensing.
d12|Cross-border movement should be easier for work and study.
e12|Most speech should remain legal unless it directly incites violence.
f12|Victimless activities should not be criminal offenses.
g12|Individuals should be free to refuse state-mandated values.
h12|Privacy tools should be legal and widely accessible.
i12|Power should be dispersed across institutions to prevent domination.
j12|Community self-governance should be preferred where feasible.
k12|Markets can coordinate many choices better than central planning.
l12|The state should intervene only when clearly necessary.
`;

const SIMPLE_RAW_STATEMENTS = `
a1|The government should do more to reduce income inequality.
b1|Large corporations have too much power.
c1|Healthcare should be guaranteed for everyone.
d1|Public services should be funded even if taxes increase.
e1|Private markets usually solve problems better than governments.
f1|People should mostly keep what they earn.
a2|Strong law enforcement makes society safer.
b2|Government surveillance is acceptable for security.
c2|Free speech should be protected even for offensive opinions.
d2|People should have broad freedom in personal lifestyle choices.
e2|Tradition should have a strong role in public life.
f2|Social change is usually good for society.
a3|Immigration should be more open.
b3|National borders should be enforced more strictly.
c3|International cooperation is more important than national interests.
d3|Military strength should be a top national priority.
e3|Climate regulation should be strict even if it slows economic growth.
f3|Economic growth is more important than environmental regulation.
a4|Unions are good for workers and society.
b4|Welfare systems create long-term dependency.
c4|Religion should have little influence on government policy.
d4|Schools should focus more on civic discipline and obedience.
e4|Drug policy should focus more on decriminalization than punishment.
f4|Markets should decide prices and wages with minimal state intervention.
`;

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

function toStatement(line: string): Statement {
  const [id, text] = line.split("|");
  const colLetter = id[0] ?? "a";
  const row = Number(id.slice(1));
  const col = LETTERS.indexOf(colLetter) + 1;

  return {
    id,
    text,
    col,
    row,
    x: col - 6.5,
    y: 6.5 - row,
  };
}

function simplifyAdvancedText(text: string): string {
  return text
    .replace(/"/g, "")
    .replace(/Stans\s+/gi, "Supports ")
    .replace(/\bNazbol\b/gi, "National Bolshevik")
    .replace(/\bMAGA\b/g, "supports MAGA politics")
    .replace(/\bQAnon\b/g, "QAnon")
    .replace(/\b4chan\b/g, "4chan")
    .replace(/\bUwU\b/g, "anime/internet culture")
    .replace(/\bBLM\b/g, "BLM")
    .replace(/\bLGBTQ\b/g, "LGBTQ+");
}

export const ADVANCED_STATEMENTS: Statement[] = ADVANCED_RAW_STATEMENTS.trim()
  .split("\n")
  .map(toStatement)
  .map((statement) => ({ ...statement, text: simplifyAdvancedText(statement.text) }));

export const SIMPLE_STATEMENTS: Statement[] = SIMPLE_RAW_STATEMENTS.trim().split("\n").map(toStatement);

export function getStatements(mode: QuestionnaireMode = "advanced"): Statement[] {
  return mode === "simple" ? SIMPLE_STATEMENTS : ADVANCED_STATEMENTS;
}

export const STATEMENTS = ADVANCED_STATEMENTS;

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

export function sanitizeAnswerValue(value: number): AnswerValue {
  const rounded = Math.round(value);
  return clamp(rounded, -2, 2) as AnswerValue;
}

export function normalizeAnswers(input: Record<string, number | undefined>, mode: QuestionnaireMode = "advanced"): AnswerMap {
  const statements = getStatements(mode);
  const out: AnswerMap = {};
  for (const statement of statements) {
    const value = input[statement.id];
    out[statement.id] = sanitizeAnswerValue(value ?? 0);
  }
  return out;
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

export function computeAnalysis(answers: AnswerMap, mode: QuestionnaireMode = "advanced"): Analysis {
  const statements = getStatements(mode);
  const maxX = statements.reduce((acc, statement) => acc + Math.abs(statement.x) * 2, 0);
  const maxY = statements.reduce((acc, statement) => acc + Math.abs(statement.y) * 2, 0);

  let rawX = 0;
  let rawY = 0;
  let intensity = 0;
  let directionalX = 0;
  let directionalY = 0;
  let directionalXAbs = 0;
  let directionalYAbs = 0;

  const values: number[] = [];
  const maxRow = statements.reduce((acc, statement) => Math.max(acc, statement.row), 1);
  const maxCol = statements.reduce((acc, statement) => Math.max(acc, statement.col), 1);
  const rowBuckets = Array.from({ length: maxRow }, () => [] as number[]);
  const colBuckets = Array.from({ length: maxCol }, () => [] as number[]);

  let authLeft = 0;
  let authRight = 0;
  let libLeft = 0;
  let libRight = 0;

  for (const statement of statements) {
    const value = answers[statement.id] ?? 0;
    values.push(value);

    rowBuckets[statement.row - 1].push(value);
    colBuckets[statement.col - 1].push(value);

    const cx = statement.x * value;
    const cy = statement.y * value;

    rawX += cx;
    rawY += cy;
    intensity += Math.abs(value);

    directionalX += cx;
    directionalY += cy;
    directionalXAbs += Math.abs(cx);
    directionalYAbs += Math.abs(cy);

    if (statement.x < 0 && statement.y > 0) {
      authLeft += value;
    } else if (statement.x > 0 && statement.y > 0) {
      authRight += value;
    } else if (statement.x < 0 && statement.y < 0) {
      libLeft += value;
    } else if (statement.x > 0 && statement.y < 0) {
      libRight += value;
    }
  }

  const econ = clamp((rawX / maxX) * 10, -10, 10);
  const social = clamp((rawY / maxY) * 10, -10, 10);
  const intensityPct = (intensity / (statements.length * 2)) * 100;
  const distanceFromCenter = Math.sqrt(econ ** 2 + social ** 2);
  const extremityPct = (distanceFromCenter / Math.sqrt(10 ** 2 + 10 ** 2)) * 100;

  const avg = mean(values);
  const variance = values.reduce((acc, value) => acc + (value - avg) ** 2, 0) / values.length;
  const stdDeviation = Math.sqrt(variance);

  const bucketMap = new Map<number, number>([
    [-2, 0],
    [-1, 0],
    [0, 0],
    [1, 0],
    [2, 0],
  ]);
  for (const value of values) {
    bucketMap.set(value, (bucketMap.get(value) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of bucketMap.values()) {
    if (count === 0) {
      continue;
    }
    const p = count / values.length;
    entropy -= p * Math.log2(p);
  }
  const entropyPct = (entropy / Math.log2(5)) * 100;

  const coherenceX = directionalXAbs === 0 ? 0 : (Math.abs(directionalX) / directionalXAbs) * 100;
  const coherenceY = directionalYAbs === 0 ? 0 : (Math.abs(directionalY) / directionalYAbs) * 100;
  const coherenceOverall = (coherenceX + coherenceY) / 2;

  const polarizationIndex = clamp(intensityPct * 0.6 + extremityPct * 0.4, 0, 100);

  const withValue = statements.map((statement) => ({ ...statement, value: answers[statement.id] ?? 0 }));
  const topAgreements = withValue
    .slice()
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .filter((item) => item.value > 0);
  const topDisagreements = withValue
    .slice()
    .sort((a, b) => a.value - b.value)
    .slice(0, 8)
    .filter((item) => item.value < 0);

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
    rowAverages: rowBuckets.map((bucket) => mean(bucket)),
    colAverages: colBuckets.map((bucket) => mean(bucket)),
  };
}

export function buildCohortSummary(
  analyses: Analysis[],
  answers: AnswerMap[],
  mode?: QuestionnaireMode,
): CohortSummary {
  const statements = mode ? getStatements(mode) : [];
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

  const econAvg = mean(econValues);
  const socialAvg = mean(socialValues);
  const econSigma = stdDev(econValues);
  const socialSigma = stdDev(socialValues);

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

  const statementAverages = statements.map((statement) => {
    const values = answers.map((answerMap) => answerMap[statement.id] ?? 0);
    return {
      id: statement.id,
      text: statement.text,
      avg: mean(values),
    };
  });

  const statementStdDev = statements.map((statement) => {
    const values = answers.map((answerMap) => answerMap[statement.id] ?? 0);
    return {
      id: statement.id,
      stdDev: stdDev(values),
    };
  });

  return {
    sampleSize: analyses.length,
    econMean: econAvg,
    econStd: econSigma,
    socialMean: socialAvg,
    socialStd: socialSigma,
    intensityMean: mean(intensityValues),
    intensityStd: stdDev(intensityValues),
    extremityMean: mean(extremityValues),
    extremityStd: stdDev(extremityValues),
    entropyMean: mean(entropyValues),
    entropyStd: stdDev(entropyValues),
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
    `You place ${analysis.econLabel} on economics (${analysis.econ.toFixed(2)}) and ${analysis.socialLabel} on social authority (${analysis.social.toFixed(2)}).`
  );

  lines.push(
    `Your nearest archetype is ${analysis.nearestArchetype.name} with ${analysis.nearestArchetype.similarityPct.toFixed(1)}% geometric similarity.`
  );

  if (analysis.extremityPct >= 70) {
    lines.push("Your ideological distance from center is high, indicating a strongly directional identity.");
  } else if (analysis.extremityPct <= 30) {
    lines.push("Your ideological distance from center is low, indicating a moderate or mixed orientation.");
  } else {
    lines.push("Your ideological distance from center is moderate, suggesting selective intensity.");
  }

  if (analysis.entropyPct >= 75) {
    lines.push("Your answer distribution spans the full response scale, indicating nuanced gradation rather than binary alignment.");
  } else if (analysis.entropyPct <= 40) {
    lines.push("Your answer distribution is concentrated in fewer categories, indicating more rigid response style.");
  }

  if (analysis.coherenceOverall >= 65) {
    lines.push("Cross-item directional coherence is high, suggesting internally consistent ideological structure.");
  } else {
    lines.push("Cross-item directional coherence is mixed, suggesting cross-pressured beliefs across issues.");
  }

  if (comparative) {
    lines.push(
      `Relative to the cohort, your intensity is at the ${comparative.intensityPercentile.toFixed(1)}th percentile and extremity at the ${comparative.extremityPercentile.toFixed(1)}th percentile.`
    );
  }

  return lines;
}
