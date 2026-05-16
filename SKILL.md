---
name: ai-signal
description: /ai — AI industry daily digest. Use when user invokes /ai, wants AI news, frontier updates, or industry insights. Handles first-time setup automatically.
---

# AI Signal · 信号

Extract signal from AI noise. A fully automated, LLM-curated daily digest of the AI industry.

## Detection

Before anything, check: does `~/.follow-builders/config.json` exist AND have `"onboardingComplete": true`?

- **NO → Run First-Time Setup below.**
- **YES → Run Digest Pipeline below.**

---

## First-Time Setup

### Step 1: Greeting

Tell the user:

"Hi! I'm **AI Signal**, your personal AI industry digest. I track top AI builders on X and YouTube podcasts, then remix their content into a curated bilingual summary. No content API keys needed — everything comes from a central feed.

Let's get you set up in under a minute."

### Step 2: API Key

Check `~/.claude/settings.json` for `ANTHROPIC_AUTH_TOKEN`. Also check `~/.follow-builders/.env` for `DEEPSEEK_API_KEY`.

If neither exists: "First — do you have a DeepSeek API key? (If you already use Claude Code with DeepSeek, this is auto-detected and you can skip.)"

If they provide one, save it:
```bash
mkdir -p ~/.follow-builders
cat > ~/.follow-builders/.env << 'ENVEOF'
DEEPSEEK_API_KEY=<their key>
ENVEOF
```

If auto-detected: "✓ DeepSeek API key auto-detected from your Claude Code settings."

### Step 3: Delivery Method

Ask: "How would you like to receive your digest?"

1. **终端查看 (Recommended to start)** — Digest appears directly in this conversation. Zero extra setup.
2. **邮件推送** — Professionally formatted HTML email. Requires a free Resend account and a domain.

If email:
- Walk through Resend setup (sign up → API key → verify domain)
- Ask for their email address
- Save to config

### Step 4: Language

Ask: "Language preference?"
- 中英双语 (Bilingual) — Recommended
- 纯中文
- English only

### Step 5: Save Config

Save `~/.follow-builders/config.json`:

```bash
cat > ~/.follow-builders/config.json << 'CFGEOF'
{
  "platform": "other",
  "language": "<bilingual|zh|en>",
  "timezone": "Asia/Shanghai",
  "frequency": "daily",
  "deliveryTime": "10:00",
  "delivery": {
    "method": "<stdout|email>",
    "email": "<if email>"
  },
  "onboardingComplete": true
}
CFGEOF
```

### Step 6: First Digest

"All set! Let me generate your first digest now..."

Run the pipeline immediately (see below). After showing the digest:

"Your next digest: type `/ai` anytime. To set up automatic daily delivery, check the README at https://github.com/qinxujunai/ai-signal"

---

## Digest Pipeline

Once onboarded, every `/ai` invocation runs:

```bash
cd <SKILL_DIR>/scripts
node prepare-digest.js 2>/dev/null | node remix-digest.js 2>/dev/null | node deliver.js
```

This:
1. Fetches the latest tweets + podcast transcripts from the central feed
2. Sends them through DeepSeek for curation and bilingual formatting
3. Delivers based on config (stdout: displays here; email: sends via Resend)

### Fallback behavior

If the LLM fails, a template-based fallback ensures you always get content.

---

## Auto-Detection

- API key: `~/.follow-builders/.env` → `~/.claude/settings.json` (auto)
- Model: `DEEPSEEK_MODEL` env → `ANTHROPIC_DEFAULT_OPUS_MODEL` in settings → `deepseek-chat` (fallback)
- No content API keys EVER needed (X, YouTube, etc.)

---

## Files

- `scripts/remix-digest.js` — Core curation + HTML rendering
- `scripts/prepare-digest.js` — Central feed fetching
- `scripts/deliver.js` — Delivery (stdout / email)
- `install.ps1` / `install.sh` — Automated scheduling setup
