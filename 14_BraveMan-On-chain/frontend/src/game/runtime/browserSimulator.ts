import type { EndReason, InputEvent, InputSource, PlayerPose, SessionHandshake, SessionStats, WeaponType } from '../types'
import { bravemanRuleset as ruleset, clampPointToRect, enemyCombatRect, playerCombatRect } from '../arenaBounds'
import { countToggleStepsToWeapon, getNextWeapon } from '../weaponCycle'

/** 敌人类型需与后端 `braveman-core` 保持一致。 */
type EnemyKind = 'chaser' | 'charger'
/** 冲锋怪状态机：追击 -> 蓄力提示 -> 冲锋。 */
type ChargerPhase =
  | { kind: 'chase' }
  | { kind: 'tell'; remaining: number; dirX: number; dirY: number }
  | { kind: 'charge'; remaining: number; dirX: number; dirY: number }

/** 运行时敌人实体：既是渲染输入，也是后端重放的一致性来源。 */
type EnemyState = {
  id: number
  kind: EnemyKind
  x: number
  y: number
  phase: ChargerPhase
  cooldown: number
}

/** 箭矢对象池里的单个投射物状态；`active=false` 表示当前槽位可复用。 */
type ProjectileState = {
  id: number
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
}

/** 每一帧暴露给 Phaser 渲染层和调试桥的只读快照。 */
export type BrowserFrameSnapshot = {
  tick: number
  playerX: number
  playerY: number
  playerFacingX: number
  playerPose: PlayerPose
  activeWeapon: WeaponType
  kills: number
  survivalMs: number
  goldEarned: number
  targetId: number | null
  projectileCount: number
  enemyCount: number
  enemies: Array<EnemyState>
  projectiles: Array<ProjectileState>
}

/** 固定 tick 频率是“前端模拟与后端重放一致”的前提。 */
const TICKS_PER_SECOND = 60
const PLAYER_SPEED = 300
const CHASER_SPEED = 118
const CHARGER_SPEED = 280
const CHARGER_TELL_TICKS = 30
const CHARGER_CHARGE_TICKS = 18
const CHARGER_IDLE_COOLDOWN_TICKS = 84
const SPAWN_SAFE_DISTANCE = 220
const BASE_SPAWN_INTERVAL_TICKS = 54
const MIN_SPAWN_INTERVAL_TICKS = 18

/** 以下参数统一换算到 tick 口径，确保前端模拟与后端 replay 使用同一时间单位。 */
const SWORD_COOLDOWN_TICKS = Math.round(ruleset.sword_cooldown_ms * TICKS_PER_SECOND / 1000)
const HOOK_SPEAR_COOLDOWN_TICKS = Math.round(ruleset.hook_spear_cooldown_ms * TICKS_PER_SECOND / 1000)
const BOW_COOLDOWN_TICKS = Math.round(ruleset.bow_cooldown_ms * TICKS_PER_SECOND / 1000)
/** 以下半径/偏移量直接驱动碰撞判定与投射物出生位置。 */
const playerRadius = ruleset.player_radius
const enemyRadius = ruleset.enemy_radius
const projectileRadius = ruleset.projectile_radius
const bowSpawnOffset = ruleset.bow_spawn_offset
const swordCleaveHalfWidth = ruleset.sword_cleave_half_width
const hookSpearSweepHalfWidth = ruleset.hook_spear_sweep_half_width

/** 简单可复现的伪随机数发生器；给定 seed 后必须逐帧稳定。 */
class Lcg {
  private state: bigint
  /** 使用 64 位线性同余随机数初始化状态，保证 seed=0 时仍可运行。 */
  constructor(seed: bigint | string) {
    const normalized = BigInt.asUintN(64, typeof seed === 'bigint' ? seed : BigInt(seed))
    this.state = normalized === 0n ? 1n : normalized
  }

