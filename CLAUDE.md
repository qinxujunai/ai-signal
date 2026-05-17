# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# AI Signal · 信号

> 从 AI 噪音中提取信号。全自动 LLM 策展、中英双语、专业 HTML 排版、每日邮件送达。

## Development Commands

```bash
# Install dependencies
cd scripts && npm install

# Run full pipeline (stdout mode — displays in terminal)
cd scripts && npm run digest

# Run individual steps
cd scripts && node prepare-digest.js                    # fetch feed → stdout JSON
cd scripts && node prepare-digest.js | node remix-digest.js   # curate → stdout HTML
cd scripts && node prepare-digest.js | node remix-digest.js | node deliver.js  # full pipe

# Email mode (requires Resend config)
cd scripts && node prepare-digest.js | node remix-digest.js | node deliver.js --force

# Dry run (check without sending)
cd scripts && node prepare-digest.js | node remix-digest.js | node deliver.js --dry-run

# Feed health check
cd scripts && node check-feed-health.js

# WSL test (Windows)
wsl -e bash /root/.ai-signal/run-digest.sh
```

## Architecture

```
prepare-digest.js  →  fetches central feed JSON (no personal API key needed)
     ↓ stdin JSON
remix-digest.js    →  DeepSeek LLM curation + HTML template rendering
     ↓ stdout HTML
deliver.js         →  stdout (terminal) / Resend email / Telegram
```

All scripts communicate via **stdin/stdout piping**. `prepare-digest.js` outputs a single JSON blob; `remix-digest.js` consumes it and outputs HTML; `deliver.js` sends or displays the result.

## Key Files

| File | Role |
|------|------|
| `scripts/remix-digest.js` | Core engine: LLM curation + HTML rendering + fallback |
| `scripts/prepare-digest.js` | Central feed fetching (tweets, podcasts, blogs) |
| `scripts/deliver.js` | Delivery: stdout / Resend email / Telegram |
| `scripts/format-auto-digest.js` | Template fallback when LLM fails |
| `scripts/check-feed-health.js` | Feed staleness monitor |
| `scripts/run-digest.sh` | WSL/Linux scheduling entry point |
| `SKILL.md` | Claude Code `/ai` skill definition |

## Configuration

| Path | Content |
|------|---------|
| `~/.ai-signal/config.json` | Language, frequency, delivery time, email |
| `~/.ai-signal/.env` | `RESEND_API_KEY`, `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` |

Legacy fallback: `~/.follow-builders/` is checked if `~/.ai-signal/` doesn't exist.

## Model Auto-Detection

`remix-digest.js` resolves the model in this order:
1. `DEEPSEEK_MODEL` in `~/.ai-signal/.env`
2. `ANTHROPIC_DEFAULT_OPUS_MODEL` / `ANTHROPIC_DEFAULT_SONNET_MODEL` / `ANTHROPIC_MODEL` from `~/.claude/settings.json`
3. Fallback: `deepseek-chat`

API key: `DEEPSEEK_API_KEY` env → `ANTHROPIC_AUTH_TOKEN` in `~/.claude/settings.json`

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

## Scheduling

Two-stage design: **generate at 09:45, send at 10:00** — ensures email arrives exactly on time.

- **Windows Task Scheduler** (primary): `.\install.ps1` — creates two daily tasks via WSL Ubuntu
  - "AI Signal Daily Digest (Generate)" at 09:45 → saves HTML draft
  - "AI Signal Daily Digest (Send)" at 10:00 → delivers pre-generated draft
- **GitHub Actions** (cloud fallback): `.github/workflows/digest.yml` — runs daily at 02:00 UTC (10:00 Beijing)
- **Linux/Mac cron**: `bash install.sh`

## Troubleshooting

| Problem | Check |
|---------|-------|
| No email received | QQ email spam folder; Resend dashboard delivery status |
| Template version instead of curated | LLM temporarily unreachable — auto-recovers next run |
| Task Scheduler not running | `Get-ScheduledTask -TaskName "AI Signal Daily Digest*"` |
| Draft not generated | Check `~/.ai-signal/cron.log` for GENERATE stage errors |
| JSON parse failure | `~/.ai-signal/cron-errors.log` |

## Tech Stack

- Node.js (v24) + ESM (`"type": "module"`)
- DeepSeek API (`/v1/chat/completions` native, no SDK)
- Resend Email API
- HTML email templates: table layout, inline CSS, 600px container, MSO conditionals
- dotenv for env loading
