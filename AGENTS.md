# AI Signal — Agent Instructions

本项目是一个 AI 行业每日简报系统。请阅读 `README.md` 获取完整配置指南。

## 快速开始

1. Fork 本仓库
2. 在 Settings → Secrets and variables → Actions 中添加：
   - `DEEPSEEK_API_KEY` — 你的 DeepSeek API key
   - `QQ_EMAIL` — 你的 QQ 邮箱
   - `QQ_SMTP_AUTH` — QQ 邮箱 SMTP 授权码
   - `AI_SIGNAL_CONFIG` — config.json 的内容
3. 启用 Actions → 每天北京时间 10:00 自动发送

## 关键文件

- `scripts/remix-digest.js` — LLM 策展引擎（含 system prompt）
- `scripts/prepare-digest.js` — Feed 数据拉取
- `scripts/deliver.js` — QQ SMTP 邮件发送
- `.github/workflows/digest.yml` — GitHub Actions 定时任务（云端调度）

## 配置检测

API key 通过 GitHub Secrets 配置，运行时注入到环境变量中。
