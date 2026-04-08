use serde::{Deserialize, Serialize};
use sha3::{Digest, Keccak256};

/// 规则版本号：前端/后端/API/链上结算都依赖此值做一致性校验。
pub const RULESET_VERSION: u32 = 7;
/// 模拟器固定 tick 频率（60 FPS）。
pub const TICKS_PER_SECOND: u32 = 60;
/// 战场宽度（像素）。
pub const ARENA_WIDTH: f32 = 1280.0;
/// 战场高度（像素）。
pub const ARENA_HEIGHT: f32 = 720.0;
// 玩家与敌人基础运动/攻击常量（需与前端视觉节奏匹配）。
const PLAYER_SPEED: f32 = 300.0;
const CHASER_SPEED: f32 = 118.0;
const CHARGER_SPEED: f32 = 280.0;
const CHARGER_TELL_TICKS: u32 = 30;
const CHARGER_CHARGE_TICKS: u32 = 18;
const CHARGER_IDLE_COOLDOWN_TICKS: u32 = 84;
const SWORD_RANGE: f32 = 110.0;
const SWORD_COOLDOWN_TICKS: u32 = 39;
const HOOK_SPEAR_RANGE: f32 = 156.0;
const HOOK_SPEAR_COOLDOWN_TICKS: u32 = 43;
const BOW_RANGE: f32 = 520.0;
const BOW_COOLDOWN_TICKS: u32 = 54;
const BOW_PROJECTILE_SPEED: f32 = 780.0;
const PROJECTILE_POOL_CAPACITY: usize = 8;
const SPAWN_SAFE_DISTANCE: f32 = 220.0;
const BASE_SPAWN_INTERVAL_TICKS: u32 = 54;
const MIN_SPAWN_INTERVAL_TICKS: u32 = 18;
const PLAYER_BOUNDS_INSET_X: f32 = 62.0;
const PLAYER_BOUNDS_INSET_TOP: f32 = 113.0;
const PLAYER_BOUNDS_INSET_BOTTOM: f32 = 57.0;
const ENEMY_BOUNDS_INSET_X: f32 = 76.0;
const ENEMY_BOUNDS_INSET_TOP: f32 = 143.0;
const ENEMY_BOUNDS_INSET_BOTTOM: f32 = 38.0;

/// 武器枚举：决定攻击形态、射程和冷却。
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WeaponType {
    Sword,
    HookSpear,
    Bow,
}

/// 敌人类型：追击怪与冲锋怪。
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EnemyKind {
    Chaser,
    Charger,
}

/// 玩家姿态：供前端动画与音效触发使用。
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PlayerPose {
    SwordIdle,
    SwordMove,
    SwordAttack,
    HookSpearIdle,
    HookSpearMove,
    HookSpearAttack,
    BowIdle,
    BowMove,
    BowAttack,
    Death,
}

/// 对局结束原因。
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EndReason {
    Death,
    Retreat,
}

/// 输入事件日志：前端按 tick 记录，后端按 tick 重放。
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum InputEvent {
    Move { tick: u32, x: i8, y: i8 },
    ToggleWeapon { tick: u32 },
    UnlockBow { tick: u32 },
    Pause { tick: u32 },
    Resume { tick: u32 },
    Retreat { tick: u32 },
}

/// 实体快照：调试与前端渲染桥接使用。
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct EntitySnapshot {
    pub id: u32,
    pub kind: String,
    pub x: f32,
    pub y: f32,
    pub facing_x: f32,
    pub active: bool,
}

/// 单帧快照：用于前端 HUD 与场景渲染。
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct FrameSnapshot {
    pub tick: u32,
    pub player_x: f32,
    pub player_y: f32,
    pub player_pose: PlayerPose,
    pub player_weapon: WeaponType,
    pub player_facing_x: f32,
    pub kills: u32,
    pub survival_ms: u32,
    pub gold_earned: u32,
    pub current_target_id: Option<u32>,
    pub enemy_count: usize,
    pub projectile_count: usize,
    pub entities: Vec<EntitySnapshot>,
}

/// 对局结算摘要：verify 时与前端 local_summary 对比。
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ReplaySummary {
    pub kills: u32,
    pub survival_ms: u32,
    pub gold_earned: u32,
    pub end_reason: EndReason,
}

/// 规则元信息（版本 + 配置哈希）。
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct RulesetMeta {
    pub ruleset_version: u32,
    pub config_hash: String,
}

/// 规则集：前后端共享的几何、战斗和经济参数。
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Ruleset {
    pub arena_width: u32,
    pub arena_height: u32,
    pub player_radius: f32,
    pub enemy_radius: f32,
    pub player_bounds_inset_x: f32,
    pub player_bounds_inset_top: f32,
    pub player_bounds_inset_bottom: f32,
    pub enemy_bounds_inset_x: f32,
    pub enemy_bounds_inset_top: f32,
    pub enemy_bounds_inset_bottom: f32,
    pub projectile_radius: f32,
    pub bow_spawn_offset: f32,
    pub sword_range: f32,
    pub sword_cleave_half_width: f32,
    pub sword_cooldown_ms: u32,
    pub hook_spear_range: f32,
    pub hook_spear_sweep_half_width: f32,
    pub hook_spear_cooldown_ms: u32,
    pub bow_range: f32,
    pub bow_speed: f32,
    pub bow_cooldown_ms: u32,
    pub projectile_pool_capacity: usize,
    pub chaser_gold: u32,
    pub charger_gold: u32,
}

