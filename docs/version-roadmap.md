# ToolReel Version Roadmap

本文档定义 MVP 完成后的版本路线。后续开发优先按版本推进，不把后台、复杂模板、素材库和多视频类型一次性堆进同一个阶段。

## 版本原则

- 先提升单条工具科普视频质量，再扩展更多视频类型。
- 先补足自动化流水线能力，再做复杂产品化后台。
- Remotion 继续负责结构化信息表达；HyperFrames 重点负责官网、产品页面和真实网页现场感。
- 每个版本都必须能通过 CLI 主流程验证，不以半成品模块作为版本完成标准。
- 任何内容判断都必须基于 research 和素材证据，不编造价格、用户评价、排名、效果数据或商业信息。

## 版本总览

| 版本 | 主题 | 核心目标 |
| --- | --- | --- |
| MVP | CLI 完整流水线 | 跑通工具科普短视频的端到端生成 |
| v1.1 | 内容质量增强 | 让 research、Creative 和脚本更像工具科普内容，而不是产品介绍 |
| v1.2 | 素材与 HyperFrames 增强 | 提升官网、产品页面、录屏和外部素材的真实感 |
| v1.3 | 视觉与字幕质量增强 | 提升 Remotion 模板、字幕、封面和自动质检 |
| v1.4 | 多视频类型扩展 | 支持榜单、对比、教程、更新速递等内容形态 |
| v1.5 | 产品化与批量生产 | 从 CLI 走向任务化、审核流和批量生产能力 |

## 推荐推进顺序

1. 完成 MVP 验收，保证 `pnpm generate` 可以稳定输出 `final.mp4`。
2. 开发 v1.1，让内容结构、口播脚本和分镜意图变得更自然。
3. 开发 v1.2，把 HyperFrames 和素材采集接入真实镜头质量提升。
4. 开发 v1.3，补视觉模板、封面和质量评估。
5. 单工具视频稳定后，再进入 v1.4 多类型扩展。
6. 最后做 v1.5 产品化，不提前引入复杂后台。

## 版本文档

- [MVP Scope](./mvp-scope.md)
- [v1.1 Content Quality](./versions/v1.1-content-quality.md)
- [v1.2 Assets and HyperFrames](./versions/v1.2-assets-hyperframes.md)
- [v1.3 Visual Quality](./versions/v1.3-visual-quality.md)
- [v1.4 Video Types](./versions/v1.4-video-types.md)
- [v1.5 Productization](./versions/v1.5-productization.md)

