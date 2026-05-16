# 📡 AI Signal · 信号

> 从 AI 噪音中提取信号。LLM 策展、中英双语、专业排版。

Extract signal from AI noise. LLM-curated, bilingual, professionally formatted.

---

## What It Is

AI Signal turns the daily flood of AI news into a clean, curated digest. It tracks top AI builders and podcasts, remixes their content through an LLM, and gives you a structured summary — either directly in your terminal or as a professionally formatted HTML email.

No X API key. No YouTube API key. All content comes from a centralized feed.

---

## Quick Start

```bash
# 1. Clone into Claude Code skills
git clone https://github.com/qinxujunai/ai-signal.git ~/.claude/skills/ai-signal

# 2. Install
cd ~/.claude/skills/ai-signal/scripts && npm install

# 3. Type /ai in Claude Code
```

**That's it.** If your Claude Code uses DeepSeek, the API key is auto-detected. The digest appears directly in your conversation.

No Resend. No domain. No cron. No WSL.

---

## How It Works

```
/ai (or terminal / cron / GitHub Actions)
  → prepare-digest.js  拉取 AI builder 动态 → feed JSON
  → remix-digest.js    DeepSeek LLM 策展 → 双语结构化内容
  → deliver.js         输出纯文本 (stdout) 或 HTML 邮件 (email)
```

---

## Delivery Modes

| 模式 | 输出 | 需要什么 |
|------|------|---------|
| **stdout（默认）** | 纯文本，直接显示在终端/对话里 | Node.js + DeepSeek key |
| **email** | 专业 HTML 邮件，卡片布局 | 以上 + Resend 账号 + 域名 |

stdout 模式剥离 HTML 标签，输出可读纯文本。邮件模式提供完整排版体验。

---

## Optional: HTML Email Delivery

1. 注册 [resend.com](https://resend.com)，验证域名
2. 创建 `~/.ai-signal/.env`：
```env
RESEND_API_KEY=re_xxxxxxxxxxxx
```
3. 创建 `~/.ai-signal/config.json`：
```json
{
  "language": "bilingual",
  "timezone": "Asia/Shanghai",
  "frequency": "daily",
  "deliveryTime": "10:00",
  "delivery": { "method": "email", "email": "you@example.com" },
  "onboardingComplete": true
}
```

首次运行 `/ai` 时，Claude Code 会引导你完成上述配置。

---

## Optional: Automated Daily Delivery

### GitHub Actions（推荐 — 电脑关机也能跑）

1. Fork 本仓库
2. 在 Settings → Secrets and variables → Actions 中添加三个 secrets：
   - `DEEPSEEK_API_KEY` — 你的 DeepSeek API key
   - `RESEND_API_KEY` — 你的 Resend API key（仅邮件模式）
   - `AI_SIGNAL_CONFIG` — `config.json` 的内容（JSON 字符串）
3. 启用 Actions

GitHub 免费提供 2000 分钟/月，每天跑一次用不了 5%。

### 本地调度

| 平台 | 命令 |
|------|------|
| **Windows** | `.\install.ps1`（任务计划 + WSL） |
| **Linux/Mac** | `bash install.sh`（cron） |

---

## Architecture

```
SCHEDULER (cron / Task Scheduler / GitHub Actions)
  ↓
prepare-digest.js  →  中央 feed（无个人 API key）
  ↓
remix-digest.js   →  DeepSeek LLM 策展 + 双语
  ↓                  (JSON修复 → retry → 模板兜底)
deliver.js        →  stdout / Resend Email
```

---

## Auto-Detection

| 配置项 | 来源 |
|--------|------|
| API key | `~/.ai-signal/.env` → `~/.claude/settings.json` |
| Model | `DEEPSEEK_MODEL` env → `ANTHROPIC_DEFAULT_OPUS_MODEL` → `deepseek-chat` |
| Feed | 默认中央 feed，可通过 `FEED_BASE_URL` 自定义 |

---

## Project Structure

```
ai-signal/
├── README.md
├── SKILL.md                    # Claude Code skill 定义
├── .github/workflows/digest.yml # GitHub Actions 定时推送
├── scripts/
│   ├── prepare-digest.js        # Feed 拉取
│   ├── remix-digest.js          # LLM 策展 + HTML 渲染 ★
│   ├── deliver.js               # 邮件/stdout 发送
│   ├── format-auto-digest.js    # 降级兜底
│   ├── check-feed-health.js     # Feed 健康监测
│   └── run-digest.sh            # WSL/Linux 调度脚本
├── install.ps1 / install.sh     # 一键安装
└── prompts/                     # 提示词模板
```

---

## Configuration

| 字段 | 值 | 说明 |
|------|-----|------|
| `language` | `bilingual` / `zh` / `en` | 语言 |
| `frequency` | `daily` / `weekly` | 频率 |
| `deliveryTime` | `"HH:MM"` | 推送时间 |
| `delivery.method` | `stdout` / `email` | 推送方式 |
| `delivery.email` | 邮箱地址 | 仅邮件模式 |

---

## Credits

本项目深受 [follow-builders](https://github.com/zarazhangrui/follow-builders) 启发，并**直接使用其精心维护的中央 feed 作为默认内容源**。

> follow-builders 由 [zarazhangrui](https://github.com/zarazhangrui) 创建并维护，每月承担 X API 和 pod2txt API 费用，持续追踪 25 位 AI builder 和 6 个播客，并将结果免费公开。这是一种慷慨。

我们在其基础之上构建了：
- 独立的 DeepSeek LLM 策展引擎，替代 Agent 会话内 remix
- 专业 HTML 邮件排版系统，替代纯文本输出
- 中文优先的双语模板
- 自动配置检测（API key / model）
- 故障降级机制
- GitHub Actions 云端调度

---

## License

MIT
