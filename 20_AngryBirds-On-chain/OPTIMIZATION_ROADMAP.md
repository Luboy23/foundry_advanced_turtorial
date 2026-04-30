# 20_AngryBirds-On-chain optimization roadmap

> 文档角色：当前项目的优化路线图与执行顺序  
> 当前口径：以 `2026-04-17` 本轮代码审查结果为准

## 1. 目标与使用方式

这份路线图把当前项目最值得投入的优化工作拆成 `P0 / P1 / P2`
三个优先级。你可以把它当成后续迭代的主执行清单，而不是单纯的
建议汇总。

路线图的设计原则如下：

- `P0` 先处理正确性、安全性、结算可靠性
- `P1` 再处理前后端状态流、性能与可维护性
- `P2` 最后处理扩展性、工程体验与长期演进

如果你只做一轮优化，先完成 `P0`。如果你准备做两轮或三轮迭代，
再继续推进 `P1` 和 `P2`。

## 2. 当前总体判断

当前项目的大方向已经成立，特别是以下几件事已经走在正确轨道上：

- 前端已经完成“开始即授权，关卡内免重复签名”的核心体验
- Rust backend 已经接入 session、验证、批量 relay 的主链路
- Solidity 合约已经具备 verified batch 与全局唯一最佳排行榜能力
- Phaser 玩法层已经具备较完整的证据采集与结算入口

当前最需要优化的，不是继续堆功能，而是把下面三类基础问题收紧：

1. 消除可以绕过 verifier 的写链入口
2. 把 backend 的 session / relay 流程改成真正可恢复的状态机
3. 把前端的状态作用域、去重与 orchestration 再做一次硬化

## 3. 优先级总览

### P0

`P0` 聚焦结果可信性与链路可靠性。这个阶段完成后，项目才能算进入
“结构稳定、可以继续叠体验”的状态。

- 移除或封闭合约里的直写提交入口
- 修复 backend session nonce 并发冲突风险
- 把 finalize / relay 改造成真正的异步状态机
- 补齐链路失败时的数据库状态与恢复策略

### P1

`P1` 聚焦前端状态流、API 调用质量、轮询策略与玩法层拆分。这个阶段
完成后，项目会更稳，也更容易继续加内容。

- 统一 run queue 的作用域与持久化键
- 把 run 去重从摘要指纹升级为 `evidenceHash / runId`
- 优化 API timeout、重试、错误分类与 observability
- 下调不必要的链上轮询频率
- 拆分 `App.tsx`、`AngryBirdsBridge`、`PlayScene.ts`

### P2

`P2` 聚焦协议一致性、测试深度和长期演进能力。这个阶段不是当前阻塞
项，但会决定项目后续扩展成本。

- 把 TS / Rust 的 evidence 协议常量统一成 shared protocol
- 为 backend 建立真正的集成测试层
- 继续优化排行榜、索引和事件消费能力
- 预留未来 `v2` 可信回放或 shared WASM validator 的演进路径

## 4. P0 路线图

### 4.1 关闭绕过 verifier 的直写入口

当前合约仍保留 `submitRun(...)`，这条路径会直接写历史和排行榜，
不会经过 session permit、verifier 签名或 backend 证据校验。

相关文件：

- `contracts/src/AngryBirdsScoreboard.sol`
- `contracts/test/AngryBirdsScoreboard.t.sol`
- `frontend/src/lib/contract.ts`
- `frontend/src/hooks/useAngryBirdsChainQueries.ts`

要怎么改：

1. 在 `AngryBirdsScoreboard.sol` 中移除 `submitRun(...)`，或者把它降级
   成只用于本地调试的 `onlyOwner` 入口。
2. 如果保留调试入口，必须明确改名，例如 `submitRunForDebug(...)`，
   避免和正式路径混淆。
3. 确认 `_recordRun(...)` 只会从 `submitVerifiedBatch(...)` 进入。
4. 更新合约测试，确保排行榜和历史只能被 verified batch 刷新。
5. 同步更新前端 ABI，删除不再使用的签名声明。

推荐顺序：

1. 先改 Solidity
2. 再跑 `forge test`
3. 再更新前端 ABI 和 contract helper
4. 最后重新部署本地链

验收标准：

- 任何普通地址都不能再绕过 backend 直接写排行榜
- smoke 流程仍可通过 `session -> upload -> finalize` 成功写链

### 4.2 修复 session nonce 并发冲突

当前 backend 的 session nonce 来自
`SELECT COALESCE(MAX(permit_nonce), 0) + 1`。如果同一玩家并发创建会话，
有概率得到相同 nonce，而链上 `SessionUsage` 是按 `player + nonce`
计数的。

