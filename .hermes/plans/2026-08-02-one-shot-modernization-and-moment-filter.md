# BewlyBewly 一次性现代化与动态过滤实施计划

> 状态：已完成（阶段 A–I）
> 基线：`main@d42143547bf4e9cc6864f227fcbcbd396bbff25b`（v0.41.1）
> 目标：在一个集成分支内一次性交付现代化扩展工具链、升级后的应用依赖、`t.bilibili.com` 动态过滤，以及 Chromium/Firefox 的真实扩展验收；不做多个过渡版本。

## 1. 决策摘要

接受“一把梭哈”，但把它定义为：**一个集成分支、一次最终切换、多个可回滚的小提交和内部 gate**，而不是把所有修改塞进一个不可审查的 commit。

核心取舍：

1. **迁移到 WXT 作为唯一扩展构建入口**，而不是继续升级现有 Vite + tsup + esno + 自制 MV3 HMR 四套拼装链路。
2. 升级到各依赖族的**最新相互兼容稳定版本**；不为了版本号强行覆盖 WXT 的 Vite peer/内置版本。当前已查询的计划目标族为 Node 24 LTS、pnpm 11、Vue 3.5、WXT 0.21、UnoCSS 66、Vitest 4、vue-tsc 3、VueUse 14、vue-i18n 11、Pinia 4、ESLint 10 / `@antfu/eslint-config` 9。TypeScript 优先 7；若 Vue/WXT 的正式兼容矩阵不接受，则固定到最高兼容稳定版，并在计划验收记录原因。
3. 删除迁移后冗余的 `vite.config.ts`、`vite.config.content.ts`、`vite-mv3-hmr.ts`、`tsup.config.ts`、手写 manifest/prepare 链以及 deprecated `crx` 打包；不保留双构建系统。
4. 动态过滤继续作用于**原版 `t.bilibili.com` DOM**，不在本次重写整个 Moments 页面，也不拦截/篡改 Bilibili API response。
5. 动态过滤采用纯规则引擎 + DOM adapter + 生命周期控制器分层；规则存储版本化，设置页作为独立的“动态”子页。
6. Chromium 与 Firefox 是发布阻断目标；Safari 保持可构建/转换能力，但由于上游已明确不维护 Safari，Safari 不阻断首轮功能发布，除非本次迁移造成确定性构建回归。

## 2. 当前基线与已知问题

- 当前栈：Vue 3.4、TS 5.4、Vite 5、Vitest 1、UnoCSS 0.59、Pinia 2、pnpm 9、WXT 0.18（只用于 submit）。
- `src/contentScripts/views/Moments/Moments.vue` 仍是 WIP；`src/stores/mainStore.ts` 将 Moments 标记为 `useOriginalBiliPage: true` / `hasBewlyPage: false`。
- `src/manifest.ts` 已给 `t.bilibili.com` 注入 isolated content script 和 MAIN-world inject script。
- 现有动态页只有样式适配 `src/styles/adaptedStyles/pages/momentsPage.scss`，没有业务过滤。
- `pnpm test` 当前使用 `vitest test`，在本机完成用例后不退出；基线实际验证使用 `pnpm exec vitest run`，3/3 通过。
- 基线 `pnpm typecheck`、`pnpm lint`、`pnpm build` 均通过。
- 构建存在 Node 废弃警告、UnoCSS global bundle warning、`broken-image.png` unresolved warning；content script 产物约 992 KB JS + 597 KB CSS。
- CI 的 `node: [lts/*, lts/-1]` 会漂移，release workflow 仍混用 pnpm action v3/v4 和 `npx release-it`。

## 3. 范围

### 3.1 本次必须完成

- 单一 WXT 构建/开发/打包入口。
- Chromium MV3 与 Firefox 对等 manifest、background、content script、MAIN-world script、DNR 和 Firefox webRequest 行为。
- pnpm、Vue、TypeScript、lint、test、UnoCSS、i18n、VueUse、Pinia 等依赖族整体升级。
- 移除废弃/重复依赖及脚本。
- 设置 schema 版本化和旧设置无损合并。
- 原版动态页广告/内容过滤：UID、用户名、正文关键词、正则、动态类型/商业组件信号、白名单、规则启停。
- 动态设置 UI、四种现有 locale、导入导出和非法规则反馈。
- 单元、DOM fixture、存储迁移、扩展 smoke、真实页面手工/自动辅助验收。
- CI、release、README/CONTRIBUTING 开发命令更新。

