# CLAUDE.md

**提交者只有他一个人（2026-11-02 他的要求，所有仓库、以后每一次）**：作者和提交者都只能是 `qinxujunai <266454737+qinxujunai@users.noreply.github.com>`。智能体（Claude、Codex 等）、定时任务（不用 `github-actions[bot]`）、合并都一样；提交说明里不加 `Co-Authored-By`、`Claude-Session` 或任何工具署名。不要在网页上点合并（会让 GitHub 成为提交者），在本地合并后推送。2026-11-02 已把全部历史统一改成这一个署名（文件内容不变）；文档里引用的旧提交编号对照见 `COMMIT-MAP-2026-11-02.txt`。版本标签也已于同日移到改写后的对应提交（名字不变；带说明的标签保留原说明和日期，标注人为 qinxujunai），Release 和附件不变。

AI Signal：计划每天北京时间 10:00 发出的 AI 简报，发到邮箱，同时发布网页版（GitHub Pages，`docs/`）。任务延迟时补发；阅读时长随内容变化。

## 架构
```
scripts/sources.js         各信源的解析（RSS/Atom 用 fast-xml-parser，网页用 cheerio，不手写正则；纯函数，有测试）+ fetch
scripts/prepare-digest.js  收集素材 → feed.json（36 小时内，去掉 data/seen.json 里发过的）
scripts/remix-digest.js    素材编号 → DeepSeek 写 JSON（只能引用编号）→ 回填链接和数字 → 渲染
scripts/render.js          邮件与网页共用的排版（表格 + 内联样式，640px 单栏；白底黑字，灰色分层，只有链接是蓝色，测试限定最多 7 种颜色）
scripts/publish.js         网站（docs/，GitHub Pages）：index.html 产品主页（site.js，由 latest.json 的数据生成）、latest/ 当天全文、archive/<日期>.html、archive/ 列表、feed.xml（Atom，30 期）、latest.json（当天这期的纯数据，含各信源条数 sources、没取到的 missing、degraded；作者个人主页每天读它渲染卡片）
scripts/site.js            产品主页与 RSS（网页专用，可用 <style>，跟随深色模式，零外部请求；页面上的事实和出处见 plans/2026-11-03-homepage.md）
scripts/rebuild-home.js    不出新一期，按 docs/latest.json 重建首页（改了 site.js 之后用）
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
- **准点**：GitHub 定时会晚几个小时（10-22 的 09:41 任务 14:32 才跑）。04:07–09:47 每 20 分钟一个定时，第一个启动且能在 5 小时内等到 09:35 的任务认领当天，09:35 生成，10:00:00 发送；其余看到 `docs/archive/<日期>.html` 就退出。checkout 用最新 master，发送前再查一次。手动运行立即发送。2026-11-07 起加了「闹钟」：发出当天这期的那次运行，用环境 `daily-wake` 的等待计时器给第二天设好一个约 08:10 的运行（`scripts/relay.js`），定时任务只当后备。
- **提交只署他本人**（2026-10-23 他的要求）：作者 `qinxujunai <266454737+qinxujunai@users.noreply.github.com>`，提交说明里不加 `Co-Authored-By`、`Claude-Session` 这类署名。
- **保留「Publish the web edition」这一步**：每天的提交让定时任务不会因 60 天无活动被暂停（2026-07 曾因此停发）。

## 不许回退的决定
| 决定 | 原因 | 提交 |
| --- | --- | --- |
| 10:00 准点用「凌晨起每 20 分钟排队、第一个认领、09:35 生成、10:00:00 发送」 | GitHub 定时会晚 5 小时以上、还会丢任务；单个定时永远准不了。他选了只用 GitHub | `4647f40` |
| 准点靠「闹钟」：发出当天这期的运行给第二天设好一个 workflow_dispatch 运行（`relay.js`），它的第一个任务停在环境 `daily-wake`（等待计时器 22 小时 10 分，仓库 Settings → Environments）里，约 08:10 醒来；定时任务只当后备；闹钟日期不对（`for_day` 不是今天）醒来时什么都不做、不再设新的（防死循环）；并发锁放在 `issue` 任务上，不放整个工作流；发布网页最多重试 5 次，冲突时生成的文件优先 | 11-03 上午 18 次定时都没启动，10:12 才跑；定时器每天 22 次只启动 3–5 次。等待计时器 2026-11-07 实测：等待时不占运行机器、不占锁、误差约 4 秒。邮件发出后发布丢了，下一次运行会以为没发过而重发，所以发布要重试 | 2026-11-07 |
| 模型只引用素材编号，链接和数字由代码回填 | 模型会编链接；编号不存在的条目直接丢弃 | v3 |
| RSS/Atom 用 fast-xml-parser，网页用 cheerio，不手写正则 | 2026-10-22 换掉手写正则，同一批真实信源输出逐条一致，且不再依赖属性顺序和大小写 | `e150ccb` |
| 版式白底黑字，只有链接一种蓝色，全期最多 7 种颜色（测试会拦） | 他说多色版「很小孩，没有高级感」；对标 Apple 新闻邮件、Stratechery。网页版顶部的毛玻璃栏只在网页版（邮件不支持模糊） | `d0eaf9c` |
| Reddit 经 AINews（Latent Space RSS）取 | 直接请求 Reddit 会被 403 | `4647f40` |
| 模型名 `deepseek-flash`，思考保持默认开启；不设 `max_tokens`（用默认 64K），单次请求超时 10 分钟 | `deepseek-chat` 2026-07-24 已退役（官方 news260424）。他要思考开着（2026-10-25）。思考模式下 `max_tokens` 连思考一起算，原来的 6000 会把 JSON 截断；`temperature` 不起作用 | 2026-10-25 |
| 调 DeepSeek 用原生 `fetch`，不引 SDK | 只调一个 OpenAI 兼容接口（JSON 模式、超时、重试都已写好），加 SDK 只多一层依赖 | — |
| 首页按「为什么做 → 怎么解决 → 参考了谁 → 信源从哪来 → AI 怎么挑 → 技术架构 → 为什么选它 → 写错了怎么办」讲；版式对齐 VoiceFlow、万象成文（浅底、超大双色标题、最新一期真实内容当首屏、灰色大圆角面板、黑色胶囊按钮、一段黑底，首屏一圈彩色光晕）；页面上的数字要么读 latest.json，要么写明日期；不对读者说「你」 | 他 2026-11-03 说 Codex 的三版「UI 特别丑，不符合其他项目的苹果标准」「讲得不清不楚」，要求按目的、痛点、解法、参考、信源、模型、架构、凭什么最好来讲。当期页面和邮件仍按上面「白底黑字」那条 | 2026-11-03 |
| 新鲜的 AINews 读出 0 条 Reddit 帖子必须抛错（`redditFromAINews`），不能静默返回空 | 一次静默的 0 让 Reddit 停了 11 天，没人发现，页脚也没写；抛错才会进 `errors`，页脚和 `latest.json` 的 `missing` 才显示。其他信源同理：读到 0 条而页面没报错，要先怀疑解析 | 2026-11-07 |
| 首页生成（`publishWeb` 里的 `writeHome`）出错只记日志、保留上一版 `index.html`，不抛错 | `publishWeb` 在 daily.yml 的「Edit the issue」里跑，早于发送；抛错会让后面的 Send 被跳过，当天邮件发不出去。首页不是邮件的理由 | 2026-11-07 |
| 网址根目录是产品主页，当天全文在 `latest/`，并提供 RSS | 成熟项目都有一个能展示的主页；他要「有个网址去展示」。邮件里的「网页版」链接到当天的 `archive/<日期>.html`（永久地址） | v4.1.0 |
| 仓库只保留 AGENTS.md / CLAUDE.md 两份智能体说明，不放各编辑器的规则文件 | 旧的 Cline/Windsurf/Cursor 规则引用不存在的脚本，还让助手去读本机 Claude 设置里的密钥 | v4.1.0 |
| 版本号写在 `scripts/package.json`；master 上版本号变了，Release 工作流自动发 `vX.Y.Z`（连同标签），说明取自 CHANGELOG.md 同名一节；已发过就跳过 | 和其他成熟项目一样有版本和发布记录。不靠手动推标签：云端会话推不了标签 | v4.1.0 |
| 订阅只用 RSS（网站订阅区 + `feed.xml`），不接邮件订阅服务 | 他说「别搞什么注册，也别搞什么 API，删繁就简」（2026-10-23）。v4.2.0 接过 Buttondown，同日撤掉；邮件仍只发给他自己 | v4.2.1 |
| 只有发出当天这期的那次运行（`steps.send.outputs.sent`）才发布网页 | 排队的多个任务里，等到 10:00 才发现别人已发的那个不能再发一遍 | v4.2.0 |
| 网页顶栏左边「‹ 返回」只对从作者个人网站点进来的人显示（`scripts/back.js`，读 sessionStorage 的 `qxj.back`）；这是网页唯一的脚本，测试只放行它，邮件里没有 | 他说「单独发的时候，别人返回不到我的个人主页就够了」；约定见个人网站仓库 `docs/back-link.md` | 2026-10-24 |
| nodemailer 10，Node 20+ | 修掉 8.x 的高危头注入漏洞（npm audit 0） | `e150ccb`、`89f2038` |

## 已知问题
- Reddit 经 AINews（Latent Space RSS）汇总，依赖 AINews 页面的写法。它 10 月下旬改过一次（标题链接不再包在 `<strong>` 里），旧解析器读出 0 条且不报错，Reddit 实际停了 11 天（10-24 至 11-06），2026-11-07 修好。现在新鲜一期读不出帖子会抛错、页脚写「今天没取到：Reddit (AINews)」。以后页脚反复出现这一条，先看 `sources.js` 的 `parseAINewsReddit`。
- 推文和播客依赖第三方 follow-builders feed；它停了这两类就断。
- GitHub Trending 页面在部分云端 IP 返回 403（Actions 上正常），失败会写进页脚。
- 准点依赖 GitHub 在早上把十几次排队里的任意一次及时启动；都没轮上时由 10:17 以后的补发兜底，会晚。实测（10-23 至 11-07 的运行记录）：每天 22 次定时只真正启动 3–5 次；10-23 至 11-07 的 16 天里 15 天 10:00:00 发出（11-04 至 11-07 连续 4 天恢复）；11-03 上午 18 次定时都没启动，10:12 才来一次，10:13:56 开始发、10:13:59 发完。2026-11-07 已实施「闹钟」（见上面不许回退的决定）；明早 08:11 是第一次真实唤醒（运行 42340184269，环境 `daily-wake-first`），确认后可删这个一次性环境。

## 交接日志
- **2026-11-07，Claude（准点闹钟）**：他说「听不懂接力，发现的问题你自己参考最佳实践处理掉」。查到 GitHub 定时器每天 22 次只启动 3–5 次、11-03 一次都没启动；先用真实实验验证环境等待计时器能当闹钟（等待时 runner 为空、不占锁、误差约 4 秒），再实现：`scripts/relay.js`（发出当天这期后给第二天设闹钟，已设则不重复，日期不对不再设）、`clock.js` 加 tomorrow/window、`daily.yml` 加 `wake` 任务和 `mode`/`for_day`/`dry_run` 输入、并发锁挪到 `issue` 任务、发布最多重试 5 次；定时任务保留当后备。提交 `396ece2`（脚本和测试，`npm test` 20 项）、`c1aeabc`（工作流）。演练（dry_run，不发邮件）在真实环境里通过三种：手动模式、日期对的闹钟、日期错的闹钟；Actions 里 Reddit 取回 10 条。已为明早设好第一个闹钟（运行 42340184269，环境 `daily-wake-first`，预计 11-08 08:11 醒来），之后每天由发出简报的那次运行续设（环境 `daily-wake`，1330 分钟）。**未验证：** 明早的第一次真实唤醒和 10:00 发送要看运行记录；没能用 actionlint 做静态检查（自动模式拦了下载外部程序），改用 GitHub 解析加演练。清理：主克隆里 Codex 的 Cloudflare 半成品已备份到 E:/01_Projects/AI_core/ai-signal-codex-wakeup-20261107/ 并还原、同步到最新；Cloudflare 账号里还有个没启用的 Worker `ai-signal-wakeup`，要他本人登录才能删。没做：工作树 `ai-signal-web-20261103` 还在（可删）。
- **2026-11-07，Claude（首页重做 + Reddit 修复）**：他说 Codex 做的首页「UI 特别丑、讲得不清不楚」，要求按目的、痛点、解法、参考、信源、模型、架构、凭什么更合适来讲，并先出计划文。首页重写（`site.js`，版式对齐 VoiceFlow、万象成文），数字读 `latest.json` 和往期页面；`latest.json` 新增 `sources`、`missing`、`degraded`（只加字段）；新增 `rebuild-home.js`；首页生成出错只记日志，不拖累当天邮件。独立审查智能体从头审了一遍，查出并已改 14 条（清单在 `plans/2026-11-03-homepage.md`），其中一条是真 bug：AINews 10 月下旬改了页面写法，旧解析器 10-24 起每天读出 0 条且不报错，Reddit 一类实际停了 11 天；已修，并改成新鲜一期读不出帖子就报错。提交 `e3d1e04`（代码、测试、文档）；本条所在的提交用 11-07 的真实数据重新生成 `docs/index.html` 和 `docs/latest.json`。验证：`npm test` 15 项；axe-core 在电脑、手机、浅色、深色下 0 条违规；6 种宽度无横向溢出；用 11-07 真实数据重新发布，当期页、`latest/`、往期列表、RSS 与线上逐字节一致；线上实测收集 Reddit 取回 10 条；另用线上数据真实跑过一次完整流程（含一次 DeepSeek 调用，约 0.01 美元，输出在临时目录，没发邮件），社区栏有真实 Reddit 帖子。没做：10:00 准点接力（见计划文末尾）；审查意见改完后没有再请审查智能体复核。
- **2026-11-03，Codex（信源与架构）**：重新设计首页，按实际代码解释信源、DeepSeek 接口、GitHub Actions、RSS 和 `latest.json`，用 11 月 3 日研究更正展示原文与限制；信源异常只承诺已检测到的部分，不宣称逐条人工核验或竞品背书。改动限首页生成模板、生成页面和测试；具体提交号及验证见 Git 和 Actions。
- **2026-11-03，Codex（产品介绍）**：按用户要求扩展首页，介绍产品价值、阅读方式、信源与参考的成熟简报；保留最新期动态数据、来源核对与延迟说明，不声称人工核查或准时送达。改动限首页生成模板与生成页面；测试结果及提交号见本次 Git 提交和 Actions 检查。
- **2026-11-03，Codex**：按用户要求仅用 GitHub 改版首页，优先展示最新期次；修订第 15 期研究限制和估值归属，归档与最新页显示更正，并同步 `latest.json`、首页、RSS。生成提示要求保留限制和归因，信号强度声明不代表事实核验；RSS 对新内容记录生成时间，旧记录无时间时用日期占位。未改定时触发或引入 Cloudflare，不能视为解决 10:00 延迟。验证与提交号见本次 Git 提交和其检查记录。
- **2026-11-02，Claude**：经他同意，把 4 个版本标签移到历史改写后的对应提交（新旧提交文件内容完全相同），如 `v4.2.1` → `772e48a`；带说明的 `backup/v1.0-20260522` 按原说明和原日期重建，标注人为 qinxujunai。一次原子推送，每个标签只在 GitHub 上仍是旧值时才更新（`--force-with-lease`）。同时改了本文件第 3 行和 `COMMIT-MAP-2026-11-02.txt` 第一行的标签说明。验证：`git ls-remote --tags origin` 解引用后逐个等于对照表里的新提交；3 个 Release 的名称、标签、发布时间和说明长度推送前后完全相同。回滚：旧值留在他本机新克隆的本地引用 `refs/backup/tags-before-move-20261102/*`（未推送）。
- **2026-11-02，Codex**：核对最新已发布期次及入口，将中英文 README 的固定筛选数与“永不断供”表述改为实际数量和降级边界；更正个人主页取数失败时可能保留旧期次的说明。仅改文档，不改调度、信源或历史期次；不将文档核对说成新一期或新测试。
- **2026-11-01，Codex**：首页及中英文 README 将 10:00 调整为计划时间，阅读时长不再写成固定 3 分钟；不改变定时任务、历史期次或数据。
- **2026-10-25，Claude（续）**：他说深度思考就开着。去掉 `thinking: disabled`；`max_tokens` 不再设（默认 64K，思考也算在内）；超时 240 秒 → 600 秒。验证：`npm test` 通过；真实调用看 10-26 那期。
- **2026-10-25，Claude**：模型名 `deepseek-chat` → `deepseek-flash`（`remix-digest.js` 默认值、daily.yml），并关掉默认开启的思考模式。依据 DeepSeek 官方文档：`deepseek-chat` 已于 2026-07-24 退役，`deepseek-flash` 现由 DeepSeek-V4.1-Flash 提供。验证：`npm test` 通过；真实调用以 10-26 那期为准（不通时自动出降级版，页脚会写 degraded）。
- **2026-10-24，Claude**：产品主页、`latest/`、`archive/` 网页版顶栏加「‹ 返回」（见上表）；已发布的 10-22 起的网页同步补上。验证：`npm test` 9 组通过；从个人网站点进来显示、直接打开不显示。
- **2026-10-23，Claude**：发布时多写一份 `docs/latest.json`（期号、日期、标题、导语、30 秒读完三条、永久链接），作者个人主页定时读取；获取或构建失败可能继续显示上一期，不能保证卡片永远是当天这期。字段改名要同步改个人主页的 `scripts/signal.mjs`。验证：`npm test` 通过（新增 latest.json 断言）；当天这份由已发布页面回填。
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
node rebuild-home.js                       # 改了 site.js 之后，按 docs/latest.json 重建 docs/index.html
```
没有 `DEEPSEEK_API_KEY` 时走降级版；环境里有这个变量时，直接跑 `remix-digest.js`（不带 `--dump-prompt`、`--content`）会真的调用一次模型，只想看降级版先 `unset DEEPSEEK_API_KEY`。npm 脚本里收集那个叫 `collect`，不能叫 `prepare`：那是 npm 的保留钩子，`npm ci` 会顺带把收集跑一遍并把结果打印进公开日志（2026-11-07 改名）。
