# AI Signal — Copilot Instructions

本项目是一个 AI 行业每日简报系统。详见 `README.md`。

## 项目结构

三个 Node.js 脚本通过文件传递数据：
1. `prepare-digest.js` — 拉取中央 feed
2. `remix-digest.js` — DeepSeek LLM 策展 + HTML 渲染
3. `deliver.js` — QQ SMTP 发送邮件

## 配置文件位置

- `~/.ai-signal/.env` — API key 和 SMTP 授权码
- `~/.ai-signal/config.json` — 语言、邮箱、推送时间

## 帮助用户配置

检测环境变量和 `~/.claude/settings.json` 中的 API key，引导用户完成 `~/.ai-signal/.env` 和 `config.json` 的创建。
