# CLAUDE.md

AI Signal：每天北京时间 10:00:00 送达的 AI 简报，发到邮箱，同时发布网页版（GitHub Pages，`docs/`）。读者是中国的 AI 从业者，3 分钟读完。

## 架构
```
scripts/sources.js         各信源的解析（RSS/Atom 用 fast-xml-parser，网页用 cheerio，不手写正则；纯函数，有测试）+ fetch
scripts/prepare-digest.js  收集素材 → feed.json（36 小时内，去掉 data/seen.json 里发过的）
scripts/remix-digest.js    素材编号 → DeepSeek 写 JSON（只能引用编号）→ 回填链接和数字 → 渲染
scripts/render.js          邮件与网页共用的排版（表格 + 内联样式，640px 单栏；白底黑字，灰色分层，只有链接是蓝色，测试限定最多 7 种颜色）
scripts/publish.js         网站（docs/，GitHub Pages）：index.html 产品主页（site.js）、latest/ 当天全文、archive/<日期>.html、archive/ 列表、feed.xml（Atom，30 期）、latest.json（当天这期的纯数据，作者个人主页每天读它渲染卡片）
scripts/site.js            产品主页与 RSS（网页专用，可用 <style>，跟随深色模式，零外部请求）
scripts/deliver.js         QQ SMTP，发给作者自己（地址只在 Secret）
scripts/email.js           主题 =「AI Signal 月/日｜当天标题」
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
- **提交只署他本人**（2026-10-23 他的要求）：作者 `qinxujunai <266454737+qinxujunai@users.noreply.github.com>`，提交说明里不加 `Co-Authored-By`、`Claude-Session` 这类署名。
- **保留「Publish the web edition」这一步**：每天的提交让定时任务不会因 60 天无活动被暂停（2026-07 曾因此停发）。

## 不许回退的决定
| 决定 | 原因 | 提交 |
| --- | --- | --- |
| 10:00 准点用「凌晨起每 20 分钟排队、第一个认领、09:35 生成、10:00:00 发送」 | GitHub 定时会晚 5 小时以上、还会丢任务；单个定时永远准不了。他选了只用 GitHub | `4647f40` |
| 模型只引用素材编号，链接和数字由代码回填 | 模型会编链接；编号不存在的条目直接丢弃 | v3 |
| RSS/Atom 用 fast-xml-parser，网页用 cheerio，不手写正则 | 2026-10-22 换掉手写正则，同一批真实信源输出逐条一致，且不再依赖属性顺序和大小写 | `e150ccb` |
| 版式白底黑字，只有链接一种蓝色，全期最多 7 种颜色（测试会拦） | 他说多色版「很小孩，没有高级感」；对标 Apple 新闻邮件、Stratechery。网页版顶部的毛玻璃栏只在网页版（邮件不支持模糊） | `d0eaf9c` |
| Reddit 经 AINews（Latent Space RSS）取 | 直接请求 Reddit 会被 403 | `4647f40` |
| 模型名 `deepseek-flash`，关掉思考（`thinking: {type: 'disabled'}`） | `deepseek-chat` 2026-07-24 已退役（官方 news260424）；`deepseek-flash` 默认开思考，原来的提示词按不思考调的 | 2026-10-25 |
| 调 DeepSeek 用原生 `fetch`，不引 SDK | 只调一个 OpenAI 兼容接口（JSON 模式、超时、重试都已写好），加 SDK 只多一层依赖 | — |
| 网址根目录是产品主页，当天全文在 `latest/`，并提供 RSS | 成熟项目都有一个能展示的主页；他要「有个网址去展示」。邮件里的「网页版」链接到当天的 `archive/<日期>.html`（永久地址） | v4.1.0 |
| 仓库只保留 AGENTS.md / CLAUDE.md 两份智能体说明，不放各编辑器的规则文件 | 旧的 Cline/Windsurf/Cursor 规则引用不存在的脚本，还让助手去读本机 Claude 设置里的密钥 | v4.1.0 |
| 版本号写在 `scripts/package.json`；master 上版本号变了，Release 工作流自动发 `vX.Y.Z`（连同标签），说明取自 CHANGELOG.md 同名一节；已发过就跳过 | 和其他成熟项目一样有版本和发布记录。不靠手动推标签：云端会话推不了标签 | v4.1.0 |
| 订阅只用 RSS（网站订阅区 + `feed.xml`），不接邮件订阅服务 | 他说「别搞什么注册，也别搞什么 API，删繁就简」（2026-10-23）。v4.2.0 接过 Buttondown，同日撤掉；邮件仍只发给他自己 | v4.2.1 |
| 只有发出当天这期的那次运行（`steps.send.outputs.sent`）才发布网页 | 排队的多个任务里，等到 10:00 才发现别人已发的那个不能再发一遍 | v4.2.0 |
| 网页顶栏左边「‹ 返回」只对从作者个人网站点进来的人显示（`scripts/back.js`，读 sessionStorage 的 `qxj.back`）；这是网页唯一的脚本，测试只放行它，邮件里没有 | 他说「单独发的时候，别人返回不到我的个人主页就够了」；约定见个人网站仓库 `docs/back-link.md` | 2026-10-24 |
| nodemailer 10，Node 20+ | 修掉 8.x 的高危头注入漏洞（npm audit 0） | `e150ccb`、`89f2038` |

## 已知问题
- 推文和播客依赖第三方 follow-builders feed；它停了这两类就断。
- GitHub Trending 页面在部分云端 IP 返回 403（Actions 上正常），失败会写进页脚。
- 准点依赖 GitHub 在早上把十几次排队里的任意一次及时启动；都没轮上时由 10:17 以后的补发兜底，会晚。

## 交接日志
- **2026-10-25，Claude**：模型名 `deepseek-chat` → `deepseek-flash`（`remix-digest.js` 默认值、daily.yml），并关掉默认开启的思考模式。依据 DeepSeek 官方文档：`deepseek-chat` 已于 2026-07-24 退役，`deepseek-flash` 现由 DeepSeek-V4.1-Flash 提供。验证：`npm test` 通过；真实调用以 10-26 那期为准（不通时自动出降级版，页脚会写 degraded）。
- **2026-10-24，Claude**：产品主页、`latest/`、`archive/` 网页版顶栏加「‹ 返回」（见上表）；已发布的 10-22 起的网页同步补上。验证：`npm test` 9 组通过；从个人网站点进来显示、直接打开不显示。
- **2026-10-23，Claude**：发布时多写一份 `docs/latest.json`（期号、日期、标题、导语、30 秒读完三条、永久链接），作者个人主页的定时任务每天读它，首页卡片就永远是当天这期。字段改名要同步改个人主页的 `scripts/signal.mjs`。验证：`npm test` 通过（新增 latest.json 断言）；当天这份由已发布页面回填。
- **2026-10-23**：v4.2.1 撤掉 Buttondown（`broadcast.js`、工作流里的发送步骤、邮件表单），订阅区改成 RSS。验证：`npm test` 9 组。
- **2026-10-23**：订阅（v4.2.0）：`site.js` 的订阅区、`email.js`、`broadcast.js`，daily.yml 加「Send to subscribers」。验证：`npm test` 9 组；用假 key 请求 Buttondown 返回 401，脚本只记警告、退出码 0；订阅区 axe 0 违规、手机无横向溢出。待作者：注册 Buttondown、关掉打开/点击追踪、在仓库设置变量 `BUTTONDOWN_USERNAME` 和 Secret `BUTTONDOWN_API_KEY`。
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
