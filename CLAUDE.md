# CLAUDE.md

AI Signal：每天北京时间 10:00:00 送达的 AI 简报，发到邮箱，同时发布网页版（GitHub Pages，`docs/`）。读者是中国的 AI 从业者，3 分钟读完。

## 架构
```
scripts/sources.js         各信源的解析（纯函数，有测试）+ fetch
scripts/prepare-digest.js  收集素材 → feed.json（36 小时内，去掉 data/seen.json 里发过的）
scripts/remix-digest.js    素材编号 → DeepSeek 写 JSON（只能引用编号）→ 回填链接和数字 → 渲染
scripts/render.js          邮件与网页共用的排版（表格 + 内联样式，640px 单栏；白底黑字，灰色分层，只有链接是蓝色，测试限定最多 7 种颜色）
scripts/deliver.js         QQ SMTP；主题 =「AI Signal 月/日｜当天标题」
scripts/clock.js           北京时间：今天的日期、等到 09:35 / 10:00
scripts/test/              node --test（npm test）
.github/workflows/daily.yml
```

## 规则
- **模型永远不输出 URL 和数字。** 新增栏目时也让模型引用编号，由 `normalize()` 回填。编号前缀：B 博客、H HN、T Techmeme、R Reddit、P 论文、G GitHub、M 模型、U 产品、X 推文、C 中文、D 播客。
- **排版**只用表格和内联样式，不用 `<style>`、图片、追踪像素；QQ 邮箱、Gmail、Outlook 都要正常显示。
- **邮箱地址只在 Secret 里。** 代码不写默认地址，日志不打印收件人（公开仓库的 Actions 日志是公开的）。
- **信源挂掉不能让任务失败。** 用 `settle()` 或 try/catch 兜住，写进 `errors`，页脚显示。Reddit 直接请求会被 403，所以经 AINews（Latent Space 的 RSS）取 Reddit 热帖。
- **准点**：GitHub 定时会晚几个小时（10-22 的 09:41 任务 14:32 才跑）。04:07–09:47 每 20 分钟一个定时，第一个启动且能在 5 小时内等到 09:35 的任务认领当天，09:35 生成，10:00:00 发送；其余看到 `docs/archive/<日期>.html` 就退出。checkout 用最新 master，发送前再查一次。手动运行立即发送。
- **保留「Publish the web edition」这一步**：每天的提交让定时任务不会因 60 天无活动被暂停（2026-07 曾因此停发）。

## 调试
```bash
cd scripts && npm ci && npm test
node prepare-digest.js --out /tmp/feed.json
node remix-digest.js --file /tmp/feed.json --dump-prompt
node remix-digest.js --file /tmp/feed.json --content issue.json --out /tmp/email.html --web-dir /tmp/web   # 用手写 JSON 预览排版
```
没有 `DEEPSEEK_API_KEY` 时走降级版。
