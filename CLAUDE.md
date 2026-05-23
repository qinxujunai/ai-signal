# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# AI Signal

> AI 行业每日简报。GitHub Actions 云端调度，LLM 策展、中英双语、QQ 邮箱直达。

## 架构

```
prepare-digest.js  →  feed.json
remix-digest.js    →  digest.html（LLM 策展 + HTML 模板）
deliver.js         →  QQ SMTP 邮件
```

## 命令

```bash
cd scripts && npm install
node prepare-digest.js --out /tmp/feed.json
node remix-digest.js --file /tmp/feed.json --out /tmp/digest.html
node deliver.js --file /tmp/digest.html --force
```

## 关键文件

| 文件 | 作用 |
|------|------|
| `scripts/remix-digest.js` | LLM 策展 + HTML 渲染（含 system prompt） |
| `scripts/prepare-digest.js` | Feed 数据拉取 |
| `scripts/deliver.js` | QQ SMTP 邮件发送 |
| `.github/workflows/digest.yml` | GitHub Actions 定时任务（云端调度） |

## 配置

| 路径 | 内容 |
|------|------|
| GitHub Secrets | `QQ_EMAIL`、`QQ_SMTP_AUTH`、`DEEPSEEK_API_KEY`、`AI_SIGNAL_CONFIG` |

## 定时调度

- GitHub Actions：`.github/workflows/digest.yml`（每天 UTC 02:00 = 北京时间 10:00）
- 完全云端运行，无需本地电脑

## 技术栈

- Node.js + ESM
- DeepSeek API
- QQ SMTP（nodemailer, smtp.qq.com:465）
- 文件传递（`--file` / `--out`），UTF-8 安全
