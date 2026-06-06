# ToolReel Development Rules

本文档沉淀 ToolReel 后续开发规范，用于约束架构、内容生成、渲染、素材、字幕、配音和输出文件。

## 1. 产品边界

ToolReel 的目标是自动生成 AI 工具种草短视频。用户只负责审核和发布，不应手动处理配音、字幕、剪辑、选图、排版或合成。

第一阶段只实现 CLI，不实现：

- Web 后台
- 数据库
- 用户系统
- 登录系统
- 复杂任务队列
- 复杂素材管理后台

## 2. 视频内容结构

每条视频围绕一个 AI 工具展开，常见结构包括：

1. 开场钩子
2. 它解决什么问题
3. 核心卖点
4. 适合谁用
5. 快速判断是否值得试
6. 结尾引导

价格和免费版信息可以保留在 research JSON 里，但不作为工具种草短视频的默认板块。无法确认时使用 `unknown`，不能编造。

Research 和脚本结构不应被固定为“介绍、卖点、价格、人群”几类。不同产品的信息结构可以不同：

- 视频脚本默认不生成价格板块，除非未来新增专门的“购买建议/商业评估”视频类型。
- 优先提炼产品定位、核心功能点、真实亮点、使用场景、官网证据和不确定信息。
- 官网英文文案进入中文视频前，应转换为自然中文角度，不要直接堆英文原句。
- 所有亮点都应能追溯到 `sourcePages` 或 `evidence`。

## 3. 视频类型

系统至少支持以下 `videoType`：

| videoType | 说明 | 默认渲染策略 |
| --- | --- | --- |
| `product_pick` | 单个 AI 工具种草 | Remotion + HyperFrames 混合 |
| `top_list` | AI 工具榜单 | Remotion |
| `tutorial` | AI 工具教程 | Remotion，官网演示可用 HyperFrames |
| `comparison` | 多个 AI 工具对比 | Remotion |
| `website_demo` | 官网展示类视频 | HyperFrames |

## 4. Scene 架构

视频必须采用 Scene 架构，每条视频动态生成 4-7 个 Scene，不固定 Scene 数量。

允许的 Scene 类型包括：

- `HOOK`
- `PROBLEM`
- `WEBSITE_DEMO`
- `SELLING_POINT`
- `FEATURE`
- `PRICING`
- `TARGET_USER`
- `WORKFLOW`
- `CTA`
- `TOOL_LIST`
- `COMPARISON`
- `RECOMMENDATION`
- `LANDING_PAGE_DEMO`
- `PRODUCT_PAGE_SCROLL`

Scene 规划必须由视频类型、脚本文案和素材可用性共同决定。

## 5. Renderer Router

必须实现 Scene 级别的 Renderer Router，建议文件：

```text
src/router/selectRenderer.ts
```

### Remotion 场景

Remotion 适合结构化动画和信息卡片：

- 开场标题动画
- 卖点卡片
- 适合人群
- 工具榜单
- 多工具对比
- 教程步骤
- 工作流动画
- 数据图表
- 结尾 CTA

Remotion 渲染必须通过真实 Remotion composition 输出，不要长期停留在 FFmpeg 文字占位。MVP 至少应覆盖 `HOOK`、`SELLING_POINT`、`CTA` 三类结构化 Scene。

Remotion renderer 需要可用的本地 Chrome 和本地端口。macOS 本地开发默认通过 `scripts/remotion-chrome-wrapper.sh` 启动 Chrome，使用独立 profile 并关闭 crash reporting，避免 Crashpad 或 Application Support 权限导致渲染中断。若在受限沙箱中运行，需要为生成命令授予本地端口和浏览器启动权限；不要因此退回到永久占位渲染。

默认使用 Remotion 的 Scene：

- `HOOK`
- `PROBLEM`
- `SELLING_POINT`
- `FEATURE`
- `TARGET_USER`
- `WORKFLOW`
- `CTA`
- `COMPARISON`
- `TOOL_LIST`
- `RECOMMENDATION`

### HyperFrames 场景

HyperFrames 适合网站展示和网页转视频：

