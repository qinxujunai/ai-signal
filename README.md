<p align="right"><strong>中文</strong> · <a href="README_EN.md">English</a></p>

# AI Signal · 信号

**每天几百条 AI 资讯，3 分钟读完真正重要的那 20 条。**

每天北京时间 10:00，AI Signal 读一遍这些来源：X 上的 AI builder、Hacker News、Hugging Face 论文热榜、GitHub 趋势、各家实验室的官方博客、中文媒体。DeepSeek 按一套写死的编辑标准挑选、合并、改写，结果发到你的邮箱，同时发布网页版。

👉 [最新一期](https://qinxujunai.github.io/ai-signal/) · [往期](https://qinxujunai.github.io/ai-signal/archive/)

## 一期里有什么

| 栏目 | 内容 |
|---|---|
| 标题 | 今天最重要的一件事，一句话；邮件主题也是它 |
| 30 秒读完 | 3 条要点，每条带数字 |
| 头条 | 发生了什么 + 为什么重要 |
| 要闻 | 6–9 条，每条 1–2 句。下面一行写来源、热度和讨论链接；同一件事的多个来源合并成一条 |
| 观点 | X 上值得听的 2–4 个判断，写明身份 |
| 论文 | Hugging Face 今日热榜，按点赞排序，一句话说清做了什么 |
| 开源 | GitHub 今日趋势里的 AI 项目，按今日新增 star 排序 |
| 快讯 | 一行一条 |
| 播客 | 有新一期时：一句话结论 + 3 条洞察 |

设计参照 TLDR、The Rundown、smol.ai AINews 和 Axios 的「Smart Brevity」：
- 只有一栏，没有图片，没有追踪像素；
- 标题就是事实；
- 每条内容下面一行元信息。

## 为什么可信
- **模型不写链接。**
  - 每条原始材料都有一个编号（H3、P1、G2…），模型只能引用编号；链接、分数、star 数由代码从原始数据回填。
  - 引用了不存在的编号，这条就直接丢弃。
  - 所以邮件里不可能出现编造的链接或数字。
- **不重复。** 发过的链接记在 `data/seen.json`，保留 60 天，下一期自动跳过。
- **不断供。**
  - 模型无响应、或返回的 JSON 修不好时，按来源热度直接排出一期，并在邮件里写明。
  - 某个信源挂了，页脚会写「今天没取到：…」。

## 怎么工作
```
prepare-digest.js   收集素材（36 小时内、去掉已发过的）
        │  feed.json
remix-digest.js     编号 → DeepSeek 编辑（JSON 输出）→ 编号回填链接与数字 → render.js 排版
        │  email.html · docs/（网页版 + 往期）· data/seen.json
deliver.js          QQ SMTP 发送，主题是当天的标题
```
GitHub Actions（`.github/workflows/daily.yml`）每天 02:00 UTC 运行，发完把网页版和 `seen.json` 提交回仓库。

这次提交还有一个作用：仓库 60 天没有活动时，GitHub 会暂停定时任务，每天提交能避免这一点。

## 信源
| 类型 | 来源 | 规则 |
|---|---|---|
| X 推文、播客、部分博客 | [follow-builders](https://github.com/zarazhangrui/follow-builders) 开放 feed | 36 小时内，每人取互动最高的 3 条 |
| 官方博客 | OpenAI、Google DeepMind、Google AI、Hugging Face、Simon Willison 的 RSS | 72 小时内 |
| Hacker News | Algolia API | 36 小时内、60 分以上，标题按整词匹配 AI 关键词 |
| 论文 | Hugging Face Daily Papers | 按点赞取前 8 篇 |
| 开源 | GitHub Trending（今日）| 只留 AI 相关；抓取失败时改用 GitHub 搜索 API |
| 中文 | 量子位 RSS | 48 小时内 |

## 配置
在仓库 Settings → Secrets and variables → Actions 里添加：

| Secret | 说明 |
|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `QQ_EMAIL` | 发件 QQ 邮箱 |
| `QQ_SMTP_AUTH` | QQ 邮箱 SMTP 授权码 |
| `AI_SIGNAL_CONFIG` | `config.example.json` 的内容：收件邮箱、`interests` 关注领域 |

本地运行：
```bash
cd scripts && npm ci
node prepare-digest.js --out /tmp/feed.json --seen ../data/seen.json
node remix-digest.js --file /tmp/feed.json --out /tmp/email.html --web-dir /tmp/web
node remix-digest.js --file /tmp/feed.json --dump-prompt   # 看模型拿到的编号素材
node deliver.js --file /tmp/email.html --dry-run
```
没有 `DEEPSEEK_API_KEY` 时会生成降级版，方便调排版。

## 成本
- deepseek-chat 每期输入约 1.5 万 token、输出约 3 千 token：约 $0.003 一天，一年约 $1。
- GitHub Actions 对公开仓库免费。

## 致谢
[follow-builders](https://github.com/zarazhangrui/follow-builders) · [DeepSeek](https://platform.deepseek.com/) · [Hacker News Algolia API](https://hn.algolia.com/api) · [Hugging Face Daily Papers](https://huggingface.co/papers)

MIT