/// 默认规则参数常量。
pub const DEFAULT_RULESET: Ruleset = Ruleset {
    arena_width: ARENA_WIDTH as u32,
    arena_height: ARENA_HEIGHT as u32,
    player_radius: 18.0,
    enemy_radius: 18.0,
    player_bounds_inset_x: PLAYER_BOUNDS_INSET_X,
    player_bounds_inset_top: PLAYER_BOUNDS_INSET_TOP,
    player_bounds_inset_bottom: PLAYER_BOUNDS_INSET_BOTTOM,
    enemy_bounds_inset_x: ENEMY_BOUNDS_INSET_X,
    enemy_bounds_inset_top: ENEMY_BOUNDS_INSET_TOP,
    enemy_bounds_inset_bottom: ENEMY_BOUNDS_INSET_BOTTOM,
    projectile_radius: 10.0,
    bow_spawn_offset: 20.0,
    sword_range: SWORD_RANGE,
    sword_cleave_half_width: 52.0,
    sword_cooldown_ms: 650,
    hook_spear_range: HOOK_SPEAR_RANGE,
    hook_spear_sweep_half_width: 28.0,
    hook_spear_cooldown_ms: 720,
    bow_range: BOW_RANGE,
    bow_speed: BOW_PROJECTILE_SPEED,
    bow_cooldown_ms: 900,
    projectile_pool_capacity: PROJECTILE_POOL_CAPACITY,
    chaser_gold: 1,
    charger_gold: 2,
};

/// 返回默认规则集（作为可序列化的运行时副本）。
pub fn default_ruleset() -> Ruleset {
    DEFAULT_RULESET.clone()
}

/// 生成规则元信息：版本号 + 配置哈希，用于前后端一致性校验。
pub fn ruleset_meta() -> RulesetMeta {
    let json = serde_json::to_vec(&default_ruleset()).expect("ruleset json");
    let config_hash = format!("0x{}", hex::encode(Keccak256::digest(json)));
    RulesetMeta {
        ruleset_version: RULESET_VERSION,
        config_hash,
    }
}

/// 玩家可活动区域边界。
fn player_bounds() -> (f32, f32, f32, f32) {
    (
        DEFAULT_RULESET.player_bounds_inset_x,
        ARENA_WIDTH - DEFAULT_RULESET.player_bounds_inset_x,
        DEFAULT_RULESET.player_bounds_inset_top,
        ARENA_HEIGHT - DEFAULT_RULESET.player_bounds_inset_bottom,
    )
}

/// 敌人可活动区域边界。
fn enemy_bounds() -> (f32, f32, f32, f32) {
    (
        DEFAULT_RULESET.enemy_bounds_inset_x,
        ARENA_WIDTH - DEFAULT_RULESET.enemy_bounds_inset_x,
        DEFAULT_RULESET.enemy_bounds_inset_top,
        ARENA_HEIGHT - DEFAULT_RULESET.enemy_bounds_inset_bottom,
    )
}

/// 将敌人位置裁剪到敌方活动边界内。
fn clamp_enemy_to_bounds(enemy: &mut EnemyState) {
    let (min_x, max_x, min_y, max_y) = enemy_bounds();
    enemy.x = enemy.x.clamp(min_x, max_x);
    enemy.y = enemy.y.clamp(min_y, max_y);
}

#[derive(Clone, Copy)]
struct RngState {
    /// 64 位线性同余随机状态。
    state: u64,
}

impl RngState {
    /// 以非零 seed 初始化 64 位线性同余随机状态。
    fn new(seed: u64) -> Self {
        Self { state: seed.max(1) }
    }

    /// 生成伪随机 u32。
    fn next_u32(&mut self) -> u32 {
        self.state = self.state.wrapping_mul(6364136223846793005).wrapping_add(1);
        (self.state >> 32) as u32
    }

    /// 生成 [0,1] 浮点随机数。
    fn next_f32(&mut self) -> f32 {
        self.next_u32() as f32 / u32::MAX as f32
    }

    /// 生成伪随机布尔值。
    fn next_bool(&mut self) -> bool {
        self.next_u32() & 1 == 1
    }
}

#[derive(Clone)]
struct PlayerState {
    /// 玩家位置 x。
    x: f32,
    /// 玩家位置 y。
    y: f32,
    /// 朝向 x（-1 或 1）。
    facing_x: f32,
    /// 当前武器。
    weapon: WeaponType,
    /// 攻击冷却 tick。
    attack_cooldown: u32,
    /// 攻击姿态剩余 tick。
    attack_pose_ticks: u32,
    /// 当前姿态（供动画层消费）。
    pose: PlayerPose,
}

/// 冲锋怪内部状态机。
#[derive(Clone, Copy)]
enum ChargerPhase {
    Chase,
    Tell {
        remaining: u32,
        dir_x: f32,
        dir_y: f32,
    },
    Charge {
        remaining: u32,
        dir_x: f32,
        dir_y: f32,
    },
}

#[derive(Clone)]
struct EnemyState {
    /// 敌人唯一 id（用于前端实体追踪）。
    id: u32,
    kind: EnemyKind,
    x: f32,
    y: f32,
    phase: ChargerPhase,
    cooldown: u32,
}

