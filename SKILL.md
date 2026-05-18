---
name: ai
description: /ai — AI Signal · 信号。AI 行业每日简报，LLM 策展、中英双语、专业排版。Type /ai for your curated daily AI digest.
---

# AI Signal · 信号

从 AI 噪音中提取信号。全自动 LLM 策展、中英双语、专业 HTML 邮件。

## Detection

检查 `~/.ai-signal/config.json` 是否存在且 `"onboardingComplete": true`。

- **否 → 首次设置**
- **是 → 生成简报**

---

## 首次设置

### 1. API Key

检查 `~/.claude/settings.json` 中的 `ANTHROPIC_AUTH_TOKEN`，以及 `~/.ai-signal/.env` 中的 `DEEPSEEK_API_KEY`。

如果没有：询问用户是否有 DeepSeek API key。如果已自动检测到，跳过。

### 2. 邮箱配置

询问用户邮箱，保存到 config：

```json
{
  "language": "bilingual",
  "timezone": "Asia/Shanghai",
  "frequency": "daily",
  "deliveryTime": "10:00",
  "delivery": { "method": "email", "email": "user@example.com" },
  "onboardingComplete": true
}
```

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

三步：拉取 feed → LLM 策展渲染 → QQ SMTP 发送。文件传递，UTF-8 安全。

---

## Auto-Detection

- API key：`~/.ai-signal/.env` → `~/.claude/settings.json`
- Model：`DEEPSEEK_MODEL` → `ANTHROPIC_DEFAULT_OPUS_MODEL` → `deepseek-chat`
- 无需内容 API key（X、YouTube 等数据来自中央 feed）

---

## Files

- `scripts/prepare-digest.js` — Feed 拉取
- `scripts/remix-digest.js` — LLM 策展 + HTML 渲染
- `scripts/deliver.js` — QQ SMTP 邮件发送
- `install.ps1` / `install.sh` — 一键安装调度
