import type { AssetCandidate, AssetData, PageCandidateKind, ScoredAssetCandidate } from "../types.ts";

type SelectionInput = {
  pageCandidates: AssetCandidate[];
  videoCandidates: AssetCandidate[];
};

const KIND_BASE_SCORE: Record<PageCandidateKind, number> = {
  homepage: 20,
  features: 88,
  demo: 92,
  use_cases: 84,
  docs: 74,
  customers: 68,
  enterprise: 76,
  download: 44,
  pricing: 18,
  other: 30,
};

export function scoreAssets(assets: AssetData): AssetData {
  const input: SelectionInput = {
    pageCandidates: assets.pageCandidates ?? [],
    videoCandidates: assets.videoCandidates ?? [],
  };
  const scoredCandidates = [
    ...scorePageCandidates(input.pageCandidates),
    ...scoreVideoCandidates(input.videoCandidates),
  ].sort((a, b) => b.score - a.score);

  return {
    ...assets,
    scoredCandidates,
    selectedAssets: {
      websiteDemoPage: selectBestPage(scoredCandidates, ["demo", "features", "use_cases", "docs", "enterprise"]),
      featurePage: selectBestPage(scoredCandidates, ["features", "docs", "enterprise", "demo"]),
      workflowPage: selectBestPage(scoredCandidates, ["use_cases", "docs", "features", "customers"]),
      demoVideo: scoredCandidates.find((candidate) => candidate.type === "video"),
    },
  };
}

function scorePageCandidates(candidates: AssetCandidate[]): ScoredAssetCandidate[] {
  return candidates
    .filter((candidate) => candidate.type === "page" && candidate.url)
    .map((candidate) => {
      const kind = candidate.kind ?? "other";
      const reasons = [`kind:${kind}`];
      let score = KIND_BASE_SCORE[kind];

      if (candidate.confidence === "high") {
        score += 12;
        reasons.push("high confidence");
      } else if (candidate.confidence === "medium") {
        score += 6;
      }

      const text = `${candidate.label ?? ""} ${candidate.url ?? ""}`.toLowerCase();
      if (/demo|showcase|product|feature|agent|workflow|docs|guide/.test(text)) {
        score += 8;
        reasons.push("content-rich page");
      }
      if (/pricing|login|signin|contact-sales|contact sales|request a demo/.test(text)) {
        score -= kind === "demo" ? 34 : 18;
        reasons.push("less useful for explainer visuals");
      }

      return { ...candidate, kind, score, reasons };
    });
}

function scoreVideoCandidates(candidates: AssetCandidate[]): ScoredAssetCandidate[] {
  return candidates
    .filter((candidate) => candidate.type === "video" && candidate.url)
    .map((candidate) => {
      const kind = candidate.kind ?? "demo";
      const reasons = ["video candidate"];
      let score = 76;
      if (candidate.source === "official_site") {
        score += 12;
        reasons.push("official source");
      }
      if (candidate.confidence === "high") {
        score += 8;
      }
      return { ...candidate, kind, score, reasons };
    });
}

function selectBestPage(
  candidates: ScoredAssetCandidate[],
  preferredKinds: PageCandidateKind[],
): ScoredAssetCandidate | undefined {
  return candidates
    .filter((candidate) => candidate.type === "page")
    .filter((candidate) => preferredKinds.includes(candidate.kind ?? "other"))
    .sort((a, b) => adjustedScore(b, preferredKinds) - adjustedScore(a, preferredKinds))[0] ??
    candidates.find((candidate) => candidate.type === "page");
}

function adjustedScore(candidate: ScoredAssetCandidate, preferredKinds: PageCandidateKind[]): number {
  const preferenceIndex = preferredKinds.indexOf(candidate.kind ?? "other");
  const preferenceBonus = preferenceIndex >= 0 ? (preferredKinds.length - preferenceIndex) * 16 : 0;
  return candidate.score + preferenceBonus;
}