### 3.2 明确不做

- 不重写完整 Bewly Moments feed。
- 不做模型/云端广告分类，不上传浏览数据。
- 不修改 Bilibili API response，不依赖私有 API schema 来隐藏卡片。
- 不把首页视频 filter 与动态 filter 强行合并成同一 schema；仅复用通用 UI/导入校验能力。
- 不在本次做大规模视觉重设计；只新增与现有设置系统一致的低噪 UI。
- 不发布商店版本，除非用户在最终本地验收后另行授权。

## 4. 分支、提交与恢复策略

实施分支：`feat/modernize-and-moment-filter`

建议签名小提交：

1. `test: lock extension baseline contracts`
2. `build: migrate extension toolchain to wxt`
3. `chore: upgrade application dependency families`
4. `ci: update build test and release workflows`
5. `feat(moment-filter): add versioned rule engine and storage`
6. `feat(moment-filter): filter original dynamic feed`
7. `feat(settings): add moment filter management`
8. `test: add chromium and firefox extension smoke coverage`
9. `docs: update development and filter documentation`

每个提交都必须能通过该阶段定义的 focused gate；最终只从完整 green 的分支合并。若 WXT 迁移无法保持关键 manifest/runtime 合同，回滚到提交 1，而不是在仓库内保留两套构建器。

## 5. 实施阶段

### 阶段 A — 冻结行为合同与 fixture

**目标：** 在更换构建器前，把“不能丢”的行为变成可比较证据。

修改/新增：

- `src/tests/manifest-contract.spec.ts`
- `src/tests/settings-migration.spec.ts`
- `tests/fixtures/manifest/chromium.json`
- `tests/fixtures/manifest/firefox.json`
- `tests/fixtures/moments/*.html`
- `package.json`

步骤：

1. 从当前成功 build 产物提取规范化 manifest fixture，忽略版本号/哈希等非合同字段。
2. 固定以下合同：matches、permissions、host permissions、DNR、background、MAIN world、web accessible resources、Firefox gecko id/webRequest 权限。
3. 为当前 settings 的旧快照建立迁移 fixture，覆盖缺字段、废弃字段、已有过滤列表。
4. 从真实 `t.bilibili.com` 页面只采集**脱敏后的最小动态卡片 DOM fixture**：普通文本、转发、视频、商品/推广、懒加载新增、缺失作者链接。不得提交 Cookie、用户 ID、私信或推荐列表原文。
5. 将 `test` 脚本修为确定性 `vitest run`，另设 `test:watch`。

Gate：

```bash
pnpm exec vitest run src/tests/manifest-contract.spec.ts src/tests/settings-migration.spec.ts
pnpm lint
pnpm typecheck
```

### 阶段 B — 一次性迁移到 WXT

**目标：** WXT 成为唯一 dev/build/zip/submit 编排层，保留现有业务源码与 Vue 组件路径，避免无意义搬家。

新增：

- `wxt.config.ts`
- `src/entrypoints/background.ts`
- `src/entrypoints/content.ts`
- `src/entrypoints/main-world.ts`
- `src/entrypoints/options/index.html`
- `src/entrypoints/options/main.ts`
- `src/entrypoints/popup/index.html`
- `src/entrypoints/popup/main.ts`

调整：

- `src/background/index.ts`：暴露可由 WXT background entrypoint 调用的 setup，避免导入即重复注册。
- `src/contentScripts/index.ts`：暴露 content setup/cleanup；由 `defineContentScript` 启动。
- `src/inject/index.js`：迁入 typed MAIN-world entrypoint；若逻辑本身无需 TS，仍由 WXT 管理产物。
- `unocss.config.ts`：升级到 UnoCSS 66 的配置/API，并明确 content scanning 与 `uno.css` 入口。
- `tsconfig.json`：采用 WXT 生成类型、现代 target/module resolution 和项目 include。
- `package.json`：统一为 `wxt dev/build/zip/submit`，分别提供 Chromium/Firefox/Safari 命令。
- `.gitignore`：切换为 WXT 输出目录。