- 官网展示
- 网页滚动
- Landing Page 展示
- 产品官网高亮
- 网站转视频

默认使用 HyperFrames 的 Scene：

- `WEBSITE_DEMO`
- `LANDING_PAGE_DEMO`
- `PRODUCT_PAGE_SCROLL`

## 6. 渲染和合成规则

- 每个 Scene 单独渲染为 MP4。
- 所有片段统一为 1080x1920。
- 所有片段统一为 30fps。
- 合成前统一音频采样率。
- 字幕和配音时间轴必须同步。
- 最终输出 `final.mp4`。
- `final.mp4` 默认打开首屏必须是可见画面，不能出现播放器默认黑屏。
- 最终 MP4 起始时间必须为 `start: 0.000000`，首帧必须是关键帧。
- 最终 MP4 必须使用 `+faststart`，提升 QuickTime 和短视频平台播放器兼容性。
- 合成后至少抽取第 0 帧检查；必要时使用 `blackdetect` 检测开头 1 秒。
- 如果直接 copy concat 导致播放器首屏黑屏，应对 `final.mp4` 做一次兼容性重编码。
- 每次生成必须输出 `run.json`、`validation.json` 和 `first-frame.png`，用于记录输入、素材、字幕、音轨、场景、媒体规格、起始时间、开头黑帧检查和首帧预览。

分段输出示例：

```text
outputs/2026-06-05-cursor/scenes/01-hook.mp4
outputs/2026-06-05-cursor/scenes/02-problem.mp4
outputs/2026-06-05-cursor/scenes/03-website-demo.mp4
outputs/2026-06-05-cursor/final.mp4
```

## 7. 配音规则

建议文件：

```text
src/tts/generateVoice.ts
```

输入是 `script.json`，输出是 `voice.mp3`。

优先支持 MiniMax TTS。没有 API Key 时：

- 最终视频生成必须中断并说明缺少真实 TTS 配置。
- 不要使用 macOS `say`、蜂鸣、正弦波、电流测试音或静音作为最终视频兜底音轨。
- 只有在明确测试音频链路时才允许生成 mock tone，且不得作为默认最终视频音轨。

MiniMax TTS 配置通过 `.env` 或系统环境变量提供：

```text
MINIMAX_API_KEY=
MINIMAX_TTS_ENDPOINT=https://api.minimaxi.com/v1/t2a_v2
MINIMAX_TTS_MODEL=speech-2.8-hd
MINIMAX_TTS_VOICE_ID=Chinese (Mandarin)_Radio_Host
```

真实 TTS 必须写出 `voice.mp3` 与 `voice.json`，便于后续校验和排查。`voice.json.provider` 必须准确标记当前 TTS provider，例如 `minimax`。未来新增其他 TTS 来源时，应通过 provider 模块扩展，不要把本机声音当作兜底。

最终合成时必须把 `voice.mp3` 作为 `final.mp4` 的主音轨；不能只生成音频文件但继续使用 scene 内部的静音轨。

## 8. 字幕规则

字幕必须来自脚本文案和配音时间轴，不依赖人工、剪映或 OCR。

输出文件：

```text
captions.json
captions.srt
```

结构示例：

```json
[
  {
    "start": 0,
    "end": 3.2,
    "text": "这个AI工具正在改变写代码的方式",
    "sceneId": "hook",
    "sceneIndex": 1
  }
]
```

口播字幕和画面重点字幕必须分开生成：

- `captions.json` / `captions.srt` 只承载口播字幕，来自 narration 和真实 TTS 时间轴。
- scene `title`、`bullets`、产品名、官网信息属于画面重点字幕或信息卡，不应混入口播字幕时间轴。

字幕时间轴必须基于真实 TTS 音频时长、最终 scene 顺序和 scene duration 生成，最后一条字幕的 `end` 应与视频主体时间轴一致。生成真实 TTS 后，应按旁白长度、语义片段和停顿权重重新分配 scene duration，再生成 `captions.json` 和 `captions.srt`。

