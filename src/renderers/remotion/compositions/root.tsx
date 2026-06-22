import React from "react";
import { Composition } from "remotion";
import type { AssetData, Caption, PlannedScene, ScriptData } from "../../../types.ts";
import { ToolReelScene } from "./toolReelScene.tsx";

const FPS = 30;
const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;

export type ToolReelSceneProps = {
  scene: PlannedScene;
  script: ScriptData;
  assets: AssetData;
  captions: Caption[];
};

const defaultProps: ToolReelSceneProps = {
  scene: {
    index: 1,
    id: "hook",
    type: "HOOK",
    title: "ToolReel",
    narration: "这个 AI 工具正在改变很多人的工作方式。",
    bullets: ["AI 工具发现", "效率提升", "快速上手"],
    duration: 6,
    renderer: "Remotion",
  },
  script: {
    toolName: "ToolReel",
    videoType: "product_pick",
    hook: "这个 AI 工具正在改变很多人的工作方式。",
    coreSellingPoint: "让 AI 工具科普视频自动生成。",
    segments: [],
  },
  assets: {
    logo: "",
    websiteScreenshot: "",
    productScreenshot: "",
    source: "auto",
  },
  captions: [
    {
      start: 0,
      end: 6,
      text: "这个 AI 工具正在改变很多人的工作方式。",
      sceneId: "hook",
      sceneIndex: 1,
    },
  ],
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ToolReelScene"
      component={ToolReelScene}
      durationInFrames={defaultProps.scene.duration * FPS}
      fps={FPS}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      defaultProps={defaultProps}
    />
  );
};
