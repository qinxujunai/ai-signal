#!/usr/bin/env bash
# AI Signal · Linux/Mac 一键安装脚本
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="$HOME/.ai-signal"

echo "========================================"
echo "  AI Signal · 安装程序"
echo "========================================"
echo ""

# ── 1. Check Node.js ──────────────────────────────────────────────
echo "[1/6] 检查环境..."
if ! command -v node &>/dev/null; then
  echo "  ✗ Node.js 未安装。请从 https://nodejs.org 下载安装" >&2
  exit 1
fi
echo "  ✓ Node.js $(node --version)"

# ── 2. Install npm dependencies ───────────────────────────────────
echo "[2/6] 安装依赖..."
cd "$SCRIPT_DIR/scripts" && npm install --silent
echo "  ✓ npm 依赖完成"

# ── 3. Create config directory ────────────────────────────────────
echo "[3/6] 创建配置目录..."
mkdir -p "$CONFIG_DIR/drafts" "$CONFIG_DIR/tmp"
echo "  ✓ $CONFIG_DIR"

# ── 4. Create .env if missing ─────────────────────────────────────
echo "[4/6] 配置文件..."
if [ ! -f "$CONFIG_DIR/.env" ]; then
  cat > "$CONFIG_DIR/.env" << 'ENVEOF'
# DeepSeek API key (required for LLM remixing)
DEEPSEEK_API_KEY=

# QQ SMTP for email delivery (optional — skip for stdout mode)
QQ_EMAIL=
QQ_SMTP_AUTH=

# Model override (optional — defaults to deepseek-chat)
# DEEPSEEK_MODEL=deepseek-v4-pro
ENVEOF
  echo "  ⚠ 请编辑 $CONFIG_DIR/.env 填入你的 API key"
else
  echo "  ✓ .env 已存在"
fi

if [ ! -f "$CONFIG_DIR/config.json" ]; then
  cat > "$CONFIG_DIR/config.json" << 'CFGEOF'
{
  "language": "bilingual",
  "timezone": "Asia/Shanghai",
  "frequency": "daily",
  "deliveryTime": "10:00",
  "delivery": { "method": "email", "email": "你的QQ邮箱@qq.com" },
  "onboardingComplete": true
}
CFGEOF
  echo "  ⚠ 请编辑 $CONFIG_DIR/config.json 填入你的邮箱"
else
  echo "  ✓ config.json 已存在"
fi

# ── 5. Deploy scheduling script ───────────────────────────────────
echo "[5/6] 部署调度脚本..."
cp "$SCRIPT_DIR/scripts/run-digest.sh" "$CONFIG_DIR/run-digest.sh"
chmod +x "$CONFIG_DIR/run-digest.sh"
# Write project root marker so deployed copy can find the project
echo "$SCRIPT_DIR" > "$CONFIG_DIR/.project-root"
echo "  ✓ 调度脚本已部署"

# ── 6. Cron setup ─────────────────────────────────────────────────
echo "[6/6] 定时任务..."
if command -v crontab &>/dev/null; then
  read -p "  是否添加每天 09:45+10:00 的定时任务？(y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    crontab -l 2>/dev/null | grep -v 'run-digest.sh' | {
      cat
      echo "45 9 * * * $CONFIG_DIR/run-digest.sh generate >> $CONFIG_DIR/cron.log 2>&1"
      echo "0 10 * * * $CONFIG_DIR/run-digest.sh send >> $CONFIG_DIR/cron.log 2>&1"
    } | crontab -
    echo "  ✓ cron 已配置（09:45 生成 + 10:00 发送）"
  else
    echo "  ⊘ 跳过。随时手动运行: $CONFIG_DIR/run-digest.sh full"
  fi
else
  echo "  ⊘ 未检测到 crontab。随时手动运行: $CONFIG_DIR/run-digest.sh full"
fi

echo ""
echo "========================================"
echo "  安装完成！"
echo "========================================"
echo ""
echo "  调度安排：09:45 生成草稿 → 10:00 发送邮件"
echo "  手动运行：$CONFIG_DIR/run-digest.sh full"
echo ""
