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
6. 生成 mock `script.json`。
7. 生成 mock `assets.json`。
8. 生成 mock `captions.json`。
9. 生成 mock `voice.mp3` 或占位音频。
10. 自动规划 scenes。
11. 自动选择每个 scene 的 renderer。
12. Remotion 能通过真实 composition 渲染至少 3 类 Scene：`HOOK`、`SELLING_POINT`、`CTA`。
13. HyperFrames 模块先预留 `WEBSITE_DEMO`。
14. 最终用 FFmpeg 合并片段。
15. 输出 `final.mp4`。

## 可以 mock 的部分

- 工具研究结果。
- 脚本文案。
- 素材清单。
- Logo 路径。
- 官网截图路径。
- 产品截图路径。
- 配音音频。
- HyperFrames 实际渲染。

mock 数据也必须符合真实数据结构，方便后续替换。

## 不做的部分

- 后台管理系统。
- 数据库。
- 用户系统。
- 登录和权限。
- 支付或订阅。
- 多用户任务队列。
- 复杂素材库。
- 真实 MiniMax TTS 强依赖。
- 真实网页自动截图强依赖。
- HyperFrames 深度网站转视频能力。

## 最低视频内容

生成的测试视频至少包含：

- 开场标题。
- 工具 Logo 或 Logo 占位。
- 官网截图占位。
- 3 个卖点。
- 大字字幕。
- 配音占位或真实配音。
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
6. 打开 `final.mp4` 后能看见竖屏短视频，且至少包含开场、卖点、官网展示占位、字幕、配音占位和 CTA。

## 后续替换顺序

MVP 跑通后再按以下顺序增强：

1. mock research 替换为真实工具信息整理。
2. mock script 替换为真实脚本生成。
3. mock assets 替换为真实 Logo 和截图获取。
4. mock voice 替换为 MiniMax TTS。
5. HyperFrames 从占位模块升级为真实官网展示渲染。
6. Remotion 视觉细节升级。
7. 增加更多 videoType 和 Scene 模板。
