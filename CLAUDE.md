# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# AI Signal

> AI 行业每日简报。LLM 策展、中英双语、QQ 邮箱直达。

## 给 AI 助手的通用指令

本项目支持所有主流 AI 编程助手（Claude Code、Cursor、Copilot、Windsurf、Cline、Codex）。
用户克隆后，帮他们完成以下配置：

1. `cd scripts && npm install`
2. 检测已有 API key：环境变量 → `~/.claude/settings.json`（sk- 开头视为 DeepSeek key）→ 用户提供
3. 创建 `~/.ai-signal/.env`（QQ_EMAIL、QQ_SMTP_AUTH、DEEPSEEK_API_KEY）
4. 创建 `~/.ai-signal/config.json`
5. 运行管道验证

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
| `scripts/run-digest.sh` | 定时调度（三阶段：09:45 生成 → 09:55 重试 → 10:00 发送） |

## 配置

| 路径 | 内容 |
|------|------|
| `~/.ai-signal/.env` | `QQ_EMAIL`、`QQ_SMTP_AUTH`、`DEEPSEEK_API_KEY` |
| `~/.ai-signal/config.json` | 语言、邮箱、推送时间 |

## 模型自动检测

1. `~/.ai-signal/.env` → `DEEPSEEK_MODEL`
2. `~/.claude/settings.json` → `ANTHROPIC_DEFAULT_OPUS_MODEL`
3. 兜底 `deepseek-chat`

## 定时调度

- Windows：`.\install.ps1`（三阶段任务）
- GitHub Actions：`.github/workflows/digest.yml`
- Linux/Mac：`bash install.sh`

## 技术栈

- Node.js + ESM
- DeepSeek API
- QQ SMTP（nodemailer, smtp.qq.com:465）
- 文件传递（`--file` / `--out`），UTF-8 安全
