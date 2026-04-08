import Phaser from 'phaser'
import { TypedEventBus } from '../events/TypedEventBus'
import { ENABLE_DEBUG_BRIDGE } from '../debugBridge'
import {
  ARROW_TEXTURE,
  ARROW_TRAIL_FRAMES,
  CHARGER_DEATH_FRAMES,
  CHARGER_MOVE_FRAMES,
  CHASER_DEATH_FRAMES,
  CHASER_MOVE_FRAMES,
  ENEMY_ANIM,
  HERO_ANIM,
  HERO_TEXTURES,
  SWORD_SLASH_FRAMES,
} from '../entities/assetKeys'
import { battlefieldRect, bravemanRuleset as ruleset, enemyCombatRect } from '../arenaBounds'
import { BrowserSimulator } from '../runtime/browserSimulator'
import type { GameCommandPayloads, GameEvents, GameState, InputSource, SessionHandshake, WeaponType } from '../types'
import { getNextWeapon } from '../weaponCycle'

/** 以下尺寸常量把 ruleset 世界坐标映射成 Phaser 场景里的视觉尺度。 */
const WORLD_WIDTH = ruleset.arena_width
const WORLD_HEIGHT = ruleset.arena_height
const COMBAT_RECT = battlefieldRect
const ENEMY_RECT = enemyCombatRect
const COUNTDOWN_TOTAL = 3
const HERO_FRAME_HEIGHT = 146
const HERO_RENDER_HEIGHT = 62
const HERO_RENDER_SCALE = HERO_RENDER_HEIGHT / HERO_FRAME_HEIGHT
const SWORD_SLASH_DISPLAY_WIDTH = 134
const SWORD_SLASH_DISPLAY_HEIGHT = 64
const SWORD_SLASH_OFFSET_X = 42
const SWORD_SLASH_OFFSET_Y = -7
const ARROW_TRAIL_DISPLAY_WIDTH = 22
const ARROW_TRAIL_DISPLAY_HEIGHT = 10
const DEFAULT_FIELD_CHROME_HEX = '#efebe2'

/** 读取 CSS 变量颜色（字符串形式），不可用时回退默认值。 */
const resolveThemeColorHex = (cssVariableName: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(cssVariableName).trim()
  return value || fallback
}

/** 把 CSS 颜色字符串转换为 Phaser 使用的数值颜色。 */
const resolveThemeColorNumber = (cssVariableName: string, fallback: number) => {
  const hex = resolveThemeColorHex(cssVariableName, `#${fallback.toString(16).padStart(6, '0')}`)
  if (!hex.startsWith('#')) return fallback
  const normalizedHex = hex.slice(1)
  const parsed = Number.parseInt(normalizedHex, 16)
  return Number.isNaN(parsed) ? fallback : parsed
}

/** 创建场景时需要注入的双向总线，负责 React 与 Phaser 的边界通讯。 */
type GameSceneOptions = {
  internalBus: TypedEventBus<GameEvents>
  commandBus: TypedEventBus<GameCommandPayloads>
}

/** 直接复用模拟器快照类型，避免渲染层再维护一套平行 DTO。 */
type BrowserSnapshot = ReturnType<BrowserSimulator['getSnapshot']>
type RuntimePose = BrowserSnapshot['playerPose']
/** 缓存上一帧敌人位置，用于死亡特效与命中闪光的落点计算。 */
type CachedEnemyState = {
  x: number
  y: number
  kind: BrowserSnapshot['enemies'][number]['kind']
  facingLeft: boolean
}
/** 记录敌人最近一次动画/朝向，避免每帧重复 `play`。 */
type EnemyRenderState = {
  lastAnimKey: string
  lastFacingLeft: boolean
}

/**
 * BraveMan 的 Phaser 主场景。
 * 它负责消费 BrowserSimulator 快照、处理输入/命令，并把场景事件回传给 React。
 */
