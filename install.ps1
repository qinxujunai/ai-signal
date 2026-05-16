# AI 前沿速递 · Windows 一键安装脚本
# 自动配置 WSL 调度 + Windows 任务计划程序

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AI 前沿速递 · 安装程序" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$PROJECT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$SCRIPTS_DIR = "$PROJECT_DIR\scripts"
$USER_HOME = $env:USERPROFILE

# 1. Create config directory
Write-Host "[1/5] 创建配置目录..." -ForegroundColor Yellow
$configDir = "$USER_HOME\.follow-builders"
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Force -Path $configDir | Out-Null
}
Write-Host "  ✓ $configDir"

# 2. Check for .env
Write-Host "[2/5] 检查配置文件..." -ForegroundColor Yellow
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

# 3. Copy WSL run script
Write-Host "[3/5] 配置 WSL 调度脚本..." -ForegroundColor Yellow
wsl -e bash -c "mkdir -p /root/.follow-builders && cp '$($SCRIPTS_DIR.Replace('\', '/').Replace('C:', '/mnt/c'))/run-digest.sh' /root/.follow-builders/run-digest.sh && chmod +x /root/.follow-builders/run-digest.sh" 2>$null
Write-Host "  ✓ WSL 脚本已部署"

# 4. Copy .env to WSL
wsl -e bash -c "cp '$($envFile.Replace('\', '/').Replace('C:', '/mnt/c'))' /root/.follow-builders/.env 2>/dev/null; cp '$($configFile.Replace('\', '/').Replace('C:', '/mnt/c'))' /root/.follow-builders/config.json 2>/dev/null"
Write-Host "  ✓ WSL 配置已同步"

# 5. Create Windows scheduled task
Write-Host "[4/5] 创建 Windows 任务计划..." -ForegroundColor Yellow
$taskName = "AI Frontier Digest"
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}
$action = New-ScheduledTaskAction -Execute "wsl" -Argument '-e bash -c "/root/.follow-builders/run-digest.sh"'
$trigger = New-ScheduledTaskTrigger -Daily -At "10:00AM"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Daily AI Frontier Digest at 10:00 AM" -User $env:USERNAME -Force | Out-Null
Write-Host "  ✓ 任务计划已创建（每天 10:00 自动运行）"

# 6. Test run
Write-Host "[5/5] 运行测试..." -ForegroundColor Yellow
Write-Host "  正在生成并发送第一期摘要（约需 30-60 秒）..."
$result = wsl -e bash -c "/root/.follow-builders/run-digest.sh 2>&1; echo EXIT:\$?"
Write-Host "  $result"
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "  安装完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  每天 10:00 北京时间自动发送到你的邮箱"
Write-Host "  手动触发：在 Claude Code 中输入 /ai"
Write-Host "  修改设置：在 Claude Code 中告诉我即可"
Write-Host ""