相关文件：

- `backend/angrybirds-api/src/main.rs`
- `contracts/src/AngryBirdsScoreboard.sol`

要怎么改：

1. 在数据库里增加玩家 nonce 的唯一约束。
2. 把 nonce 分配改成事务内原子流程，不再采用“先查最大值再插入”的
   两步式做法。
3. 推荐新增一张计数表，例如 `player_session_counters`，字段最少包含：
   - `player`
   - `next_nonce`
   - `updated_at_ms`
4. `create_session(...)` 先在事务中锁定或更新该玩家的计数，再插入
   `game_sessions`。
5. 增加并发场景测试，验证同一玩家快速连点不会拿到相同 nonce。

推荐顺序：

1. 先补 DB schema
2. 再改 `create_session(...)`
3. 再补并发测试
4. 最后验证链上 `getSessionUsage(...)` 语义仍正确

验收标准：

- 同一玩家并发创建多个 session，不会共享 nonce
- 不会再出现不同 session 争用同一 `SessionUsage` 槽位

### 4.3 把 finalize / relay 改成真正的异步状态机

当前 `POST /api/sessions/:sessionId/finalize` 会在请求内直接执行
`process_session_batches(...)`，并等待链上 receipt。这样做简单，但不
利于失败恢复、重试退避和前端稳定反馈。

相关文件：

- `backend/angrybirds-api/src/main.rs`
- `frontend/src/lib/api.ts`
- `frontend/src/hooks/useAngryBirdsSubmissionFlow.ts`

要怎么改：

1. 把 `finalize_session(...)` 改成“只标记 finalize requested 并返回”。
2. 让后台 worker 负责扫描待 finalize session，然后执行真实 relay。
3. 把 `session_runs.status` 与 `relay_batches.status` 真正用起来，至少
   落地这些状态：
   - `validated`
   - `queued`
   - `submitted`
   - `confirmed`
   - `failed`
4. 在发交易前先写 `relay_batches` 为 `submitted`，拿到 tx hash 后保存
   `submitted_at_ms`。
5. 收到 receipt 后再切到 `confirmed`。
6. 如果交易失败或 RPC 出错，写入 `failed` 与 `fail_reason`，并由 worker
   按退避策略重试。
7. 前端 `fetchSessionStatus(...)` 需要能区分“已入队”和“已确认”，而不是
   只看到最终确认态。

推荐顺序：

1. 先补数据库状态字段和迁移
2. 再调整 worker 逻辑
3. 再收敛 HTTP handler 的语义
4. 最后调整前端状态文案与恢复逻辑

验收标准：

- finalize 接口不再长时间阻塞
- relayer 临时失败时，session 不会丢单
- 前端可以看到 `queued / submitted / confirmed / failed` 的真实过程

### 4.4 补齐失败恢复与观测字段

当前 backend 已经有 `last_error`、`fail_reason` 这些字段，但实际使用
还不够完整，排障成本仍然偏高。

相关文件：

- `backend/angrybirds-api/src/main.rs`
- `frontend/src/lib/api.ts`
- `frontend/src/hooks/useAngryBirdsSubmissionFlow.ts`

要怎么改：

1. 给每次 session 创建、run 上传、batch relay 生成 request id 或 batch
   correlation id。
2. 在日志中统一打印：
   - `session_id`
   - `player`
   - `permit_nonce`
   - `batch_id`
   - `run_id`
   - `tx_hash`
3. 把前端错误类型统一归类成：
   - 授权失效
   - backend 临时不可用
   - 证据校验失败
   - 链上提交失败
4. 在 `GET /status` 中继续保留 `lastError`，同时让它更接近真实失败原因。

推荐顺序：

1. 先补日志字段
2. 再补 API 错误分类
3. 最后统一前端错误提示文案

验收标准：

- 出现“同步失败”时，可以快速判断是 session、backend、RPC 还是链上问题

## 5. P1 路线图

### 5.1 让 run queue 真正按环境作用域隔离

当前进度已经按 `chainId + deploymentId + walletAddress` 隔离，但
`sessionStorage` 里的 run queue 仍使用单一全局 key。

相关文件：

- `frontend/src/features/progress/localStore.ts`
- `frontend/src/hooks/useAngryBirdsSubmissionFlow.ts`
- `frontend/src/App.tsx`

要怎么改：

1. 为 run queue 增加类似 progress 的 scoped key builder。
2. key 至少要包含：
   - `chainId`
   - `deploymentId`
   - `walletAddress`
