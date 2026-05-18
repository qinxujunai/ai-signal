---
name: ai
description: /ai — AI Signal · 信号。AI 行业每日简报，LLM 策展、中英双语、专业排版。Type /ai for your curated daily AI digest.
---

# AI Signal · 信号

从 AI 噪音中提取信号。全自动 LLM 策展、中英双语、专业 HTML 邮件。

## 检测

检查 `~/.ai-signal/config.json` 是否存在。

- **不存在 → 首次设置（3 步，1 分钟）**
- **存在 → 直接生成简报**

---

## 首次设置

### 1. 安装依赖

```bash
cd <skill-dir>/scripts && npm install
```

### 2. 配置

创建 `~/.ai-signal/.env`（如果还没有）：

```env
DEEPSEEK_API_KEY=你的key（可选，有 Claude Code 配置则自动检测）
QQ_EMAIL=你的QQ邮箱@qq.com（可选，想收邮件才填）
QQ_SMTP_AUTH=你的SMTP授权码（可选，想收邮件才填）
```

创建 `~/.ai-signal/config.json`：

```json
{
  "language": "bilingual",
  "timezone": "Asia/Shanghai",
  "frequency": "daily",
  "deliveryTime": "10:00",
  "delivery": { "method": "email", "email": "你的QQ邮箱@qq.com" },
  "onboardingComplete": true
}
```

如果只想在终端看，`delivery.method` 设为 `"stdout"` 即可，不需要 QQ 配置。

### 3. 生成第一期

立即运行管道（见下方），展示结果。

---

## 管道执行

```powershell
# Windows (PowerShell)
$TMP = "$env:USERPROFILE\.ai-signal\tmp"
New-Item -ItemType Directory -Force $TMP | Out-Null
$OutputEncoding = [System.Text.Encoding]::UTF8
node prepare-digest.js --out "$TMP\feed.json"
node remix-digest.js --file "$TMP\feed.json" --out "$TMP\digest.html"
node deliver.js --file "$TMP\digest.html" --force
```

```bash
# Linux/macOS
TMP="$HOME/.ai-signal/tmp"
mkdir -p "$TMP"
node prepare-digest.js --out "$TMP/feed.json"
node remix-digest.js --file "$TMP/feed.json" --out "$TMP/digest.html"
node deliver.js --file "$TMP/digest.html" --force
```

三步：拉取 feed → LLM 策展渲染 → 发送/显示。文件传递，UTF-8 安全。

---

## 自动检测

- **API key**：`~/.ai-signal/.env` → `~/.claude/settings.json`（仅 `sk-` 开头的 token）
- **Model**：`DEEPSEEK_MODEL` → `ANTHROPIC_DEFAULT_OPUS_MODEL` → `deepseek-chat`
- **Feed**：默认中央 feed，可通过 `FEED_BASE_URL` 环境变量自定义

---

## 文件

| 文件 | 作用 |
|------|------|
| `scripts/prepare-digest.js` | Feed 数据拉取 |
| `scripts/remix-digest.js` | LLM 策展 + HTML 渲染 |
| `scripts/deliver.js` | QQ SMTP 邮件 / stdout 输出 |
| `scripts/check-feed-health.js` | Feed 健康监测 |
| `scripts/run-digest.sh` | WSL 定时调度 |
| `install.ps1` / `install.sh` | 一键安装 |