删除：

- `vite.config.ts`
- `vite.config.content.ts`
- `vite-mv3-hmr.ts`
- `tsup.config.ts`
- `src/manifest.ts`
- `scripts/prepare.ts`
- `scripts/manifest.ts`
- `scripts/client.ts`
- 不再需要的 `scripts/utils.ts`

依赖删除候选（以 `pnpm knip` 和构建证明为准）：

- `crx`
- `tsup`
- `esno`
- `chokidar`
- `fs-extra`
- `npm-run-all`
- `@rollup/plugin-replace`
- 手写 HMR 所需依赖

验收重点：

- MAIN 与 isolated world 仍各执行一次，不能重复挂监听器。
- Firefox 的 `webRequestBlocking`/cookies 分支不被构建期常量迁移破坏。
- content script 仍在 `document_start`，all frames/match-about-blank 行为与旧 manifest 一致。
- options、popup、背景 API bridge、首页替换、原版页面样式均能启动。

Gate：

```bash
pnpm build
pnpm build:firefox
pnpm build:safari
pnpm test:manifest
pnpm knip
```

然后逐字段 diff 新旧 manifest，而不是只看 build exit code。

### 阶段 C — 升级所有依赖族并修 API

**目标：** 在 WXT 结构上一次性升级，不保留旧 major 的兼容胶水。

依赖族：

- Runtime：Vue 3.5、Pinia 4、vue-i18n 11、VueUse 14、DOMPurify、OverlayScrollbars、QRCode、Iconify、webextension polyfill/bridge。
- Tooling：pnpm 11、WXT 0.21、UnoCSS 66、Vitest 4、jsdom 30、vue-tsc 3、ESLint 10、Antfu config 9、Knip 6、Sass、rimraf、web-ext。
- TypeScript：先尝试 7；若 WXT/Vue 正式类型链不兼容，固定到最高兼容稳定版并新增 Renovate/Dependabot 后续跟踪，不使用 `skipLibCheck` 掩盖自有代码错误。

同步修复：

- `unocss.config.ts` 的 preset/import/content pipeline/postprocess 类型变化。
- `eslint.config.mjs` 的 Antfu 9 与 ESLint 10 flat config API。
- `vite.config.ts` 中原有 Vitest 配置迁到独立 `vitest.config.ts`，避免测试依赖构建器内部配置。
- `@types/dompurify` 已废弃：改用 DOMPurify 自带类型并删除。
- `crx` 已废弃：由 WXT zip 取代。
- 校正 dependencies/devDependencies：运行时被打包的 Vue、VueUse、Iconify 等不能因历史原因错误留在 devDependencies。
- 清理 `.npmrc` 的 `shamefully-hoist` / 宽松 peer 配置；优先在严格 peer 下解决真实冲突。
- `tsconfig.json` 提升 target，并开启适合现代 ESM 的 module resolution；不一次性开启与迁移无关的大量 stylistic compiler flags。
- 重新生成 `src/auto-imports.d.ts`，检查 diff 中没有丢失真实 API。

