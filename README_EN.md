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
  <img src="https://img.shields.io/badge/GitHub_Actions-Free_Cloud_Scheduling-2088FF?style=flat-square&logo=githubactions&logoColor=white" alt="GitHub Actions">
  <img src="https://img.shields.io/badge/DeepSeek-v4--flash-4D8BFF?style=flat-square" alt="DeepSeek">
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT License">
</p>

---

## What It Is

AI Signal tracks top AI builders on X and YouTube podcasts, remixes their content through DeepSeek LLM into a curated bilingual summary, renders it as a professional HTML email, and delivers it to your QQ mailbox.

**Fully cloud-based. No local computer required.** Runs on GitHub Actions, free for public repos.

No X API key. No YouTube API key. All content comes from a public central feed.

**👉 [View latest email sample](https://qinxujunai.github.io/ai-signal/)**

---

## Quick Start

### GitHub Actions (Recommended)

```bash
# 1. Fork this repository
# 2. In Settings → Secrets and variables → Actions, add:
#    DEEPSEEK_API_KEY  — Your DeepSeek API key (platform.deepseek.com)
#    QQ_EMAIL          — Your QQ email
#    QQ_SMTP_AUTH      — QQ email SMTP auth code
#    AI_SIGNAL_CONFIG  — config.json content (see below)
# 3. Enable Actions → Daily at 10:00 AM Beijing time
```

**Completely cloud-based, no local computer needed.** GitHub Actions free tier: unlimited minutes for public repos, 2000 minutes/month for private repos. Running 2 minutes daily is more than enough.

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

## Configuration

### GitHub Actions Secrets

Add these in your GitHub repo's Settings → Secrets and variables → Actions:

| Secret Name | Description |
|-------------|-------------|
| `DEEPSEEK_API_KEY` | DeepSeek API key (platform.deepseek.com) |
| `QQ_EMAIL` | Your QQ email |
| `QQ_SMTP_AUTH` | QQ email SMTP auth code (QQ Mail → Settings → Account → POP3/SMTP → Generate auth code) |
| `AI_SIGNAL_CONFIG` | config.json content (see below) |

### AI_SIGNAL_CONFIG Content

```json
{
  "language": "bilingual",
  "timezone": "Asia/Shanghai",
  "frequency": "daily",
  "deliveryTime": "10:00",
  "delivery": {
    "method": "email",
    "email": "your-qq-email@qq.com"
  },
  "onboardingComplete": true
}
```

### Custom Feeds

Override default feeds via environment variables:

```env
FEED_BASE_URL=https://raw.githubusercontent.com/your-org/your-feed/main
FEED_X_URL=your-custom-x-feed.json
FEED_PODCASTS_URL=your-custom-podcasts.json
FEED_BLOGS_URL=your-custom-blogs.json
```

---

## Project Structure

```
ai-signal/
├── scripts/
│   ├── prepare-digest.js      # Feed fetching (X/podcasts/blogs)
│   ├── remix-digest.js        # LLM curation + HTML rendering
│   ├── deliver.js             # QQ SMTP email delivery
│   └── check-feed-health.js   # Feed health monitor
├── .github/workflows/
│   └── digest.yml             # GitHub Actions scheduled task (cloud-based)
├── config.example.json        # Config template
└── README.md
```

---

## DeepSeek API Cost

| Model | Input Price | Output Price | Daily Digest Cost |
|-------|-------------|--------------|-------------------|
| deepseek-chat (v4-flash) | $0.14/M tokens | $0.28/M tokens | ~$0.002 |
| deepseek-reasoner (v4-pro) | $0.55/M tokens | $2.19/M tokens | ~$0.01 |

**deepseek-chat costs about $0.73 per year, essentially free.** New accounts get 5M tokens free, enough for 333 days.

---

## Credits

- Data source: [follow-builders](https://github.com/zarazhangrui/follow-builders) — tracking 25 AI builders and 6 podcasts, freely available
- LLM: [DeepSeek](https://platform.deepseek.com/) — high性价比的中文 LLM

---

## License

MIT
