import type {
  ContentQualityReport,
  CreativeBrief,
  OutputValidationCheck,
  ResearchResult,
  ScriptData,
} from "../types.ts";

const CLAIM_PATTERNS = [
  /\btop\s*\d+\b/i,
  /排名第?[一二三四五六七八九十\d]+/,
  /最受欢迎|全网第一|行业第一|用户数|融资|估值/,
  /\$[0-9]+|免费版|价格|套餐|订阅|月付|年付/,
];

export function validateContentQuality(
  research: ResearchResult,
  creative: CreativeBrief,
  script: ScriptData,
): ContentQualityReport {
  const text = collectScriptText(script);
  const hasPriceSegment = script.segments.some((segment) => segment.sceneType === "PRICING");
  const hasWorkflowOrUseCase = script.segments.some((segment) =>
    ["WORKFLOW", "TARGET_USER"].includes(segment.sceneType),
  );
  const unsupportedClaims = findUnsupportedClaims(text, research);
  const longEnglishLines = text.filter(hasLongEnglishRun);
  const insightCategories = new Set((research.insights ?? []).map((item) => item.category));

  const checks = [
    check("researchConfidencePresent", Boolean(research.confidence), research.confidence ?? "missing", "high|medium|low"),
    check(
      "sourceCoverage",
      (research.sourcePages?.length ?? 0) >= 2,
      research.sourcePages?.length ?? 0,
      "homepage plus at least one extension source",
    ),
    check("evidencePresent", (research.evidence?.length ?? 0) >= 2, research.evidence?.length ?? 0, ">=2"),
    check("insightsPresent", (research.insights?.length ?? 0) >= 3, research.insights?.length ?? 0, ">=3"),
    check("positioningInsightPresent", insightCategories.has("positioning"), [...insightCategories].join(", ") || "none", "positioning"),
    check(
      "capabilityInsightPresent",
      insightCategories.has("core_capability") || insightCategories.has("workflow"),
      [...insightCategories].join(", ") || "none",
      "core_capability or workflow",
    ),
    check(
      "useCaseInsightPresent",
      insightCategories.has("use_case") || insightCategories.has("workflow") || insightCategories.has("audience"),
      [...insightCategories].join(", ") || "none",
      "use_case, workflow, or audience",
    ),
    check("creativeAngleSelected", Boolean(creative.selectedAngle?.id), creative.selectedAngle?.id ?? "missing", "selected angle"),
    check("sceneBeatsPresent", creative.sceneBeats.length >= 4, creative.sceneBeats.length, ">=4"),
    check("noPriceSegment", !hasPriceSegment, hasPriceSegment, false),
    check("workflowOrUseCasePresent", hasWorkflowOrUseCase, hasWorkflowOrUseCase, true),
    check("noUnsupportedCommercialClaims", unsupportedClaims.length === 0, unsupportedClaims.join(" | ") || "none", "no unsupported price, rank, user, funding claims"),
    check("noLongEnglishCopy", longEnglishLines.length === 0, longEnglishLines.join(" | ") || "none", "no long raw official English copy in narration or on-screen text"),
    check("notRigidProductIntro", !looksLikeRigidProductIntro(script), script.segments.map((segment) => segment.title).join(" / "), "self-media explainer structure"),
  ];

  return {
    schemaVersion: 1,
    inspectedAt: new Date().toISOString(),
    passed: checks.every((item) => item.passed),
    checks,
    summary: {
      confidence: research.confidence,
      sourcePageCount: research.sourcePages?.length ?? 0,
      evidenceCount: research.evidence?.length ?? 0,
      insightCount: research.insights?.length ?? 0,
      segmentCount: script.segments.length,
      hasPriceSegment,
      hasWorkflowOrUseCase,
    },
  };
}

function collectScriptText(script: ScriptData): string[] {
  return [
    script.hook,
    script.coreSellingPoint,
    ...script.segments.flatMap((segment) => [
      segment.title,
      segment.narration,
      ...(segment.bullets ?? []),
    ]),
  ].filter(Boolean);
}

function findUnsupportedClaims(text: string[], research: ResearchResult): string[] {
  const evidenceText = [
    research.pricing === "unknown" ? "" : research.pricing,
    ...(research.evidence ?? []).map((item) => item.text),
    ...(research.sourcePages ?? []).flatMap((page) => [page.title ?? "", page.description ?? ""]),
  ].join("\n");

  return text.filter((line) =>
    CLAIM_PATTERNS.some((pattern) => pattern.test(line) && !pattern.test(evidenceText)),
  );
}

function hasLongEnglishRun(text: string): boolean {
  const matches = text.match(/[A-Za-z][A-Za-z0-9 ,.'’:&()/-]{48,}/g) ?? [];
  return matches.some((match) => match.trim().split(/\s+/).length >= 8);
}

function looksLikeRigidProductIntro(script: ScriptData): boolean {
  const titles = script.segments.map((segment) => segment.title).join(" ");
  return /价格|套餐|产品介绍|功能介绍/.test(titles);
}

function check(
  name: string,
  passed: boolean,
  actual?: string | number | boolean,
  expected?: string | number | boolean,
): OutputValidationCheck {
  return { name, passed, actual, expected };
}
