# AI Signal · Windows 一键安装脚本
# 三阶段调度：09:45 生成 → 09:55 重试 → 10:00 发送
# ──────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$PROJECT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$SCRIPTS_DIR = "$PROJECT_DIR\scripts"
$WSL_DISTRO = "Ubuntu"
$USER_HOME = $env:USERPROFILE

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AI Signal · 安装程序" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── 0. Check prerequisites ────────────────────────────────────────
Write-Host "[0/7] 检查环境..." -ForegroundColor Yellow

# Check Node.js
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "  ✗ Node.js 未安装。请从 https://nodejs.org 下载安装" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Node.js $(node --version)" -ForegroundColor Green

# Check WSL
$wsl = Get-Command wsl -ErrorAction SilentlyContinue
if (-not $wsl) {
    Write-Host "  ✗ WSL 未安装。请运行: wsl --install" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ WSL 已安装" -ForegroundColor Green

# ── 1. Install npm dependencies ───────────────────────────────────
Write-Host "[1/7] 安装依赖..." -ForegroundColor Yellow
Push-Location "$SCRIPTS_DIR"
npm install --silent 2>$null
Pop-Location
Write-Host "  ✓ npm 依赖完成" -ForegroundColor Green

# ── 2. Create config directory ────────────────────────────────────
Write-Host "[2/7] 创建配置目录..." -ForegroundColor Yellow
$configDir = "$USER_HOME\.ai-signal"
New-Item -ItemType Directory -Force -Path "$configDir\drafts", "$configDir\tmp" | Out-Null
Write-Host "  ✓ $configDir" -ForegroundColor Green

# ── 3. Create .env if missing ─────────────────────────────────────
Write-Host "[3/7] 配置文件..." -ForegroundColor Yellow
$envFile = "$configDir\.env"
if (-not (Test-Path $envFile)) {
    @"
# DeepSeek API key (required for LLM remixing)
DEEPSEEK_API_KEY=

# QQ SMTP for email delivery (optional — skip for stdout mode)
QQ_EMAIL=
QQ_SMTP_AUTH=

# Model override (optional — defaults to deepseek-chat)
# DEEPSEEK_MODEL=deepseek-v4-pro
"@ | Out-File -FilePath $envFile -Encoding utf8
    Write-Host "  ⚠ 请编辑 $envFile 填入你的 API key" -ForegroundColor Yellow
} else {
    Write-Host "  ✓ .env 已存在" -ForegroundColor Green
}

$configFile = "$configDir\config.json"
if (-not (Test-Path $configFile)) {
    @'
{
  "language": "bilingual",
  "timezone": "Asia/Shanghai",
  "frequency": "daily",
  "deliveryTime": "10:00",
  "delivery": { "method": "email", "email": "你的QQ邮箱@qq.com" },
  "onboardingComplete": true
}
'@ | Out-File -FilePath $configFile -Encoding utf8
    Write-Host "  ⚠ 请编辑 $configFile 填入你的邮箱" -ForegroundColor Yellow
} else {
    Write-Host "  ✓ config.json 已存在" -ForegroundColor Green
}

# ── 4. Deploy script to WSL ──────────────────────────────────────
Write-Host "[4/7] 部署调度脚本..." -ForegroundColor Yellow

# Resolve project root in WSL path format
$wslProjectRoot = $PROJECT_DIR.Replace('\', '/').Replace(':', '', 1).ToLower()
# Convert "C:/Users/..." → "/mnt/c/Users/..."
if ($wslProjectRoot -match '^([a-z]):/(.*)') {
    $wslProjectRoot = "/mnt/$1/$($Matches[2])"
}

# Deploy run-digest.sh + project root marker
$wslConfigDir = "/home/$(wsl -d $WSL_DISTRO -e whoami 2>$null)/.ai-signal"
wsl -d $WSL_DISTRO -e mkdir -p "$wslConfigDir" 2>$null
wsl -d $WSL_DISTRO -e bash -c "cp '$wslProjectRoot/scripts/run-digest.sh' '$wslConfigDir/run-digest.sh' && chmod +x '$wslConfigDir/run-digest.sh' && echo '$wslProjectRoot' > '$wslConfigDir/.project-root'"
Write-Host "  ✓ 脚本已部署到 WSL" -ForegroundColor Green

# ── 5. Sync config to WSL ────────────────────────────────────────
Write-Host "[5/7] 同步配置..." -ForegroundColor Yellow
$wslEnvSrc = $envFile.Replace('\', '/').Replace(':', '', 1).ToLower()
if ($wslEnvSrc -match '^([a-z]):/(.*)') { $wslEnvSrc = "/mnt/$1/$($Matches[2])" }
$wslCfgSrc = $configFile.Replace('\', '/').Replace(':', '', 1).ToLower()
if ($wslCfgSrc -match '^([a-z]):/(.*)') { $wslCfgSrc = "/mnt/$1/$($Matches[2])" }
wsl -d $WSL_DISTRO -e bash -c "cp '$wslEnvSrc' '$wslConfigDir/.env' 2>/dev/null; cp '$wslCfgSrc' '$wslConfigDir/config.json' 2>/dev/null"
Write-Host "  ✓ 配置已同步到 WSL" -ForegroundColor Green

# ── 6. Create three-stage scheduled tasks ─────────────────────────
Write-Host "[6/7] 创建定时任务（三阶段）..." -ForegroundColor Yellow
$taskBase = "AI Signal Daily Digest"
Get-ScheduledTask -TaskName "$taskBase*" -ErrorAction SilentlyContinue | ForEach-Object {
    Unregister-ScheduledTask -TaskName $_.TaskName -Confirm:$false
}

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$wslExe = "C:\Windows\system32\wsl.exe"

# 09:45 — Generate
$action1 = New-ScheduledTaskAction -Execute $wslExe -Argument "-d $WSL_DISTRO -e bash -c `"$wslConfigDir/run-digest.sh generate`"" -WorkingDirectory "C:\Windows\system32"
$trigger1 = New-ScheduledTaskTrigger -Daily -At "09:45AM"
Register-ScheduledTask -TaskName "$taskBase (Generate)" -Action $action1 -Trigger $trigger1 -Settings $settings -Description "AI Signal: generate digest at 09:45" -User $env:USERNAME -Force | Out-Null

# 09:55 — Retry generate
$action2 = New-ScheduledTaskAction -Execute $wslExe -Argument "-d $WSL_DISTRO -e bash -c `"$wslConfigDir/run-digest.sh generate`"" -WorkingDirectory "C:\Windows\system32"
$trigger2 = New-ScheduledTaskTrigger -Daily -At "09:55AM"
Register-ScheduledTask -TaskName "$taskBase (Retry)" -Action $action2 -Trigger $trigger2 -Settings $settings -Description "AI Signal: retry generate at 09:55" -User $env:USERNAME -Force | Out-Null

# 10:00 — Send
$action3 = New-ScheduledTaskAction -Execute $wslExe -Argument "-d $WSL_DISTRO -e bash -c `"$wslConfigDir/run-digest.sh send`"" -WorkingDirectory "C:\Windows\system32"
$trigger3 = New-ScheduledTaskTrigger -Daily -At "10:00AM"
Register-ScheduledTask -TaskName "$taskBase (Send)" -Action $action3 -Trigger $trigger3 -Settings $settings -Description "AI Signal: send digest at 10:00" -User $env:USERNAME -Force | Out-Null

Write-Host "  ✓ 09:45 Generate / 09:55 Retry / 10:00 Send" -ForegroundColor Green

# ── 7. Verify ─────────────────────────────────────────────────────
Write-Host "[7/7] 验证..." -ForegroundColor Yellow
$testResult = wsl -d $WSL_DISTRO -e bash -c "$wslConfigDir/run-digest.sh generate 2>&1 | tail -5"
Write-Host $testResult

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  安装完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  调度安排："
Write-Host "    09:45 — 生成简报"
Write-Host "    09:55 — 重试生成（如果 09:45 失败）"
Write-Host "    10:00 — 发送邮件"
Write-Host ""
Write-Host "  配置文件：$envFile"
Write-Host "  配置文件：$configFile"
Write-Host ""
