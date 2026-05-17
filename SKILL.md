---
name: ai
description: /ai — AI Signal · 信号。AI 行业每日简报，LLM 策展、中英双语、专业排版。Type /ai for your curated daily AI digest. Handles first-time setup automatically.
---

# AI Signal · 信号

Extract signal from AI noise. A fully automated, LLM-curated daily digest of the AI industry.

## Detection

Before anything, check: does `~/.ai-signal/config.json` exist AND have `"onboardingComplete": true`?

- **NO → Run First-Time Setup below.**
- **YES → Run Digest Pipeline below.**

---

## First-Time Setup

### Step 1: Greeting

Tell the user:

"Hi! I'm **AI Signal**, your personal AI industry digest. I track top AI builders on X and YouTube podcasts, then remix their content into a curated bilingual summary. No content API keys needed — everything comes from a central feed.

Let's get you set up in under a minute."

### Step 2: API Key

Check `~/.claude/settings.json` for `ANTHROPIC_AUTH_TOKEN`. Also check `~/.ai-signal/.env` for `DEEPSEEK_API_KEY`.

If neither exists: "First — do you have a DeepSeek API key? (If you already use Claude Code with DeepSeek, this is auto-detected and you can skip.)"

If they provide one, save it:
```bash
mkdir -p ~/.ai-signal
cat > ~/.ai-signal/.env << 'ENVEOF'
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

Save `~/.ai-signal/config.json`:

```bash
cat > ~/.ai-signal/config.json << 'CFGEOF'
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

**On Windows (PowerShell):**
```powershell
$TMP = "$env:USERPROFILE\.ai-signal\tmp"
New-Item -ItemType Directory -Force $TMP | Out-Null
$OutputEncoding = [System.Text.Encoding]::UTF8
node prepare-digest.js --out "$TMP\feed.json"
if ($LASTEXITCODE -eq 0) { node remix-digest.js --file "$TMP\feed.json" --out "$TMP\digest.html" }
if ($LASTEXITCODE -eq 0) { node deliver.js --file "$TMP\digest.html" --force }
```

**On Linux/macOS (bash):**
```bash
TMP="$HOME/.ai-signal/tmp"
mkdir -p "$TMP"
node prepare-digest.js --out "$TMP/feed.json" && \
node remix-digest.js --file "$TMP/feed.json" --out "$TMP/digest.html" && \
node deliver.js --file "$TMP/digest.html" --force
```

This:
1. Fetches the latest tweets + podcast transcripts from the central feed
2. Writes to temp files instead of relying on shell pipes (avoids encoding corruption)
3. Sends through DeepSeek for curation and bilingual formatting
4. Delivers based on config (stdout: displays here; email: sends via Resend)

### Why file-based, not pipe-based

PowerShell 5.1 defaults `$OutputEncoding` to US-ASCII. Piping `node a.js | node b.js` transcodes UTF-8 Chinese through ASCII, turning all non-ASCII characters into `?`. Bash pipes are byte-transparent but file-based is consistently safe everywhere.

---

## Auto-Detection

- API key: `~/.ai-signal/.env` → `~/.claude/settings.json` (auto)
- Model: `DEEPSEEK_MODEL` env → `ANTHROPIC_DEFAULT_OPUS_MODEL` in settings → `deepseek-chat` (fallback)
- No content API keys EVER needed (X, YouTube, etc.)

---

## Files

- `scripts/remix-digest.js` — Core curation + HTML rendering
- `scripts/prepare-digest.js` — Central feed fetching
- `scripts/deliver.js` — Delivery (stdout / email)
- `install.ps1` / `install.sh` — Automated scheduling setup
