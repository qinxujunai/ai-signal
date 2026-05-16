# 📡 AI Signal · 信号

> 从 AI 噪音中提取信号。全自动 LLM 策展、中英双语、专业 HTML 排版、每日邮件送达。

## 项目概述

AI Signal 是一个全自动化的 AI 行业每日简报系统。每天定时抓取 AI 领域顶级 builder 的推文和播客，通过 DeepSeek LLM 策展为中英双语摘要，渲染为专业 HTML 邮件，发送到指定邮箱。

## 核心架构

```
Windows 任务计划 (每天 10:00)
  → WSL bash → run-digest.sh
    → prepare-digest.js  (拉取中央 feed，无需个人 API key)
    → remix-digest.js    (DeepSeek LLM 策展 + HTML 模板渲染)
    → deliver.js         (Resend API 发送邮件)
    → QQ邮箱
```

## 关键文件

| 文件 | 职责 |
|------|------|
| `scripts/remix-digest.js` | ★ 核心引擎：LLM 策展 + HTML 模板渲染 + 兜底 |
| `scripts/prepare-digest.js` | 从中央 GitHub feed 拉取推文/播客数据 |
| `scripts/deliver.js` | Resend API 邮件发送（HTML + 纯文本双模） |
| `scripts/format-auto-digest.js` | LLM 失败时的模板兜底 |
| `scripts/run-digest.sh` | WSL 调度入口脚本 |
| `install.ps1` | Windows 一键安装（WSL + 任务计划） |

## 配置位置

| 文件 | 内容 |
|------|------|
| `~/.follow-builders/config.json` | 语言、频率、推送时间、邮箱 |
| `~/.follow-builders/.env` | `RESEND_API_KEY`、`DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL` |
| `~/.claude/settings.json` | API key 和 model 自动回读（无需重复配） |

## 模型自动跟随

`remix-digest.js` 启动时会按以下优先级找模型：
1. `~/.follow-builders/.env` 里的 `DEEPSEEK_MODEL`
2. `~/.claude/settings.json` → `ANTHROPIC_DEFAULT_OPUS_MODEL`
3. 兜底 `deepseek-chat`

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
- **测试管道**：`wsl -e bash /root/.follow-builders/run-digest.sh`
- **查看日志**：`wsl -e bash -c 'tail -20 /root/.follow-builders/cron.log'`

## 故障排查

| 问题 | 排查 |
|------|------|
| 没收到邮件 | 检查 QQ 邮箱垃圾箱；Resend dashboard 看 delivery status |
| 收到模板版而非精炼版 | LLM 临时不可达，下期自动恢复 |
| 任务计划没跑 | `Get-ScheduledTask -TaskName "AI Frontier Digest"` |
| JSON 解析失败 | 查看 `~/.follow-builders/cron-errors.log` |

## 技术栈

- Node.js (v24) + ESM
- DeepSeek API (native `/v1/chat/completions`)
- Resend Email API
- Windows Task Scheduler + WSL (Ubuntu)
- HTML 邮件模板（table 布局、内联 CSS、600px 容器）

## GitHub

- Repo: `github.com/qinxujunai/ai-signal`
- 作者: 秦徐俊
- 基于 follow-builders 的中央 feed，策展引擎和邮件系统完全自建

## 发件品牌

- 发件名: AI Signal · 信号
- 发件地址: digest@praxisai.online
- 标题格式: 📡 AI Signal | 2026年X月X日星期X