#[derive(Clone)]
struct ProjectileState {
    id: u32,
    active: bool,
    x: f32,
    y: f32,
    vx: f32,
    vy: f32,
}

/// 确定性战斗模拟器：
/// - 输入：seed + 初始能力（bow_unlocked）+ 输入事件；
/// - 输出：帧快照与结算摘要；
/// - 约束：同输入必须得到同输出，供后端权威重放使用。
pub struct Simulator {
    pub tick: u32,
    player: PlayerState,
    bow_unlocked: bool,
    enemies: Vec<EnemyState>,
    projectiles: Vec<ProjectileState>,
    move_x: i8,
    move_y: i8,
    next_enemy_id: u32,
    next_projectile_id: u32,
    rng: RngState,
    ended: Option<EndReason>,
    kills: u32,
    gold_earned: u32,
    current_target_id: Option<u32>,
}

impl Simulator {
    /// 创建模拟器并初始化玩家、敌人池和投射物池。
    pub fn new(seed: u64, bow_unlocked: bool) -> Self {
        Self {
            tick: 0,
            player: PlayerState {
                x: ARENA_WIDTH * 0.5,
                y: ARENA_HEIGHT * 0.5,
                facing_x: 1.0,
                weapon: WeaponType::Sword,
                attack_cooldown: 0,
                attack_pose_ticks: 0,
                pose: PlayerPose::SwordIdle,
            },
            bow_unlocked,
            enemies: Vec::new(),
            projectiles: (0..PROJECTILE_POOL_CAPACITY)
                .map(|index| ProjectileState {
                    // 投射物池预分配，运行时复用，避免频繁堆分配。
                    id: index as u32,
                    active: false,
                    x: 0.0,
                    y: 0.0,
                    vx: 0.0,
                    vy: 0.0,
                })
                .collect(),
            move_x: 0,
            move_y: 0,
            next_enemy_id: 1,
            next_projectile_id: PROJECTILE_POOL_CAPACITY as u32,
            rng: RngState::new(seed),
            ended: None,
            kills: 0,
            gold_earned: 0,
            current_target_id: None,
        }
    }

    /// 应用单个输入事件到模拟器状态。
    pub fn apply_event(&mut self, event: &InputEvent) {
        match event {
            InputEvent::Move { x, y, .. } => {
                self.move_x = *x;
                self.move_y = *y;
            }
            InputEvent::ToggleWeapon { .. } => {
                // 切武器策略：剑 -> 钩矛 -> （已解锁弓 ? 弓 : 剑） -> 剑。
                self.player.weapon = match self.player.weapon {
                    WeaponType::Sword => WeaponType::HookSpear,
                    WeaponType::HookSpear => {
                        if self.bow_unlocked {
                            WeaponType::Bow
                        } else {
                            WeaponType::Sword
                        }
                    }
                    WeaponType::Bow => WeaponType::Sword,
                };
            }
            InputEvent::UnlockBow { .. } => {
                // 解锁事件会立即把当前武器切到弓。
                self.bow_unlocked = true;
                self.player.weapon = WeaponType::Bow;
            }
            InputEvent::Retreat { .. } => self.ended = Some(EndReason::Retreat),
            InputEvent::Pause { .. } | InputEvent::Resume { .. } => {}
        }
    }

    /// 推进 1 tick 的战斗模拟。
    pub fn step(&mut self) {
        if self.ended.is_some() {
            return;
        }
        self.tick += 1;
        self.update_player_movement();
        self.spawn_if_needed();
        self.update_enemies();
        self.resolve_auto_attack();
        self.update_projectiles();
        self.resolve_contact_death();
        self.update_pose();
        self.player.attack_cooldown = self.player.attack_cooldown.saturating_sub(1);
        self.player.attack_pose_ticks = self.player.attack_pose_ticks.saturating_sub(1);
        // 清理越界实体，控制长局内存占用。
        self.enemies.retain(|enemy| {
            enemy.x >= -120.0
                && enemy.x <= ARENA_WIDTH + 120.0
                && enemy.y >= -80.0
                && enemy.y <= ARENA_HEIGHT + 80.0
        });
    }

    /// 若本局已结束，返回结算摘要。
    pub fn summary(&self) -> Option<ReplaySummary> {
        self.ended.map(|end_reason| ReplaySummary {
            kills: self.kills,
            survival_ms: (self.tick * 1000) / TICKS_PER_SECOND,
            gold_earned: self.gold_earned,
            end_reason,
        })
    }

    /// 输出当前帧快照，供前端渲染或调试使用。
    pub fn snapshot(&self) -> FrameSnapshot {
        let mut entities = Vec::new();
        entities.push(EntitySnapshot {
            id: 0,
            kind: "player".to_string(),
            x: self.player.x,
            y: self.player.y,
            facing_x: self.player.facing_x,
            active: true,
        });
        for enemy in &self.enemies {
            entities.push(EntitySnapshot {
                id: enemy.id,
                kind: match enemy.kind {
                    EnemyKind::Chaser => "enemy_chaser".to_string(),
                    EnemyKind::Charger => "enemy_charger".to_string(),
                },
                x: enemy.x,
                y: enemy.y,
                facing_x: (self.player.x - enemy.x).signum(),
                active: true,
            });
        }
        for projectile in self.projectiles.iter().filter(|item| item.active) {
            entities.push(EntitySnapshot {
                id: projectile.id,
                kind: "arrow".to_string(),
                x: projectile.x,
                y: projectile.y,
                facing_x: projectile.vx.signum(),
                active: true,
            });
        }
        FrameSnapshot {
            tick: self.tick,
            player_x: self.player.x,
            player_y: self.player.y,
            player_pose: self.player.pose,
            player_weapon: self.player.weapon,
            player_facing_x: self.player.facing_x,
            kills: self.kills,
            survival_ms: (self.tick * 1000) / TICKS_PER_SECOND,
            gold_earned: self.gold_earned,
            current_target_id: self.current_target_id,
            enemy_count: self.enemies.len(),
            projectile_count: self.projectiles.iter().filter(|item| item.active).count(),
            entities,
        }
    }