  /** 生成一个伪随机 u32 值。 */
  nextU32() {
    this.state = (this.state * 6364136223846793005n + 1n) & ((1n << 64n) - 1n)
    return Number((this.state >> 32n) & 0xffffffffn)
  }

  /** 生成 [0, 1] 区间的伪随机浮点数。 */
  nextFloat() {
    return this.nextU32() / 0xffffffff
  }

  /** 生成伪随机布尔值。 */
  nextBool() {
    return (this.nextU32() & 1) === 1
  }
}

/** 计算二维平面两点距离。 */
const distance = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by)
/** 向量归一化，返回 (单位向量x, 单位向量y, 原始长度)。 */
const normalize = (x: number, y: number): [number, number, number] => {
  const magnitude = Math.hypot(x, y)
  if (magnitude <= Number.EPSILON) return [0, 0, 0]
  return [x / magnitude, y / magnitude, magnitude]
}

/**
 * 浏览器侧确定性战斗模拟器。
 * 它把输入日志、刷怪、命中和结算都收敛到同一套规则，供后端 verify 重放校验。
 */
export class BrowserSimulator {
  /** 由后端下发的局级上下文（sessionId/seed/rulesetMeta）。 */
  private readonly session: SessionHandshake
  private tick = 0
  /** 所有随机出生与敌人构成都只能从这里取值，避免不可重放的随机源。 */
  private rng: Lcg
  private playerX = ruleset.arena_width / 2
  private playerY = ruleset.arena_height / 2
  private facingX = 1
  private activeWeapon: WeaponType = 'sword'
  private attackCooldown = 0
  private attackPoseTicks = 0
  private playerPose: PlayerPose = 'sword_idle'
  private enemies: EnemyState[] = []
  /** 箭矢对象池：通过复用槽位减少长局中的分配抖动。 */
  private projectiles: ProjectileState[] = Array.from({ length: ruleset.projectile_pool_capacity }, (_, index) => ({
    id: index,
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
  }))
  private moveX: -1 | 0 | 1 = 0
  private moveY: -1 | 0 | 1 = 0
  private nextEnemyId = 1
  /** 投射物逻辑 id 独立递增，便于渲染层判断“新箭矢”与旧槽位复用。 */
  private nextProjectileId = ruleset.projectile_pool_capacity
  /** 非空表示本局结束，后续 update 将短路。 */
  private ended: EndReason | null = null
  private kills = 0
  private goldEarned = 0
  private currentTargetId: number | null = null
  /** 是否已拥有霜翎逐月，会同时影响武器循环和开局武器状态。 */
  private hasBowUnlocked: boolean
  /** 可提交后端 verify 的输入日志。 */
  private logs: InputEvent[] = []
  private inputSource: InputSource = 'keyboard'

  /** 使用 session 初始化本地模拟器，用于与后端 replay 规则对齐。 */
  constructor(session: SessionHandshake) {
    this.session = session
    this.rng = new Lcg(session.seed)
    this.hasBowUnlocked = session.bowUnlocked
  }

  /** 获取当前帧快照，供渲染层消费。 */
  getSnapshot(): BrowserFrameSnapshot {
    return {
      tick: this.tick,
      playerX: this.playerX,
      playerY: this.playerY,
      playerFacingX: this.facingX,
      playerPose: this.playerPose,
      activeWeapon: this.activeWeapon,
      kills: this.kills,
      survivalMs: Math.floor((this.tick * 1000) / TICKS_PER_SECOND),
      goldEarned: this.goldEarned,
      targetId: this.currentTargetId,
      projectileCount: this.projectiles.filter((item) => item.active).length,
      enemyCount: this.enemies.length,
      enemies: this.enemies.map((enemy) => ({ ...enemy })),
      projectiles: this.projectiles.filter((item) => item.active).map((item) => ({ ...item })),
    }
  }

