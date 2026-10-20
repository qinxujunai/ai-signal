<p align="right"><a href="README.md">中文</a> · <strong>English</strong></p>

# AI Signal

**Hundreds of AI headlines a day. The twenty that matter, in three minutes.**

Every day at 10:00 Beijing time, AI Signal reads:
- AI builders on X
- Hacker News
- the Hugging Face Daily Papers ranking
- GitHub Trending
- official lab blogs
- Chinese media

DeepSeek selects, merges and rewrites the day's items against a fixed editorial brief. The issue goes to your inbox and to the web.

[Latest issue](https://qinxujunai.github.io/ai-signal/) · [Archive](https://qinxujunai.github.io/ai-signal/archive/)

## What an issue contains
- A one-line headline, which is also the email subject.
- A 30-second summary.
- One lead story with "why it matters".
- 6–9 stories, each with a source line.
- Opinions from X.
- Top papers.
- Trending AI repositories.
- Quick hits.
- A podcast digest when there is a new episode.

The layout follows TLDR, The Rundown, smol.ai AINews and Axios: one column, no images, no tracking.

## Why you can trust it
- **The model never writes links.** Every source item gets an ID, and the model may only cite IDs. Code fills in the real links, scores and star counts. An unknown ID drops the item.
- **No repeats.** Sent links are kept in `data/seen.json` for 60 days.
- **Always delivered.** If the model fails, the issue is built from ranked sources and says so. Missing sources are named in the footer.

## How it works
1. `prepare-digest.js` collects the last 36 hours.
2. `remix-digest.js` numbers the items, asks DeepSeek for a JSON issue, resolves the IDs, and renders the email and web editions (`render.js`).
3. `deliver.js` sends it over QQ SMTP.

GitHub Actions (`.github/workflows/daily.yml`) runs this daily and commits the web edition. That commit also keeps GitHub from pausing the schedule for inactivity.

## Setup
Add these secrets:
- `DEEPSEEK_API_KEY`
- `QQ_EMAIL`
- `QQ_SMTP_AUTH`
- `AI_SIGNAL_CONFIG` (the contents of `config.example.json`)

Cost: about $0.003 a day with deepseek-chat.

MIT