    /// 根据输入更新玩家位移与朝向。
    fn update_player_movement(&mut self) {
        let mut dx = self.move_x as f32;
        let mut dy = self.move_y as f32;
        let magnitude = (dx * dx + dy * dy).sqrt();
        if magnitude > 1.0 {
            dx /= magnitude;
            dy /= magnitude;
        }
        if dx.abs() > 0.01 {
            self.player.facing_x = dx.signum();
        }
        let (min_x, max_x, min_y, max_y) = player_bounds();
        self.player.x =
            (self.player.x + dx * PLAYER_SPEED / TICKS_PER_SECOND as f32).clamp(min_x, max_x);
        self.player.y =
            (self.player.y + dy * PLAYER_SPEED / TICKS_PER_SECOND as f32).clamp(min_y, max_y);
    }

    /// 按动态节奏刷怪，并避免贴脸出生。
    fn spawn_if_needed(&mut self) {
        let elapsed_sec = self.tick / TICKS_PER_SECOND;
        let reduction = (elapsed_sec / 6).min(BASE_SPAWN_INTERVAL_TICKS - MIN_SPAWN_INTERVAL_TICKS);
        let interval = BASE_SPAWN_INTERVAL_TICKS
            .saturating_sub(reduction)
            .max(MIN_SPAWN_INTERVAL_TICKS);
        if self.tick % interval != 0 {
            return;
        }
        let side_left = self.rng.next_bool();
        // 25% 冲锋怪，75% 追击怪。
        let kind = if self.rng.next_f32() < 0.25 {
            EnemyKind::Charger
        } else {
            EnemyKind::Chaser
        };
        let (min_x, max_x, min_y, max_y) = enemy_bounds();
        let mut y = min_y + self.rng.next_f32() * (max_y - min_y);
        if (y - self.player.y).abs() < SPAWN_SAFE_DISTANCE * 0.5 {
            y = if y < self.player.y {
                (y - SPAWN_SAFE_DISTANCE).max(min_y)
            } else {
                (y + SPAWN_SAFE_DISTANCE).min(max_y)
            };
        }
        self.enemies.push(EnemyState {
            id: self.next_enemy_id,
            kind,
            x: if side_left { min_x } else { max_x },
            y,
            phase: ChargerPhase::Chase,
            cooldown: CHARGER_IDLE_COOLDOWN_TICKS,
        });
        self.next_enemy_id += 1;
    }

    /// 推进所有敌人 AI 状态与位置。
    fn update_enemies(&mut self) {
        for enemy in &mut self.enemies {
            match enemy.kind {
                EnemyKind::Chaser => {
                    let (dir_x, dir_y, _) =
                        normalize(self.player.x - enemy.x, self.player.y - enemy.y);
                    enemy.x += dir_x * CHASER_SPEED / TICKS_PER_SECOND as f32;
                    enemy.y += dir_y * CHASER_SPEED / TICKS_PER_SECOND as f32;
                }
                EnemyKind::Charger => {
                    // cooldown 控制冲锋触发窗口，避免连冲造成无解压制。
                    enemy.cooldown = enemy.cooldown.saturating_sub(1);
                    enemy.phase = match enemy.phase {
                        ChargerPhase::Chase => {
                            let dx = self.player.x - enemy.x;
                            let dy = self.player.y - enemy.y;
                            let (_, _, distance) = normalize(dx, dy);
                            if enemy.cooldown == 0 && distance < 260.0 {
                                let (dir_x, dir_y, _) = normalize(dx, dy);
                                ChargerPhase::Tell {
                                    remaining: CHARGER_TELL_TICKS,
                                    dir_x,
                                    dir_y,
                                }
                            } else {
                                let (dir_x, dir_y, _) = normalize(dx, dy);
                                enemy.x += dir_x * (CHASER_SPEED * 0.8) / TICKS_PER_SECOND as f32;
                                enemy.y += dir_y * (CHASER_SPEED * 0.8) / TICKS_PER_SECOND as f32;
                                ChargerPhase::Chase
                            }
                        }
                        ChargerPhase::Tell {
                            remaining,
                            dir_x,
                            dir_y,
                        } => {
                            if remaining <= 1 {
                                ChargerPhase::Charge {
                                    remaining: CHARGER_CHARGE_TICKS,
                                    dir_x,
                                    dir_y,
                                }
                            } else {
                                ChargerPhase::Tell {
                                    remaining: remaining - 1,
                                    dir_x,
                                    dir_y,
                                }
                            }
                        }
                        ChargerPhase::Charge {
                            remaining,
                            dir_x,
                            dir_y,
                        } => {
                            enemy.x += dir_x * CHARGER_SPEED / TICKS_PER_SECOND as f32;
                            enemy.y += dir_y * CHARGER_SPEED / TICKS_PER_SECOND as f32;
                            if remaining <= 1 {
                                enemy.cooldown = CHARGER_IDLE_COOLDOWN_TICKS;
                                ChargerPhase::Chase
                            } else {
                                ChargerPhase::Charge {
                                    remaining: remaining - 1,
                                    dir_x,
                                    dir_y,
                                }
                            }
                        }
                    }
                }
            }
            clamp_enemy_to_bounds(enemy);
        }
    }