  /** 获取本局结算结果；未结束时返回 null。 */
  getResult(): SessionStats | null {
    if (!this.ended) return null
    return {
      sessionId: this.session.sessionId,
      rulesetVersion: this.session.rulesetVersion,
      configHash: this.session.configHash,
      kills: this.kills,
      survivalMs: Math.floor((this.tick * 1000) / TICKS_PER_SECOND),
      goldEarned: this.goldEarned,
      endReason: this.ended,
      inputSource: this.inputSource,
      logs: [...this.logs],
    }
  }

  /** 设置玩家输入方向，并记录输入日志。 */
  setMovement(x: -1 | 0 | 1, y: -1 | 0 | 1, source: InputSource) {
    // 相同输入不重复写日志，避免日志噪音。
    if (this.moveX === x && this.moveY === y) return
    this.moveX = x
    this.moveY = y
    this.inputSource = source
    this.logs.push({ kind: 'move', tick: this.tick, x, y })
  }

  /** 按当前可用武器循环切换。 */
  toggleWeapon() {
    this.activeWeapon = getNextWeapon(this.activeWeapon, this.hasBowUnlocked)
    this.logs.push({ kind: 'toggle_weapon', tick: this.tick })
  }

  /** 通过计算切换步数，切到指定武器。 */
  equipWeapon(weapon: WeaponType) {
    // 统一复用 toggleWeapon，确保日志语义与玩家手动切换一致。
    const steps = countToggleStepsToWeapon(this.activeWeapon, weapon, this.hasBowUnlocked)
    for (let index = 0; index < steps; index += 1) {
      this.toggleWeapon()
    }
  }

  /** 解锁并装备霜翎逐月；若已解锁则直接切到霜翎逐月。 */
  unlockBowAndEquip() {
    if (!this.hasBowUnlocked) {
      this.hasBowUnlocked = true
      this.logs.push({ kind: 'unlock_bow', tick: this.tick })
      this.activeWeapon = 'bow'
      return
    }
    this.equipWeapon('bow')
  }

  /** 记录暂停事件。 */
  pause() {
    this.logs.push({ kind: 'pause', tick: this.tick })
  }

  /** 记录恢复事件。 */
  resume() {
    this.logs.push({ kind: 'resume', tick: this.tick })
  }

  /** 主动撤离并结束本局。 */
  retreat() {
    if (this.ended) return
    this.ended = 'retreat'
    this.logs.push({ kind: 'retreat', tick: this.tick })
    this.playerPose = 'death'
  }

  /** 调试用途：直接触发死亡结束。 */
  forceDeath() {
    if (this.ended) return
    this.ended = 'death'
    this.playerPose = 'death'
  }

  /** 推进一步模拟：移动、刷怪、自动攻击、碰撞结算与姿态更新。 */
  update() {
    if (this.ended) return
    this.tick += 1
    this.updatePlayerMovement()
    this.spawnIfNeeded()
    this.updateEnemies()
    this.resolveAutoAttack()
    this.updateProjectiles()
    this.resolveContactDeath()
    this.updatePose()
    this.attackCooldown = Math.max(0, this.attackCooldown - 1)
    this.attackPoseTicks = Math.max(0, this.attackPoseTicks - 1)
    // 清理离场实体，避免长局下数组无限增长。
    this.enemies = this.enemies.filter((enemy) => enemy.x >= -120 && enemy.x <= ruleset.arena_width + 120 && enemy.y >= -80 && enemy.y <= ruleset.arena_height + 80)
  }

  /** 根据输入更新玩家位置，并限制在可活动矩形内。 */
  private updatePlayerMovement() {
    let dx = this.moveX
    let dy = this.moveY
    const magnitude = Math.hypot(dx, dy)
    if (magnitude > 1) {
      // 斜向输入归一化，避免斜走速度比直走更快。
      dx = (dx / magnitude) as -1 | 0 | 1
      dy = (dy / magnitude) as -1 | 0 | 1
    }
    if (Math.abs(dx) > 0.01) this.facingX = Math.sign(dx)
    const nextPosition = clampPointToRect(
      this.playerX + dx * PLAYER_SPEED / TICKS_PER_SECOND,
      this.playerY + dy * PLAYER_SPEED / TICKS_PER_SECOND,
      playerCombatRect,
    )
    this.playerX = nextPosition.x
    this.playerY = nextPosition.y
  }

