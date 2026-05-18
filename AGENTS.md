# AI Signal — Agent Instructions

本项目是一个 AI 行业每日简报系统。请阅读 `README.md` 获取完整配置指南。

## 快速开始

1. `cd scripts && npm install`
2. 检测用户是否已有 DeepSeek API key 和 QQ SMTP 授权码
3. 创建 `~/.ai-signal/.env` 和 `~/.ai-signal/config.json`
4. 运行管道：`node prepare-digest.js --out /tmp/feed.json && node remix-digest.js --file /tmp/feed.json --out /tmp/digest.html && node deliver.js --file /tmp/digest.html --force`

## 关键文件

- `scripts/remix-digest.js` — LLM 策展引擎（含 system prompt）
- `scripts/prepare-digest.js` — Feed 数据拉取
- `scripts/deliver.js` — QQ SMTP 邮件发送
- `scripts/run-digest.sh` — 定时调度

## 配置检测

API key 按优先级查找：`.env` → 环境变量 → `~/.claude/settings.json`（仅 `sk-` 开头）