    /// 自动攻击逻辑：近战范围结算或霜翎逐月投射。
    fn resolve_auto_attack(&mut self) {
        let Some(target_index) = self.find_target_index() else {
            self.current_target_id = None;
            return;
        };
        let target_id = self.enemies[target_index].id;
        self.current_target_id = Some(target_id);
        let facing = (self.enemies[target_index].x - self.player.x).signum();
        if facing.abs() > 0.0 {
            self.player.facing_x = facing;
        }
        // 冷却未结束时保留目标锁定，但不结算伤害。
        if self.player.attack_cooldown > 0 {
            return;
        }
        match self.player.weapon {
            WeaponType::Sword => {
                let mut defeated_ids = Vec::new();
                for enemy in &self.enemies {
                    if is_enemy_in_sword_sweep(
                        enemy.x - self.player.x,
                        enemy.y - self.player.y,
                        self.player.facing_x,
                        DEFAULT_RULESET.sword_range,
                        DEFAULT_RULESET.sword_cleave_half_width,
                    ) {
                        defeated_ids.push(enemy.id);
                    }
                }
                if defeated_ids.is_empty() {
                    return;
                }
                // 近战清扫可一次命中多个敌人。
                self.enemies.retain(|enemy| {
                    if defeated_ids.contains(&enemy.id) {
                        self.kills += 1;
                        self.gold_earned += gold_for_enemy(enemy.kind);
                        false
                    } else {
                        true
                    }
                });
                self.player.attack_cooldown = SWORD_COOLDOWN_TICKS;
                self.player.attack_pose_ticks = 12;
            }
            WeaponType::HookSpear => {
                let mut defeated_ids = Vec::new();
                for enemy in &self.enemies {
                    if is_enemy_in_hook_spear_sweep(
                        enemy.x - self.player.x,
                        enemy.y - self.player.y,
                        self.player.facing_x,
                        DEFAULT_RULESET.hook_spear_range,
                        DEFAULT_RULESET.hook_spear_sweep_half_width,
                    ) {
                        defeated_ids.push(enemy.id);
                    }
                }
                if defeated_ids.is_empty() {
                    return;
                }
                // 钩矛同样可多目标清扫，射程更远、横向更窄。
                self.enemies.retain(|enemy| {
                    if defeated_ids.contains(&enemy.id) {
                        self.kills += 1;
                        self.gold_earned += gold_for_enemy(enemy.kind);
                        false
                    } else {
                        true
                    }
                });
                self.player.attack_cooldown = HOOK_SPEAR_COOLDOWN_TICKS;
                self.player.attack_pose_ticks = 14;
            }
            WeaponType::Bow => {
                let target = &self.enemies[target_index];
                let (dir_x, dir_y, distance) =
                    normalize(target.x - self.player.x, target.y - self.player.y);
                if distance > BOW_RANGE {
                    return;
                }
                // 远程攻击复用投射物池，不在运行中分配新对象。
                if let Some(projectile) = self.projectiles.iter_mut().find(|item| !item.active) {
                    projectile.active = true;
                    projectile.id = self.next_projectile_id;
                    self.next_projectile_id += 1;
                    projectile.x =
                        self.player.x + self.player.facing_x * DEFAULT_RULESET.bow_spawn_offset;
                    projectile.y = self.player.y;
                    projectile.vx = dir_x * BOW_PROJECTILE_SPEED / TICKS_PER_SECOND as f32;
                    projectile.vy = dir_y * BOW_PROJECTILE_SPEED / TICKS_PER_SECOND as f32;
                    self.player.attack_cooldown = BOW_COOLDOWN_TICKS;
                    self.player.attack_pose_ticks = 12;
                }
            }
        }
    }

    /// 更新投射物飞行并处理命中消解。
    fn update_projectiles(&mut self) {
        for projectile in &mut self.projectiles {
            if !projectile.active {
                continue;
            }
            projectile.x += projectile.vx;
            projectile.y += projectile.vy;
            if projectile.x < -80.0
                || projectile.x > ARENA_WIDTH + 80.0
                || projectile.y < -80.0
                || projectile.y > ARENA_HEIGHT + 80.0
            {
                projectile.active = false;
                continue;
            }
            // 命中判定使用圆形碰撞近似：enemy_radius + projectile_radius。
            if let Some(index) = self.enemies.iter().position(|enemy| {
                distance(projectile.x, projectile.y, enemy.x, enemy.y)
                    <= DEFAULT_RULESET.enemy_radius + DEFAULT_RULESET.projectile_radius
            }) {
                let enemy = self.enemies.remove(index);
                self.kills += 1;
                self.gold_earned += gold_for_enemy(enemy.kind);
                projectile.active = false;
            }
        }
    }

