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
5. 价格或免费版信息
6. 结尾引导

价格和免费版信息必须基于可验证来源。无法确认时使用 `unknown`，不能编造。

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
- 价格页
- 适合人群
- 工具榜单
- 多工具对比
- 教程步骤
- 工作流动画
- 数据图表
- 结尾 CTA

默认使用 Remotion 的 Scene：

- `HOOK`
- `PROBLEM`
- `SELLING_POINT`
- `FEATURE`
- `PRICING`
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

- 不要让 pipeline 报错中断。
- 生成 mock voice 或占位音频。
- 保证后续字幕、渲染、合成步骤可以继续执行。

## 8. 字幕规则

字幕必须来自脚本文案和配音时间轴，不依赖人工、剪映或 OCR。

输出文件：

```text
captions.json
```

结构示例：

```json
[
  {
    "start": 0,
    "end": 3.2,
    "text": "这个AI工具正在改变写代码的方式"
  }
]
```

展示规则：

- 中文大字字幕。
- 每行 8-12 个中文字。
- 最多 2 行。
- 自动换行。
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
  script.json
  assets.json
  captions.json
  voice.mp3
  cover.png
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
