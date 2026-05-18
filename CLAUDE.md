# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# AI Signal · 信号

> 从 AI 噪音中提取信号。LLM 策展、中英双语、专业排版、QQ 邮箱直达。

## Architecture

```
prepare-digest.js  →  拉取中央 feed，写出 feed.json
  ↓ (file)
remix-digest.js    →  DeepSeek LLM 策展 + HTML 渲染，写出 digest.html
  ↓ (file)
deliver.js         →  读取 digest.html → QQ SMTP 发送邮件
```

三个脚本通过临时文件传递数据。`run-digest.sh` 负责调度和路径转换。

## Development Commands

```bash
cd scripts && npm install

# 单步执行
node prepare-digest.js --out /tmp/feed.json
node remix-digest.js --file /tmp/feed.json --out /tmp/digest.html
node deliver.js --file /tmp/digest.html --force

# WSL 调度测试
wsl -d Ubuntu -e bash /root/.ai-signal/run-digest.sh generate
wsl -d Ubuntu -e bash /root/.ai-signal/run-digest.sh send
```

## Key Files

| File | Role |
|------|------|
| `scripts/remix-digest.js` | LLM 策展 + HTML 模板 + 兜底 |
| `scripts/prepare-digest.js` | Feed 数据拉取 |
| `scripts/deliver.js` | QQ SMTP 邮件发送 |
| `scripts/check-feed-health.js` | Feed 健康监测 |
| `scripts/run-digest.sh` | WSL 调度（两阶段：generate/send） |
| `install.ps1` | Windows 一键安装 |

## Configuration

| Path | Content |
|------|---------|
| `~/.ai-signal/config.json` | 语言、频率、推送时间、邮箱 |
| `~/.ai-signal/.env` | `QQ_EMAIL`、`QQ_SMTP_AUTH`、`DEEPSEEK_API_KEY` |

## Model Auto-Detection

`remix-digest.js` 按优先级找模型：
1. `~/.ai-signal/.env` → `DEEPSEEK_MODEL`
2. `~/.claude/settings.json` → `ANTHROPIC_DEFAULT_OPUS_MODEL` / `ANTHROPIC_DEFAULT_SONNET_MODEL`
3. 兜底 `deepseek-chat`

API key：`DEEPSEEK_API_KEY` env → `~/.claude/settings.json` 中 `sk-` 开头的 token。

## Scheduling

两阶段设计：**09:45 生成 + 10:00 发送**，确保准时送达。

- Windows Task Scheduler：`.\install.ps1`（两阶段任务）
- GitHub Actions：`.github/workflows/digest.yml`
- Linux/Mac cron：`bash install.sh`

## 故障排查

| 问题 | 排查 |
|------|------|
| 没收到邮件 | 检查 QQ 垃圾箱；`~/.ai-signal/cron.log` |
| Draft 没生成 | `cron.log` 中 GENERATE 阶段错误 |
| 模型调用失败 | settings.json 中模型名后缀已自动剥离；检查 API key |

## Tech Stack

- Node.js (v24) + ESM
- DeepSeek API (`/v1/chat/completions`)
- QQ SMTP (nodemailer, `smtp.qq.com:465`)
- HTML 邮件模板（table 布局、内联 CSS、600px 容器）
- 文件传递架构（`--file` / `--out`），UTF-8 安全
