# CLAUDE.md

AI Signal：每天北京时间 10:00 自动生成的 AI 简报。发到邮箱，同时发布网页版（GitHub Pages，`docs/`）。读者是中国的 AI 从业者，目标是 3 分钟读完、信息密度最高。

## 架构
```
scripts/prepare-digest.js  收集素材 → feed.json（36 小时内、去掉 data/seen.json 里发过的）
scripts/remix-digest.js    给素材编号 → DeepSeek 写 JSON（只能引用编号）→ 回填链接和数字 → 渲染
scripts/render.js          邮件与网页共用的排版（表格 + 内联样式，640px 单栏）
scripts/deliver.js         QQ SMTP；主题 =「AI Signal 月/日｜当天标题」
.github/workflows/daily.yml  每天 02:00 UTC 运行，发信后提交 docs/ 和 data/seen.json
```

## 规则
- **模型永远不输出 URL 和数字。** 新增栏目时也让模型引用编号，由 `normalize()` 回填。
- **排版**只用表格和内联样式，不用 `<style>`、图片、追踪像素。QQ 邮箱、Gmail、Outlook 都要能正常显示。
- 邮件和网页都不出现收件人邮箱。
- **信源挂掉不能让任务失败。** 在 `prepare-digest.js` 里用 `settle()` 或 try/catch 兜住，写进 `errors`，页脚会显示。
- **保留「Publish the web edition」这一步。**
  - 原因：仓库曾 60 天没有提交，GitHub 暂停了定时任务，2026-07-22 之后就停发了。
  - 现在每天的提交让任务保持活跃。

## 调试
```bash
cd scripts && npm ci
node prepare-digest.js --out /tmp/feed.json
node remix-digest.js --file /tmp/feed.json --dump-prompt          # 模型看到的编号素材
node remix-digest.js --file /tmp/feed.json --content issue.json --out /tmp/email.html --web-dir /tmp/web   # 用手写的 JSON 预览排版
```
没有 `DEEPSEEK_API_KEY` 时会走降级版。