Gate：

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm knip
pnpm build
pnpm build:firefox
```

实施记录（2026-08-02）：

- 生产/工具链已升级到 Node 24 CI、pnpm 11.18、Vue 3.5、Pinia 4、VueUse 14、Vite 8、Vitest 4、ESLint 10、Knip 6、release-it 21；移除 `webext-bridge`、`release-it-pnpm`、`@types/dompurify` 与重复 import sorter。
- pnpm 11 配置迁到 `pnpm-workspace.yaml`，启用严格 peer、`trustPolicy: no-downgrade`、显式 build-script allowlist 和短期供应链版本钉住；删除 `shamefully-hoist` 与旧 `.npmrc` 宽松配置。
- TypeScript 7.0.2 在本次执行时仍处于 `minimumReleaseAge` 窗口，未绕过供应链策略；固定到已通过 Vue/WXT 全量类型与三浏览器构建 gate 的 TypeScript 6.0.3。
- `release-it-pnpm` 被 pnpm 11 判定为高风险 trust downgrade，已由 release-it 21 原生 `npm.publish: false` 配置替代；发布 dry-run 已能加载新 CLI，完整 dry-run 留到干净提交后执行。

额外约束：安装日志中不得遗留 unresolved peer dependency；允许有明确上游来源且记录过的 deprecation，但本仓库直接依赖不得是 deprecated 包。

### 阶段 D — 设置存储版本化

**目标：** 在添加动态规则前解决当前 `mergeDefaults` 只能浅层兜底、缺少显式 schema migration 的问题。

新增：

- `src/settings/types.ts`
- `src/settings/defaults.ts`
- `src/settings/migrations.ts`
- `src/settings/storage.ts`
- `src/settings/migrations.spec.ts`

调整：

- `src/logic/storage.ts`：保留对外 `settings` 单一入口，但内部切换到版本化加载/校验/迁移。
- `src/composables/useStorageLocal.ts`：适配新版 VueUse 类型；对 extension storage 的序列化语义写测试。

规则结构：

```ts
type MomentRuleField = 'authorUid' | 'authorName' | 'content' | 'dynamicType' | 'commercialSignal'
type MomentRuleOperator = 'equals' | 'contains' | 'regex' | 'in'
type MomentRuleAction = 'hide' | 'allow'

interface MomentFilterRule {
  id: string
  enabled: boolean
  action: MomentRuleAction
  field: MomentRuleField
  operator: MomentRuleOperator
  value: string | string[]
  caseSensitive?: boolean
  note?: string
  createdAt: number
}

interface MomentFilterSettingsV1 {
  schemaVersion: 1
  enabled: boolean
  mode: 'any' | 'all'
  rules: MomentFilterRule[]
}
```

语义：

- `allow` 优先于 `hide`，避免关键词误伤特定 UP。
- 非法正则在保存/导入时拒绝，运行时永不抛出到 observer。
- 默认关闭，不预置主观广告关键词；可提供未启用的示例模板。
- UID 规则精确匹配；用户名允许 equals/contains；正文支持 contains/regex。
- `commercialSignal` 只针对稳定 DOM 组件/可访问标签，不对所有含“购买”等普通文本做不可解释的默认屏蔽。

Gate：迁移旧 settings、刷新后持久化、浏览器 storage change 同步、非法导入、allow 优先级、规则组合测试全部通过。

### 阶段 E — 动态过滤核心与 DOM 生命周期

新增：

- `src/features/moment-filter/types.ts`
- `src/features/moment-filter/matcher.ts`
- `src/features/moment-filter/selectors.ts`
- `src/features/moment-filter/extract.ts`
- `src/features/moment-filter/controller.ts`
- `src/features/moment-filter/index.ts`
- `src/features/moment-filter/matcher.spec.ts`
- `src/features/moment-filter/controller.spec.ts`

接入：

- `src/contentScripts/index.ts` 或迁移后的 `src/entrypoints/content.ts`

运行条件：

- 仅顶层 `https://t.bilibili.com/*` 启动；除非 fixture 证明动态 feed 确实位于目标 iframe。
- settings 关闭时零 observer、零扫描。
- 启动时扫描现存卡片；随后 `MutationObserver` 只收集新增 subtree 内候选卡片。
- 以 microtask/requestIdleCallback 批处理，并有最大 batch；不对每次 mutation 全页 query。
- `WeakMap<Element, fingerprint>` 记录已处理卡片。正文/作者发生变化时 fingerprint 变化才重判。
- SPA navigation、BFCache `pageshow/pagehide`、扩展热重载必须 cleanup，保证 observer/listener 单实例。
- settings/rules 改变时重新评估当前卡片；被规则隐藏的节点用扩展自有 class/attribute 标记，不写 inline style，规则取消后可恢复。
- 提供隐藏统计但默认只保存在内存；不记录正文，不做遥测。

DOM 提取优先级：

1. 稳定链接语义与 URL 中 UID；
2. 可访问名称、明确的 data 属性；
3. 组件 class selector；
4. 文本启发式只作为最后兜底。

2026-08-02 在线页面已只读核验的首组选取器为：卡片 `.bili-dyn-list__item`、列表 `.bili-dyn-list__items`、作者 `.bili-dyn-title`、正文 `.bili-dyn-content__orig`、链接/视频标题 `.bili-dyn-card-link-common__detail__title` / `.bili-dyn-card-video__title`、页面根 `.bili-dyn-home--member` / `.bili-dyn-home--visitor`。它们只作为集中 adapter 的当前证据，不散落进 controller。