export class GameScene extends Phaser.Scene {
  /** Phaser -> React 事件通道：上报状态、倒计时、快照、结算。 */
  private readonly internalBus: TypedEventBus<GameEvents>
  /** React -> Phaser 命令通道：接收开始/暂停/切武器等指令。 */
  private readonly commandBus: TypedEventBus<GameCommandPayloads>
  /** 当前场景状态机，与 App 里的 `gameState` 保持同步。 */
  private state: GameState = 'idle'
  /** 浏览器端确定性模拟器；非空时表示本局已创建。 */
  private simulator: BrowserSimulator | null = null
  private player!: Phaser.GameObjects.Sprite
  private enemies = new Map<number, Phaser.GameObjects.Sprite>()
  private projectiles = new Map<number, Phaser.GameObjects.Sprite>()
  private activeArrowTrails = new Map<number, Phaser.GameObjects.Sprite>()
  /** 键盘和触摸输入分开缓存，再按优先级合成为最终移动向量。 */
  private keyboardMove: { x: -1 | 0 | 1; y: -1 | 0 | 1 } = { x: 0, y: 0 }
  private touchMove: { x: -1 | 0 | 1; y: -1 | 0 | 1 } = { x: 0, y: 0 }
  private lastInputSource: InputSource = 'keyboard'
  /** 倒计时文案与累计毫秒数分开保存，便于按整数秒对外广播。 */
  private countdownValue: number | null = null
  private countdownElapsedMs = 0
  /** 记录当前 session，供开局初始化与解锁武器时复用。 */
  private session: SessionHandshake | null = null
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys
  private keyA?: Phaser.Input.Keyboard.Key
  private keyD?: Phaser.Input.Keyboard.Key
  private keyW?: Phaser.Input.Keyboard.Key
  private keyS?: Phaser.Input.Keyboard.Key
  private keyJ?: Phaser.Input.Keyboard.Key
  private keySpace?: Phaser.Input.Keyboard.Key
  private countdownLabel?: Phaser.GameObjects.Text
  /** 大厅态的预选武器；开局时会作为 simulator 初始武器来源。 */
  private idleWeapon: WeaponType = 'sword'
  private isBowAvailable = false
  /** 打开装备弹窗时会屏蔽空格快捷键，防止误触暂停/继续。 */
  private isEquipmentModalOpen = false
  private lastRenderedPose: RuntimePose | null = null
  private lastFacingLeft = false
  /** 缓存上一帧敌人坐标，给命中闪光和死亡特效复用。 */
  private lastEnemyPositionsById = new Map<number, CachedEnemyState>()
  private enemyRenderStateById = new Map<number, EnemyRenderState>()
  /** 运行中的特效引用，便于下一帧跟随角色或统一销毁。 */
  private activeSlashFx: Phaser.GameObjects.Sprite | null = null
  private activeHitFx = new Set<Phaser.GameObjects.Container>()
  private activeEnemyDeathFx = new Set<Phaser.GameObjects.Container>()

  /** 构造场景实例并注入双向事件总线。 */
  constructor(options: GameSceneOptions) {
    super({ key: 'game-scene' })
    this.internalBus = options.internalBus
    this.commandBus = options.commandBus
  }

