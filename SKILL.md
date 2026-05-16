---
name: ai-signal
description: /ai — AI industry daily digest. Curated bilingual newsletter from top builders. Use when user invokes /ai, wants AI news, frontier updates, or industry insights. Zero content API keys. Auto-detects LLM config from Claude Code settings.
---

# AI Signal · 信号

Extract signal from AI noise. A fully automated, LLM-curated daily digest of the AI industry.

## What You Do

When the user invokes `/ai` or asks for their AI digest, run the full pipeline:

```bash
cd <SKILL_DIR>/scripts
node prepare-digest.js 2>/dev/null | node remix-digest.js 2>/dev/null | node deliver.js
```

This fetches the latest, remixes via LLM, and delivers based on their config.

## First Run — Auto-Onboarding

Check if `~/.follow-builders/config.json` exists. If NOT, run onboarding:

1. Tell the user: "AI Signal 需要几分钟完成首次配置。你只需要一个 DeepSeek API key。"
2. Ask: "推送方式？"
   - **终端查看（推荐起步）** — 零额外配置，摘要直接显示在对话里
   - **邮件推送** — 需要 Resend 账号 + 域名
3. If email: walk through the Resend setup (same as before)
4. Ask: "语言偏好？" → 中英双语 / 纯中文 / 纯英文
5. Ask: "推送频率？" → 每天 / 每周
6. Save config to `~/.follow-builders/config.json`:

```json
{
  "platform": "other",
  "language": "<bilingual|zh|en>",
  "timezone": "Asia/Shanghai",
  "frequency": "<daily|weekly>",
  "deliveryTime": "10:00",
  "delivery": {
    "method": "<stdout|email>",
    "email": "<if email>"
  },
  "onboardingComplete": true
}
```

7. If they have a DeepSeek API key, save to `~/.follow-builders/.env`:

```env
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxx
```

Tell them: "如果你的 Claude Code 已经配了 DeepSeek API key，这步跳过——系统会自动读取。"

8. Do NOT ask for X/Twitter API keys or YouTube API keys. Content comes from a central feed.
9. After saving config, immediately run the pipeline to show them the first digest.

## Auto-Detection

The remix engine automatically:
- Reads `DEEPSEEK_API_KEY` from `~/.follow-builders/.env`
- Falls back to `ANTHROPIC_AUTH_TOKEN` from `~/.claude/settings.json`
- Reads model from `ANTHROPIC_DEFAULT_OPUS_MODEL` in settings.json
- Strips `[1m]` suffix automatically

This means users who already use Claude Code with DeepSeek need ZERO additional API configuration.

## Delivery Modes

### stdout (zero setup)
- Digest is output directly in the terminal/Claude Code conversation
- No Resend, no domain, no cron needed
- User just types `/ai` whenever they want a digest

### email (full setup)
- Professional HTML email via Resend
- Requires Resend API key + verified domain
- Can be scheduled (Windows Task Scheduler or Linux cron)
- Run `install.ps1` for one-click Windows setup

## Troubleshooting

- "No API key" → Check `~/.follow-builders/.env` or `~/.claude/settings.json`
- "Empty digest" → Central feed may be updating, retry in a minute
- Email not received → Check spam folder; verify domain in Resend dashboard

## Files

- `scripts/remix-digest.js` — Core curation + HTML rendering engine
- `scripts/prepare-digest.js` — Fetches central feed
- `scripts/deliver.js` — Delivery (stdout / email / Telegram)
- `install.ps1` — Windows one-click scheduling setup
