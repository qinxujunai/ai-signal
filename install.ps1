# AI Signal · 一键安装脚本
# 配置 WSL 调度 + Windows 任务计划（两阶段：09:45 生成 + 10:00 发送）

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AI Signal · 安装程序" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$PROJECT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$SCRIPTS_DIR = "$PROJECT_DIR\scripts"
$USER_HOME = $env:USERPROFILE
$WSL_DISTRO = "Ubuntu"

# 0. Ensure WSL Ubuntu is available and is default
Write-Host "[0/7] 检查 WSL Ubuntu..." -ForegroundColor Yellow
$defaultDistro = (wsl --list --verbose 2>&1 | Select-String '^\*\s+(\S+)' | ForEach-Object { $_.Matches.Groups[1].Value }).Trim()
if ($defaultDistro -ne $WSL_DISTRO) {
    Write-Host "  当前默认: $defaultDistro → 切换为 $WSL_DISTRO"
    wsl --set-default $WSL_DISTRO
    Write-Host "  ✓ WSL 默认发行版已设为 $WSL_DISTRO"
} else {
    Write-Host "  ✓ WSL 默认发行版已是 $WSL_DISTRO"
}

# 1. Create config directory
Write-Host "[1/7] 创建配置目录..." -ForegroundColor Yellow
$configDir = "$USER_HOME\.ai-signal"
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Force -Path $configDir | Out-Null
}
Write-Host "  ✓ $configDir"

# 2. Check for .env
Write-Host "[2/7] 检查配置文件..." -ForegroundColor Yellow
$envFile = "$configDir\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "  ⚠ .env 文件不存在，创建模板..."
@"
# Resend API key for email delivery
RESEND_API_KEY=re_xxxxxxxxxxxx

# DeepSeek API key (optional — auto-reads from ~/.claude/settings.json if blank)
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxx

# Model override (optional)
# DEEPSEEK_MODEL=deepseek-v4-pro
"@ | Out-File -FilePath $envFile -Encoding utf8
    Write-Host "  ⚠ 请编辑 $envFile 填入你的 API keys"
}

$configFile = "$configDir\config.json"
if (-not (Test-Path $configFile)) {
@'
{
  "platform": "other",
  "language": "bilingual",
  "timezone": "Asia/Shanghai",
  "frequency": "daily",
  "deliveryTime": "10:00",
  "delivery": {
    "method": "email",
    "email": "your-email@qq.com"
  },
  "onboardingComplete": true
}
'@ | Out-File -FilePath $configFile -Encoding utf8
    Write-Host "  ⚠ 请编辑 $configFile 填入你的接收邮箱"
}
Write-Host "  ✓ 配置检查完成"

# 3. Register /ai in Claude Code global CLAUDE.md
Write-Host "[3/7] 注册 /ai 命令..." -ForegroundColor Yellow
$claudeMd = "$USER_HOME\.claude\CLAUDE.md"
$aiLine = '- `/ai` — AI Signal daily digest. Run: `cd ~/.claude/skills/ai-signal/scripts && node prepare-digest.js 2>/dev/null | node remix-digest.js 2>/dev/null | node deliver.js`'
if (-not (Test-Path $claudeMd)) {
    New-Item -ItemType Directory -Force -Path "$USER_HOME\.claude" | Out-Null
    "## Available Skills`n`n$aiLine" | Out-File -FilePath $claudeMd -Encoding utf8
    Write-Host "  ✓ CLAUDE.md 已创建，/ai 已注册"
} elseif (-not (Select-String -Path $claudeMd -Pattern '/ai.*ai-signal' -Quiet)) {
    $content = Get-Content $claudeMd -Raw
    if ($content -match '## Available Skills') {
        $content = $content -replace '(## Available Skills[^\n]*\n)', "`$1$aiLine`n"
    } else {
        $content += "`n`n## Available Skills`n$aiLine`n"
    }
    Set-Content -Path $claudeMd -Value $content -Encoding utf8
    Write-Host "  ✓ /ai 已注册到 CLAUDE.md"
} else {
    Write-Host "  ✓ /ai 已注册，跳过"
}

# 4. Sync run-digest.sh to WSL
Write-Host "[4/7] 部署 WSL 调度脚本..." -ForegroundColor Yellow
$wslScripts = "/root/.ai-signal"
wsl -d $WSL_DISTRO -e bash -c "mkdir -p $wslScripts/drafts" 2>$null

