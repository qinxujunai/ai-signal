# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# AI Signal · 信号

> 从 AI 噪音中提取信号。全自动 LLM 策展、中英双语、专业 HTML 排版、每日邮件送达。

## Development Commands

```bash
# Install dependencies
cd scripts && npm install

# Run full pipeline (file-based, UTF-8 safe)
cd scripts && npm run digest

# Run individual steps (file-based mode)
cd scripts && node prepare-digest.js --out /tmp/feed.json
cd scripts && node remix-digest.js --file /tmp/feed.json --out /tmp/digest.html
cd scripts && node deliver.js --file /tmp/digest.html --force

# Dry run
cd scripts && node deliver.js --file /tmp/digest.html --dry-run

# Feed health check
cd scripts && node check-feed-health.js

# WSL test (Windows)
wsl -d Ubuntu -e bash /root/.ai-signal/run-digest.sh
```

## Architecture

```
prepare-digest.js  →  拉取中央 feed，写出 feed.json
  ↓ (file, not pipe)
remix-digest.js    →  DeepSeek LLM 策展 + HTML 模板渲染，写出 digest.html
  ↓ (file, not pipe)
deliver.js         →  读取 digest.html → stdout / Resend 邮件
```

三个脚本通过**临时文件**传递数据，不依赖 shell 管道。
Windows PowerShell 管道默认 US-ASCII，会损坏中文 UTF-8。

## Key Files

| File | Role |
|------|------|
| `scripts/remix-digest.js` | ★ 核心引擎：LLM 策展 + HTML 模板渲染 + 兜底。`--file` 读输入，`--out` 写输出 |
| `scripts/prepare-digest.js` | 从中央 GitHub feed 拉取推文/播客数据。`--out` 写输出 |
| `scripts/deliver.js` | Resend API 邮件发送（HTML + 纯文本双模）。`--file` 读输入 |
| `scripts/format-auto-digest.js` | LLM 失败时的模板兜底 |
| `scripts/run-digest.sh` | WSL 调度入口脚本（两阶段：generate/send） |
| `install.ps1` | Windows 一键安装（WSL Ubuntu + 任务计划） |

## Configuration

| Path | Content |
|------|---------|
| `~/.ai-signal/config.json` | Language, frequency, delivery time, email |
| `~/.ai-signal/.env` | `RESEND_API_KEY`, `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` |

Legacy fallback: `~/.follow-builders/` is checked if `~/.ai-signal/` doesn't exist.

## Model Auto-Detection

`remix-digest.js` 启动时按以下优先级找模型：

| 优先级 | 来源 | 说明 |
|--------|------|------|
| 1 | `~/.ai-signal/.env` → `DEEPSEEK_MODEL` | 用户手动指定 |
| 2 | `~/.claude/settings.json` → `ANTHROPIC_DEFAULT_OPUS_MODEL_NAME` | 干净名，优先 |
| 3 | `~/.claude/settings.json` → `ANTHROPIC_DEFAULT_OPUS_MODEL` | 带后缀，自动剥离 `[1M]` `[1T]` 等 |
| 4 | `~/.claude/settings.json` → `ANTHROPIC_DEFAULT_SONNET_MODEL` | 同上 |
| 5 | 兜底 `deepseek-chat` | 永远可用的保底 |

API key 回退逻辑也会自动读 `settings.json`，但仅当 token 以 `sk-` 开头（DeepSeek key 特征）才会用，避免把 Anthropic key 误当 DeepSeek key 调用。

## Reliability

```
LLM generates JSON → repair common errors (trailing comma, control chars)
  → fails? → retry once with fix prompt
  → still fails? → renderFallback (template-based HTML)
  → user always gets an email
```

## Delivery Modes

| Mode | Output | Requirements |
|------|--------|-------------|
| stdout (default) | Plain text in terminal | Node.js + DeepSeek key |
| email | HTML email via Resend | Above + Resend account + domain |
| telegram | Markdown via Bot API | Above + bot token + chat ID |

## 手动操作

- **立即发送一期**：在 Claude Code 里输入 `/ai`
- **改频率/语言/邮箱**：直接跟我说
- **测试管道（WSL）**：`wsl -d Ubuntu -e bash /root/.ai-signal/run-digest.sh`
- **查看日志**：`wsl -d Ubuntu -e bash -c 'tail -20 /root/.ai-signal/cron.log'`

## Scheduling

Two-stage design: **generate at 09:45, send at 10:00** — ensures email arrives exactly on time.

- **Windows Task Scheduler** (primary): `.\install.ps1` — creates two daily tasks via WSL Ubuntu
  - "AI Signal Daily Digest (Generate)" at 09:45 → saves HTML draft
  - "AI Signal Daily Digest (Send)" at 10:00 → delivers pre-generated draft
- **GitHub Actions** (cloud fallback): `.github/workflows/digest.yml` — runs daily at 02:00 UTC (10:00 Beijing)
- **Linux/Mac cron**: `bash install.sh`

## 故障排查

| 问题 | 排查 |
|------|------|
| 没收到邮件 | 检查 QQ 邮箱垃圾箱；Resend dashboard 看 delivery status |
| 邮件中文乱码/问号 | 用文件传递模式（`--file`/`--out`），勿用 `\|` 管道 |
| 收到模板版而非精炼版 | LLM 临时不可达，下期自动恢复 |
| 任务计划没跑 | `Get-ScheduledTask -TaskName "AI Signal Daily Digest*"` |
| Draft 没生成 | 查看 `~/.ai-signal/cron.log` 中 GENERATE 阶段错误 |
| JSON 解析失败 | 查看 `~/.ai-signal/cron-errors.log` |
| 模型调用失败 | settings.json 中模型名可能带后缀，已自动剥离；检查 API key |

## Tech Stack

- Node.js (v24) + ESM
- DeepSeek API (native `/v1/chat/completions`，自动跟随 Claude Code 模型配置)
- Resend Email API
- Windows Task Scheduler + WSL (Ubuntu) / GitHub Actions (Linux)
- HTML 邮件模板（table 布局、内联 CSS、600px 容器）
- 文件传递架构（`--file` / `--out`），跨平台 UTF-8 安全，不依赖 shell 管道

## 发件品牌

- 发件名: AI Signal · 信号
- 发件地址: digest@praxisai.online
- 标题格式: 📡 AI Signal | 2026年X月X日星期X