渲染器必须使用 `captions.json` 的时间轴显示当前字幕，不要把整段 scene narration 静态显示在整个 scene 里。Remotion 渲染时小数秒 duration 需要转换为整数帧数。

展示规则：

- 中文大字字幕。
- 每条字幕表达一个完整小意思，优先按语义和口播节奏切，不要机械按字数硬切。
- 每条字幕建议 8-18 个中文字，最长不超过 22 个中文字；强调句可以单独成条。
- 优先在标点、停顿、转折词、连接词、信息点切换处断句。
- 不要拆开产品名、英文工具名、平台名、URL、版本名和固定词组。
- 每行 8-14 个中文字。
- 最多 2 行。
- 自动换行。
- 不要把短标点或 1-2 个字的残片单独作为一条字幕。
- 字幕停留时间要足够用户读完，短字幕也不能一闪而过。
- 视频画面文字不得用省略号截断；能完整换行展示就展示，放不下就过滤该信息或在脚本层改写成更短的完整表达。
- URL 不要半截展示；需要展示时优先使用完整域名，如 `cursor.com`。
- `validation.json` 必须检查可见文案，不允许输出省略号、`unknown` 占位、内部模板标签或“待补充”等未完成状态文案。
- 重要词后续可高亮。
- 出现在画面下方安全区域。
- 不遮挡产品界面核心区域。

## 9. 素材规则

建议文件：

```text
src/assets/collectAssets.ts
```

输入：

- 工具名称
- 官网 URL

输出：

```text
assets.json
```

素材优先级：

1. 工具 Logo
2. 官网首页截图
3. 产品界面截图
4. 功能页截图
5. 价格页截图
6. 简单动态图表
7. GIF 或视频素材

第一阶段可以支持手动配置素材路径，但架构必须预留自动获取官网截图、Logo、产品截图。

当前 MVP 素材采集规则：

- 自动抓取官网 HTML 元信息。
- 自动用本地 Chrome 生成官网截图。
- 自动下载官网 icon / Logo 候选。
- 自动记录官网页面中发现的图片、视频、社交链接候选。
- 可以通过 `assets.manual.json` 或 `TOOLREEL_MANUAL_ASSETS` 合并人工筛选素材。
- 推特名人评价、三方视频、官方视频、录屏可以作为人工素材输入，但必须记录真实来源，不要编造背书。
- 对第三方视频和社交内容，第一阶段只记录候选 URL，不自动下载或二次分发。
- 官网截图进入视频时应优先使用慢速滚动、推近或重点区域高亮，避免纯静态截图。
- Remotion 是核心渲染器；Remotion 场景失败时应直接失败并暴露错误，不要静默降级到低质量保底渲染。

手动素材模板见：

```text
docs/manual-assets.example.json
```

## 10. Logo 和水印规则

只允许展示本期推荐工具的品牌 Logo。

禁止出现：

- 用户账号 Logo
- 「量子缦途」Logo
- 固定品牌角标
- 自定义水印

工具 Logo 只在开场 1-3 秒和结尾总结页出现，中间不常驻角落。

## 11. 封面规则

输出文件：

```text
cover.png
```

规格：

- 1080x1920
- 工具名称
- 一句核心卖点
- 工具 Logo
- 科技感背景
- 无账号 Logo
- 无固定水印

## 12. 数据文件规则

每条视频生成一个独立目录：

```text
outputs/YYYY-MM-DD-tool-slug/
  input.json
  research.json
  script.json
  assets.json
  captions.json
  captions.srt
  voice.mp3
  voice.json
  cover.png
  run.json
  validation.json
  first-frame.png
  scenes/
  final.mp4
```

所有中间产物都要可检查、可复用、可重新渲染。

## 13. 实现优先级

开发顺序必须遵守：

1. 先跑通全流程，再优化细节。
2. 先 CLI，后后台。
3. 先 mock 数据，后真实 API。
4. 先 Remotion，后 HyperFrames 深度接入。
5. 先生成视频，再追求视觉高级。
6. 不过早引入数据库。
7. 不过早做登录系统。
8. 不过早做复杂管理后台。
