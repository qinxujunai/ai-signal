#!/usr/bin/env bash
# AI Signal · Linux/Mac 一键安装脚本
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/scripts" && pwd)"
CONFIG_DIR="$HOME/.follow-builders"

echo "========================================"
echo "  AI Signal · 安装程序"
echo "========================================"
echo ""

# 1. Install npm dependencies
echo "[1/4] 安装依赖..."
cd "$SCRIPT_DIR" && npm install --silent
echo "  ✓ npm 依赖完成"

# 2. Create config directory
echo "[2/4] 创建配置目录..."
mkdir -p "$CONFIG_DIR"

# 3. Create .env if missing
if [ ! -f "$CONFIG_DIR/.env" ]; then
  cat > "$CONFIG_DIR/.env" << 'ENVEOF'
# DeepSeek API key (optional — auto-reads from ~/.claude/settings.json if blank)
DEEPSEEK_API_KEY=

# Resend API key (only needed for email delivery)
RESEND_API_KEY=

# Model override (optional — auto-reads from Claude Code settings)
# DEEPSEEK_MODEL=deepseek-v4-pro
ENVEOF
  echo "  ⚠ .env 已创建，请编辑 $CONFIG_DIR/.env"
else
  echo "  ✓ .env 已存在"
fi

# 4. Create config.json if missing
if [ ! -f "$CONFIG_DIR/config.json" ]; then
  cat > "$CONFIG_DIR/config.json" << 'CFGEOF'
{
  "platform": "other",
  "language": "bilingual",
  "timezone": "Asia/Shanghai",
  "frequency": "daily",
  "deliveryTime": "10:00",
  "delivery": {
    "method": "stdout",
    "email": ""
  },
  "onboardingComplete": true
}
CFGEOF
  echo "  ✓ config.json 已创建（默认 stdout 模式）"
else
  echo "  ✓ config.json 已存在"
fi

# 5. Create WSL/Linux cron wrapper
echo "[3/4] 配置调度脚本..."
cp "$SCRIPT_DIR/run-digest.sh" "$CONFIG_DIR/run-digest.sh"
chmod +x "$CONFIG_DIR/run-digest.sh"
echo "  ✓ 调度脚本已部署"

# 6. Offer cron setup
echo "[4/5] 注册 /ai 到 Claude Code..."
CLAUDE_MD="$HOME/.claude/CLAUDE.md"
CLAUDE_LINE='- `/ai` — AI industry daily digest. When user invokes /ai, run: `cd ~/.claude/skills/ai-signal/scripts && node prepare-digest.js 2>/dev/null | node remix-digest.js 2>/dev/null | node deliver.js`. Auto-detects API key from settings.'
if [ ! -f "$CLAUDE_MD" ]; then
  mkdir -p "$(dirname "$CLAUDE_MD")"
  printf "## Available Skills\n\n%s\n" "$CLAUDE_LINE" > "$CLAUDE_MD"
  echo "  ✓ CLAUDE.md created, /ai registered"
elif ! grep -q '/ai.*ai-signal' "$CLAUDE_MD" 2>/dev/null; then
  if grep -q '## Available Skills' "$CLAUDE_MD" 2>/dev/null; then
    sed -i "/## Available Skills/a $CLAUDE_LINE" "$CLAUDE_MD"
  else
    printf "\n## Available Skills\n%s\n" "$CLAUDE_LINE" >> "$CLAUDE_MD"
  fi
  echo "  ✓ /ai registered in CLAUDE.md"
else
  echo "  ✓ /ai already registered"
fi

echo "[5/5] 定时任务..."
if command -v crontab &> /dev/null; then
  read -p "  是否添加每天 10:00 的定时任务？(y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    (crontab -l 2>/dev/null; echo "0 10 * * * $CONFIG_DIR/run-digest.sh") | crontab -
    echo "  ✓ cron 已配置（每天 10:00）"
  else
    echo "  ⊘ 跳过。随时输 /ai 手动获取"
  fi
else
  echo "  ⊘ 未检测到 crontab。随时输 /ai 手动获取"
fi

echo ""
echo "========================================"
echo "  安装完成！"
echo "========================================"
echo ""
echo "  手动获取：在 Claude Code 中输入 /ai"
echo "  （如果你已经配了 DeepSeek API key，零额外配置）"
echo ""