  /** 按时间节奏刷新怪物并保证出生与玩家有安全距离。 */
  private spawnIfNeeded() {
    const elapsedSec = Math.floor(this.tick / TICKS_PER_SECOND)
    // 每 6 秒略微加快刷怪节奏，直到触达最小间隔，形成平滑增压。
    const reduction = Math.min(Math.floor(elapsedSec / 6), BASE_SPAWN_INTERVAL_TICKS - MIN_SPAWN_INTERVAL_TICKS)
    const interval = Math.max(MIN_SPAWN_INTERVAL_TICKS, BASE_SPAWN_INTERVAL_TICKS - reduction)
    if (this.tick % interval !== 0) return

    const sideLeft = this.rng.nextBool()
    // 敌人构成：约 25% 冲锋怪，75% 追击怪。
    const kind: EnemyKind = this.rng.nextFloat() < 0.25 ? 'charger' : 'chaser'
    let y = enemyCombatRect.top + this.rng.nextFloat() * enemyCombatRect.height
    if (Math.abs(y - this.playerY) < SPAWN_SAFE_DISTANCE * 0.5) {
      y = y < this.playerY
        ? Math.max(enemyCombatRect.top, y - SPAWN_SAFE_DISTANCE)
        : Math.min(enemyCombatRect.bottom, y + SPAWN_SAFE_DISTANCE)
    }
    this.enemies.push({
      id: this.nextEnemyId++,
      kind,
      x: sideLeft ? enemyCombatRect.left : enemyCombatRect.right,
      y,
      phase: { kind: 'chase' },
      cooldown: CHARGER_IDLE_COOLDOWN_TICKS,
    })
  }

  /** 更新所有怪物 AI 状态与位移。 */
  private updateEnemies() {
    for (const enemy of this.enemies) {
      if (enemy.kind === 'chaser') {
        const [dx, dy] = normalize(this.playerX - enemy.x, this.playerY - enemy.y)
        enemy.x += dx * CHASER_SPEED / TICKS_PER_SECOND
        enemy.y += dy * CHASER_SPEED / TICKS_PER_SECOND
        const clamped = clampPointToRect(enemy.x, enemy.y, enemyCombatRect)
        enemy.x = clamped.x
        enemy.y = clamped.y
        continue
      }

      // cooldown 控制冲锋触发节奏，避免连续冲刺压死玩家。
      enemy.cooldown = Math.max(0, enemy.cooldown - 1)
      if (enemy.phase.kind === 'chase') {
        const [dx, dy, distanceToPlayer] = normalize(this.playerX - enemy.x, this.playerY - enemy.y)
        if (enemy.cooldown === 0 && distanceToPlayer < 260) {
          enemy.phase = { kind: 'tell', remaining: CHARGER_TELL_TICKS, dirX: dx, dirY: dy }
        } else {
          enemy.x += dx * (CHASER_SPEED * 0.8) / TICKS_PER_SECOND
          enemy.y += dy * (CHASER_SPEED * 0.8) / TICKS_PER_SECOND
        }
        const clamped = clampPointToRect(enemy.x, enemy.y, enemyCombatRect)
        enemy.x = clamped.x
        enemy.y = clamped.y
        continue
      }

      if (enemy.phase.kind === 'tell') {
        enemy.phase.remaining -= 1
        if (enemy.phase.remaining <= 0) {
          enemy.phase = { kind: 'charge', remaining: CHARGER_CHARGE_TICKS, dirX: enemy.phase.dirX, dirY: enemy.phase.dirY }
        }
        continue
      }

      enemy.x += enemy.phase.dirX * CHARGER_SPEED / TICKS_PER_SECOND
      enemy.y += enemy.phase.dirY * CHARGER_SPEED / TICKS_PER_SECOND
      enemy.phase.remaining -= 1
      if (enemy.phase.remaining <= 0) {
        enemy.cooldown = CHARGER_IDLE_COOLDOWN_TICKS
        enemy.phase = { kind: 'chase' }
      }
      const clamped = clampPointToRect(enemy.x, enemy.y, enemyCombatRect)
      enemy.x = clamped.x
      enemy.y = clamped.y
    }
  }

