# AI Signal · 一键安装脚本
# 三阶段调度：09:45 生成 → 09:55 重试 → 10:00 发送

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AI Signal · 安装程序" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$PROJECT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$SCRIPTS_DIR = "$PROJECT_DIR\scripts"
$USER_HOME = $env:USERPROFILE
$WSL_DISTRO = "Ubuntu"

# 0. Ensure WSL Ubuntu
Write-Host "[0/7] 检查 WSL Ubuntu..." -ForegroundColor Yellow
wsl --set-default $WSL_DISTRO 2>$null
Write-Host "  ✓ WSL 默认发行版: $WSL_DISTRO"

# 1. Create config directory
Write-Host "[1/7] 创建配置目录..." -ForegroundColor Yellow
$configDir = "$USER_HOME\.ai-signal"
New-Item -ItemType Directory -Force -Path "$configDir\drafts","$configDir\tmp" | Out-Null
Write-Host "  ✓ $configDir"

# 2. Check for .env
Write-Host "[2/7] 检查配置文件..." -ForegroundColor Yellow
$envFile = "$configDir\.env"
if (-not (Test-Path $envFile)) {
@"
QQ_EMAIL=你的QQ邮箱@qq.com
QQ_SMTP_AUTH=你的SMTP授权码
DEEPSEEK_API_KEY=sk-xxxxx
"@ | Out-File -FilePath $envFile -Encoding utf8
    Write-Host "  ⚠ 请编辑 $envFile"
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
    Write-Host "  ⚠ 请编辑 $configFile"
}
Write-Host "  ✓ 配置检查完成"

# 3. Register /ai
Write-Host "[3/7] 注册 /ai 命令..." -ForegroundColor Yellow
$claudeMd = "$USER_HOME\.claude\CLAUDE.md"
$aiLine = '- `/ai` — AI Signal daily digest. Run: `cd ~/.claude/skills/ai-signal/scripts && node prepare-digest.js --out /tmp/feed.json && node remix-digest.js --file /tmp/feed.json --out /tmp/digest.html && node deliver.js --file /tmp/digest.html --force`'
if (-not (Test-Path $claudeMd)) {
    New-Item -ItemType Directory -Force -Path "$USER_HOME\.claude" | Out-Null
    "## Available Skills`n`n$aiLine" | Out-File -FilePath $claudeMd -Encoding utf8
} elseif (-not (Select-String -Path $claudeMd -Pattern '/ai.*ai-signal' -Quiet)) {
    $content = Get-Content $claudeMd -Raw
    if ($content -match '## Available Skills') {
        $content = $content -replace '(## Available Skills[^\n]*\n)', "`$1$aiLine`n"
    } else {
        $content += "`n`n## Available Skills`n$aiLine`n"
    }
    Set-Content -Path $claudeMd -Value $content -Encoding utf8
}
Write-Host "  ✓ /ai 已注册"

# 4. Deploy script to WSL
Write-Host "[4/7] 部署调度脚本..." -ForegroundColor Yellow
$wslScriptSrc = $SCRIPTS_DIR.Replace('\', '/').Replace('C:', '/mnt/c')
wsl -d $WSL_DISTRO -e bash -c "cp $wslScriptSrc/run-digest.sh /root/.ai-signal/run-digest.sh && chmod +x /root/.ai-signal/run-digest.sh"
Write-Host "  ✓ 脚本已部署"

# 5. Sync config
Write-Host "[5/7] 同步配置..." -ForegroundColor Yellow
$wslEnvSrc = $envFile.Replace('\', '/').Replace('C:', '/mnt/c')
$wslCfgSrc = $configFile.Replace('\', '/').Replace('C:', '/mnt/c')
wsl -d $WSL_DISTRO -e bash -c "cp $wslEnvSrc /root/.ai-signal/.env 2>/dev/null; cp $wslCfgSrc /root/.ai-signal/config.json 2>/dev/null"
Write-Host "  ✓ 配置已同步"

# 6. Create three-stage scheduled tasks
Write-Host "[6/7] 创建定时任务（三阶段）..." -ForegroundColor Yellow
$taskBase = "AI Signal Daily Digest"
Get-ScheduledTask -TaskName "$taskBase*" -ErrorAction SilentlyContinue | ForEach-Object { Unregister-ScheduledTask -TaskName $_.TaskName -Confirm:$false }

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$wslExe = "C:\Windows\system32\wsl.exe"

# 09:45 — Generate
$action1 = New-ScheduledTaskAction -Execute $wslExe -Argument "-d $WSL_DISTRO -e bash -c `"/root/.ai-signal/run-digest.sh generate`"" -WorkingDirectory "C:\Windows\system32"
$trigger1 = New-ScheduledTaskTrigger -Daily -At "09:45AM"
Register-ScheduledTask -TaskName "$taskBase (Generate)" -Action $action1 -Trigger $trigger1 -Settings $settings -Description "AI Signal: generate digest at 09:45" -User $env:USERNAME -Force | Out-Null

# 09:55 — Retry generate
$action2 = New-ScheduledTaskAction -Execute $wslExe -Argument "-d $WSL_DISTRO -e bash -c `"/root/.ai-signal/run-digest.sh generate`"" -WorkingDirectory "C:\Windows\system32"
$trigger2 = New-ScheduledTaskTrigger -Daily -At "09:55AM"
Register-ScheduledTask -TaskName "$taskBase (Retry)" -Action $action2 -Trigger $trigger2 -Settings $settings -Description "AI Signal: retry generate at 09:55 if first attempt failed" -User $env:USERNAME -Force | Out-Null

# 10:00 — Send
$action3 = New-ScheduledTaskAction -Execute $wslExe -Argument "-d $WSL_DISTRO -e bash -c `"/root/.ai-signal/run-digest.sh send`"" -WorkingDirectory "C:\Windows\system32"
$trigger3 = New-ScheduledTaskTrigger -Daily -At "10:00AM"
Register-ScheduledTask -TaskName "$taskBase (Send)" -Action $action3 -Trigger $trigger3 -Settings $settings -Description "AI Signal: send digest at 10:00 (or failure notification)" -User $env:USERNAME -Force | Out-Null

Write-Host "  ✓ 09:45 Generate / 09:55 Retry / 10:00 Send"

# 7. Test
Write-Host "[7/7] 运行测试..." -ForegroundColor Yellow
wsl -d $WSL_DISTRO -e bash -c "/root/.ai-signal/run-digest.sh generate 2>&1 | tail -3"
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "  安装完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  调度安排："
Write-Host "    09:45 — 生成简报"
Write-Host "    09:55 — 重试生成（如果 09:45 失败）"
Write-Host "    10:00 — 发送邮件（或发送失败通知）"
Write-Host ""
Write-Host "  手动触发：在 Claude Code 中输入 /ai"
Write-Host ""
