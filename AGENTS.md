# AI Signal — Agent Instructions

先读 `CLAUDE.md`（架构、规则、调试命令）和 `README.md`（栏目、信源、配置）。

最重要的四条：
1. **模型只能引用素材编号。** 链接和数字由代码回填，不要改回让模型直接写 URL。
2. **邮件排版只用表格和内联样式。**
3. **保留工作流里每天提交 `docs/` 和 `data/seen.json` 的步骤。** 它让定时任务不会被 GitHub 暂停。
4. **不写、不打印邮箱地址。** 只放在 Secret 里；改完跑 `cd scripts && npm test`。
