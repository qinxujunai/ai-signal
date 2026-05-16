# 📡 AI Signal · 信号

> 从 AI 噪音中提取信号。全自动、LLM 策展、中英双语、专业排版，每天准时送达。

Extract signal from AI noise. Fully automated, LLM-curated, bilingual, professionally formatted, delivered daily.

---

## NOT Claude Code Only

AI Signal is a **standalone Node.js pipeline**. It works anywhere Node.js runs.

| 使用方式 | 命令 |
|---------|------|
| **终端** | `node prepare-digest.js \| node remix-digest.js \| node deliver.js` |
| **npm** | `npm run digest` |
| **cron / 任务计划** | `bash run-digest.sh` (already scheduled daily 10:00) |
| **Claude Code** | `/ai` (convenience entry point) |
| **Codex CLI / Cursor / 任何 Agent** | 同上，只要它能执行 shell 命令 |

The `/ai` slash command in Claude Code is just a convenience — the engine itself is tool-agnostic.

---

## What It Does

Every morning at your chosen time, this system:

1. **Fetches** the latest posts from 13+ top AI builders on X/Twitter and the latest AI podcast transcripts — from a centralized feed. **No X API key, no YouTube API key, no scraping required.**
2. **Curates** the content through an LLM (DeepSeek, configurable) — filtering noise, grouping by topic, extracting key insights, and writing bilingual summaries.
3. **Renders** a professionally designed HTML email — card layout, gradient header, mobile-friendly, with clickable source links.
4. **Delivers** to your email inbox via Resend.

All fully automated. You do nothing after setup.

### Sample output

<img src="https://img.shields.io/badge/format-HTML_Email-blue" alt="HTML Email"> <img src="https://img.shields.io/badge/language-Bilingual_(CN/EN)-green" alt="Bilingual"> <img src="https://img.shields.io/badge/style-Newsletter_Cards-purple" alt="Newsletter">

- **今日焦点** (Today's Focus) — the single most important story, prominently displayed
- **今日必读** (Must Read) — 1-2 curated deep-dives with full context
- **主题板块** (Topic Sections) — grouped by theme (Product, Strategy, Open Source, Funding)
- **深度播客** (Deep Dive Podcast) — 3-5 key insights with memorable quotes and takeaway

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                  SCHEDULER                         │
│  Windows Task Scheduler or Linux cron              │
│  Fires daily at your configured time              │
└────────────────────┬─────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────┐
│              FEED FETCHING                         │
│  prepare-digest.js                                 │
│  Pulls centralized feed from GitHub raw URLs      │
│  No API keys needed for content                   │
└────────────────────┬─────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────┐
│              LLM CURATION                          │
│  remix-digest.js                                   │
│  DeepSeek API (configurable model)                │
│  • Filters low-quality tweets                     │
│  • Groups by topic                                │
│  • Generates bilingual summaries                  │
│  • Outputs structured JSON                        │
│  • Auto-reads API key from Claude Code settings   │
└────────────────────┬─────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────┐
│              HTML RENDERING                        │
│  Hand-crafted email template                      │
│  • 600px responsive container                    │
│  • Gradient header with date                     │
│  • Card-based content layout                     │
│  • Chinese-first bilingual ordering              │
│  • Inline CSS for email client compatibility     │
└────────────────────┬─────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────┐
│              EMAIL DELIVERY                        │
│  deliver.js + Resend API                          │
│  • HTML email with plain-text fallback            │
│  • Custom domain (praxisai.online)               │
│  • Delivered to QQ邮箱 / Gmail / any email        │
└──────────────────────────────────────────────────┘
```

### Fault Tolerance

```
LLM JSON generated ──→ Valid? ──→ Render HTML ──→ Send
                          │
                          ├── Repair common errors (trailing commas, control chars)
                          ├── Retry once with fix prompt
                          └── Both fail? ──→ Fallback template (still sends!)
```

**You will always receive an email.** If the LLM is unavailable, a clean template-based version is sent instead, with a note that the next issue will auto-recover.

---

## Project Structure

```
ai-signal/
├── README.md                    # This file
├── .gitignore
├── scripts/
│   ├── prepare-digest.js        # Feed fetching (fetches from central GitHub feed)
│   ├── remix-digest.js          # LLM curation + HTML template rendering ★ core
│   ├── deliver.js               # Email delivery via Resend
│   ├── format-auto-digest.js    # Simple template fallback
│   └── run-digest.sh            # WSL/Linux cron wrapper
├── prompts/                     # LLM prompt templates (optional overrides)
└── install.ps1                  # Windows one-click setup
```

---

## Quick Start

### Zero to Digest in 2 Minutes

```bash
# 1. Clone into Claude Code skills directory
git clone https://github.com/qinxujunai/ai-signal.git ~/.claude/skills/ai-signal

# 2. Install dependencies
cd ~/.claude/skills/ai-signal/scripts && npm install

# 3. Done. Type /ai in Claude Code.
```

**That's it.** If your Claude Code is already configured with a DeepSeek API key, the system auto-detects it. No `.env` file, no Resend, no domain, no cron needed.

### What Happens When You Type `/ai`

```
/ai → Claude Code scans skill descriptions
    → Matches "AI industry daily digest"
    → Runs: prepare-digest.js → remix-digest.js → deliver.js
    → Digest appears in your terminal (stdout mode)
```

No content API keys are ever needed — all tweets and podcast transcripts come from a centralized feed.

### Optional: Email Delivery

Want the digest as a professionally formatted HTML email instead?

1. Sign up at [resend.com](https://resend.com), verify a domain
2. Create `~/.ai-signal/.env`:
```env
RESEND_API_KEY=re_xxxxxxxxxxxx
```
3. Create `~/.ai-signal/config.json`:
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

### Optional: Daily Auto-Send

**Windows (Task Scheduler + WSL):**
```powershell
.\install.ps1
```

**Linux/Mac (cron):**
```bash
bash install.sh
```

### Test the Pipeline

```bash
cd ~/.claude/skills/ai-signal/scripts
node prepare-digest.js | node remix-digest.js | node deliver.js
```

---

## Configuration Reference

| Setting | Values | Description |
|---------|--------|-------------|
| `language` | `bilingual`, `zh`, `en` | Digest language |
| `frequency` | `daily`, `weekly` | Delivery frequency |
| `deliveryTime` | `"HH:MM"` | Time in your timezone |
| `timezone` | IANA timezone | e.g. `Asia/Shanghai` |
| `delivery.method` | `email`, `telegram`, `stdout` | Delivery method |
| `delivery.email` | email address | Recipient email |

### Changing Settings

Just tell Claude Code: "Switch to weekly digests", "Change language to Chinese", "Change my email to ..."

---

## How It's Different

| | Central feed based tools | AI Signal |
|---|---|---|
| **Content format** | Plain text / markdown | Professional HTML email |
| **Trigger** | Manual (`/ai` in agent) | Automatic (daily schedule) + manual (`/ai`) |
| **Curation** | Agent in-session LLM | Standalone DeepSeek API with custom prompts |
| **Bilingual** | Manual interleaving | Smart template: Chinese-first, English subtitle |
| **Layout** | Raw text | Card layout, gradient header, section tags |
| **Reliability** | No fallback | JSON repair → retry → template fallback |
| **API keys** | Manual .env setup | Auto-reads from Claude Code settings.json |
| **Model** | Fixed | Auto-follows Claude Code model config |

---

## Credits

- LLM curation & HTML template system built from scratch
- Email delivery via [Resend](https://resend.com)
- Default feed source: community-maintained builder tracking

---

## License

MIT