3. `hydrateRunSyncState(...)`、`writeRunSyncSnapshot(...)`、
   `clearRunSyncSnapshot(...)` 全部改为基于 scope 读写。
4. `resetSyncState()` 只清当前 scope，不清全局。

推荐顺序：

1. 先改 `localStore.ts`
2. 再改 hook 调用方式
3. 最后补单测

验收标准：

- 不同钱包、不同 deployment、不同链之间的待同步数据不会互相覆盖

### 5.2 把 run 去重升级到 `evidenceHash / runId`

当前 `queueIncludesSummary(...)` 还是按摘要字段和时间戳做 fingerprint。
这对 UX 足够，但对协议语义不够强。

相关文件：

- `frontend/src/hooks/useAngryBirdsSubmissionFlow.ts`
- `frontend/src/game/replayHash.ts`
- `backend/angrybirds-core/src/lib.rs`

要怎么改：

1. 前端在 summary 生成后就稳定生成 `evidenceHash`。
2. 在绑定 session 后，前端可以进一步生成本地 `runId`，或者直接使用
   backend 返回的 `runId`。
3. queue 去重逻辑改为优先比较：
   - `runId`
   - 或 `evidenceHash + sessionId + levelVersion`
4. 删除旧 fingerprint 逻辑，避免未来多版本 evidence 产生误判。

推荐顺序：

1. 先整理数据结构
2. 再替换 queue 去重逻辑
3. 最后补恢复场景测试

验收标准：

- 不会把不同证据误判成同一条 run
- 页面刷新后，队列中的每一条 run 都有稳定标识

### 5.3 收紧前端 API 调用层

当前 API helper 使用裸 `fetch(...)`，缺少 timeout、abort、retry 与更细的
错误分类。

相关文件：

- `frontend/src/lib/api.ts`
- `frontend/src/hooks/useAngryBirdsSubmissionFlow.ts`

要怎么改：

1. 抽一个统一的 `requestJson(...)` helper。
2. 为所有请求增加 `AbortController` timeout。
3. 增加可重试错误分类，例如：
   - 网络超时
   - 502/503/504
   - fetch aborted
4. 非重试类错误直接透传原 message，例如：
   - session expired
   - validation failed
5. Optional：请求头加入 `x-request-id` 便于对齐 backend 日志。

推荐顺序：

1. 先抽通用 helper
2. 再改现有 API 方法
3. 最后收敛 hook 里的错误映射

验收标准：

- 前端不会因为一个长时间无响应的请求长期卡住状态机
- 网络抖动下的恢复体验更清晰

### 5.4 下调不必要的链上轮询

当前 catalog、leaderboard、history 使用同一轮询节奏。catalog 是近乎静态
数据，没有必要以 10 秒频率刷新。

相关文件：

- `frontend/src/hooks/useAngryBirdsChainQueries.ts`
- `frontend/src/App.tsx`

要怎么改：

1. catalog 改成长 `staleTime`，例如 5 分钟或只在页面加载时获取一次。
2. leaderboard 继续轮询，但可以改成 15 秒到 30 秒。
3. history 优先按 wallet 和 finalize 事件触发刷新，不必长时间高频轮询。
4. `invalidateChainData()` 改成更细粒度失效，而不是三类数据全部一起
   invalidate。

推荐顺序：

1. 先拆 query 策略
2. 再改 invalidate 粒度
3. 最后观察页面切换与 finalize 后的刷新效果

验收标准：

- RPC 压力下降
- 排行榜和历史仍能在用户视角及时刷新

### 5.5 拆分前端 orchestration 层

当前 `App.tsx` 已经承担过多职责，`AngryBirdsBridge` 与 `PlayScene.ts`
也都出现单文件继续膨胀的趋势。

相关文件：

- `frontend/src/App.tsx`
- `frontend/src/game/bridge.ts`
- `frontend/src/game/scenes/PlayScene.ts`

要怎么改：

1. 把 `App.tsx` 拆成三个逻辑层：
   - `useBridgeBindings`
   - `useGameplayStartGuard`
   - `useGameShellController`
2. 把 `AngryBirdsBridge` 按领域拆成多个子模块：
   - session
   - submission
   - wallet
   - chain panel
   - UI / menu
3. 把 `PlayScene.ts` 继续拆出下列控制器：
   - `EvidenceRecorder`
   - `HudController`
   - `BirdLifecycleController`
   - `DamageResolver`
   - `PauseMenuCoordinator`

推荐顺序：

1. 先拆 `App.tsx`
2. 再拆 `PlayScene.ts`
3. 最后收束 `bridge.ts`

