---
name: ai
description: /ai — AI Signal · 信号。AI 行业每日简报，GitHub Actions 云端调度，LLM 策展、中英双语、专业排版。
---

# AI Signal · 信号

从 AI 噪音中提取信号。GitHub Actions 云端定时调度，DeepSeek 按编辑标准策展，高信息密度的中文 HTML 邮件 + 网页版。

## 管道执行

```bash
cd scripts && npm install
node prepare-digest.js --out /tmp/feed.json
node remix-digest.js --file /tmp/feed.json --out /tmp/digest.html --web-dir /tmp/web
node deliver.js --file /tmp/digest.html --force
```

三步：拉取 feed → LLM 策展渲染 → 发送/显示。文件传递，UTF-8 安全。

## 定时调度

- GitHub Actions：`.github/workflows/daily.yml`
- 每天 UTC 02:00 = 北京时间 10:00 自动运行
- 完全云端运行，无需本地电脑

## 配置

通过 GitHub Secrets 配置：`DEEPSEEK_API_KEY`、`QQ_EMAIL`、`QQ_SMTP_AUTH`、`AI_SIGNAL_CONFIG`

## 文件

| 文件 | 作用 |
|------|------|
| `scripts/prepare-digest.js` | Feed 数据拉取 |
| `scripts/remix-digest.js` | 素材编号 → LLM 策展 → 回填链接与数字 |
| `scripts/deliver.js` | QQ SMTP 邮件 / stdout 输出 |
| `scripts/render.js` | 邮件与网页排版 |
| `.github/workflows/daily.yml` | GitHub Actions 定时任务 |