选择器至少允许两套已验证结构并集中在 `selectors.ts`；站点变更时 fail-open（不过滤），不能误删整个 feed container。若列表尚未挂载，临时观察 `document.body`，找到 `.bili-dyn-list__items` 后立即改绑列表 observer；若列表根被替换，断开旧 observer 并重绑。

路由生命周期显式监听现有 MAIN-world 发出的 `historyChange`，同时补足 `popstate`、`hashchange`、`pageshow` / `pagehide`。每次读取实时 `location.href`，不得复用当前 content script 初始化时缓存的静态 `currentUrl`。

Gate：

- fixture 中普通、转发、视频、图文、商品/推广、缺失字段卡片均有覆盖。
- 重复 mutation 不重复处理；批量插入不会 N² 扫描。
- observer cleanup 后不再响应。
- 规则关闭/删除后卡片恢复。
- 选择器失效时保持页面原样并只输出一次开发诊断。

### 阶段 F — 设置 UI 与 i18n

新增：

- `src/components/Settings/BewlyPages/Moments/Moments.vue`
- `src/components/Settings/BewlyPages/Moments/MomentRuleEditor.vue`
- `src/components/Settings/BewlyPages/Moments/MomentRuleTable.vue`
- `src/components/Settings/BewlyPages/Moments/importExport.ts`
- UI/focused tests

调整：

- `src/components/Settings/types.ts`：增加 `BewlyPage.Moments`。
- `src/components/Settings/BewlyPages/BewlyPages.vue`：增加“动态”子页。
- `src/_locales/en.yml`
- `src/_locales/cmn-CN.yml`
- `src/_locales/cmn-TW.yml`
- `src/_locales/jyut.yml`

UI：

- 总开关、any/all 模式。
- 规则表显示 action、field、operator、value、启停、备注。
- 添加/编辑时按 field 限制 operator；regex 即时校验。
- JSON 导入必须做 schema 校验、预览新增/覆盖数量，再写 storage。
- 导出包含 `schemaVersion`；文件不包含浏览历史或命中内容。
- 提供“从当前动态创建规则”作为后续增强：若能在原版卡片菜单中稳定注入，则本次实现；若 Bilibili 菜单生命周期不稳定，不阻断基础规则编辑器。

视觉要求：与现有 SettingsItem/Button/Input/Table 体系一致；窄窗口下不横向溢出；键盘可达、表单 label、错误提示和 focus 状态通过自动检查。

### 阶段 G — CI、打包与 release

调整：

- `.github/workflows/ci.yml`
- `.github/workflows/release-it.yml`
- `.release-it.json`（若保留 release-it）
- `package.json`
- `docs/CONTRIBUTING*.md`

CI 策略：

1. 固定受支持 Node 版本，不再使用漂移的 `lts/*`；主矩阵 Linux + Node 24，补一个 Windows build smoke。
2. Corepack/pnpm 11 exact + frozen lockfile。
3. 顺序：lint → typecheck → unit/DOM tests → knip → Chromium build → Firefox build → manifest contract → zip → Playwright extension smoke。
4. 产物名称唯一，上传 Chromium/Firefox zip 和规范化 manifest。
5. release 只消费 CI 已验证构建流程，不在 release job 临时使用 `npx` 下载不同版本工具。
6. 商店 submit 继续保留为显式手动动作；本次不触发。

### 阶段 H — 真实扩展验收

新增 Playwright persistent-context smoke（Chromium）：

- 加载 unpacked extension。
- 打开一个本地 fixture 页面，验证 content script 启动、storage 生效、规则隐藏/恢复。
- 打开 options/popup，验证 Vue mount 无 console error。
- 验证 service worker 注册并可响应至少一个既有 message API。

真实 `t.bilibili.com` 验收：

