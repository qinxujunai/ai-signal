# CLAUDE.md

AI Signal：每天北京时间 10:00:00 送达的 AI 简报，发到邮箱，同时发布网页版（GitHub Pages，`docs/`）。读者是中国的 AI 从业者，3 分钟读完。

## 架构
```
scripts/sources.js         各信源的解析（RSS/Atom 用 fast-xml-parser，网页用 cheerio，不手写正则；纯函数，有测试）+ fetch
scripts/prepare-digest.js  收集素材 → feed.json（36 小时内，去掉 data/seen.json 里发过的）
scripts/remix-digest.js    素材编号 → DeepSeek 写 JSON（只能引用编号）→ 回填链接和数字 → 渲染
scripts/render.js          邮件与网页共用的排版（表格 + 内联样式，640px 单栏；白底黑字，灰色分层，只有链接是蓝色，测试限定最多 7 种颜色）
scripts/publish.js         网站（docs/，GitHub Pages）：index.html 产品主页（site.js）、latest/ 当天全文、archive/<日期>.html、archive/ 列表、feed.xml（Atom，30 期）
scripts/site.js            产品主页与 RSS（网页专用，可用 <style>，跟随深色模式，零外部请求）
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

## 不许回退的决定
| 决定 | 原因 | 提交 |
| --- | --- | --- |
| 10:00 准点用「凌晨起每 20 分钟排队、第一个认领、09:35 生成、10:00:00 发送」 | GitHub 定时会晚 5 小时以上、还会丢任务；单个定时永远准不了。他选了只用 GitHub | `4647f40` |
| 模型只引用素材编号，链接和数字由代码回填 | 模型会编链接；编号不存在的条目直接丢弃 | v3 |
| RSS/Atom 用 fast-xml-parser，网页用 cheerio，不手写正则 | 2026-10-22 换掉手写正则，同一批真实信源输出逐条一致，且不再依赖属性顺序和大小写 | `e150ccb` |
| 版式白底黑字，只有链接一种蓝色，全期最多 7 种颜色（测试会拦） | 他说多色版「很小孩，没有高级感」；对标 Apple 新闻邮件、Stratechery。网页版顶部的毛玻璃栏只在网页版（邮件不支持模糊） | `d0eaf9c` |
| Reddit 经 AINews（Latent Space RSS）取 | 直接请求 Reddit 会被 403 | `4647f40` |
| 调 DeepSeek 用原生 `fetch`，不引 SDK | 只调一个 OpenAI 兼容接口（JSON 模式、超时、重试都已写好），加 SDK 只多一层依赖 | — |
| 网址根目录是产品主页，当天全文在 `latest/`，并提供 RSS | 成熟项目都有一个能展示的主页；他要「有个网址去展示」。邮件里的「网页版」链接到当天的 `archive/<日期>.html`（永久地址） | v4.1.0 |
| 仓库只保留 AGENTS.md / CLAUDE.md 两份智能体说明，不放各编辑器的规则文件 | 旧的 Cline/Windsurf/Cursor 规则引用不存在的脚本，还让助手去读本机 Claude 设置里的密钥 | v4.1.0 |
| 版本号写在 `scripts/package.json`，打 `vX.Y.Z` 标签自动发 Release，说明取自 CHANGELOG.md | 和其他成熟项目一样有版本和发布记录 | v4.1.0 |
| nodemailer 10，Node 20+ | 修掉 8.x 的高危头注入漏洞（npm audit 0） | `e150ccb`、`89f2038` |

## 已知问题
- 推文和播客依赖第三方 follow-builders feed；它停了这两类就断。
- GitHub Trending 页面在部分云端 IP 返回 403（Actions 上正常），失败会写进页脚。
- 准点依赖 GitHub 在早上把十几次排队里的任意一次及时启动；都没轮上时由 10:17 以后的补发兜底，会晚。

## 交接日志
- **2026-10-22，Claude**：v4 准点、信源 11 类、版式（`4647f40`）；白底黑字版式（`d0eaf9c`）；解析换成成熟库、nodemailer 10（`e150ccb`）。验证：`npm test` 7 组通过；真实信源新旧解析输出一致；10-23 是第一次准点发送，以运行记录为准。

- **2026-10-23，Claude**：产品主页、`latest/`、RSS（`publish.js`、`site.js`），站内链接不再开新标签页，「原帖」链接加下划线（axe 0 违规）；LICENSE、CHANGELOG、Release 工作流；删掉过时的编辑器规则文件和根目录 package.json。验证：`npm test` 8 组；本地预览手机/电脑、亮/暗无横向溢出、无报错。

## 调试
```bash
cd scripts && npm ci && npm test
node prepare-digest.js --out /tmp/feed.json
node remix-digest.js --file /tmp/feed.json --dump-prompt
node remix-digest.js --file /tmp/feed.json --content issue.json --out /tmp/email.html --web-dir /tmp/web   # 用手写 JSON 预览排版
```
没有 `DEEPSEEK_API_KEY` 时走降级版。