验收标准：

- 单文件长度明显下降
- 每个模块的职责边界更清晰
- 单测更容易补齐

## 6. P2 路线图

### 6.1 建 shared protocol，统一 TS / Rust 协议定义

当前前端和 Rust backend 都各自维护 evidence hash、checkpoint cadence
和部分协议常量，未来很容易再出现“前端变了，后端没同步”的问题。

相关文件：

- `frontend/src/game/replayHash.ts`
- `frontend/src/game/scenes/PlayScene.ts`
- `backend/angrybirds-core/src/lib.rs`

要怎么改：

1. 抽出一层 protocol 文档或 shared schema。
2. 明确固定：
   - `checkpointIntervalMs`
   - `checkpointGapSlackMs`
   - `durationDriftSlackMs`
   - `evidenceHash` 的 canonical serialization 规则
   - `runId` 的生成规则
3. 如果后续继续强化可信性，可以把协议校验进一步下沉到 Rust/WASM
   shared validator。

推荐顺序：

1. 先写 protocol spec
2. 再统一实现
3. 最后补跨语言一致性测试

验收标准：

- TS 和 Rust 对同一份 evidence 计算出完全一致的 hash 和 runId

### 6.2 补 backend 集成测试层

当前 backend 主要逻辑集中在 `main.rs`，我没有看到独立的 API 集成测试。
这会让后续改 relay 或 DB 状态机时重构风险较高。

相关文件：

- `backend/angrybirds-api/src/main.rs`
- `backend/angrybirds-core/src/lib.rs`

要怎么改：

1. 先把 API crate 按模块拆分：
   - `config.rs`
   - `db.rs`
   - `models.rs`
   - `handlers.rs`
   - `relay.rs`
   - `errors.rs`
2. 为以下链路补测试：
   - `create -> activate -> upload -> finalize -> confirmed`
   - `upload when session expired`
   - `relay failure then retry`
3. 对 SQLite schema 和状态迁移补回归测试。

推荐顺序：

1. 先拆模块
2. 再补 happy-path 测试
3. 最后补 failure-path 测试

验收标准：

- backend 核心链路改动后可以靠测试快速回归验证

### 6.3 为排行榜与索引层预留扩展位

当前全局唯一最佳排行榜已经成立，但查询层仍主要依赖直接链上读。
如果后续要做分页、玩家资料、更多榜单维度，索引层会越来越有价值。

相关文件：

- `contracts/src/AngryBirdsScoreboard.sol`
- `frontend/src/hooks/useAngryBirdsChainQueries.ts`
- `backend/angrybirds-api/src/main.rs`

要怎么改：

1. 保留当前链上读作为真值口径。
2. Optional：为 `GlobalBestUpdated` 和 `VerifiedBatchSubmitted` 建一个轻量
   indexer。
3. 让前端先支持“直读链上”和“未来接索引层”的双实现切换点。

推荐顺序：

1. 先不阻塞 P0 / P1
2. 在玩法和结算稳定后再做

验收标准：

- 后续增加更多榜单维度时，不需要重写当前前端展示层

## 7. 推荐执行顺序

如果你准备按迭代推进，我建议采用下面的顺序：

1. 先完成 `P0.1`，封闭 `submitRun(...)`
2. 再完成 `P0.2`，修复 nonce 并发
3. 再完成 `P0.3` 与 `P0.4`，让 relay 状态机与失败恢复真正落地
4. 接着完成 `P1.1` 与 `P1.2`，修正前端 queue 作用域和去重语义
5. 再完成 `P1.3` 与 `P1.4`，优化 API 与链上轮询
6. 最后推进 `P1.5`，做前端结构拆分
7. 等整体稳定后，再进入 `P2`

## 8. 每轮迭代的最小验收建议

每推进一个优先级，至少做一次完整回归。推荐的最小验收如下：

- `forge test`
- `cargo test`
- `npm run test:unit`
- `npm run build`
- 本地手工验证：
  - 点击开始时只签一次
  - 连续通关多关不再额外签名
  - 返回首页后自动 finalize
  - 排行榜只保留每个钱包的一条最佳成绩
  - relayer 或 backend 临时失败时能恢复

## 9. 当前最值得立刻开工的三个任务

如果你要我继续直接落地，我最推荐立刻开始这三件事：

1. 封闭 `submitRun(...)` 并重部署本地合约
2. 重做 backend session nonce 分配与唯一约束
3. 把 finalize / relay 改造成真正的异步队列状态机

这三件事做完之后，项目的可信性、稳定性和后续扩展空间都会明显提升。
