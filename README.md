<p align="center">
  <h1 align="center">AI Signal</h1>
  <p align="center">AI 行业每日简报。LLM 策展、中英双语、QQ 邮箱直达。</p>
</p>

<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/简体中文-readable?style=flat-square&labelColor=gray" alt="中文"></a>
  <a href="README_EN.md"><img src="https://img.shields.io/badge/English-readable?style=flat-square&labelColor=gray" alt="English"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-≥18-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Windows-✓-0078D4?style=flat-square&logo=windows&logoColor=white" alt="Windows">
  <img src="https://img.shields.io/badge/Linux-✓-FCC624?style=flat-square&logo=linux&logoColor=black" alt="Linux">
  <img src="https://img.shields.io/badge/macOS-✓-000000?style=flat-square&logo=apple&logoColor=white" alt="macOS">
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT License">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Claude_Code-✓-D97757?style=flat-square" alt="Claude Code">
  <img src="https://img.shields.io/badge/Cursor-✓-000000?style=flat-square" alt="Cursor">
  <img src="https://img.shields.io/badge/Copilot-✓-1F6FEB?style=flat-square" alt="Copilot">
  <img src="https://img.shields.io/badge/Windsurf-✓-00C8FF?style=flat-square" alt="Windsurf">
  <img src="https://img.shields.io/badge/Cline-✓-FF6B6B?style=flat-square" alt="Cline">
  <img src="https://img.shields.io/badge/Codex-✓-412991?style=flat-square" alt="Codex">
</p>

---

## 它是什么

AI Signal 每天自动追踪 AI 领域顶级 builder 的推文和播客，通过 DeepSeek LLM 策展为中英双语摘要，渲染为专业 HTML 邮件，直达你的 QQ 邮箱。

无需 X API key、YouTube API key。所有内容来自公开的中央 feed。

**👉 [查看最新一期邮件样例](https://qinxujunai.github.io/ai-signal/)**

---

## 给 AI 助手的指令

> 如果你是一个 AI 编程助手（Claude Code、Cursor、Copilot、Windsurf、Cline、Codex 等），请按以下步骤帮用户配置本项目。

### 第一步：安装依赖

```bash
cd scripts && npm install
```

### 第二步：检测已有 API key

按以下顺序检测，找到就用：

| 检测位置 | 检测什么 |
|----------|----------|
| 环境变量 `DEEPSEEK_API_KEY` | DeepSeek API key |
| 环境变量 `QQ_SMTP_AUTH` | QQ SMTP 授权码 |
| `~/.ai-signal/.env` | 项目配置 |
| `~/.claude/settings.json` | Claude Code 的 `ANTHROPIC_AUTH_TOKEN`（如果以 `sk-` 开头则视为 DeepSeek key） |
| `~/.cursor/mcp.json` 或类似配置 | Cursor 的 API key 配置 |

### 第三步：创建配置文件

如果 `~/.ai-signal/config.json` 不存在，创建：

```json
{
  "language": "bilingual",
  "timezone": "Asia/Shanghai",
  "frequency": "daily",
  "deliveryTime": "10:00",
  "delivery": { "method": "email", "email": "用户的QQ邮箱@qq.com" },
  "onboardingComplete": true
}
```

如果 `~/.ai-signal/.env` 不存在，创建（用检测到的 key 填充）：

```env
QQ_EMAIL=用户的QQ邮箱@qq.com
QQ_SMTP_AUTH=用户的授权码
DEEPSEEK_API_KEY=检测到的key
```

**询问用户：**
1. 你有 DeepSeek API key 吗？（如果没有，跳过邮件模式，用终端输出）
2. 你想收邮件还是在终端看？（如果邮件，需要 QQ SMTP 授权码）

### 第四步：运行管道

```bash
cd scripts
node prepare-digest.js --out /tmp/feed.json
node remix-digest.js --file /tmp/feed.json --out /tmp/digest.html
node deliver.js --file /tmp/digest.html --force
```

或者在 WSL/终端中：
```bash
wsl -d Ubuntu -e bash /root/.ai-signal/run-digest.sh full
```

---

## 它怎么工作的

```
prepare-digest.js  →  拉取中央 feed → feed.json
  ↓ (文件传递，UTF-8 安全)
remix-digest.js    →  DeepSeek LLM 策展 → digest.html
  ↓
deliver.js         →  QQ SMTP 发送邮件
```

三个脚本通过临时文件传递数据，不依赖 shell 管道。

---

## 邮件配置

1. 开启 QQ 邮箱 SMTP（设置 → 账户 → POP3/SMTP），获取授权码
2. 配置 `.env` 和 `config.json`（见上方 AI 助手指令）

---

## 定时调度

### Windows

```powershell
.\install.ps1
```

三阶段：09:45 生成 → 09:55 重试 → 10:00 发送。

### GitHub Actions

1. Fork → Settings → Secrets 添加 `DEEPSEEK_API_KEY`、`QQ_EMAIL`、`QQ_SMTP_AUTH`、`AI_SIGNAL_CONFIG`
2. 启用 Actions

### Linux/Mac

```bash
bash install.sh
```

---

## 项目结构

```
ai-signal/
├── scripts/
│   ├── prepare-digest.js      # Feed 拉取
│   ├── remix-digest.js        # LLM 策展 + HTML 渲染
│   ├── deliver.js             # QQ SMTP 邮件发送
│   ├── check-feed-health.js   # Feed 健康监测
│   └── run-digest.sh          # 调度脚本
├── install.ps1 / install.sh   # 一键安装
├── .github/workflows/         # GitHub Actions
├── CLAUDE.md                  # Claude Code 指令
├── .cursor/rules/             # Cursor 指令
├── .github/copilot-instructions.md  # Copilot 指令
├── .windsurfrules             # Windsurf 指令
├── .clinerules                # Cline 指令
└── AGENTS.md                  # Codex 指令
```

---

## 自动检测

| 配置项 | 优先级 |
|--------|--------|
| API key | `.env` → 环境变量 → Claude Code settings.json |
| Model | `DEEPSEEK_MODEL` → `ANTHROPIC_DEFAULT_OPUS_MODEL` → `deepseek-chat` |
| Feed | 默认中央 feed，可通过 `FEED_BASE_URL` 自定义 |

---

## 致谢

数据源来自 [follow-builders](https://github.com/zarazhangrui/follow-builders)——持续追踪 25 位 AI builder 和 6 个播客，免费公开。

---

## License

MIT