    /// 玩家与敌人接触即死亡。
    fn resolve_contact_death(&mut self) {
        if self.enemies.iter().any(|enemy| {
            distance(self.player.x, self.player.y, enemy.x, enemy.y)
                <= DEFAULT_RULESET.player_radius + DEFAULT_RULESET.enemy_radius
        }) {
            // 一旦接触即终局，后续 step 会短路退出。
            self.ended = Some(EndReason::Death);
            self.player.pose = PlayerPose::Death;
        }
    }

    /// 根据战斗状态刷新玩家 pose。
    fn update_pose(&mut self) {
        if self.ended.is_some() {
            self.player.pose = PlayerPose::Death;
            return;
        }
        if self.player.attack_pose_ticks > 0 {
            self.player.pose = match self.player.weapon {
                WeaponType::Sword => PlayerPose::SwordAttack,
                WeaponType::HookSpear => PlayerPose::HookSpearAttack,
                WeaponType::Bow => PlayerPose::BowAttack,
            };
            return;
        }
        let moving = self.move_x != 0 || self.move_y != 0;
        self.player.pose = match (self.player.weapon, moving) {
            (WeaponType::Sword, true) => PlayerPose::SwordMove,
            (WeaponType::Sword, false) => PlayerPose::SwordIdle,
            (WeaponType::HookSpear, true) => PlayerPose::HookSpearMove,
            (WeaponType::HookSpear, false) => PlayerPose::HookSpearIdle,
            (WeaponType::Bow, true) => PlayerPose::BowMove,
            (WeaponType::Bow, false) => PlayerPose::BowIdle,
        };
    }

    /// 选择武器有效范围内最近的敌人为当前目标。
    fn find_target_index(&self) -> Option<usize> {
        let range = match self.player.weapon {
            WeaponType::Sword => SWORD_RANGE,
            WeaponType::HookSpear => HOOK_SPEAR_RANGE,
            WeaponType::Bow => BOW_RANGE,
        };
        self.enemies
            .iter()
            .enumerate()
            .filter_map(|(index, enemy)| {
                let dist = distance(self.player.x, self.player.y, enemy.x, enemy.y);
                (dist <= range).then_some((index, dist))
            })
            // 目标选择仅按距离最近，不引入仇恨值/血量等权重。
            .min_by(|a, b| a.1.partial_cmp(&b.1).unwrap())
            .map(|item| item.0)
    }
}

/// 按输入日志进行确定性复盘，产出后端权威结算摘要。
pub fn replay(seed: u64, bow_unlocked: bool, logs: &[InputEvent]) -> Option<ReplaySummary> {
    let mut simulator = Simulator::new(seed, bow_unlocked);
    let mut event_index = 0usize;
    // 回放上限：取日志最大 tick + 90 秒，防止无终局日志导致无限循环。
    let mut max_tick = logs
        .iter()
        .map(event_tick)
        .max()
        .unwrap_or(0)
        .saturating_add(TICKS_PER_SECOND * 90);
    // 至少运行 5 秒，避免极短输入造成异常提前返回。
    if max_tick < TICKS_PER_SECOND * 5 {
        max_tick = TICKS_PER_SECOND * 5;
    }
    while simulator.tick <= max_tick {
        // 按 tick 顺序消费输入日志，确保与前端记录时序一致。
        while event_index < logs.len() && event_tick(&logs[event_index]) == simulator.tick {
            simulator.apply_event(&logs[event_index]);
            event_index += 1;
        }
        simulator.step();
        if let Some(summary) = simulator.summary() {
            return Some(summary);
        }
    }
    None
}

/// 读取输入事件对应的触发 tick。
fn event_tick(event: &InputEvent) -> u32 {
    match event {
        InputEvent::Move { tick, .. }
        | InputEvent::ToggleWeapon { tick }
        | InputEvent::UnlockBow { tick }
        | InputEvent::Pause { tick }
        | InputEvent::Resume { tick }
        | InputEvent::Retreat { tick } => *tick,
    }
}

/// 向量归一化，并返回长度。
fn normalize(x: f32, y: f32) -> (f32, f32, f32) {
    let magnitude = (x * x + y * y).sqrt();
    if magnitude <= f32::EPSILON {
        (0.0, 0.0, 0.0)
    } else {
        (x / magnitude, y / magnitude, magnitude)
    }
}

/// 计算二维距离。
fn distance(ax: f32, ay: f32, bx: f32, by: f32) -> f32 {
    let dx = ax - bx;
    let dy = ay - by;
    (dx * dx + dy * dy).sqrt()
}

/// 判断敌人是否落在玄火镇岳清扫范围内。
fn is_enemy_in_sword_sweep(
    delta_x: f32,
    delta_y: f32,
    facing_x: f32,
    sword_range: f32,
    sword_cleave_half_width: f32,
) -> bool {
    let forward = delta_x * facing_x;
    if forward < 0.0 || forward > sword_range {
        return false;
    }
    delta_y.abs() <= sword_cleave_half_width
}

/// 判断敌人是否落在金钩裂甲清扫范围内。
fn is_enemy_in_hook_spear_sweep(
    delta_x: f32,
    delta_y: f32,
    facing_x: f32,
    hook_spear_range: f32,
    hook_spear_sweep_half_width: f32,
) -> bool {
    let forward = delta_x * facing_x;
    if forward < 0.0 || forward > hook_spear_range {
        return false;
    }
    delta_y.abs() <= hook_spear_sweep_half_width
}

