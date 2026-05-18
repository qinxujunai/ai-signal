# 📡 AI Signal · 信号

> 从 AI 噪音中提取信号。LLM 策展、中英双语、专业 HTML 邮件。

---

## What It Is

AI Signal 每天自动追踪 AI 领域顶级 builder 的推文和播客，通过 DeepSeek LLM 策展为中英双语摘要，渲染为专业 HTML 邮件，直达你的 QQ 邮箱。

无需 X API key、YouTube API key。所有内容来自公开的中央 feed。

---

## 📮 Demo

👉 **[查看最新一期邮件样例 →](https://qinxujunai.github.io/ai-signal/)**

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/qinxujunai/ai-signal.git

# 2. Install
cd ai-signal/scripts && npm install

# 3. 在 Claude Code 里输入 /ai
```

如果 Claude Code 已配置 DeepSeek，API key 自动检测，零额外配置。

---

## How It Works

```
prepare-digest.js  →  拉取中央 feed → feed.json
  ↓ (文件传递，UTF-8 安全)
remix-digest.js    →  DeepSeek LLM 策展 → digest.html
  ↓
deliver.js         →  QQ SMTP 发送邮件
```

---

## Email Setup

1. 开启 QQ 邮箱 SMTP 服务（设置 → 账户 → POP3/SMTP），获取授权码
2. 创建 `~/.ai-signal/.env`：

```env
QQ_EMAIL=你的QQ邮箱@qq.com
QQ_SMTP_AUTH=你的授权码
DEEPSEEK_API_KEY=sk-xxxxx
```

3. 创建 `~/.ai-signal/config.json`：

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

---

## Automated Daily Delivery

### Windows（推荐）

```powershell
.\install.ps1
```

两阶段调度：09:45 生成草稿 → 10:00 发送邮件。

### GitHub Actions（电脑关机也能跑）

1. Fork 本仓库
2. 在 Settings → Secrets 中添加：
   - `DEEPSEEK_API_KEY`
   - `QQ_EMAIL`、`QQ_SMTP_AUTH`
   - `AI_SIGNAL_CONFIG`（config.json 内容）
3. 启用 Actions

### Linux/Mac

```bash
bash install.sh
```

---

## Architecture

```
prepare-digest.js  →  feed.json
remix-digest.js    →  digest.html（LLM 策展 + HTML 模板）
deliver.js         →  QQ SMTP 邮件
```

脚本间通过 `--file` / `--out` 传递文件，不依赖 shell 管道，UTF-8 安全。

---

## Auto-Detection

| 配置项 | 优先级 |
|--------|--------|
| API key | `~/.ai-signal/.env` → `~/.claude/settings.json` |
| Model | `DEEPSEEK_MODEL` → `ANTHROPIC_DEFAULT_OPUS_MODEL` → `deepseek-chat` |
| Feed | 默认中央 feed，可通过 `FEED_BASE_URL` 自定义 |

---

## Project Structure

```
ai-signal/
├── scripts/
│   ├── prepare-digest.js      # Feed 拉取
│   ├── remix-digest.js        # LLM 策展 + HTML 渲染
│   ├── deliver.js             # QQ SMTP 邮件发送
│   ├── check-feed-health.js   # Feed 健康监测
│   └── run-digest.sh          # WSL 调度脚本
├── install.ps1 / install.sh   # 一键安装
├── .github/workflows/         # GitHub Actions
└── SKILL.md                   # Claude Code /ai skill
```

---

## Credits

数据源来自 [follow-builders](https://github.com/zarazhangrui/follow-builders)——持续追踪 25 位 AI builder 和 6 个播客，免费公开。在此基础上构建了 LLM 策展引擎和 HTML 邮件系统。

---

## License

MIT