  /** 自动攻击逻辑：根据当前武器执行近战清扫或发射箭矢。 */
  private resolveAutoAttack() {
    const targetIndex = this.findTargetIndex()
    if (targetIndex === -1) {
      this.currentTargetId = null
      return
    }

    const target = this.enemies[targetIndex]
    this.currentTargetId = target.id
    const facing = Math.sign(target.x - this.playerX)
    if (facing !== 0) this.facingX = facing
    // 冷却中不触发新攻击，但仍保留目标锁定信息供 UI 显示。
    if (this.attackCooldown > 0) return

    if (this.activeWeapon === 'sword') {
      const defeatedIds = this.enemies.filter((enemy) => {
        return isEnemyInSwordSweep(
          enemy.x - this.playerX,
          enemy.y - this.playerY,
          this.facingX,
          ruleset.sword_range,
          swordCleaveHalfWidth,
        )
      }).map((enemy) => enemy.id)
      if (defeatedIds.length === 0) return
      // 近战命中按集合一次结算，可同时击败多个敌人。
      this.enemies = this.enemies.filter((enemy) => {
        if (defeatedIds.includes(enemy.id)) {
          this.kills += 1
          this.goldEarned += enemy.kind === 'charger' ? ruleset.charger_gold : ruleset.chaser_gold
          return false
        }
        return true
      })
      this.attackCooldown = SWORD_COOLDOWN_TICKS
      this.attackPoseTicks = 15
      return
    }

    if (this.activeWeapon === 'hook_spear') {
      const defeatedIds = this.enemies.filter((enemy) => {
        return isEnemyInHookSpearSweep(
          enemy.x - this.playerX,
          enemy.y - this.playerY,
          this.facingX,
          ruleset.hook_spear_range,
          hookSpearSweepHalfWidth,
        )
      }).map((enemy) => enemy.id)
      if (defeatedIds.length === 0) return
      // 金钩裂甲同样支持一次清扫多个目标。
      this.enemies = this.enemies.filter((enemy) => {
        if (defeatedIds.includes(enemy.id)) {
          this.kills += 1
          this.goldEarned += enemy.kind === 'charger' ? ruleset.charger_gold : ruleset.chaser_gold
          return false
        }
        return true
      })
      this.attackCooldown = HOOK_SPEAR_COOLDOWN_TICKS
      this.attackPoseTicks = 14
      return
    }

    const [dirX, dirY, dist] = normalize(target.x - this.playerX, target.y - this.playerY)
    if (dist > ruleset.bow_range) return
    // 远程攻击使用投射物对象池，避免频繁创建/销毁对象。
    const projectile = this.projectiles.find((item) => !item.active)
    if (!projectile) return
    projectile.active = true
    projectile.id = this.nextProjectileId++
    projectile.x = this.playerX + this.facingX * bowSpawnOffset
    projectile.y = this.playerY
    projectile.vx = dirX * ruleset.bow_speed / TICKS_PER_SECOND
    projectile.vy = dirY * ruleset.bow_speed / TICKS_PER_SECOND
    this.attackCooldown = BOW_COOLDOWN_TICKS
    this.attackPoseTicks = 12
  }

