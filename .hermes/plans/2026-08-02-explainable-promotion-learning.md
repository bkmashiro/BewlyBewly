# Explainable Promotion Learning Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 在现有原版动态 DOM 规则过滤上，增加本地、可解释、可撤销的推广学习、首次疑似推广折叠，以及过滤后的有效未读数；不使用 embedding，不修改 Bilibili 账号侧已读高水位。

**Architecture:** 保留 `moment-filter` 的独立版本化规则存储，新增第二个独立 `promotion-learning` 本地 storage 与纯分类器。DOM controller 先执行 allow 规则，再执行既有 hide 规则与推广分类；confirmed 自动折叠并计为扩展侧已读，suspected 显示可恢复的确认条。TopBar 只基于 `feed/nav` 返回的可用标题/作者/链接计算 Bewly 有效未读，不写 `bp_t_offset_*` 或调用账号副作用接口。

**Tech Stack:** WXT MV3、Vue 3、TypeScript 6、webextension-polyfill、Vitest/jsdom、pnpm 11、Node 24。

---

## Non-goals

- embedding、LLM 摘要、远程文本上传。
- 自动调用 Bilibili“不感兴趣”、封禁、取消关注或其他画像写入。
- 混合批次推进 Bilibili 全局已读 offset/cookie。
- 通用 inbox、全文搜索、键盘分拣、复杂统计、跨站广告拦截。
- 保存完整动态正文；学习库只保存用户确认的最小关键词、域名、作者 UID 与不可逆 fingerprint。

## Product contract

1. 明确商业 DOM 信号或已学习签名命中：`confirmed`，默认折叠，Bewly 有效未读不计数。
2. 仅启发式文本信号命中：`suspected`，显示紧凑折叠条；在用户确认前仍计入有效未读。
3. allow 规则始终优先，允许作者永不被推广分类自动折叠。
4. 用户可临时显示、标记正常、仅隐藏本条，或选择关键词加入学习库。
5. 作者作用域签名：author UID + 任一已选关键词/域名即命中；全局签名必须两个独立特征命中。
6. 禁用 Moments Filter、规则变化、SPA/BFCache、cleanup 后恢复原始 DOM。
7. TopBar 有效未读只调整 Bewly 展示，不改变 Bilibili 账号侧已读状态。

### Task 1: Promotion learning core

**Files:**
- Create: `src/features/moment-filter/promotion-learning.ts`
- Create: `src/features/moment-filter/promotion-storage.ts`
- Create: `src/tests/moment-promotion-learning.spec.ts`

**TDD cases:**
- strict schema decode fail-open；非法/未知字段恢复空库。
- 明确 commercial signal => confirmed + reason。
- author-scoped keyword/domain => confirmed。
- global signature requires two independent hits。
- heuristic-only candidate => suspected；普通“购买”单词不能触发。
- allow override 由 controller integration test 证明。
- suggestions 只返回短、去重、无 URL/mention 的候选；不保存正文。
- duplicate signature merge is idempotent。

**Gate:** `pnpm exec vitest run src/tests/moment-promotion-learning.spec.ts`、typecheck、scoped eslint、`git diff --check`。

### Task 2: Collapsed card and learning interaction

**Files:**
- Modify: `src/features/moment-filter/controller.ts`
- Modify: `src/features/moment-filter/quick-actions.ts`
- Modify: `src/features/moment-filter/index.ts`
- Modify: `src/features/moment-filter/extract.ts`
- Modify: `src/features/moment-filter/types.ts`
- Test: `src/tests/moment-filter-controller.spec.ts`
- Test: `src/tests/moment-filter-quick-actions.spec.ts`

**TDD cases:**
- confirmed hides card and injects one compact placeholder with reason/show action。
- suspected collapses but remains distinguishable and not local-read until confirmed。
- show-once restores card without deleting learned rule。
- normal action removes matching local signature and re-evaluates。
- selected text inside current card is preferred；otherwise show deterministic keyword chips。
- add-to-library writes author-scoped minimal signature and re-evaluates all cards。
- one delegated document click handler，不能每卡一个 global listener。
- allow rule bypasses both suspected and confirmed promotion paths。
- cleanup removes shells/listeners and restores all cards。

**Gate:** focused controller/quick-action tests + typecheck + scoped eslint。

### Task 3: Effective unread planner and TopBar integration

**Files:**
- Create: `src/features/moment-filter/effective-unread.ts`
- Create: `src/tests/moment-effective-unread.spec.ts`
- Modify: `src/components/TopBar/TopBar.vue`
- Modify: `src/components/TopBar/components/MomentsPop.vue`

**TDD cases:**
- all confirmed promotions => effective unread 0。
- mixed batch => count only normal + suspected；preserve their source order。
- allow rule restores item to effective unread。
- missing author/text/domain => fail-open count as unread。
- API failure falls back to existing `dynamic/entrance` count。
- planner never writes storage/cookie/network。

**Integration:** TopBar refresh may fetch a bounded `feed/nav` first page only when Moments Filter is enabled；不补页、不递归。无法证明覆盖全部 `update_num` 时 fail-open 使用原 count。

**Gate:** focused planner/component tests or source contract + full Vue typecheck/build。

### Task 4: Settings and localization

**Files:**
- Modify: `src/components/Settings/BewlyPages/Moments/Moments.vue`
- Modify: `src/locales/{en,cmn-CN,cmn-TW,jyut}.yml`
- Test: `src/tests/moment-filter-settings.spec.ts`

**UI:**
- learning library rows: author scope、keywords/domains、created time、delete。
- effective unread explanation and explicit statement: “只影响 Bewly 红点，不修改 Bilibili 已读状态”。
- no dashboard、no confidence slider、no raw fingerprint display。

**Gate:** locale parse、a11y scoped lint、focused settings test、narrow viewport visual smoke。

### Task 5: Final verification

1. `pnpm test`
2. `pnpm typecheck && pnpm lint && pnpm knip`
3. `pnpm build`
4. manifest contract
5. Chrome unpacked smoke on deterministic synthetic page: suspected collapse -> select keyword -> persisted signature -> confirmed auto-hide -> show/undo。
6. Real public `t.bilibili.com` fail-open smoke；无登录态不宣称有效未读账号 journey。
7. Independent post-fix review。
8. Signed commits, push, `pnpm zip`, SHA-256 + `unzip -tq`。
