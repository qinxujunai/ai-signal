<p align="right"><a href="README.md">中文</a> · <strong>English</strong></p>

# AI Signal

**An AI briefing, planned daily for 10:00 Beijing time and readable in a few minutes.**

> Hundreds of AI updates arrive every day. The hard part isn't seeing them; it's telling which are credible and which are worth reading. I also want to know about good GitHub projects early, and what problem each one solves. So it reads everything for me each morning.
> — Qin Xujun

🌐 **[qinxujunai.github.io/ai-signal](https://qinxujunai.github.io/ai-signal/)** · [Today](https://qinxujunai.github.io/ai-signal/latest/) · [Archive](https://qinxujunai.github.io/ai-signal/archive/) · [RSS](https://qinxujunai.github.io/ai-signal/feed.xml) · [Changelog](CHANGELOG.md)

## What it reads
AI builders on X, Hacker News, Techmeme, Reddit (via [AINews](https://www.latent.space/s/ainews)), Hugging Face papers and trending models, GitHub Trending, Product Hunt, lab blogs (OpenAI, Anthropic, Google DeepMind, Qwen and more), and Chinese tech media. About 100 fresh items a day; 15–25 make the issue.

## What an issue contains
- **Masthead:** issue number, the day's headline (also the email subject), and one editor's line on where the day points.
- **30 seconds:** three takeaways with numbers.
- **Lead story:** what happened and why it matters.
- **Stories:** 6–9 items, each with a tag, a signal-strength mark (●●○), the source and the discussion.
- **Community:** the hottest Reddit threads. **Voices:** sharp takes from X.
- **New models / new products:** Hugging Face trending weights and Product Hunt launches.
- **Papers / open source / quick hits.**

## Why you can trust it
- **The model never writes links or numbers.** Every item has an ID; the model may only cite IDs, and code fills in links, scores and star counts from the raw data. An unknown ID drops the item.
- **No repeats:** sent links are remembered for 60 days.
- **Never silent:** without the model, the issue is built from ranked sources and says so; a dead source is named in the footer.

## How it arrives on time
GitHub's scheduler can start a job hours late (a 09:41 run started at 14:32 on 2026-10-22) and may drop runs. So a run is queued every 20 minutes from 04:07 to 09:47 Beijing time; the first one to start claims the day, collects and edits at 09:35, and sends at exactly 10:00:00. Later runs see the issue and stop; a run that only starts after 10:00 sends at once.

## Setup
Secrets: `DEEPSEEK_API_KEY`, `QQ_EMAIL`, `QQ_SMTP_AUTH`, `AI_SIGNAL_CONFIG` (contents of `config.example.json`). Addresses live only in secrets; neither the code nor the logs print them.

```bash
cd scripts && npm ci && npm test
node prepare-digest.js --out /tmp/feed.json --seen ../data/seen.json
node remix-digest.js --file /tmp/feed.json --out /tmp/email.html --web-dir /tmp/web
node deliver.js --file /tmp/email.html --dry-run
```

[MIT](LICENSE)