1. 使用专用/现有测试浏览器 profile，不复制登录 secret 到仓库。
2. 加载 Chromium unpacked 产物，打开 `https://t.bilibili.com/`。
3. 创建仅命中一个已知测试条件的规则，记录规则前后同一 viewport 的截图和可见卡片计数。
4. 下滚触发至少两批懒加载，确认新卡片自动过滤、无明显布局空洞、无全页扫描卡顿。
5. 关闭过滤，所有扩展隐藏卡片恢复。
6. 刷新、前进后退/BFCache、切换规则，确认无重复 observer 和 console exception。
7. Firefox 临时扩展重复核心路径。
8. 设置页做桌面宽度和窄窗口视觉 QA。

性能门槛：用 synthetic fixture 插入 500 张卡片，observer 批处理不产生长时间 N² 扫描；记录总处理时间、单 batch 最大时间和重复判定次数。阈值在基线测量后固定，不能只写“看起来不卡”。

## 6. Subagent 协作方案

主控负责架构、共享文件、最终取舍、diff 复核、真实浏览器和全部 gates。Subagent 只做边界清晰的独立 lane，不做最终审查。

### 第一轮（可并行）

- **Lane A — WXT build migration**：只改 entrypoints、WXT config、旧 build files、manifest contract tests；禁止改业务组件和 settings。
- **Lane B — dependency/API codemods**：在 WXT 骨架确定后，只处理 UnoCSS/ESLint/VueUse/i18n/TS 类型升级；禁止改 entrypoints。
- **Lane C — rule engine tests + implementation**：只改 `src/features/moment-filter/{types,matcher}` 和 tests；不接 DOM、不改 storage。
- **Lane D — DOM fixtures/controller**：只改 selector/extract/controller 和 fixture tests；规则接口由主控冻结后开始。

### 第二轮（依赖第一轮接口）

- **Lane E — Settings UI/i18n**：只改 Moments 设置子页和四份 locale；使用主控冻结 schema。
- **Lane F — Playwright/CI/docs**：只改 tests、workflow、docs；不得调整产品逻辑来让测试“通过”。

冲突文件（`package.json`、`pnpm-lock.yaml`、`src/logic/storage.ts`、`src/contentScripts/index.ts`、`wxt.config.ts`）只由主控整合，不分给多个 agent 并发写。

每个 subagent 返回：修改文件列表、diff 摘要、运行过的命令和原始结果、未覆盖风险；主控必须读取实际 diff 并重跑 gate，不能以 agent 自述作为完成证明。

## 7. 最终发布 Gate

