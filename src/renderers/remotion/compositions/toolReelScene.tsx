import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { chunkText } from "../../../utils/text.ts";
import type { ToolReelSceneProps } from "./root.tsx";

const palette = {
  bg: "#07111f",
  panel: "rgba(255,255,255,0.08)",
  panelDark: "rgba(0,0,0,0.30)",
  text: "#f8fbff",
  muted: "rgba(248,251,255,0.72)",
  accent: "#8df5c5",
  blue: "#00d4ff",
  amber: "#ffd166",
};

function bulletLines(text: string): string[] {
  const normalized = text.replace(/[.…]+$/g, "").replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > 34) {
    return [];
  }
  const lines: string[] = [];
  for (let index = 0; index < normalized.length; index += 17) {
    lines.push(normalized.slice(index, index + 17));
  }
  return lines.slice(0, 2);
}

function focusLabel(scene: ToolReelSceneProps["scene"]): string {
  const focus = scene.visualFocus?.replace(/[.…]+$/g, "").trim();
  if (focus && focus.length <= 18) {
    return focus;
  }
  if (scene.type === "WEBSITE_DEMO") {
    return "官网主打信息";
  }
  if (scene.type === "WORKFLOW") {
    return "真实使用场景";
  }
  if (scene.type === "CTA") {
    return "记住这个工具";
  }
  return "核心信息";
}

function sceneTone(scene: ToolReelSceneProps["scene"]): { accent: string; label: string } {
  if (scene.type === "WORKFLOW") {
    return { accent: palette.amber, label: "场景" };
  }
  if (scene.type === "FEATURE") {
    return { accent: palette.blue, label: "细节" };
  }
  if (scene.type === "CTA") {
    return { accent: palette.accent, label: "总结" };
  }
  if (scene.type === "SELLING_POINT") {
    return { accent: palette.accent, label: "核心" };
  }
  return { accent: scene.type === "WEBSITE_DEMO" ? palette.blue : palette.accent, label: "科普" };
}

const baseStyles = {
  fontFamily:
    '"Hiragino Sans GB", "STHeiti", "PingFang SC", "Arial Unicode MS", Arial, sans-serif',
  letterSpacing: 0,
};

export const ToolReelScene: React.FC<ToolReelSceneProps> = ({ scene, script, assets, captions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 95 } });
  const fade = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const tone = sceneTone(scene);
  const accent = tone.accent;
  const activeCaption =
    captions.find((caption) => currentTime >= caption.start && currentTime < caption.end) ??
    captions[captions.length - 1];
  const captionLines = chunkText(activeCaption?.text ?? scene.narration, 11);
  const screenshot = usableImage(assets.productScreenshot) || usableImage(assets.websiteScreenshot);
  const logo = usableImage(assets.logo);
  const imageDrift = interpolate(frame, [0, scene.duration * fps], [0, -34], {
    extrapolateRight: "clamp",
  });
  const imageScale = interpolate(frame, [0, scene.duration * fps], [1.04, 1.1], {
    extrapolateRight: "clamp",
  });

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
          top: 118,
          left: 86,
          padding: "7px 14px",
          background: `${accent}22`,
          color: accent,
          fontSize: 24,
          lineHeight: 1,
          opacity: fade,
        }}
      >
        {tone.label}
      </div>

      <div
        style={{
          position: "absolute",
          top: 106,
          right: 72,
          maxWidth: 470,
          padding: "9px 18px",
          background: "rgba(255,255,255,0.10)",
          color: "rgba(248,251,255,0.82)",
          fontSize: 26,
          lineHeight: 1.15,
          textAlign: "right",
          opacity: fade,
        }}
      >
        {focusLabel(scene)}
      </div>

      <div
        style={{
          position: "absolute",
          top: 174,
          left: 86,
          maxWidth: 910,
          padding: "10px 18px",
          background: "rgba(0,0,0,0.30)",
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
          {screenshot ? (
            <>
              <Img
                src={screenshot}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "top center",
                  opacity: 0.86,
                  transform: `translateY(${imageDrift}px) scale(${imageScale})`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(7,17,31,0.06) 0%, rgba(7,17,31,0.20) 48%, rgba(7,17,31,0.76) 100%)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 28,
                  right: 28,
                  bottom: 28,
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                }}
              >
                {logo ? (
                  <div
                    style={{
                      width: 74,
                      height: 74,
                      background: "rgba(255,255,255,0.92)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Img
                      src={logo}
                      style={{
                        width: 48,
                        height: 48,
                        objectFit: "contain",
                      }}
                    />
                  </div>
                ) : null}
                <div>
                  <div style={{ fontSize: 44, lineHeight: 1.05 }}>{script.toolName}</div>
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 27,
                      lineHeight: 1.25,
                      color: "rgba(248,251,255,0.78)",
                    }}
                  >
                    {assets.homepage?.title ?? script.coreSellingPoint}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 76, lineHeight: 1.05 }}>{script.toolName}</div>
              <div
                style={{
                  marginTop: 28,
                  fontSize: 38,
                  lineHeight: 1.3,
                  color: palette.muted,
                }}
              >
                {script.coreSellingPoint}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ position: "absolute", top: 910, left: 128, width: 824 }}>
        {(scene.onScreenFocus?.length ? scene.onScreenFocus : scene.bullets)
          .map((bullet) => ({ bullet, lines: bulletLines(bullet) }))
          .filter((item) => item.lines.length)
          .slice(0, 3)
          .map(({ bullet, lines }, index) => (
          <div
            key={bullet}
            style={{
              minHeight: 96,
              marginBottom: 28,
              padding: "14px 28px",
              boxSizing: "border-box",
              background: "rgba(255,255,255,0.10)",
              borderLeft: `8px solid ${accent}`,
              fontSize: 34,
              lineHeight: 1.18,
              display: "flex",
              alignItems: "center",
              opacity: interpolate(frame, [8 + index * 6, 18 + index * 6], [0, 1], {
                extrapolateRight: "clamp",
              }),
              transform: `translateX(${interpolate(frame, [8 + index * 6, 18 + index * 6], [36, 0], {
                extrapolateRight: "clamp",
              })}px)`,
            }}
          >
            <div>
              {lines.map((line, lineIndex) => (
                <div key={line}>
                  {lineIndex === 0 ? "- " : "\u00A0\u00A0"}
                  {line}
                </div>
              ))}
            </div>
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
              fontSize: 52,
              lineHeight: 1.16,
              textAlign: "center",
              whiteSpace: "nowrap",
            }}
          >
            {line}
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          left: 86,
          right: 86,
          bottom: 102,
          height: 3,
          background: "rgba(255,255,255,0.12)",
        }}
      >
        <div
          style={{
            width: `${Math.round(((scene.index || 1) / Math.max(1, script.segments.length)) * 100)}%`,
            height: "100%",
            background: accent,
          }}
        />
      </div>

    </AbsoluteFill>
  );
};

function usableImage(source: string | undefined): string | undefined {
  if (!source || source === "unknown" || source.startsWith("mock://")) {
    return undefined;
  }
  if (source.startsWith("static:")) {
    return staticFile(source.slice("static:".length));
  }
  return source;
}