  /** 更新箭矢飞行并处理命中结算。 */
  private updateProjectiles() {
    for (const projectile of this.projectiles) {
      if (!projectile.active) continue
      projectile.x += projectile.vx
      projectile.y += projectile.vy
      if (projectile.x < -80 || projectile.x > ruleset.arena_width + 80 || projectile.y < -80 || projectile.y > ruleset.arena_height + 80) {
        projectile.active = false
        continue
      }
      // 碰撞判定使用圆形近似：`敌人半径 + 投射物半径`。
      const hitIndex = this.enemies.findIndex((enemy) => distance(projectile.x, projectile.y, enemy.x, enemy.y) <= enemyRadius + projectileRadius)
      if (hitIndex >= 0) {
        const [enemy] = this.enemies.splice(hitIndex, 1)
        this.kills += 1
        this.goldEarned += enemy.kind === 'charger' ? ruleset.charger_gold : ruleset.chaser_gold
        projectile.active = false
      }
    }
  }

  /** 玩家与怪物接触即判定死亡。 */
  private resolveContactDeath() {
    const dead = this.enemies.some((enemy) => distance(this.playerX, this.playerY, enemy.x, enemy.y) <= playerRadius + enemyRadius)
    if (dead) {
      // 触碰成功后立即终局，保持“零容错”生存规则。
      this.ended = 'death'
      this.playerPose = 'death'
    }
  }

  /** 按状态机决定当前角色姿态（idle/move/attack/death）。 */
  private updatePose() {
    if (this.ended) {
      this.playerPose = 'death'
      return
    }
    if (this.attackPoseTicks > 0) {
      this.playerPose = this.activeWeapon === 'sword'
        ? 'sword_attack'
        : this.activeWeapon === 'hook_spear'
          ? 'hook_spear_attack'
          : 'bow_attack'
      return
    }
    const moving = this.moveX !== 0 || this.moveY !== 0
    if (this.activeWeapon === 'sword') {
      this.playerPose = moving ? 'sword_move' : 'sword_idle'
      return
    }
    if (this.activeWeapon === 'hook_spear') {
      this.playerPose = moving ? 'hook_spear_move' : 'hook_spear_idle'
      return
    }
    this.playerPose = moving ? 'bow_move' : 'bow_idle'
  }

  /** 在武器有效范围内选择最近敌人为目标。 */
  private findTargetIndex() {
    const range = this.activeWeapon === 'sword'
      ? ruleset.sword_range
      : this.activeWeapon === 'hook_spear'
        ? ruleset.hook_spear_range
        : ruleset.bow_range
    // 目标策略：仅按距离最近，不加入仇恨或威胁权重。
    let winner = -1
    let bestDistance = Number.POSITIVE_INFINITY
    this.enemies.forEach((enemy, index) => {
      const dist = distance(this.playerX, this.playerY, enemy.x, enemy.y)
      if (dist <= range && dist < bestDistance) {
        winner = index
        bestDistance = dist
      }
    })
    return winner
  }
}

/** 判断敌人是否落在玄火镇岳扇形清扫范围内。 */
const isEnemyInSwordSweep = (
  deltaX: number,
  deltaY: number,
  facingX: number,
  swordRange: number,
  cleaveHalfWidth: number,
) => {
  const forward = deltaX * facingX
  if (forward < 0 || forward > swordRange) return false
  const lateral = deltaY
  return Math.abs(lateral) <= cleaveHalfWidth
}

/** 判断敌人是否落在金钩裂甲横向扫击范围内。 */
const isEnemyInHookSpearSweep = (
  deltaX: number,
  deltaY: number,
  facingX: number,
  hookSpearRange: number,
  sweepHalfWidth: number,
) => {
  const forward = deltaX * facingX
  if (forward < 0 || forward > hookSpearRange) return false
  return Math.abs(deltaY) <= sweepHalfWidth
}
