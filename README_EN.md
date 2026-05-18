<p align="center">
  <h1 align="center">AI Signal</h1>
  <p align="center">AI industry daily digest. LLM-curated, bilingual, delivered to your inbox.</p>
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

## What It Is

AI Signal tracks top AI builders on X and YouTube podcasts, remixes their content through DeepSeek LLM into a curated bilingual summary, renders it as a professional HTML email, and delivers it to your QQ mailbox.

No X API key. No YouTube API key. All content comes from a public central feed.

**👉 [View latest email sample](https://qinxujunai.github.io/ai-signal/)**

---

## AI Assistant Instructions

> If you are an AI coding assistant (Claude Code, Cursor, Copilot, Windsurf, Cline, Codex, etc.), follow these steps to set up the project for the user.

### Step 1: Install dependencies

```bash
cd scripts && npm install
```

### Step 2: Detect existing API keys

Check in this order, use the first one found:

| Location | What to check |
|----------|---------------|
| Env var `DEEPSEEK_API_KEY` | DeepSeek API key |
| Env var `QQ_SMTP_AUTH` | QQ SMTP auth code |
| `~/.ai-signal/.env` | Project config |
| `~/.claude/settings.json` | `ANTHROPIC_AUTH_TOKEN` (use if starts with `sk-`) |

### Step 3: Create config files

If `~/.ai-signal/config.json` doesn't exist, create it:

```json
{
  "language": "bilingual",
  "timezone": "Asia/Shanghai",
  "frequency": "daily",
  "deliveryTime": "10:00",
  "delivery": { "method": "email", "email": "user@qq.com" },
  "onboardingComplete": true
}
```

If `~/.ai-signal/.env` doesn't exist, create it with detected keys:

```env
QQ_EMAIL=user@qq.com
QQ_SMTP_AUTH=auth_code
DEEPSEEK_API_KEY=detected_key
```

**Ask the user:**
1. Do you have a DeepSeek API key? (If not, skip email mode, use terminal output)
2. Email or terminal? (Email needs QQ SMTP auth code)

### Step 4: Run the pipeline

```bash
cd scripts
node prepare-digest.js --out /tmp/feed.json
node remix-digest.js --file /tmp/feed.json --out /tmp/digest.html
node deliver.js --file /tmp/digest.html --force
```

---

## How It Works

```
prepare-digest.js  →  fetch feed → feed.json
  ↓ (file transfer, UTF-8 safe)
remix-digest.js    →  DeepSeek LLM curation → digest.html
  ↓
deliver.js         →  QQ SMTP email delivery
```

Three scripts pass data through temp files, no shell pipes, UTF-8 safe.

---

## Email Setup

1. Enable QQ Mail SMTP (Settings → Account → POP3/SMTP), get auth code
2. Configure `.env` and `config.json` (see AI assistant instructions above)

---

## Automated Delivery

### Windows

```powershell
.\install.ps1
```

Three-stage: 09:45 generate → 09:55 retry → 10:00 send.

### GitHub Actions

1. Fork → Settings → Secrets: `DEEPSEEK_API_KEY`, `QQ_EMAIL`, `QQ_SMTP_AUTH`, `AI_SIGNAL_CONFIG`
2. Enable Actions

### Linux/Mac

```bash
bash install.sh
```

---

## Project Structure

```
ai-signal/
├── scripts/
│   ├── prepare-digest.js      # Feed fetching
│   ├── remix-digest.js        # LLM curation + HTML rendering
│   ├── deliver.js             # QQ SMTP email delivery
│   ├── check-feed-health.js   # Feed health monitor
│   └── run-digest.sh          # Scheduling script
├── install.ps1 / install.sh   # One-click install
├── .github/workflows/         # GitHub Actions
├── CLAUDE.md                  # Claude Code instructions
├── .cursor/rules/             # Cursor instructions
├── .github/copilot-instructions.md  # Copilot instructions
├── .windsurfrules             # Windsurf instructions
├── .clinerules                # Cline instructions
└── AGENTS.md                  # Codex instructions
```

---

## Auto-Detection

| Config | Priority |
|--------|----------|
| API key | `.env` → env vars → Claude Code settings.json |
| Model | `DEEPSEEK_MODEL` → `ANTHROPIC_DEFAULT_OPUS_MODEL` → `deepseek-chat` |
| Feed | Default central feed, customizable via `FEED_BASE_URL` |

---

## Credits

Data source: [follow-builders](https://github.com/zarazhangrui/follow-builders) — tracking 25 AI builders and 6 podcasts, freely available.

---

## License

MIT