# Convert Windows path to WSL mount path
$wslScriptPath = $SCRIPTS_DIR.Replace('\', '/').Replace('C:', '/mnt/c').Replace('D:', '/mnt/d')
wsl -d $WSL_DISTRO -e bash -c "cat > $wslScripts/run-digest.sh << 'SCRIPT_EOF'
#!/bin/bash
export HOME=/root
NODE=\"/mnt/d/Apps/Dev/NodeJS/node.exe\"
SCRIPTS=\"$wslScriptPath\"
DATA_DIR=\"/root/.ai-signal\"
DRAFT_DIR=\"\$DATA_DIR/drafts\"
LOG=\"\$DATA_DIR/cron.log\"
ERR=\"\$DATA_DIR/cron-errors.log\"

mkdir -p \"\$DRAFT_DIR\" \"\$(dirname \"\$LOG\")\"

STAGE=\"\${1:-full}\"
TODAY=\$(date +%F)
DRAFT=\"\$DRAFT_DIR/\$TODAY.html\"

log() { echo \"=== [\$TODAY \$(date +%H:%M:%S)] \$1 ===\" >> \"\$LOG\"; }

generate() {
  log \"GENERATE start\"
  cd \"\$SCRIPTS\" || { log \"ERROR: cannot cd to \$SCRIPTS\"; exit 1; }
  find \"\$DRAFT_DIR\" -name \"*.html\" -mtime +1 -delete 2>/dev/null
  if [ -f \"\$DRAFT\" ]; then
    age=\$(( \$(date +%s) - \$(stat -c %Y \"\$DRAFT\" 2>/dev/null || echo 0) ))
    if [ \"\$age\" -lt 14400 ]; then
      log \"SKIP: draft exists (\${age}s old), skipping generate\"
      exit 0
    fi
  fi
  \"\$NODE\" prepare-digest.js 2>/dev/null \\
    | \"\$NODE\" remix-digest.js 2>>\"\$ERR\" \\
    > \"\$DRAFT\"
  if [ -s \"\$DRAFT\" ]; then
    log \"GENERATE ok → \$DRAFT (\$(wc -c < \"\$DRAFT\") bytes)\"
  else
    log \"GENERATE FAIL: empty draft\"
    rm -f \"\$DRAFT\"
    exit 1
  fi
}

send() {
  log \"SEND start\"
  cd \"\$SCRIPTS\" || { log \"ERROR: cannot cd to \$SCRIPTS\"; exit 1; }
  if [ ! -f \"\$DRAFT\" ]; then
    log \"SEND FAIL: no draft at \$DRAFT — run generate first\"
    exit 1
  fi
  RESULT=(\"\$NODE\" deliver.js --file \"\$DRAFT\" 2>&1)
  echo \"\$RESULT\" >> \"\$LOG\"
  log \"SEND done: \$RESULT\"
}

case \"\$STAGE\" in
  generate) generate ;;
  send) send ;;
  *)
    log \"FULL start\"
    cd \"\$SCRIPTS\" || { log \"ERROR: cannot cd to \$SCRIPTS\"; exit 1; }
    \"\$NODE\" prepare-digest.js 2>/dev/null \\
      | \"\$NODE\" remix-digest.js 2>>\"\$ERR\" \\
      | \"\$NODE\" deliver.js 2>&1 >> \"\$LOG\"
    log \"FULL done\"
    ;;
esac
SCRIPT_EOF
chmod +x $wslScripts/run-digest.sh"
Write-Host "  ✓ WSL 脚本已部署"

# 5. Sync .env and config.json to WSL
Write-Host "[5/7] 同步配置到 WSL..." -ForegroundColor Yellow
$wslEnvSrc = $envFile.Replace('\', '/').Replace('C:', '/mnt/c').Replace('D:', '/mnt/d')
$wslCfgSrc = $configFile.Replace('\', '/').Replace('C:', '/mnt/c').Replace('D:', '/mnt/d')
wsl -d $WSL_DISTRO -e bash -c "cp '$wslEnvSrc' /root/.ai-signal/.env 2>/dev/null && cp '$wslCfgSrc' /root/.ai-signal/config.json 2>/dev/null"
Write-Host "  ✓ WSL 配置已同步"

# 6. Create Windows scheduled task — two triggers
Write-Host "[6/7] 创建 Windows 任务计划（两阶段）..." -ForegroundColor Yellow
$taskName = "AI Signal Daily Digest"
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$action = New-ScheduledTaskAction -Execute "wsl" -Argument "-d $WSL_DISTRO -e bash -c `"/root/.ai-signal/run-digest.sh generate`""
$actionSend = New-ScheduledTaskAction -Execute "wsl" -Argument "-d $WSL_DISTRO -e bash -c `"/root/.ai-signal/run-digest.sh send`""

$triggerGenerate = New-ScheduledTaskTrigger -Daily -At "09:45AM"
$triggerSend = New-ScheduledTaskTrigger -Daily -At "10:00AM"

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# Register generate task
Register-ScheduledTask -TaskName "$taskName (Generate)" -Action $action -Trigger $triggerGenerate -Settings $settings -Description "AI Signal: generate digest draft at 09:45" -User $env:USERNAME -Force | Out-Null
Write-Host "  ✓ 生成任务已创建（每天 09:45）"

# Register send task
Register-ScheduledTask -TaskName "$taskName (Send)" -Action $actionSend -Trigger $triggerSend -Settings $settings -Description "AI Signal: send pre-generated digest at 10:00" -User $env:USERNAME -Force | Out-Null
Write-Host "  ✓ 发送任务已创建（每天 10:00）"

# Remove old task if it exists
$oldTask = Get-ScheduledTask -TaskName "AI Builders Digest" -ErrorAction SilentlyContinue
if ($oldTask) {
    Unregister-ScheduledTask -TaskName "AI Builders Digest" -Confirm:$false
    Write-Host "  ✓ 已清理旧任务 'AI Builders Digest'"
}

# 7. Test run
Write-Host "[7/7] 运行测试..." -ForegroundColor Yellow
Write-Host "  正在生成并发送第一期摘要（约需 30-60 秒）..."
wsl -d $WSL_DISTRO -e bash -c "/root/.ai-signal/run-digest.sh full 2>&1"
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "  安装完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  调度安排："
Write-Host "    09:45 — 生成摘要草稿"
Write-Host "    10:00 — 发送邮件"
Write-Host ""
Write-Host "  手动触发：在 Claude Code 中输入 /ai"
Write-Host "  修改设置：在 Claude Code 中告诉我即可"
Write-Host ""
