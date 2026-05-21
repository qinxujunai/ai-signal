<p align="center">
  <h1 align="center">🔔 AI Signal</h1>
  <p align="center">每天自动追踪 AI 顶级 builder，LLM 策展筛选，中英双语摘要，邮件直达。</p>
</p>

<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/简体中文-readable?style=flat-square&labelColor=gray" alt="中文"></a>
  <a href="README_EN.md"><img src="https://img.shields.io/badge/English-readable?style=flat-square&labelColor=gray" alt="English"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-≥18-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/GitHub_Actions-免费调度-2088FF?style=flat-square&logo=githubactions&logoColor=white" alt="GitHub Actions">
  <img src="https://img.shields.io/badge/DeepSeek-v4--flash-4D8BFF?style=flat-square" alt="DeepSeek">
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT License">
</p>

---

## 它解决什么问题

> AI 信息太多了。Twitter、播客、博客……每天几百条推文，真正值得看的不到 5 条。

AI Signal 帮你做筛选：

1. **追踪 25+ 位 AI 顶级 builder**（Sam Altman、Andrej Karpathy、Swyx 等）的 X 推文
2. **追踪 6+ 个 AI 播客**的最新一期
3. **追踪 AI 博客**的关键更新
4. **DeepSeek LLM 自动策展**——从海量信息中筛选真正重要的，翻译成中英双语
5. **每天早上 10:00 邮件直达**——打开就能看，不用刷信息流

**无需 X API key、YouTube API key。** 所有内容来自公开的中央 feed。

👉 **[查看最新一期邮件样例](https://qinxujunai.github.io/ai-signal/)**

---

## 30 秒快速开始

### 方式一：GitHub Actions（推荐，免费云端运行）

```bash
# 1. Fork 本仓库
# 2. 在 Settings → Secrets and variables → Actions 中添加：
#    DEEPSEEK_API_KEY  — 你的 DeepSeek API key（platform.deepseek.com 注册）
#    QQ_EMAIL          — 你的 QQ 邮箱
#    QQ_SMTP_AUTH      — QQ 邮箱 SMTP 授权码
#    AI_SIGNAL_CONFIG  — config.json 的内容（见下方配置）
# 3. 启用 Actions → 每天北京时间 10:00 自动发送
```

### 方式二：本地运行

```bash
git clone https://github.com/qinxujunai/ai-signal.git
cd ai-signal/scripts && npm install

# 配置
mkdir -p ~/.ai-signal
cp ../config.example.json ~/.ai-signal/config.json
# 编辑 ~/.ai-signal/config.json 填入你的邮箱

cat > ~/.ai-signal/.env << 'EOF'
DEEPSEEK_API_KEY=你的key
QQ_EMAIL=你的QQ邮箱
QQ_SMTP_AUTH=你的SMTP授权码
DEEPSEEK_MODEL=deepseek-chat
EOF

# 运行
node prepare-digest.js --out /tmp/feed.json
node remix-digest.js --file /tmp/feed.json --out /tmp/digest.html
node deliver.js --file /tmp/digest.html --force
```

---

## 它怎么工作的

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  prepare-digest  │────▶│   remix-digest    │────▶│    deliver      │
│  拉取 RSS Feed   │     │  DeepSeek LLM    │     │  QQ SMTP 邮件   │
│  (X/播客/博客)   │     │  策展 + 中英翻译  │     │  发送到你的邮箱  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

三个脚本通过 JSON/HTML 文件传递数据，不依赖 shell 管道。

---

## 信源

数据来自 [follow-builders](https://github.com/zarazhangrui/follow-builders)——一个持续追踪 AI 领域 builder 的开源项目：

| 类型 | 内容 | 数量 |
|------|------|------|
| X 推文 | AI builder 的最新推文（含转推、回复） | 25+ 人 |
| 播客 | AI 相关播客最新一期（含完整 transcript） | 6+ 个 |
| 博客 | AI 公司/研究机构的博客更新 | 多个 |

LLM 从这些原始数据中筛选出**真正值得看的**，翻译成中英双语摘要。

---

## 配置

`~/.ai-signal/config.json`：

```json
{
  "language": "bilingual",
  "timezone": "Asia/Shanghai",
  "frequency": "daily",
  "deliveryTime": "10:00",
  "delivery": {
    "method": "email",
    "email": "你的QQ邮箱@qq.com"
  },
  "onboardingComplete": true
}
```

`~/.ai-signal/.env`：

```env
DEEPSEEK_API_KEY=sk-xxx          # DeepSeek API key（platform.deepseek.com）
DEEPSEEK_MODEL=deepseek-chat     # 使用 deepseek-v4-flash（便宜快速）
QQ_EMAIL=你的QQ邮箱@qq.com
QQ_SMTP_AUTH=你的SMTP授权码       # QQ邮箱 → 设置 → 账户 → POP3/SMTP → 生成授权码
```

### 自定义信源

可以通过环境变量覆盖默认 feed：

```env
FEED_BASE_URL=https://raw.githubusercontent.com/your-org/your-feed/main
FEED_X_URL=your-custom-x-feed.json
FEED_PODCASTS_URL=your-custom-podcasts.json
FEED_BLOGS_URL=your-custom-blogs.json
```

---

## 项目结构

```
ai-signal/
├── scripts/
│   ├── prepare-digest.js      # Feed 拉取（X/播客/博客）
│   ├── remix-digest.js        # LLM 策展 + HTML 渲染
│   ├── deliver.js             # QQ SMTP 邮件发送
│   ├── check-feed-health.js   # Feed 健康监测
│   └── run-digest.sh          # 本地调度脚本
├── .github/workflows/
│   └── digest.yml             # GitHub Actions 定时任务
├── config.example.json        # 配置模板
├── install.ps1                # Windows 一键安装
├── install.sh                 # Linux/Mac 一键安装
└── README.md
```

---

## 定时调度

| 方式 | 平台 | 成本 | 说明 |
|------|------|------|------|
| **GitHub Actions** | 云端 | 免费 | 推荐。fork 后配置 secrets 即可 |
| Windows Task Scheduler | 本地 | 免费 | 需要电脑开着 |
| Linux cron | 本地 | 免费 | 需要电脑开着 |

GitHub Actions 免费额度：公开仓库无限分钟数，私有仓库 2000 分钟/月。每天跑 2 分钟，绰绰有余。

---

## DeepSeek API 成本

| 模型 | 输入价格 | 输出价格 | 每日简报成本 |
|------|----------|----------|-------------|
| deepseek-chat (v4-flash) | $0.14/M tokens | $0.28/M tokens | ~$0.002 |
| deepseek-reasoner (v4-pro) | $0.55/M tokens | $2.19/M tokens | ~$0.01 |

**deepseek-chat 每年成本约 $0.73，约等于免费。** 新注册送 5M tokens，够用 333 天。

---

## 致谢

- 数据源：[follow-builders](https://github.com/zarazhangrui/follow-builders)——持续追踪 AI builder 的开源 feed
- LLM：[DeepSeek](https://platform.deepseek.com/)——高性价比的中文 LLM

---

## License

MIT
