#!/usr/bin/env bash
# AI Signal · Linux/Mac 一键安装脚本
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/scripts" && pwd)"
CONFIG_DIR="$HOME/.ai-signal"

echo "========================================"
echo "  AI Signal · 安装程序"
echo "========================================"
echo ""

# 1. Install npm dependencies
echo "[1/5] 安装依赖..."
cd "$SCRIPT_DIR" && npm install --silent
echo "  ✓ npm 依赖完成"

# 2. Create config directory
echo "[2/5] 创建配置目录..."
mkdir -p "$CONFIG_DIR/drafts"

# 3. Create .env if missing
if [ ! -f "$CONFIG_DIR/.env" ]; then
  cat > "$CONFIG_DIR/.env" << 'ENVEOF'
# DeepSeek API key (optional — auto-reads from ~/.claude/settings.json if blank)
DEEPSEEK_API_KEY=

# QQ SMTP for email delivery
QQ_EMAIL=
QQ_SMTP_AUTH=

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

# 5. Deploy scheduling script
echo "[3/5] 部署调度脚本..."
cp "$SCRIPT_DIR/run-digest.sh" "$CONFIG_DIR/run-digest.sh"
chmod +x "$CONFIG_DIR/run-digest.sh"
echo "  ✓ 调度脚本已部署"

# 6. Register /ai in Claude Code
echo "[4/5] 注册 /ai 到 Claude Code..."
CLAUDE_MD="$HOME/.claude/CLAUDE.md"
CLAUDE_LINE='- `/ai` — AI Signal daily digest. Run: `cd ~/.claude/skills/ai-signal/scripts && node prepare-digest.js 2>/dev/null | node remix-digest.js 2>/dev/null | node deliver.js`'
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
  echo "  ✓ /ai registered in CLAUDE_MD"
else
  echo "  ✓ /ai already registered"
fi

# 7. Cron setup — two-stage (09:45 generate + 10:00 send)
echo "[5/5] 定时任务..."
if command -v crontab &> /dev/null; then
  read -p "  是否添加每天 09:45+10:00 的定时任务？(y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Remove old entry if exists
    crontab -l 2>/dev/null | grep -v 'run-digest.sh' | { cat; echo "45 9 * * * $CONFIG_DIR/run-digest.sh generate >> $CONFIG_DIR/cron.log 2>&1"; echo "0 10 * * * $CONFIG_DIR/run-digest.sh send >> $CONFIG_DIR/cron.log 2>&1"; } | crontab -
    echo "  ✓ cron 已配置（09:45 生成 + 10:00 发送）"
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
echo "  调度安排：09:45 生成草稿 → 10:00 发送邮件"
echo "  手动获取：在 Claude Code 中输入 /ai"
echo ""