  /** Phaser 场景生命周期入口：初始化舞台、角色和输入绑定。 */
  create(): void {
    this.cameras.main.setBackgroundColor(resolveThemeColorHex('--field-chrome', DEFAULT_FIELD_CHROME_HEX))
    this.createStageBackdrop()

    this.player = this.add.sprite(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5, HERO_TEXTURES.sword_idle).setDepth(10)
    this.player.setScale(HERO_RENDER_SCALE)

    this.countdownLabel = this.add.text(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5, '', {
      fontFamily: 'Space Grotesk, Noto Sans SC, sans-serif',
      fontSize: '64px',
      fontStyle: '700',
      color: '#101010',
    }).setOrigin(0.5).setDepth(50).setVisible(false)

    this.cursors = this.input.keyboard?.createCursorKeys()
    this.keyA = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.A)
    this.keyD = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    this.keyW = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.W)
    this.keyS = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.S)
    this.keyJ = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.J)
    this.keySpace = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    // Phaser 默认会把空格透传给页面滚动，这里主动捕获给游戏使用。
    this.input.keyboard?.addCapture(Phaser.Input.Keyboard.KeyCodes.SPACE)

    this.registerCommands()
    this.renderIdleWeapon()
    this.setState('idle')
  }

  /** 绘制战场背景和可战斗区域的视觉边界。 */
  private createStageBackdrop() {
    const fieldChrome = resolveThemeColorNumber('--field-chrome', 0xefebe2)
    const combatSurface = resolveThemeColorNumber('--paper-50', 0xf7f4ed)

    this.add.rectangle(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5, WORLD_WIDTH, WORLD_HEIGHT, fieldChrome).setDepth(0)

    const graphics = this.add.graphics({ x: 0, y: 0 }).setDepth(1)
    graphics.fillStyle(combatSurface, 1)
    graphics.fillRect(COMBAT_RECT.left, COMBAT_RECT.top, COMBAT_RECT.width, COMBAT_RECT.height)

    graphics.lineStyle(2, 0x282828, 0.12)
    graphics.strokeRect(COMBAT_RECT.left, COMBAT_RECT.top, COMBAT_RECT.width, COMBAT_RECT.height)

    graphics.lineStyle(1.2, 0x6a4730, 0.12)
    graphics.beginPath()
    graphics.moveTo(COMBAT_RECT.left, COMBAT_RECT.bottom)
    graphics.lineTo(COMBAT_RECT.right, COMBAT_RECT.bottom)
    graphics.strokePath()

    graphics.lineStyle(1, 0x101010, 0.04)
    graphics.beginPath()
    graphics.moveTo(COMBAT_RECT.left, COMBAT_RECT.centerY)
    graphics.lineTo(COMBAT_RECT.right, COMBAT_RECT.centerY)
    graphics.strokePath()

    graphics.lineStyle(1, 0x6a4730, 0.08)
    graphics.beginPath()
    graphics.moveTo(ENEMY_RECT.left, ENEMY_RECT.top)
    graphics.lineTo(ENEMY_RECT.left, ENEMY_RECT.bottom)
    graphics.moveTo(ENEMY_RECT.right, ENEMY_RECT.top)
    graphics.lineTo(ENEMY_RECT.right, ENEMY_RECT.bottom)
    graphics.strokePath()
  }

  /** 每帧更新：驱动倒计时、模拟器推进、渲染和结算事件。 */
  update(_: number, delta: number): void {
    this.handleKeyboardShortcuts()
    if (this.state === 'countdown') {
      this.countdownElapsedMs += delta
      const remaining = COUNTDOWN_TOTAL - Math.floor(this.countdownElapsedMs / 1000)
      if (remaining !== this.countdownValue && remaining > 0) {
        this.countdownValue = remaining
        this.countdownLabel?.setText(String(remaining)).setVisible(true)
        // 倒计时数字由 App/HUD 接收并展示。
        this.internalBus.emit('onCountdown', { value: remaining })
      }
      if (this.countdownElapsedMs >= COUNTDOWN_TOTAL * 1000) {
        this.countdownLabel?.setVisible(false)
        this.setState('running')
      }
      return
    }

    if (this.state !== 'running' || !this.simulator) {
      return
    }

    this.syncMovementFromKeyboard()
    this.simulator.update()
    const snapshot = this.simulator.getSnapshot()
    this.renderSnapshot(snapshot)
    this.emitSnapshot(snapshot)

    const result = this.simulator.getResult()
    if (result) {
      this.setState('gameover')
      // 终局时把完整 SessionStats 上报给 App，进入 verify -> claim 链路。
      this.internalBus.emit('onGameOver', { stats: result })
    }
  }

  /** 注册来自 UI 层的命令（开始、暂停、切武器等）。 */
  private registerCommands() {
    // 开始新局
    this.commandBus.on('startGame', ({ session }) => {
      this.session = session
      this.startRound(session)
    })
    // 暂停
    this.commandBus.on('pauseGame', () => {
      if (this.state !== 'running' || !this.simulator) return
      this.simulator.pause()
      this.setState('paused')
    })
    // 继续
    this.commandBus.on('resumeGame', () => {
      if (this.state !== 'paused' || !this.simulator) return
      this.simulator.resume()
      this.setState('running')
    })
    // 回大厅
    this.commandBus.on('returnToIdle', () => {
      this.setState('idle')
      this.simulator = null
      this.session = null
      this.clearRuntimeSprites()
      this.renderIdleWeapon()
    })
    // 移动输入
    this.commandBus.on('setMovement', ({ x, y, source }) => {
      this.touchMove = { x, y }
      this.lastInputSource = source
      // 非 running 态下也记录输入，确保恢复后状态一致。
      this.simulator?.setMovement(x, y, source)
    })
    // 装备弹窗状态
    this.commandBus.on('setEquipmentModalOpen', ({ open }) => {
      this.isEquipmentModalOpen = open
    })
    // 霜翎逐月可用状态
    this.commandBus.on('setBowAvailability', ({ available }) => {
      this.isBowAvailable = available
      if (!available && !this.simulator && this.idleWeapon === 'bow') {
        // 大厅态若失去弓资格，立即把预选武器降级回近战，避免 UI 显示脏状态。
        this.idleWeapon = 'sword'
        this.renderIdleWeapon()
      }
    })
    // 循环切武器
    this.commandBus.on('toggleWeapon', () => {
      if (this.simulator) {
        this.simulator.toggleWeapon()
        this.pushSnapshotIfNotRunning()
        return
      }
      this.idleWeapon = getNextWeapon(this.idleWeapon, this.isBowAvailable)
      this.renderIdleWeapon()
    })
    // 指定装备武器
    this.commandBus.on('equipWeapon', ({ weapon }) => {
      if (weapon === 'bow' && !this.isBowAvailable) return
      if (this.simulator) {
        this.simulator.equipWeapon(weapon)
        this.pushSnapshotIfNotRunning()
        return
      }
      this.idleWeapon = weapon
      this.renderIdleWeapon()
    })
    // 购买后解锁霜翎逐月并装备
    this.commandBus.on('unlockBowAndEquip', () => {
      this.idleWeapon = 'bow'
      if (this.session) {
        this.session = { ...this.session, bowUnlocked: true }
      }
      if (this.simulator) {
        this.simulator.unlockBowAndEquip()
        this.pushSnapshotIfNotRunning()
        return
      }
      this.renderIdleWeapon()
    })
    // 主动撤离
    this.commandBus.on('retreat', () => {
      this.simulator?.retreat()
      // 非 running 态也补推快照，保证 UI 即时收到 gameover。
      this.pushSnapshotIfNotRunning()
    })
    // 调试强制结束
    this.commandBus.on('debugForceGameOver', () => this.simulator?.forceDeath())
  }

  /** 基于 session 初始化新一局模拟器并进入倒计时。 */
  private startRound(session: SessionHandshake) {
    this.clearRuntimeSprites()
    this.simulator = new BrowserSimulator(session)
    // 大厅预选武器会继承到新局；若弓未解锁则自动降级到近战武器。
    if ((this.idleWeapon !== 'bow' || session.bowUnlocked) && this.idleWeapon !== 'sword') {
      this.simulator.equipWeapon(this.idleWeapon)
    }
    this.keyboardMove = { x: 0, y: 0 }
    this.touchMove = { x: 0, y: 0 }
    this.lastInputSource = 'keyboard'
    this.countdownElapsedMs = 0
    this.countdownValue = COUNTDOWN_TOTAL
    this.countdownLabel?.setText(String(COUNTDOWN_TOTAL)).setVisible(true)
    const snapshot = this.simulator.getSnapshot()
    this.renderSnapshot(snapshot)
    this.emitSnapshot(snapshot)
    this.setState('countdown')
    this.internalBus.emit('onCountdown', { value: COUNTDOWN_TOTAL })
  }

  /** 处理键盘快捷键（J 切武器，Space 暂停/继续）。 */
  private handleKeyboardShortcuts() {
    if (Phaser.Input.Keyboard.JustDown(this.keyJ!)) {
      this.commandBus.emit('toggleWeapon', undefined)
    }
    // 装备弹窗打开时屏蔽空格快捷键，避免误触发暂停/继续。
    if (this.isEquipmentModalOpen) return
    if (Phaser.Input.Keyboard.JustDown(this.keySpace!)) {
      if (this.state === 'running' && this.simulator) {
        this.simulator.pause()
        this.setState('paused')
      } else if (this.state === 'paused' && this.simulator) {
        this.simulator.resume()
        this.setState('running')
      }
    }
  }

  /** 同步键盘与触摸输入，确定最终有效移动向量。 */
  private syncMovementFromKeyboard() {
    const nextX = ((this.cursors?.left?.isDown || this.keyA?.isDown) ? -1 : 0) + ((this.cursors?.right?.isDown || this.keyD?.isDown) ? 1 : 0)
    const nextY = ((this.cursors?.up?.isDown || this.keyW?.isDown) ? -1 : 0) + ((this.cursors?.down?.isDown || this.keyS?.isDown) ? 1 : 0)
    const normalizedX = nextX < 0 ? -1 : nextX > 0 ? 1 : 0
    const normalizedY = nextY < 0 ? -1 : nextY > 0 ? 1 : 0
    this.keyboardMove = { x: normalizedX, y: normalizedY }
    // 若触摸仍在持续输入，则保持触摸优先；否则回退键盘向量。
    const effective = this.lastInputSource === 'touch' && (this.touchMove.x !== 0 || this.touchMove.y !== 0)
      ? this.touchMove
      : this.keyboardMove
    if (normalizedX !== 0 || normalizedY !== 0) {
      this.lastInputSource = 'keyboard'
    }
    this.simulator?.setMovement(effective.x, effective.y, this.lastInputSource)
  }

  /** 按模拟快照更新玩家、敌人、投射物及命中特效。 */
  private renderSnapshot(snapshot: BrowserSnapshot) {
    const facingLeft = snapshot.playerFacingX < 0
    this.player.setPosition(snapshot.playerX, snapshot.playerY)
    this.player.setDepth(100 + snapshot.playerY)
    this.renderPlayerPose(snapshot.playerPose, facingLeft, snapshot.playerX, snapshot.playerY)

    // 保留上一帧敌人位置，用于计算命中特效/死亡特效落点。
    const previousEnemyPositions = new Map(this.lastEnemyPositionsById)
    const aliveEnemyIds = new Set<number>()
    snapshot.enemies.forEach((enemy) => {
      aliveEnemyIds.add(enemy.id)
      const animKey = this.getEnemyAnimationKey(enemy)
      const facingEnemyLeft = enemy.x > snapshot.playerX
      const sprite = this.enemies.get(enemy.id) ?? this.createEnemySprite(enemy)
      sprite.setPosition(enemy.x, enemy.y)
      sprite.setDepth(100 + enemy.y)
      sprite.setDisplaySize(enemy.kind === 'charger' ? 64 : 48, enemy.kind === 'charger' ? 72 : 58)
      this.playEnemyAnimation(enemy.id, sprite, animKey, facingEnemyLeft)
      this.enemies.set(enemy.id, sprite)
    })
    for (const [enemyId, sprite] of this.enemies.entries()) {
      if (!aliveEnemyIds.has(enemyId)) {
        const lastState = previousEnemyPositions.get(enemyId)
        if (lastState) {
          this.spawnEnemyDeathFx(lastState)
        }
        sprite.destroy()
        this.enemies.delete(enemyId)
        this.enemyRenderStateById.delete(enemyId)
      }
    }

    if (snapshot.playerPose === 'sword_attack' || snapshot.playerPose === 'hook_spear_attack') {
      let hitCount = 0
      for (const [enemyId, position] of previousEnemyPositions.entries()) {
        if (!aliveEnemyIds.has(enemyId)) {
          hitCount += 1
          this.spawnHitFlash(position.x, position.y, position.x < snapshot.playerX)
        }
      }
      if (hitCount > 0) {
        // 多段命中时适度增强震屏反馈。
        const baseIntensity = snapshot.playerPose === 'hook_spear_attack' ? 0.001 : 0.0012
        this.cameras.main.shake(52, Math.min(0.0018, baseIntensity + hitCount * 0.0002), true)
      }
    }
    this.lastEnemyPositionsById = new Map(
      snapshot.enemies.map((enemy) => [
        enemy.id,
        {
          x: enemy.x,
          y: enemy.y,
          kind: enemy.kind,
          facingLeft: enemy.x > snapshot.playerX,
        },
      ]),
    )

    const aliveProjectileIds = new Set<number>()
    snapshot.projectiles.forEach((projectile) => {
      aliveProjectileIds.add(projectile.id)
      const rotation = Math.atan2(projectile.vy, projectile.vx)
      const trail = this.activeArrowTrails.get(projectile.id) ?? this.createArrowTrailSprite(projectile.id)
      const sprite = this.projectiles.get(projectile.id) ?? this.add.sprite(projectile.x, projectile.y, ARROW_TEXTURE)
      this.positionArrowTrail(trail, projectile.x, projectile.y, rotation)
      sprite.setTexture(ARROW_TEXTURE)
      sprite.setPosition(projectile.x, projectile.y)
      sprite.setRotation(rotation)
      sprite.setDepth(80 + projectile.y)
      this.projectiles.set(projectile.id, sprite)
    })
    for (const [projectileId, sprite] of this.projectiles.entries()) {
      if (!aliveProjectileIds.has(projectileId)) {
        sprite.destroy()
        this.projectiles.delete(projectileId)
      }
    }
    for (const [projectileId, trail] of this.activeArrowTrails.entries()) {
      if (!aliveProjectileIds.has(projectileId)) {
        trail.destroy()
        this.activeArrowTrails.delete(projectileId)
      }
    }

    if (ENABLE_DEBUG_BRIDGE) {
      // 调试桥仅暴露只读快照，便于浏览器控制台观察当前战局而不影响逻辑。
      ;(window as Window & { __BRAVEMAN_DEBUG_SNAPSHOT__?: BrowserSnapshot }).__BRAVEMAN_DEBUG_SNAPSHOT__ = snapshot
    }
  }

  /** 向 UI 发出当前帧的 HUD 摘要。 */
  private emitSnapshot(snapshot: BrowserSnapshot) {
    this.internalBus.emit('onSnapshot', {
      kills: snapshot.kills,
      survivalMs: snapshot.survivalMs,
      goldEarned: snapshot.goldEarned,
      activeWeapon: snapshot.activeWeapon,
      pose: snapshot.playerPose,
      targetId: snapshot.targetId,
      projectileCount: snapshot.projectileCount,
      enemyCount: snapshot.enemyCount,
    })
  }

  /** 创建敌人精灵实例。 */
  private createEnemySprite(enemy: BrowserSnapshot['enemies'][number]) {
    const texture = enemy.kind === 'charger' ? CHARGER_MOVE_FRAMES[0] : CHASER_MOVE_FRAMES[0]
    return this.add.sprite(enemy.x, enemy.y, texture).setOrigin(0.5, 0.84)
  }

  /** 根据敌人类型与状态计算应播放的动画 key。 */
  private getEnemyAnimationKey(enemy: BrowserSnapshot['enemies'][number]) {
    if (enemy.kind === 'chaser') {
      return ENEMY_ANIM.chaser_move
    }
    if (enemy.phase.kind === 'tell') {
      return ENEMY_ANIM.charger_tell
    }
    if (enemy.phase.kind === 'charge') {
      return ENEMY_ANIM.charger_charge
    }
    return ENEMY_ANIM.charger_move
  }

  /** 仅在必要时切换敌人动画和朝向，减少重复播放。 */
  private playEnemyAnimation(enemyId: number, sprite: Phaser.GameObjects.Sprite, animKey: string, facingLeft: boolean) {
    const renderState = this.enemyRenderStateById.get(enemyId)
    if (!renderState || renderState.lastAnimKey !== animKey || sprite.anims.currentAnim?.key !== animKey || !sprite.anims.isPlaying) {
      sprite.play(animKey, true)
    }
    if (!renderState || renderState.lastFacingLeft !== facingLeft) {
      sprite.setFlipX(facingLeft)
    }
    this.enemyRenderStateById.set(enemyId, { lastAnimKey: animKey, lastFacingLeft: facingLeft })
  }

  /** 大厅待机态下刷新角色武器姿态。 */
  private renderIdleWeapon() {
    const pose = this.idleWeapon === 'bow'
      ? 'bow_idle'
      : this.idleWeapon === 'hook_spear'
        ? 'hook_spear_idle'
        : 'sword_idle'
    this.renderPlayerPose(pose, false, this.player.x, this.player.y)
    this.internalBus.emit('onSnapshot', {
      kills: 0,
      survivalMs: 0,
      goldEarned: 0,
      activeWeapon: this.idleWeapon,
      pose,
      targetId: null,
      projectileCount: 0,
      enemyCount: 0,
    })
  }

  /** 依据玩家 pose 更新动画，并处理攻击特效触发。 */
  private renderPlayerPose(pose: RuntimePose, facingLeft: boolean, playerX: number, playerY: number) {
    const enteringPose = this.lastRenderedPose !== pose
    if (enteringPose || facingLeft !== this.lastFacingLeft) {
      this.player.setFlipX(facingLeft)
    }
    this.player.setScale(HERO_RENDER_SCALE)

    switch (pose) {
      case 'sword_idle':
        this.playLoopAnimation(HERO_ANIM.sword_idle)
        break
      case 'sword_move':
        this.playLoopAnimation(HERO_ANIM.sword_move)
        break
      case 'sword_attack':
        if (enteringPose || this.player.anims.currentAnim?.key !== HERO_ANIM.sword_attack) {
          this.player.play(HERO_ANIM.sword_attack)
          this.spawnSwordSlash(playerX, playerY, facingLeft)
        }
        break
      case 'death':
        if (enteringPose || this.player.anims.currentAnim?.key !== HERO_ANIM.death) {
          this.player.play(HERO_ANIM.death)
        }
        break
      case 'hook_spear_idle':
        this.playLoopAnimation(HERO_ANIM.hook_spear_idle)
        break
      case 'hook_spear_move':
        this.playLoopAnimation(HERO_ANIM.hook_spear_move)
        break
      case 'hook_spear_attack':
        if (enteringPose || this.player.anims.currentAnim?.key !== HERO_ANIM.hook_spear_attack) {
          this.player.play(HERO_ANIM.hook_spear_attack)
        }
        break
      case 'bow_idle':
        this.playLoopAnimation(HERO_ANIM.bow_idle)
        break
      case 'bow_move':
        this.playLoopAnimation(HERO_ANIM.bow_move)
        break
      case 'bow_attack':
        if (enteringPose || this.player.anims.currentAnim?.key !== HERO_ANIM.bow_attack) {
          this.player.play(HERO_ANIM.bow_attack)
        }
        break
    }

    if (this.activeSlashFx) {
      this.positionSwordSlash(playerX, playerY, facingLeft)
    }

    this.lastRenderedPose = pose
    this.lastFacingLeft = facingLeft
  }

  /** 播放可循环动作时避免重复调用造成闪烁。 */
  private playLoopAnimation(key: string) {
    if (this.player.anims.currentAnim?.key === key && this.player.anims.isPlaying) {
      return
    }
    this.player.play(key, true)
  }

  /** 生成并播放玄火镇岳挥砍特效。 */
  private spawnSwordSlash(playerX: number, playerY: number, facingLeft: boolean) {
    this.activeSlashFx?.destroy()
    const sprite = this.add.sprite(playerX, playerY, SWORD_SLASH_FRAMES[0])
    sprite.setDisplaySize(SWORD_SLASH_DISPLAY_WIDTH, SWORD_SLASH_DISPLAY_HEIGHT)
    sprite.setAlpha(0.12)
    sprite.setScale(0.94)
    sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      // 动画播完后回收特效引用，避免下一次攻击仍跟随旧 slash。
      if (this.activeSlashFx === sprite) {
        this.activeSlashFx = null
      }
      sprite.destroy()
    })
    this.activeSlashFx = sprite
    this.positionSwordSlash(playerX, playerY, facingLeft)
    this.tweens.add({
      targets: sprite,
      alpha: 1,
      scaleX: 1.02,
      scaleY: 0.98,
      duration: 66,
      ease: 'Quad.easeOut',
    })
    sprite.play(HERO_ANIM.sword_slash)
  }

  /** 将挥砍特效跟随到玩家当前位置。 */
  private positionSwordSlash(playerX: number, playerY: number, facingLeft: boolean) {
    if (!this.activeSlashFx) {
      return
    }
    this.activeSlashFx.setPosition(playerX + (facingLeft ? -SWORD_SLASH_OFFSET_X : SWORD_SLASH_OFFSET_X), playerY + SWORD_SLASH_OFFSET_Y)
    this.activeSlashFx.setFlipX(facingLeft)
    this.activeSlashFx.setAngle(facingLeft ? 3 : -3)
    this.activeSlashFx.setDepth(106 + playerY)
  }

  /** 命中瞬间特效：血色闪光与碎片拖尾。 */
  private spawnHitFlash(x: number, y: number, facingLeft: boolean) {
    const direction = facingLeft ? -1 : 1
    const splash = this.add.container(x, y - 4).setDepth(105 + y)
    const core = this.add.circle(0, 0, 8, 0x7c1717, 0.38)
    const highlight = this.add.circle(3, -2, 5, 0xe07373, 0.28)
    const blotA = this.add.circle(-8, 3, 3, 0xb82a2a, 0.3)
    const blotB = this.add.circle(9, 5, 2.6, 0xb82a2a, 0.24)
    const blotC = this.add.circle(-2, -7, 2.4, 0xe07373, 0.22)
    const streakA = this.add.rectangle(direction * 14, -4, 24, 1.6, 0xe07373, 0.34).setRotation(direction * -0.08)
    const streakB = this.add.rectangle(direction * 8, 5, 15, 1.2, 0xb82a2a, 0.3).setRotation(direction * 0.1)
    const shardA = this.add.rectangle(direction * 17, -9, 7, 1.2, 0x101010, 0.26).setRotation(direction * -0.16)
    const shardB = this.add.rectangle(direction * 20, 1, 6, 1.1, 0x4d1010, 0.22).setRotation(direction * 0.14)
    splash.add([core, highlight, blotA, blotB, blotC, streakA, streakB, shardA, shardB])
    this.activeHitFx.add(splash)
    this.tweens.add({
      targets: [streakA, streakB, shardA, shardB],
      x: `+=${direction * 12}`,
      alpha: 0,
      duration: 132,
      ease: 'Quad.easeOut',
    })
    this.tweens.add({
      targets: splash,
      alpha: 0,
      scaleX: 1.92,
      scaleY: 1.62,
      x: x + direction * 4,
      duration: 190,
      ease: 'Quad.easeOut',
      onComplete: () => {
        // tween 结束后销毁容器，避免命中特效集合持续膨胀。
        this.activeHitFx.delete(splash)
        splash.destroy()
      },
    })
  }

  /** 敌人死亡特效：根据敌人类型播放不同碎裂反馈。 */
  private spawnEnemyDeathFx(enemy: CachedEnemyState) {
    if (enemy.x < -32 || enemy.x > WORLD_WIDTH + 32 || enemy.y < -32 || enemy.y > WORLD_HEIGHT + 32) {
      return
    }

    const isCharger = enemy.kind === 'charger'
    const container = this.add.container(enemy.x, enemy.y - (isCharger ? 2 : 0)).setDepth(101 + enemy.y)
    const sprite = this.add.sprite(0, 0, isCharger ? CHARGER_DEATH_FRAMES[0] : CHASER_DEATH_FRAMES[0])
    sprite.setOrigin(0.5, 0.84)
    sprite.setDisplaySize(isCharger ? 72 : 54, isCharger ? 82 : 66)
    sprite.setFlipX(enemy.facingLeft)
    container.add(sprite)

    if (isCharger) {
      const shardA = this.add.rectangle(-12, -7, 8, 4, 0x3d434b, 0.72).setRotation(-0.34)
      const shardB = this.add.rectangle(10, -2, 7, 3, 0x707780, 0.64).setRotation(0.22)
      container.add([shardA, shardB])
      this.tweens.add({
        targets: shardA,
        x: -24,
        y: -18,
        angle: -40,
        alpha: 0,
        duration: 260,
        ease: 'Quad.easeOut',
      })
      this.tweens.add({
        targets: shardB,
        x: 22,
        y: -12,
        angle: 32,
        alpha: 0,
        duration: 240,
        ease: 'Quad.easeOut',
      })
    } else {
      const mistA = this.add.circle(-8, -5, 4, 0x2b2d31, 0.24)
      const mistB = this.add.circle(7, -2, 3.2, 0x463b35, 0.2)
      container.add([mistA, mistB])
      this.tweens.add({
        targets: [mistA, mistB],
        y: '-=10',
        alpha: 0,
        scaleX: 1.4,
        scaleY: 1.3,
        duration: 220,
        ease: 'Quad.easeOut',
      })
    }

    this.activeEnemyDeathFx.add(container)
    sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      // 死亡动画自身承担生命周期结束信号，播完即可安全回收。
      this.activeEnemyDeathFx.delete(container)
      container.destroy()
    })
    sprite.play(isCharger ? ENEMY_ANIM.charger_death : ENEMY_ANIM.chaser_death)
  }

  /** 为给定投射物创建箭尾残影精灵。 */
  private createArrowTrailSprite(projectileId: number) {
    const sprite = this.add.sprite(0, 0, ARROW_TRAIL_FRAMES[0])
    sprite.setDisplaySize(ARROW_TRAIL_DISPLAY_WIDTH, ARROW_TRAIL_DISPLAY_HEIGHT)
    sprite.setAlpha(0.9)
    sprite.play(HERO_ANIM.arrow_trail)
    this.activeArrowTrails.set(projectileId, sprite)
    return sprite
  }

  /** 更新箭尾残影位置和深度。 */
  private positionArrowTrail(trail: Phaser.GameObjects.Sprite, x: number, y: number, rotation: number) {
    const offset = 12
    trail.setPosition(x - Math.cos(rotation) * offset, y - Math.sin(rotation) * offset)
    trail.setRotation(rotation)
    trail.setDepth(79 + y)
  }

  /** 清空本局生成的运行时精灵与缓存状态。 */
  private clearRuntimeSprites() {
    this.enemies.forEach((sprite) => sprite.destroy())
    this.enemies.clear()
    this.enemyRenderStateById.clear()
    this.projectiles.forEach((sprite) => sprite.destroy())
    this.projectiles.clear()
    this.activeArrowTrails.forEach((sprite) => sprite.destroy())
    this.activeArrowTrails.clear()
    this.activeSlashFx?.destroy()
    this.activeSlashFx = null
    this.activeHitFx.forEach((fx) => fx.destroy())
    this.activeHitFx.clear()
    this.activeEnemyDeathFx.forEach((fx) => fx.destroy())
    this.activeEnemyDeathFx.clear()
    this.lastEnemyPositionsById.clear()
    this.isEquipmentModalOpen = false
    this.lastRenderedPose = null
    this.lastFacingLeft = false
  }

  /** 非 running 态下补推一次快照，保持 UI 同步。 */
  private pushSnapshotIfNotRunning() {
    if (!this.simulator || this.state === 'running') {
      return
    }
    const snapshot = this.simulator.getSnapshot()
    this.renderSnapshot(snapshot)
    this.emitSnapshot(snapshot)

    const result = this.simulator.getResult()
    if (result && this.state !== 'gameover') {
      this.setState('gameover')
      // 例如撤离/强制结束场景下，保证 App 仍能收到结算事件。
      this.internalBus.emit('onGameOver', { stats: result })
    }
  }

  /** 切换场景状态并广播给 UI。 */
  private setState(nextState: GameState) {
    this.state = nextState
    this.internalBus.emit('onGameState', { state: nextState })
  }
}
