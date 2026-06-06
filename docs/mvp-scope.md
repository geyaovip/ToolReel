# ToolReel MVP Scope

本文档定义第一阶段 MVP 的范围、交付物和验收标准。除非用户明确改变目标，第一阶段不要扩大范围。

## MVP 目标

运行一条 CLI 命令后，系统可以生成一个完整的竖屏测试视频：

```bash
pnpm generate --name="Cursor" --url="https://cursor.com" --type="product_pick"
```

期望最终输出：

```text
outputs/YYYY-MM-DD-cursor/final.mp4
```

## 必须实现

1. 初始化 TypeScript 项目。
2. 初始化 Remotion。
3. 预留 HyperFrames 渲染模块。
4. 实现 CLI 输入。
5. 生成 `input.json`。
6. 基于官网 research 生成 `research.json`。
7. 自动生成 `creative.json`，选择本期种草角度、分镜意图和封面标题方案。
8. 基于 research 和 creative 生成动态 `script.json`，口播应更接近自媒体判断，不是官网功能清单。
9. 生成自动采集版 `assets.json`，至少包含官网截图、Logo 候选和外部素材候选。
10. 生成与 scene 时间轴对齐的 `captions.json` 和 `captions.srt`。
11. 生成真实 TTS `voice.mp3`，并在最终合成时作为 `final.mp4` 的主音轨。
12. 自动规划 scenes。
13. 自动选择每个 scene 的 renderer。
14. Remotion 能通过真实 composition 渲染至少 3 类 Scene：`HOOK`、`SELLING_POINT`、`CTA`。
15. HyperFrames 模块先预留 `WEBSITE_DEMO`。
16. 最终用 FFmpeg 合并片段。
17. 输出 `final.mp4`。

## 可以 mock 的部分

- 工具研究结果。
- 脚本文案。
- 素材清单。
- Logo 路径。
- 官网截图路径。
- 产品截图路径。
- HyperFrames 实际渲染。

mock 数据也必须符合真实数据结构，方便后续替换。

配音不再属于可 mock 部分。最终视频必须使用真实 TTS provider 生成的音频；当前 provider 是 MiniMax，未来可以扩展其他 TTS 来源。

## 不做的部分

- 后台管理系统。
- 数据库。
- 用户系统。
- 登录和权限。
- 支付或订阅。
- 多用户任务队列。
- 复杂素材库。
- 真实网页自动截图强依赖。
- HyperFrames 深度网站转视频能力。

## 最低视频内容

生成的测试视频至少包含：

- 开场标题。
- 工具 Logo 或 Logo 占位。
- 官网截图占位。
- 3 个卖点。
- 大字字幕。
- 真实 TTS 配音。
- 结尾 CTA。

生成的视频不得包含：

- 用户账号 Logo。
- 「量子缦途」Logo。
- 固定水印。
- 品牌角标。

## CLI 输出要求

CLI 成功运行后应打印：

```text
使用渲染模式：Hybrid

Scenes:
1. HOOK - Remotion
2. PROBLEM - Remotion
3. WEBSITE_DEMO - HyperFrames
4. SELLING_POINT - Remotion
5. TARGET_USER - Remotion
6. CTA - Remotion

输出目录：
outputs/YYYY-MM-DD-cursor/

最终视频：
outputs/YYYY-MM-DD-cursor/final.mp4
```

实际 Scene 数量可以动态变化，但必须清楚列出每个 Scene 和对应 renderer。

## 验收标准

MVP 完成后，用户应能做到：

1. 安装依赖。
2. 运行 `pnpm generate --name="Cursor" --url="https://cursor.com" --type="product_pick"`。
3. 在 `outputs/YYYY-MM-DD-cursor/` 看到完整中间产物。
4. 在同一目录看到 `final.mp4`。
5. 在同一目录看到 `validation.json` 和 `first-frame.png`。
6. 在同一目录看到 `run.json`，可快速排查输入、素材、字幕、音轨、场景、校验状态。
7. 打开 `final.mp4` 后能看见竖屏短视频，且至少包含开场、卖点、官网展示占位、字幕、配音占位和 CTA。

## 后续替换顺序

MVP 跑通后再按以下顺序增强：

1. research 增强为更全面的多来源信息整理和事实校验。
2. script 增强为更自然的口播节奏、字幕高亮和视频类型差异化表达。
3. 素材采集增强为更深的官方视频、三方视频、公开评价和录屏筛选。
4. HyperFrames 从占位模块升级为真实官网展示渲染。
5. Remotion 视觉细节升级。
6. 增加更多 TTS provider、videoType 和 Scene 模板。
