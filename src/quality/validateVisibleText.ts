import type { Caption, OutputValidationCheck, PlannedScene, ScriptData } from "../types.ts";

const FORBIDDEN_VISIBLE_TEXT = [
  "…",
  "...",
  "unknown",
  "待补充",
  "真实官网截图",
  "开场钩子",
  "官网展示",
  "HyperFrames",
  "Remotion",
  "Official assets",
];

export function validateVisibleText(
  script: ScriptData,
  scenes: PlannedScene[],
  captions: Caption[],
): OutputValidationCheck[] {
  const visibleText = collectVisibleText(script, scenes, captions);
  return [
    {
      name: "noForbiddenVisibleText",
      passed: visibleText.violations.length === 0,
      actual: visibleText.violations.join(" | ") || "none",
      expected: "no ellipsis, unknown placeholders, internal template labels, or incomplete fallback text",
    },
  ];
}

function collectVisibleText(
  script: ScriptData,
  scenes: PlannedScene[],
  captions: Caption[],
): { violations: string[] } {
  const candidates = [
    script.toolName,
    script.hook,
    script.coreSellingPoint,
    ...script.segments.flatMap((segment) => [
      segment.sceneType === "WEBSITE_DEMO" ? "" : segment.title,
      segment.narration,
      ...(segment.bullets ?? []),
    ]),
    ...scenes.flatMap((scene) => [
      scene.type === "WEBSITE_DEMO" ? "" : scene.title,
      scene.narration,
      ...scene.bullets,
    ]),
    ...captions.map((caption) => caption.text),
  ].filter(Boolean);

  const violations = new Set<string>();
  for (const text of candidates) {
    for (const forbidden of FORBIDDEN_VISIBLE_TEXT) {
      if (text.includes(forbidden)) {
        violations.add(`${forbidden} in "${text}"`);
      }
    }
  }

  return { violations: [...violations] };
}