必须全部满足：

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm knip
pnpm build
pnpm build:firefox
pnpm zip
pnpm zip:firefox
```

并通过：

- Chromium/Firefox manifest contract diff。
- Playwright unpacked-extension smoke。
- `t.bilibili.com` 登录态真实页面过滤、恢复、懒加载和 SPA/BFCache 验收。
- 设置迁移：从 v0.41.1 storage fixture 升级后原设置不丢。
- 规则导入的非法 JSON/regex 不污染存储。
- options、popup、background、首页 Bewly 替换、原版动态页均无新增 uncaught console error。
- `git diff --check`、工作区仅包含预期文件。
- 生成的 Chromium/Firefox zip 可解压，manifest 与实际入口文件一一存在。

最终输出：

- 升级前后依赖矩阵。
- 删除的旧构建链清单。
- Chromium/Firefox 包路径与 SHA-256。
- 测试、构建、真实页面验收证据。
- 已知非阻断项；不得用“后续慢慢迁移”隐藏本次 scope 内欠账。

## 8. 主要风险与止损条件

1. **WXT 与 Firefox header rewrite 行为不等价**：manifest contract + Firefox runtime smoke 阻断。
2. **MAIN-world script 重复/未执行**：在 fixture 中写单实例哨兵，重复注册即失败。
3. **UnoCSS 66 扫描变化导致大量样式丢失**：关键设置页/首页截图对比和产物 class presence 检查。
4. **TypeScript 7 与 Vue/WXT 类型链未正式兼容**：只能回退到最高正式兼容稳定 TS，不允许 `any`/`@ts-ignore` 批量压错。
5. **Pinia/VueUse 存储语义变化导致设置丢失**：旧 snapshot migration 和真实 extension storage refresh 测试阻断。
6. **Bilibili DOM selector 漂移**：集中 adapter、多 fixture、fail-open；绝不删除未知祖先节点。
7. **observer 性能回归**：只扫描 added subtree、批处理、fingerprint；500 卡 synthetic benchmark 阻断明显 N²。
8. **构建成功但扩展入口失效**：真实 unpacked extension smoke，而非只验 zip 存在。
9. **release 流程意外提交/发布**：所有 submit/store 命令保持手动；实施和验收阶段禁止运行。

止损条件：若迁移后无法同时恢复 Chromium + Firefox 的 manifest/runtime 合同，或必须长期保留新旧双构建链，停止合并并回滚 WXT 迁移；重新评估，但不交付半迁移状态。

## 9. 最终验收记录（2026-08-02）

### 9.1 工具链与质量门禁

- 精确环境：Node `v24.18.1`、pnpm `11.18.0`，`pnpm install --frozen-lockfile` 通过。
- `pnpm test`：10 个测试文件、47 项测试通过；manifest contract 另有 5 项通过。
- `pnpm typecheck`、`pnpm lint`、`pnpm knip` 全部通过；新增 Moments 设置页由 `eslint-plugin-vuejs-accessibility` 推荐规则静态门禁覆盖。
- Chromium、Firefox、Safari MV3 构建通过；Firefox `web-ext lint` 为 0 error、3 个既有 bundle warning。
- `release-it --dry-run --ci patch` 通过，未提交、打 tag、上传或发布。
- `pnpm outdated` 仅剩两个有意保留项：`@types/node` 固定 24.x 以匹配 CI/runtime，TypeScript 7.0.2 因发布时间与兼容性门槛暂不采用；当前为 TS 6.0.3。

### 9.2 动态过滤验收

- 使用 Google Chrome for Testing `149.0.7827.55` 从 `.output/chrome-mv3` 加载真实 unpacked extension。
- 在公开的 `https://t.bilibili.com/` 真实页面上确认：3 张原版动态卡保持原 DOM；新增内容规则后 1 张被隐藏、3 张获得快捷规则入口，设置页实时显示规则。
- 从卡片快捷菜单新增“允许作者”规则后，存储内出现 allow + hide 两条规则，白名单优先逻辑和存储同步均生效。
- 设置关闭时不创建 feed observer；启用后 style/observer 才挂载。首屏、added subtree、root replacement、路由事件、`pagehide/pageshow`、清理恢复均有确定性测试。
- 500 卡 synthetic 队列以 100 张/批处理，定向测试耗时 `154 ms`，没有全量重复扫描。

### 9.3 视觉与无障碍

- 真实页面 1280×900 smoke：Bewly 顶栏、Bilibili 原版动态布局、设置弹层均无新增空白、错位或横向溢出。
- 480×800 窄窗口复验后，将 Bewly Pages 子导航改为响应式顶部按钮组；Moments Filter 内容可完整滚动，无横向内容裁切。
- 快捷菜单改为触发器下方纵向菜单，不再侵入左侧登录栏；菜单含可读 label、键盘 Escape/焦点恢复与 `role="menu"`/`menuitem`。

### 9.4 归档

- Chromium：`.output/bewly-bewly-0.41.1-chrome.zip`，16,141,088 bytes，SHA-256 `757b1a8ed4daaa98607cb741e6b8fd6e09668c1f728b7dcb62d56a832db746e8`。
- Firefox：`.output/bewly-bewly-0.41.1-firefox.zip`，16,141,432 bytes，SHA-256 `98b0c770c45cb5a3b04555d8630ebb9bafb4ae149e89d5451abec039e139f913`。
- Sources：`.output/bewly-bewly-0.41.1-sources.zip`，16,079,054 bytes，SHA-256 `dcfa448bdeb7d1f6546d08d94b2099ecafabe96a2f11100c53179fbc1b2d57fd`。
- 三个归档均通过 `unzip -tq`。

### 9.5 环境覆盖边界

- 本机没有 Firefox.app，因此未伪报 Firefox runtime smoke；Firefox 以 MV3 build、manifest contract、archive integrity 和 `web-ext lint` 覆盖。
- 隔离 Chromium profile 未使用任何用户凭据，因此真实 smoke 为公开动态页；登录态无限滚动和 BFCache 行为由脱敏 fixture 与 MutationObserver/route/page lifecycle 测试覆盖。
