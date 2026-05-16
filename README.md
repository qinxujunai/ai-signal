# 📡 AI Signal · 信号

> 从 AI 噪音中提取信号。全自动、LLM 策展、中英双语、专业排版，每天准时送达。

Extract signal from AI noise. Fully automated, LLM-curated, bilingual, professionally formatted, delivered daily.

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

### Prerequisites

- **Node.js** ≥ 18
- **A DeepSeek API key** (or use the one already configured in Claude Code — auto-detected)
- **A Resend account** with a verified domain (for email delivery)
- **Windows**: WSL enabled (Ubuntu recommended)
- **Linux/Mac**: `cron` (usually pre-installed)

### 1. Clone

```bash
git clone https://github.com/YOUR_USERNAME/ai-frontier-digest.git
cd ai-frontier-digest
npm install --prefix scripts
```

### 2. Configure

Create `~/.follow-builders/.env`:

```env
# Resend API key for email delivery
RESEND_API_KEY=re_xxxxxxxxxxxx

# DeepSeek API key (optional — auto-reads from ~/.claude/settings.json)
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxx

# Model override (optional — defaults to Claude Code settings or deepseek-chat)
DEEPSEEK_MODEL=deepseek-v4-pro
```

Create `~/.follow-builders/config.json`:

```json
{
  "platform": "other",
  "language": "bilingual",
  "timezone": "Asia/Shanghai",
  "frequency": "daily",
  "deliveryTime": "10:00",
  "delivery": {
    "method": "email",
    "email": "your-email@qq.com"
  },
  "onboardingComplete": true
}
```

### 3. Schedule

**Windows (Task Scheduler + WSL):**
```powershell
.\install.ps1
```

**Linux/Mac (cron):**
```bash
(crontab -l 2>/dev/null; echo "0 10 * * * /path/to/scripts/run-digest.sh") | crontab -
```

### 4. Test

```bash
cd scripts
node prepare-digest.js | node remix-digest.js | node deliver.js
```

Check your email. You should receive a professionally formatted AI digest.

### 5. Manual Trigger

In Claude Code, type `/ai` to trigger an immediate digest.

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

| | Original follow-builders | AI Frontier Digest |
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

- Feed data sourced via [follow-builders](https://github.com/zarazhangrui/follow-builders) by [zarazhangrui](https://github.com/zarazhangrui)
- LLM curation & HTML template system built from scratch
- Email delivery via [Resend](https://resend.com)

---

## License

MIT
