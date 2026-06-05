import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { ToolReelSceneProps } from "./root.tsx";

const palette = {
  bg: "#07111f",
  panel: "rgba(255,255,255,0.08)",
  panelDark: "rgba(0,0,0,0.30)",
  text: "#f8fbff",
  muted: "rgba(248,251,255,0.72)",
  accent: "#8df5c5",
  blue: "#00d4ff",
};

function compactCaption(text: string): string[] {
  const normalized = text.replace(/\s+/g, "");
  const lines: string[] = [];
  for (let index = 0; index < normalized.length; index += 12) {
    lines.push(normalized.slice(index, index + 12));
  }
  return lines.slice(0, 2);
}

function sceneLabel(type: string): string {
  if (type === "HOOK") return "开场钩子";
  if (type === "SELLING_POINT") return "核心卖点";
  if (type === "CTA") return "结尾引导";
  if (type === "PROBLEM") return "问题场景";
  if (type === "TARGET_USER") return "适合人群";
  return type.replaceAll("_", " ");
}

const baseStyles = {
  fontFamily:
    '"Hiragino Sans GB", "STHeiti", "PingFang SC", "Arial Unicode MS", Arial, sans-serif',
  letterSpacing: 0,
};

export const ToolReelScene: React.FC<ToolReelSceneProps> = ({ scene, script, assets }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 95 } });
  const fade = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const accent = scene.type === "WEBSITE_DEMO" ? palette.blue : palette.accent;
  const captionLines = compactCaption(scene.narration);

  return (
    <AbsoluteFill
      style={{
        ...baseStyles,
        backgroundColor: palette.bg,
        color: palette.text,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 90,
          left: 70,
          width: 940,
          height: 8,
          backgroundColor: accent,
          opacity: fade,
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 122,
          left: 76,
          fontSize: 34,
          color: palette.muted,
          opacity: fade,
        }}
      >
        Remotion · {sceneLabel(scene.type)}
      </div>

      <div
        style={{
          position: "absolute",
          top: 174,
          left: 86,
          maxWidth: 910,
          padding: "8px 18px",
          background: "rgba(0,0,0,0.24)",
          fontSize: scene.title.length > 14 ? 56 : 70,
          lineHeight: 1.05,
          transform: `translateY(${(1 - enter) * 24}px)`,
          opacity: enter,
        }}
      >
        {scene.title}
      </div>

      <div
        style={{
          position: "absolute",
          top: 250,
          left: 86,
          width: 908,
          height: 610,
          background: palette.panel,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 60,
            left: 32,
            width: 844,
            height: 470,
            background: palette.panelDark,
            padding: 36,
            boxSizing: "border-box",
          }}
        >
          <div style={{ fontSize: 76, lineHeight: 1.05 }}>{script.toolName}</div>
          <div
            style={{
              marginTop: 28,
              fontSize: 38,
              lineHeight: 1.3,
              color: palette.muted,
            }}
          >
            {scene.type === "WEBSITE_DEMO" ? assets.websiteScreenshot : script.coreSellingPoint}
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", top: 930, left: 128, width: 824 }}>
        {scene.bullets.slice(0, 3).map((bullet, index) => (
          <div
            key={bullet}
            style={{
              height: 74,
              marginBottom: 38,
              padding: "15px 28px",
              boxSizing: "border-box",
              background: "rgba(255,255,255,0.10)",
              fontSize: 38,
              lineHeight: 1.1,
              opacity: interpolate(frame, [8 + index * 6, 18 + index * 6], [0, 1], {
                extrapolateRight: "clamp",
              }),
              transform: `translateX(${interpolate(frame, [8 + index * 6, 18 + index * 6], [36, 0], {
                extrapolateRight: "clamp",
              })}px)`,
            }}
          >
            - {bullet}
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          bottom: 210,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        {captionLines.map((line) => (
          <div
            key={line}
            style={{
              padding: "12px 26px",
              background: "rgba(0,0,0,0.58)",
              fontSize: 58,
              lineHeight: 1.16,
              textAlign: "center",
            }}
          >
            {line}
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 82,
          left: 0,
          width: "100%",
          textAlign: "center",
          fontSize: 28,
          color: "rgba(255,255,255,0.42)",
        }}
      >
        MVP MOCK VIDEO - no account logo / no watermark
      </div>
    </AbsoluteFill>
  );
};

