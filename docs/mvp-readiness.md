# ToolReel MVP Readiness

本文档定义 MVP 是否完成的最终判断口径。MVP readiness 不等于后续版本停止开发，而是表示当前 CLI 流水线已经可以稳定生成一条可审核的工具科普短视频。

## Ready 标准

运行：

```bash
pnpm generate --name="Cursor" --url="https://cursor.com" --type="product_pick"
```

输出目录必须包含：

- `final.mp4`
- `run.json`
- `validation.json`
- `mvp-readiness.json`
- `first-frame.png`
- `input.json`
- `research.json`
- `creative.json`
- `script.json`
- `content-quality.json`
- `assets.json`
- `captions.json`
- `captions.srt`
- `voice.mp3`
- `voice.json`
- `cover.png`
- `scenes.json`

`mvp-readiness.json.ready` 必须为 `true`。

## 必须通过的检查

- `runPassed`
- `validationPassed`
- `contentQualityPassed`
- `requiredFilesPresent`
- `requiredScenesPresent`
- `realTtsProvider`
- `captionCount`
- `researchSources`
- `pageCandidates`
- `scoredAssets`
- `selectedWebsiteDemoAsset`
- 所有核心 `validation:*` 检查

## 当前允许延期

以下能力不阻塞 MVP：

- HyperFrames 深度网站转视频：放到 v1.2。
- 复杂后台、任务系统和审核界面：v1.5 暂缓。
- 多视频类型完整支持：放到 v1.4。
- 更高级的 Remotion 视觉体系和封面多方案评分：放到 v1.3。

## 手动复查命令

生成后可以单独检查：

```bash
pnpm mvp:check outputs/YYYY-MM-DD-tool
```

该命令会写入：

```text
outputs/YYYY-MM-DD-tool/mvp-readiness.json
```
