<p align="right"><strong>中文</strong> · <a href="README_EN.md">English</a></p>

# AI Signal · 信号

**每天北京时间 10:00，一封 3 分钟读完的 AI 简报。**

> AI 的消息每天成百上千。难的不是看到，是分清哪些可信、哪些值得看；GitHub 上的好项目，我也想第一时间知道它能解决什么问题。所以我让它每天替我读一遍。
> —— 秦徐俊

👉 [最新一期](https://qinxujunai.github.io/ai-signal/) · [往期](https://qinxujunai.github.io/ai-signal/archive/)

## 每天读什么
X 上的 AI builder、Hacker News、Techmeme、Reddit（经 [AINews](https://www.latent.space/s/ainews) 汇总）、Hugging Face 论文热榜和热门模型、GitHub 趋势、Product Hunt、OpenAI / Anthropic / Google DeepMind / Qwen 等官方博客、量子位和 36氪。每天大约 100 条新内容，挑出 15–25 条。

## 一期里有什么
| 栏目 | 内容 |
|---|---|
| 报头 | 期号、今天最重要的一件事、主编一句话说清今天的走向 |
| 30 秒读完 | 3 条要点，每条带数字 |
| 头条 | 发生了什么 + 为什么重要 |
| 要闻 | 6–9 条；每条下面一行：分类、信号强度（●●○）、来源、讨论 |
| 社区在聊 | Reddit 上讨论最热的 2–3 个帖子 |
| 观点 | X 上值得听的判断，写明身份 |
| 新模型 / 新产品 | Hugging Face 热门的新权重，Product Hunt 的新 AI 产品 |
| 论文 / 开源 | 论文热榜、GitHub 今日趋势里的 AI 项目 |
| 快讯 | 一行一条 |

**信号强度**：几个独立来源报道了同一件事，或这一条在社区里有多热（HN 300 分、Reddit 热度 1000 以上等），最多三个点。

## 为什么可信
- **模型不写链接，也不写数字。** 每条素材有编号（H3、R1、M2…），模型只能引用编号；链接、分数、star 数由代码从原始数据回填。引用了不存在的编号，这条直接丢掉。
- **不重复。** 发过的链接记在 `data/seen.json`，保留 60 天。
- **不断供。** 模型没响应时按热度直接排出一期并写明；某个信源挂了，页脚写「今天没取到：…」。

## 怎么做到准点
GitHub 的定时任务在高峰期会晚好几个小时（2026-10-22 定在 09:41 的任务 14:32 才开始），还可能被丢掉。所以：
- 北京时间 04:07 到 09:47，每 20 分钟排一次；第一个启动的任务认领当天；
- 它等到 09:35 收集素材、编辑，再等到 **10:00:00** 发送；
- 后面启动的任务看到当天已发就退出；10:00 之后才启动的任务立刻补发。

## 怎么工作
```
prepare-digest.js   收集素材（36 小时内，去掉已发过的）            sources.js 里是各信源的解析
remix-digest.js     编号 → DeepSeek 编辑（JSON）→ 回填链接与数字 → render.js 排版
deliver.js          QQ SMTP 发送，主题是当天的标题
clock.js            北京时间：等到 09:35、等到 10:00
```

## 配置
仓库 Settings → Secrets and variables → Actions：

| Secret | 说明 |
|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `QQ_EMAIL` | 发件 QQ 邮箱 |
| `QQ_SMTP_AUTH` | QQ 邮箱 SMTP 授权码 |
| `AI_SIGNAL_CONFIG` | `config.example.json` 的内容：收件邮箱、`interests` 关注领域 |

邮箱只放在 Secret 里，代码和运行日志都不打印邮箱地址。

本地运行：
```bash
cd scripts && npm ci && npm test
node prepare-digest.js --out /tmp/feed.json --seen ../data/seen.json
node remix-digest.js --file /tmp/feed.json --dump-prompt          # 模型看到的编号素材
node remix-digest.js --file /tmp/feed.json --out /tmp/email.html --web-dir /tmp/web
node deliver.js --file /tmp/email.html --dry-run
```
没有 `DEEPSEEK_API_KEY` 时生成降级版，方便调排版。

## 成本
deepseek-chat 每期约 2 万 token 输入、3 千 token 输出，一年约 $2–3。GitHub Actions 对公开仓库免费。

## 致谢
[follow-builders](https://github.com/zarazhangrui/follow-builders) · [AINews / Latent Space](https://www.latent.space/s/ainews) · [Techmeme](https://www.techmeme.com/) · [Hacker News Algolia API](https://hn.algolia.com/api) · [Hugging Face](https://huggingface.co/papers) · [DeepSeek](https://platform.deepseek.com/)

MIT
