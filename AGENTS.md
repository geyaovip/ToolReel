# ToolReel Agent Rules

本仓库用于实现 ToolReel：AI 工具种草短视频自动生成系统。后续所有 agent 和工程师在动手前必须先读本文件，并遵守 `docs/development-rules.md` 与 `docs/mvp-scope.md`。

## 当前阶段

- 当前目标是先建立开发规范和项目约束，不直接开始业务实现。
- 第一阶段只做 CLI MVP，不做后台、数据库、登录系统、复杂管理台。
- 实现时优先跑通完整流水线，再逐步替换 mock 数据和占位模块。

## 产品定位

ToolReel 不是普通视频剪辑器，而是自动化视频生产流水线。用户只输入 AI 工具名称和官网链接，系统自动完成信息整理、脚本、配音、字幕、截图/素材、Scene 规划、渲染、合成、封面生成。

核心输出是适合视频号、抖音、小红书、B 站的竖屏短视频：

- 默认画幅：1080x1920
- 默认帧率：30fps
- 目标时长：45-60 秒
- 允许范围：40-75 秒
- 内容风格：科技感、干净、信息密度高、像科技媒体视频

## 不可违反的内容规则

- 不要添加用户自己的账号 Logo。
- 不要添加「量子缦途」Logo。
- 不要添加固定品牌角标。
- 不要添加自定义水印。
- 不要编造价格、免费版、功能或商业信息；拿不到准确信息时标记为 `unknown`。
- 不要做纯文字视频。
- 不要把视频做成 PPT 直接录屏质感。
- 不要依赖人工加字幕、剪映或 OCR 识别字幕。

工具 Logo 只指本期推荐工具的品牌 Logo，只应出现在：

- 开场 1-3 秒
- 结尾总结页

中间主要展示官网截图、产品截图、功能卡片、字幕和动态文字。

## 架构原则

- 使用 Scene 架构，每条视频动态生成 4-7 个 Scene。
- Scene 级别选择渲染器，不把 Remotion 和 HyperFrames 强行混在同一个画面里。
- 每个 Scene 单独渲染为 MP4，最后用 FFmpeg 合成 `final.mp4`。
- Remotion 负责卡片、标题、卖点、价格、人群、榜单、对比、教程、CTA 等结构化动画。
- HyperFrames 负责官网展示、网页滚动、Landing Page 展示、产品官网高亮等网站转视频场景。
- 所有 pipeline 模块都应可替换：先 mock，后真实 API。

## 推荐目录

除非有充分理由，不要偏离以下结构：

```text
src/
  cli/
    generate.ts
  pipeline/
    runPipeline.ts
  research/
    researchTool.ts
  script/
    generateScript.ts
  assets/
    collectAssets.ts
  tts/
    generateVoice.ts
  subtitles/
    generateCaptions.ts
  scenes/
    planScenes.ts
  router/
    selectRenderer.ts
  renderers/
    remotion/
      renderRemotionScene.ts
      compositions/
    hyperframes/
      renderHyperFrameScene.ts
      templates/
  merge/
    mergeScenes.ts
  cover/
    generateCover.ts
  utils/
    file.ts
    slug.ts
    time.ts
```

## CLI Contract

第一阶段入口命令应保持为：

```bash
pnpm generate --name="Cursor" --url="https://cursor.com" --type="product_pick"
```

输出目录格式：

```text
outputs/YYYY-MM-DD-tool-slug/
  input.json
  script.json
  assets.json
  captions.json
  voice.mp3
  cover.png
  scenes/
    01-hook.mp4
    02-problem.mp4
    03-website-demo.mp4
  final.mp4
```

## Development Conduct

- 修改前先理解现有结构，不做无关重构。
- 保持模块边界清晰：research、script、assets、tts、subtitles、scenes、router、renderers、merge、cover 不要互相硬耦合。
- 数据交换优先使用 JSON 文件和明确类型。
- 任何外部 API 都必须有 mock 或 fallback，缺少 API Key 不能让 MVP pipeline 中断。
- 新增功能时同步更新相关文档、类型和运行说明。
- 验证要覆盖 CLI 到输出文件的主路径；媒体渲染相关变更至少检查文件是否生成、规格是否符合预期。