/// 按敌人类型返回金币奖励值。
fn gold_for_enemy(kind: EnemyKind) -> u32 {
    match kind {
        EnemyKind::Chaser => 1,
        EnemyKind::Charger => 2,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn enemy(id: u32, x: f32, y: f32, kind: EnemyKind) -> EnemyState {
        EnemyState {
            id,
            kind,
            x,
            y,
            phase: ChargerPhase::Chase,
            cooldown: CHARGER_IDLE_COOLDOWN_TICKS,
        }
    }

    #[test]
    fn replay_retreat_summary_is_deterministic() {
        let logs = vec![InputEvent::Retreat { tick: 10 }];
        let left = replay(42, true, &logs).expect("summary");
        let right = replay(42, true, &logs).expect("summary");
        assert_eq!(left, right);
        assert_eq!(left.end_reason, EndReason::Retreat);
    }

    #[test]
    fn replay_cycles_between_sword_and_hook_spear_before_bow_unlock() {
        let logs = vec![
            InputEvent::ToggleWeapon { tick: 0 },
            InputEvent::ToggleWeapon { tick: 1 },
            InputEvent::Move {
                tick: 2,
                x: 1,
                y: 0,
            },
            InputEvent::Retreat { tick: 10 },
        ];
        let mut simulator = Simulator::new(7, false);
        simulator.apply_event(&InputEvent::ToggleWeapon { tick: 0 });
        assert_eq!(simulator.player.weapon, WeaponType::HookSpear);
        simulator.apply_event(&InputEvent::ToggleWeapon { tick: 1 });
        assert_eq!(simulator.player.weapon, WeaponType::Sword);

        let summary = replay(7, false, &logs).expect("summary");
        assert_eq!(summary.end_reason, EndReason::Retreat);
    }

    #[test]
    fn replay_unlock_bow_allows_mid_run_toggle() {
        let logs = vec![
            InputEvent::ToggleWeapon { tick: 0 },
            InputEvent::UnlockBow { tick: 5 },
            InputEvent::ToggleWeapon { tick: 6 },
            InputEvent::ToggleWeapon { tick: 7 },
            InputEvent::Retreat { tick: 12 },
        ];
        let summary = replay(99, false, &logs).expect("summary");
        assert_eq!(summary.end_reason, EndReason::Retreat);
    }

    #[test]
    fn ruleset_meta_has_prefixed_hash() {
        let meta = ruleset_meta();
        assert_eq!(meta.ruleset_version, 7);
        assert!(meta.config_hash.starts_with("0x"));
    }

    #[test]
    fn default_ruleset_exposes_shared_geometry() {
        let ruleset = default_ruleset();
        assert_eq!(ruleset.player_radius, 18.0);
        assert_eq!(ruleset.enemy_radius, 18.0);
        assert_eq!(ruleset.player_bounds_inset_x, 62.0);
        assert_eq!(ruleset.player_bounds_inset_top, 113.0);
        assert_eq!(ruleset.player_bounds_inset_bottom, 57.0);
        assert_eq!(ruleset.enemy_bounds_inset_x, 76.0);
        assert_eq!(ruleset.enemy_bounds_inset_top, 143.0);
        assert_eq!(ruleset.enemy_bounds_inset_bottom, 38.0);
        assert_eq!(ruleset.projectile_radius, 10.0);
        assert_eq!(ruleset.bow_spawn_offset, 20.0);
        assert_eq!(ruleset.sword_cleave_half_width, 52.0);
        assert_eq!(ruleset.hook_spear_range, 156.0);
        assert_eq!(ruleset.hook_spear_sweep_half_width, 28.0);
    }

    #[test]
    fn player_movement_clamps_to_visual_bounds() {
        let mut simulator = Simulator::new(1, false);

        simulator.player.x = DEFAULT_RULESET.player_bounds_inset_x - 10.0;
        simulator.player.y = ARENA_HEIGHT - DEFAULT_RULESET.player_bounds_inset_bottom + 12.0;
        simulator.move_x = -1;
        simulator.move_y = 1;
        simulator.update_player_movement();
        assert_eq!(simulator.player.x, DEFAULT_RULESET.player_bounds_inset_x);
        assert_eq!(
            simulator.player.y,
            ARENA_HEIGHT - DEFAULT_RULESET.player_bounds_inset_bottom
        );

        simulator.player.x = ARENA_WIDTH - DEFAULT_RULESET.player_bounds_inset_x + 10.0;
        simulator.player.y = DEFAULT_RULESET.player_bounds_inset_top - 12.0;
        simulator.move_x = 1;
        simulator.move_y = -1;
        simulator.update_player_movement();
        assert_eq!(
            simulator.player.x,
            ARENA_WIDTH - DEFAULT_RULESET.player_bounds_inset_x
        );
        assert_eq!(simulator.player.y, DEFAULT_RULESET.player_bounds_inset_top);
    }

    #[test]
    fn spawned_enemies_start_inside_visual_bounds() {
        let mut simulator = Simulator::new(1, false);
        simulator.tick = BASE_SPAWN_INTERVAL_TICKS;

        simulator.spawn_if_needed();

        let enemy = simulator.enemies.first().expect("spawned enemy");
        assert!(
            enemy.x == DEFAULT_RULESET.enemy_bounds_inset_x
                || enemy.x == ARENA_WIDTH - DEFAULT_RULESET.enemy_bounds_inset_x
        );
        assert!(enemy.y >= DEFAULT_RULESET.enemy_bounds_inset_top);
        assert!(enemy.y <= ARENA_HEIGHT - DEFAULT_RULESET.enemy_bounds_inset_bottom);
    }

    #[test]
    fn charger_charge_stays_inside_visual_bounds() {
        let mut simulator = Simulator::new(1, false);
        simulator.enemies = vec![EnemyState {
            id: 1,
            kind: EnemyKind::Charger,
            x: ARENA_WIDTH - DEFAULT_RULESET.enemy_bounds_inset_x - 2.0,
            y: ARENA_HEIGHT - DEFAULT_RULESET.enemy_bounds_inset_bottom - 2.0,
            phase: ChargerPhase::Charge {
                remaining: CHARGER_CHARGE_TICKS,
                dir_x: 1.0,
                dir_y: 1.0,
            },
            cooldown: 0,
        }];

        simulator.update_enemies();

        let enemy = simulator.enemies.first().expect("charger");
        assert_eq!(enemy.x, ARENA_WIDTH - DEFAULT_RULESET.enemy_bounds_inset_x);
        assert_eq!(
            enemy.y,
            ARENA_HEIGHT - DEFAULT_RULESET.enemy_bounds_inset_bottom
        );
    }

    #[test]
    fn sword_sweep_kills_multiple_enemies_in_one_attack() {
        let mut simulator = Simulator::new(1, false);
        simulator.enemies = vec![
            enemy(
                1,
                simulator.player.x + 36.0,
                simulator.player.y - 20.0,
                EnemyKind::Chaser,
            ),
            enemy(
                2,
                simulator.player.x + 58.0,
                simulator.player.y + 18.0,
                EnemyKind::Chaser,
            ),
            enemy(
                3,
                simulator.player.x + 88.0,
                simulator.player.y + 4.0,
                EnemyKind::Charger,
            ),
        ];

        simulator.resolve_auto_attack();

        assert_eq!(simulator.kills, 3);
        assert_eq!(simulator.gold_earned, 4);
        assert!(simulator.enemies.is_empty());
        assert_eq!(simulator.player.attack_cooldown, SWORD_COOLDOWN_TICKS);
    }

    #[test]
    fn sword_sweep_respects_front_and_lateral_bounds() {
        let mut simulator = Simulator::new(1, false);
        simulator.enemies = vec![
            enemy(
                1,
                simulator.player.x + 24.0,
                simulator.player.y + 16.0,
                EnemyKind::Chaser,
            ),
            enemy(
                2,
                simulator.player.x - 56.0,
                simulator.player.y + 10.0,
                EnemyKind::Chaser,
            ),
            enemy(
                3,
                simulator.player.x + 32.0,
                simulator.player.y + DEFAULT_RULESET.sword_cleave_half_width + 12.0,
                EnemyKind::Charger,
            ),
        ];

        simulator.resolve_auto_attack();

        assert_eq!(simulator.kills, 1);
        assert_eq!(simulator.gold_earned, 1);
        assert_eq!(simulator.enemies.len(), 2);
        assert!(simulator.enemies.iter().any(|item| item.id == 2));
        assert!(simulator.enemies.iter().any(|item| item.id == 3));
    }

    #[test]
    fn hook_spear_sweep_kills_multiple_enemies_in_one_attack() {
        let mut simulator = Simulator::new(1, false);
        simulator.player.weapon = WeaponType::HookSpear;
        simulator.enemies = vec![
            enemy(
                1,
                simulator.player.x + 54.0,
                simulator.player.y - 12.0,
                EnemyKind::Chaser,
            ),
            enemy(
                2,
                simulator.player.x + 102.0,
                simulator.player.y + 10.0,
                EnemyKind::Chaser,
            ),
            enemy(
                3,
                simulator.player.x + 138.0,
                simulator.player.y + 4.0,
                EnemyKind::Charger,
            ),
        ];

        simulator.resolve_auto_attack();

        assert_eq!(simulator.kills, 3);
        assert_eq!(simulator.gold_earned, 4);
        assert!(simulator.enemies.is_empty());
        assert_eq!(simulator.player.attack_cooldown, HOOK_SPEAR_COOLDOWN_TICKS);
    }

    #[test]
    fn hook_spear_sweep_respects_front_and_lateral_bounds() {
        let mut simulator = Simulator::new(1, false);
        simulator.player.weapon = WeaponType::HookSpear;
        simulator.enemies = vec![
            enemy(
                1,
                simulator.player.x + 84.0,
                simulator.player.y + 18.0,
                EnemyKind::Chaser,
            ),
            enemy(
                2,
                simulator.player.x - 88.0,
                simulator.player.y + 6.0,
                EnemyKind::Chaser,
            ),
            enemy(
                3,
                simulator.player.x + 76.0,
                simulator.player.y + DEFAULT_RULESET.hook_spear_sweep_half_width + 12.0,
                EnemyKind::Charger,
            ),
        ];

        simulator.resolve_auto_attack();

        assert_eq!(simulator.kills, 1);
        assert_eq!(simulator.gold_earned, 1);
        assert_eq!(simulator.enemies.len(), 2);
        assert!(simulator.enemies.iter().any(|item| item.id == 2));
        assert!(simulator.enemies.iter().any(|item| item.id == 3));
    }
}
