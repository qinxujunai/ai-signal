# 📡 AI Signal · 信号

> 从 AI 噪音中提取信号。全自动 LLM 策展、中英双语、专业 HTML 排版、每日邮件送达。

## 项目概述

AI Signal 是一个全自动化的 AI 行业每日简报系统。每天定时抓取 AI 领域顶级 builder 的推文和播客，通过 DeepSeek LLM 策展为中英双语摘要，渲染为专业 HTML 邮件，发送到指定邮箱。

## 核心架构

```
GitHub Actions / Windows 任务计划 (每天 10:00)
  → prepare-digest.js  (拉取中央 feed，写出 feed.json)
  → remix-digest.js    (DeepSeek LLM 策展 + HTML 模板渲染，写出 digest.html)
  → deliver.js         (读取 digest.html → stdout / Resend 邮件)

三个脚本通过临时文件传递数据，不依赖 shell 管道。
Windows PowerShell 管道默认 US-ASCII，会损坏中文 UTF-8。
```

## 调度方式

- **推荐**: GitHub Actions — 免费，电脑关了也能跑
- **备选**: Windows 任务计划 + WSL、Linux cron

## 关键文件

| 文件 | 职责 |
|------|------|
| `scripts/remix-digest.js` | ★ 核心引擎：LLM 策展 + HTML 模板渲染 + 兜底。`--file` 读输入，`--out` 写输出 |
| `scripts/prepare-digest.js` | 从中央 GitHub feed 拉取推文/播客数据。`--out` 写输出 |
| `scripts/deliver.js` | Resend API 邮件发送（HTML + 纯文本双模）。`--file` 读输入 |
| `scripts/format-auto-digest.js` | LLM 失败时的模板兜底 |
| `scripts/run-digest.sh` | WSL 调度入口脚本（文件传递模式） |
| `install.ps1` | Windows 一键安装（WSL + 任务计划） |

## 配置位置

| 文件 | 内容 |
|------|------|
| `~/.ai-signal/config.json` | 语言、频率、推送时间、邮箱 |
| `~/.ai-signal/.env` | `RESEND_API_KEY`、`DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL` |
| `~/.claude/settings.json` | API key 和 model 自动回读（无需重复配） |

## 模型自动跟随

`remix-digest.js` 启动时按以下优先级找模型：

| 优先级 | 来源 | 说明 |
|--------|------|------|
| 1 | `~/.ai-signal/.env` → `DEEPSEEK_MODEL` | 用户手动指定 |
| 2 | `~/.claude/settings.json` → `ANTHROPIC_DEFAULT_OPUS_MODEL_NAME` | 干净名，优先 |
| 3 | `~/.claude/settings.json` → `ANTHROPIC_DEFAULT_OPUS_MODEL` | 带后缀，自动剥离 `[1M]` `[1T]` 等 |
| 4 | `~/.claude/settings.json` → `ANTHROPIC_DEFAULT_SONNET_MODEL` | 同上 |
| 5 | 兜底 `deepseek-chat` | 永远可用的保底 |

API key 回退逻辑也会自动读 `settings.json`，但仅当 token 以 `sk-` 开头（DeepSeek key 特征）才会用，避免把 Anthropic key 误当 DeepSeek key 调用。

在 Claude Code 里切模型 → 邮件摘要自动用新模型。

## 可靠性设计

```
LLM 生成 JSON → 修复常见错误（trailing comma 等）
  → 失败？→ retry 一次（带 fix prompt）
  → 还是失败？→ 模板兜底（renderFallback）
  → 无论如何，每天会收到一封邮件
```

## 手动操作

- **立即发送一期**：在 Claude Code 里输入 `/ai`
- **改频率/语言/邮箱**：直接跟我说
- **测试管道（WSL）**：`wsl -e bash /root/.ai-signal/run-digest.sh`
- **测试管道（PowerShell）**：见 SKILL.md 的 Pipeline 命令（文件传递模式，UTF-8 安全）
- **查看日志**：`wsl -e bash -c 'tail -20 /root/.ai-signal/cron.log'`

## 故障排查

| 问题 | 排查 |
|------|------|
| 没收到邮件 | 检查 QQ 邮箱垃圾箱；Resend dashboard 看 delivery status |
| 邮件中文乱码/问号 | 管道损坏 — 用文件传递模式（`--file`/`--out`），勿用 `\|` 管道 |
| 收到模板版而非精炼版 | LLM 临时不可达，下期自动恢复 |
| 任务计划没跑 | `Get-ScheduledTask -TaskName "AI Frontier Digest"` |
| JSON 解析失败 | 查看 `~/.ai-signal/cron-errors.log` |
| 模型调用失败 "does not exist" | settings.json 中模型名带后缀 `[1M]`，已自动剥离；检查 API key 是否为 DeepSeek key |

## 技术栈

- Node.js (v24) + ESM
- DeepSeek API (native `/v1/chat/completions`，自动跟随 Claude Code 模型配置)
- Resend Email API
- Windows Task Scheduler + WSL (Ubuntu) / GitHub Actions (Linux)
- HTML 邮件模板（table 布局、内联 CSS、600px 容器）
- 文件传递架构（`--file` / `--out`），跨平台 UTF-8 安全，不依赖 shell 管道

## GitHub

- Repo: `github.com/qinxujunai/ai-signal`
- 作者: 秦徐俊
- 中央 feed 数据源，策展引擎和邮件系统完全自建

## 发件品牌

- 发件名: AI Signal · 信号
- 发件地址: digest@praxisai.online
- 标题格式: 📡 AI Signal | 2026年X月X日星期X
