use std::{
    env,
    net::SocketAddr,
    path::PathBuf,
    process::Command,
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use axum::{
    extract::State,
    http::{header, HeaderValue, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use braveman_core::{replay, ruleset_meta, EndReason, InputEvent};
use dotenvy::dotenv;
use ethers_core::{
    abi::{decode, encode, ParamType, Token},
    types::{Address, Bytes, H256, U256},
    utils::keccak256,
};
use ethers_providers::{Http, Provider};
use ethers_signers::{LocalWallet, Signer};
use serde::{Deserialize, Serialize};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use tower_http::cors::{Any, CorsLayer};

/// API 全局共享状态：
/// - 运行配置（端口、RPC、合约地址）；
/// - 结算签名信息（signer_wallet）；
/// - 规则一致性元数据（rulesetVersion/configHash）。
#[derive(Clone)]
struct AppState {
    /// HTTP 监听地址。
    bind: SocketAddr,
    /// SQLite 文件路径。
    db_path: PathBuf,
    /// 读取链上状态的 RPC 入口。
    rpc_url: String,
    /// EIP-712 domain 使用的链 ID。
    chain_id: u64,
    /// BraveManGame 合约地址。
    contract_address: Address,
    /// 后端结算签名钱包（私钥由环境变量注入）。
    signer_wallet: LocalWallet,
    /// 部署批次标识：用于拒绝旧部署遗留 session。
    deployment_id: String,
    /// 当前规则版本。
    ruleset_version: u32,
    /// 当前规则配置哈希。
    config_hash: String,
}

/// `sessions` 表读取结果，表示一条会话记录的运行态快照。
#[derive(Clone)]
struct SessionRow {
    /// 小写 0x 格式玩家地址。
    player: String,
    /// 会话种子，驱动前后端一致随机序列。
    seed: i64,
    /// 会话状态：active/verified。
    status: String,
    /// 会话过期时间（unix 秒）。
    expires_at: i64,
    /// 会话绑定规则版本。
    ruleset_version: u32,
    /// 会话绑定规则哈希。
    config_hash: String,
    /// 会话创建时读取到的弓解锁状态。
    bow_unlocked: bool,
    /// 会话所属部署批次。
    deployment_id: String,
}

/// `/api/sessions` 请求体。
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionRequest {
    /// 玩家地址。
    player: String,
}

/// 对外暴露的规则元信息。
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RulesetMetaResponse {
    ruleset_version: u32,
    config_hash: String,
}

/// `/api/sessions` 响应体。
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionResponse {
    session_id: String,
    seed: String,
    expires_at: String,
    bow_unlocked: bool,
    ruleset_meta: RulesetMetaResponse,
}

/// `/api/settlements/verify` 请求体。
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct VerifyRequest {
    player: String,
    session_id: String,
    ruleset_version: u32,
    config_hash: String,
    logs: Vec<InputEvent>,
    local_summary: ReplaySummaryWire,
}

/// 为 HTTP 传输定义的重放摘要格式（字段名与前端对齐）。
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ReplaySummaryWire {
    kills: u32,
    survival_ms: u32,
    gold_earned: u32,
    end_reason: EndReason,
}

/// 返回给前端并用于链上 claim 的结算 payload。
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SettlementPayload {
    session_id: String,
    player: String,
    kills: u32,
    survival_ms: u32,
    gold_earned: u32,
    ended_at: u64,
    ruleset_version: u32,
    config_hash: String,
}

/// `/api/settlements/verify` 响应体。
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VerifyResponse {
    settlement: SettlementPayload,
    signature: String,
    replay_summary: ReplaySummaryWire,
}

/// 健康检查响应。
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HealthResponse {
    ok: bool,
    message: Option<String>,
}

/// API 统一错误结构。
#[derive(Debug)]
struct ApiError {
    /// HTTP 状态码。
    status: StatusCode,
    /// 机器可读错误码（前端用于分支处理）。
    code: &'static str,
    /// 玩家可读错误信息。
    message: String,
    /// 是否建议前端展示“可重试”动作。
    retryable: bool,
}

impl ApiError {
    /// 构造统一 API 错误对象，确保前端能按固定字段解析。
    fn new(
        status: StatusCode,
        code: &'static str,
        message: impl Into<String>,
        retryable: bool,
    ) -> Self {
        Self {
            status,
            code,
            message: message.into(),
            retryable,
        }
    }
}

impl IntoResponse for ApiError {
    /// 将业务错误转换成统一 JSON 响应体。
    fn into_response(self) -> Response {
        let body = Json(serde_json::json!({
            "code": self.code,
            "message": self.message,
            "retryable": self.retryable,
        }));
        (self.status, body).into_response()
    }
}

#[tokio::main]
/// API 进程入口：加载配置、初始化数据库并启动 HTTP 服务。
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    // 规则元信息来自 braveman-core，确保 API 与重放内核共用同一配置语义。
    let meta = ruleset_meta();
    let bind: SocketAddr = env::var("BRAVEMAN_API_BIND")
        .unwrap_or_else(|_| "127.0.0.1:8787".to_string())
        .parse()?;
    let db_path = PathBuf::from(
        env::var("BRAVEMAN_DB_PATH").unwrap_or_else(|_| "./braveman.sqlite".to_string()),
    );
    let rpc_url =
        env::var("BRAVEMAN_RPC_URL").unwrap_or_else(|_| "http://127.0.0.1:8545".to_string());
    let chain_id = env::var("BRAVEMAN_CHAIN_ID")
        .unwrap_or_else(|_| "31337".to_string())
        .parse::<u64>()?;
    let contract_address: Address = env::var("BRAVEMAN_CONTRACT_ADDRESS")?.parse()?;
    let signer_wallet: LocalWallet = env::var("BRAVEMAN_SIGNER_PRIVATE_KEY")?
        .parse::<LocalWallet>()?
        .with_chain_id(chain_id);
    let deployment_id = env::var("BRAVEMAN_DEPLOYMENT_ID").unwrap_or_else(|_| "legacy".to_string());

    // 启动时执行一次建表/补列，兼容老版本数据库。
    init_db(&db_path)?;

    let state = Arc::new(AppState {
        bind,
        db_path,
        rpc_url,
        chain_id,
        contract_address,
        signer_wallet,
        deployment_id,
        ruleset_version: meta.ruleset_version,
        config_hash: meta.config_hash,
    });

    // 开发态允许本地 Vite dev/preview 端口跨域访问。
    let cors = CorsLayer::new()
        .allow_origin([
            HeaderValue::from_static("http://127.0.0.1:5173"),
            HeaderValue::from_static("http://localhost:5173"),
            HeaderValue::from_static("http://127.0.0.1:4173"),
            HeaderValue::from_static("http://localhost:4173"),
        ])
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE])
        .allow_credentials(false)
        .expose_headers(Any);

    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/sessions", post(create_session))
        .route("/api/settlements/verify", post(verify_settlement))
        .layer(cors)
        .with_state(state.clone());

    let listener = tokio::net::TcpListener::bind(state.bind).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

/// 健康检查接口：主要验证链路可达与合约可读。
async fn health(State(state): State<Arc<AppState>>) -> Json<HealthResponse> {
    let readiness = ensure_chain_ready(&state).await;
    Json(HealthResponse {
        ok: readiness.is_ok(),
        message: readiness.err(),
    })
}

/// 创建 session：校验地址、检查活跃局、写入数据库并返回开局参数。
async fn create_session(
    State(state): State<Arc<AppState>>,
    Json(request): Json<SessionRequest>,
) -> Result<Json<SessionResponse>, ApiError> {
    // 1) 解析并校验地址。
    let player = parse_address(&request.player)?;
    let now = now_unix();
    // session 生存期固定 1 小时，避免旧局长期占用 active 名额。
    let expires_at = now + 3600;
    // 开局前读取链上弓解锁状态，后续前端模拟会以此为初始能力集。
    let bow_unlocked = read_bow_unlocked_with_retry(&state, player).await?;

    // 2) 同钱包同部署同时间窗口只允许一个 active session。
    let active_exists = count_active_sessions(&state.db_path, player, now, &state.deployment_id)
        .map_err(internal_error)?;
    if active_exists > 0 {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "SESSION_ACTIVE",
            "当前钱包已有未完成的活动 session。",
            false,
        ));
    }

    // 3) 生成确定性 seed 与唯一 sessionId。
    let seed = derive_seed(player, now as u64);
    let session_id = derive_session_id(player, seed, now as u64);
    insert_session(
        &state.db_path,
        &session_id,
        &format_address(player),
        seed as i64,
        expires_at,
        state.ruleset_version,
        &state.config_hash,
        bow_unlocked,
        &state.deployment_id,
        now,
    )
    .map_err(internal_error)?;

    // 4) 返回开局所需完整握手信息。
    Ok(Json(SessionResponse {
        session_id,
        seed: seed.to_string(),
        expires_at: format_rfc3339(expires_at).map_err(internal_error)?,
        bow_unlocked,
        ruleset_meta: RulesetMetaResponse {
            ruleset_version: state.ruleset_version,
            config_hash: state.config_hash.clone(),
        },
    }))
}

/// 结算验证接口：复盘日志、比对本地摘要、签名并返回 settlement payload。
async fn verify_settlement(
    State(state): State<Arc<AppState>>,
    Json(request): Json<VerifyRequest>,
) -> Result<Json<VerifyResponse>, ApiError> {
    let player = parse_address(&request.player)?;
    // A. 首先验证前端请求携带的 ruleset 元数据是否匹配当前后端。
    if request.ruleset_version != state.ruleset_version || request.config_hash != state.config_hash
    {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "RULESET_MISMATCH",
            "前后端规则版本不一致。",
            false,
        ));
    }

    // B. 读取 session，并校验所有权、时效性、部署版本与状态门禁。
    let row = get_session(&state.db_path, &request.session_id)
        .map_err(internal_error)?
        .ok_or_else(|| {
            ApiError::new(
                StatusCode::BAD_REQUEST,
                "INVALID_REQUEST",
                "session 不存在。",
                false,
            )
        })?;

    if row.player != format_address(player) {
        return Err(ApiError::new(
            StatusCode::FORBIDDEN,
            "INVALID_REQUEST",
            "session 与当前钱包不匹配。",
            false,
        ));
    }
    if row.expires_at <= now_unix() {
        return Err(ApiError::new(
            StatusCode::GONE,
            "SESSION_EXPIRED",
            "session 已过期，请重新开局。",
            false,
        ));
    }
    if row.status != "active" {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "INVALID_REQUEST",
            "session 已完成或不可再次验证。",
            false,
        ));
    }
    if row.deployment_id != state.deployment_id {
        return Err(ApiError::new(
            StatusCode::GONE,
            "SESSION_EXPIRED",
            "session 来自旧部署，请重新开局。",
            false,
        ));
    }
    if row.ruleset_version != state.ruleset_version || row.config_hash != state.config_hash {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "RULESET_MISMATCH",
            "session 绑定的规则版本与当前后端不一致。",
            false,
        ));
    }

    // C. 用后端权威模拟器重放日志，得到可信摘要。
    let replay_summary =
        replay(row.seed as u64, row.bow_unlocked, &request.logs).ok_or_else(|| {
            ApiError::new(
                StatusCode::UNPROCESSABLE_ENTITY,
                "REPLAY_MISMATCH",
                "后端无法从日志复盘出有效结算。",
                false,
            )
        })?;
    let replay_wire = ReplaySummaryWire {
        kills: replay_summary.kills,
        survival_ms: replay_summary.survival_ms,
        gold_earned: replay_summary.gold_earned,
        end_reason: replay_summary.end_reason,
    };

    // D. 比较“前端本地摘要”与“后端重放摘要”，不一致则拒绝签名。
    if replay_wire != request.local_summary {
        return Err(ApiError::new(
            StatusCode::UNPROCESSABLE_ENTITY,
            "REPLAY_MISMATCH",
            format!(
                "Replay result differs from local summary. local(k={},s={},g={},e={:?}) replay(k={},s={},g={},e={:?})",
                request.local_summary.kills,
                request.local_summary.survival_ms,
                request.local_summary.gold_earned,
                request.local_summary.end_reason,
                replay_wire.kills,
                replay_wire.survival_ms,
                replay_wire.gold_earned,
                replay_wire.end_reason,
            ),
            false,
        ));
    }

    // E. 组装 settlement 并执行 EIP-712 签名。
    let settlement = SettlementPayload {
        session_id: request.session_id.clone(),
        player: format_address(player),
        kills: replay_wire.kills,
        survival_ms: replay_wire.survival_ms,
        gold_earned: replay_wire.gold_earned,
        ended_at: now_unix() as u64,
        ruleset_version: state.ruleset_version,
        config_hash: state.config_hash.clone(),
    };
    let signature = sign_settlement(&state, &settlement).map_err(|error| {
        ApiError::new(
            StatusCode::SERVICE_UNAVAILABLE,
            "SIGNER_UNAVAILABLE",
            error.to_string(),
            true,
        )
    })?;

    // F. 只要签名成功即标记 verified，防止同 session 二次验证。
    mark_session_verified(&state.db_path, &request.session_id, now_unix())
        .map_err(internal_error)?;

    Ok(Json(VerifyResponse {
        settlement,
        signature,
        replay_summary: replay_wire,
    }))
}

/// 初始化 SQLite 表结构，并兼容旧版本字段补齐。
fn init_db(db_path: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    // 核心会话表 + 预留事件表（便于后续索引扩展）。
    sqlite_exec(
        db_path,
        "
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            player TEXT NOT NULL,
            seed INTEGER NOT NULL,
            status TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            ruleset_version INTEGER NOT NULL,
            config_hash TEXT NOT NULL,
            bow_unlocked INTEGER NOT NULL DEFAULT 0,
            deployment_id TEXT NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL,
            verified_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS indexed_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tx_hash TEXT NOT NULL,
            event_name TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
        ",
    )?;
    // 向后兼容旧库：缺列时补齐，已存在时在 try_add_column 中吞掉重复错误。
    try_add_column(
        db_path,
        "ALTER TABLE sessions ADD COLUMN bow_unlocked INTEGER NOT NULL DEFAULT 0;",
    )?;
    try_add_column(
        db_path,
        "ALTER TABLE sessions ADD COLUMN deployment_id TEXT NOT NULL DEFAULT '';",
    )?;
    Ok(())
}

/// 尝试执行“加列”语句，若列已存在则吞掉重复错误。
fn try_add_column(db_path: &PathBuf, sql: &str) -> Result<(), Box<dyn std::error::Error>> {
    match sqlite_exec(db_path, sql) {
        Ok(_) => Ok(()),
        Err(error) => {
            let message = error.to_string();
            if message.contains("duplicate column name") {
                Ok(())
            } else {
                Err(error)
            }
        }
    }
}

/// 统计某钱包在当前部署下仍有效的 active session 数量。
fn count_active_sessions(
    db_path: &PathBuf,
    player: Address,
    now: i64,
    deployment_id: &str,
) -> Result<i64, Box<dyn std::error::Error>> {
    // active 判定同时绑定 deployment_id，防止重部署后旧 session 污染新局。
    let sql = format!(
        "SELECT COUNT(*) FROM sessions WHERE player = '{}' AND status = 'active' AND expires_at > {} AND deployment_id = '{}';",
        sql_quote(&format_address(player)),
        now,
        sql_quote(deployment_id),
    );
    let output = sqlite_exec(db_path, &sql)?;
    Ok(output.parse::<i64>().unwrap_or(0))
}

/// 插入一条新的 session 记录。
fn insert_session(
    db_path: &PathBuf,
    session_id: &str,
    player: &str,
    seed: i64,
    expires_at: i64,
    ruleset_version: u32,
    config_hash: &str,
    bow_unlocked: bool,
    deployment_id: &str,
    created_at: i64,
) -> Result<(), Box<dyn std::error::Error>> {
    // status 初始固定 active，只有 verify 成功后会转为 verified。
    let sql = format!(
        "INSERT INTO sessions (session_id, player, seed, status, expires_at, ruleset_version, config_hash, bow_unlocked, deployment_id, created_at) VALUES ('{}', '{}', {}, 'active', {}, {}, '{}', {}, '{}', {});",
        sql_quote(session_id),
        sql_quote(player),
        seed,
        expires_at,
        ruleset_version,
        sql_quote(config_hash),
        if bow_unlocked { 1 } else { 0 },
        sql_quote(deployment_id),
        created_at,
    );
    sqlite_exec(db_path, &sql)?;
    Ok(())
}

/// 读取单条 session 记录并解析为结构体。
fn get_session(
    db_path: &PathBuf,
    session_id: &str,
) -> Result<Option<SessionRow>, Box<dyn std::error::Error>> {
    let sql = format!(
        "SELECT player, seed, status, expires_at, ruleset_version, config_hash, bow_unlocked, deployment_id FROM sessions WHERE session_id = '{}';",
        sql_quote(session_id),
    );
    let output = sqlite_exec(db_path, &sql)?;
    if output.is_empty() {
        return Ok(None);
    }

    // sqlite3 默认 `|` 分隔字段，按固定列顺序解析。
    let parts = output.split('|').map(str::trim).collect::<Vec<_>>();
    if parts.len() != 8 {
        return Err(format!("unexpected session row: {output}").into());
    }

    Ok(Some(SessionRow {
        player: parts[0].to_string(),
        seed: parts[1].parse()?,
        status: parts[2].to_string(),
        expires_at: parts[3].parse()?,
        ruleset_version: parts[4].parse()?,
        config_hash: parts[5].to_string(),
        bow_unlocked: parts[6] != "0",
        deployment_id: parts[7].to_string(),
    }))
}

/// 将 session 状态标记为 verified，防止重复验证。
fn mark_session_verified(
    db_path: &PathBuf,
    session_id: &str,
    verified_at: i64,
) -> Result<(), Box<dyn std::error::Error>> {
    // 仅做状态流转，不修改会话 seed/玩家等不可变字段。
    let sql = format!(
        "UPDATE sessions SET status = 'verified', verified_at = {} WHERE session_id = '{}';",
        verified_at,
        sql_quote(session_id),
    );
    sqlite_exec(db_path, &sql)?;
    Ok(())
}

/// 调用 sqlite3 命令执行 SQL，并返回 stdout 文本结果。
fn sqlite_exec(db_path: &PathBuf, sql: &str) -> Result<String, Box<dyn std::error::Error>> {
    // 为减少依赖，教学版本直接复用系统 sqlite3 CLI。
    let output = Command::new("sqlite3").arg(db_path).arg(sql).output()?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr)
            .trim()
            .to_string()
            .into());
    }
    Ok(String::from_utf8(output.stdout)?.trim().to_string())
}

/// 进行最小 SQL 字符串转义，防止单引号破坏语句。
fn sql_quote(value: &str) -> String {
    value.replace('\'', "''")
}

/// 按合约 EIP-712 结构对 settlement 进行签名。
fn sign_settlement(
    state: &AppState,
    settlement: &SettlementPayload,
) -> Result<String, Box<dyn std::error::Error>> {
    // 1) 先把 sessionId/configHash 从 hex 字符串解析成 bytes32。
    let session_bytes = parse_bytes32(&settlement.session_id)?;
    let config_hash_bytes = parse_bytes32(&settlement.config_hash)?;
    // 2) 按 Solidity 中同名类型串计算 TYPEHASH。
    let type_hash = keccak256("Settlement(bytes32 sessionId,address player,uint32 kills,uint32 survivalMs,uint32 goldEarned,uint64 endedAt,uint32 rulesetVersion,bytes32 configHash)");
    let domain_type_hash = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
    );
    let name_hash = keccak256("BraveManGame");
    let version_hash = keccak256("1");
    // 3) 计算 domain separator（name/version/chainId/verifyingContract）。
    let domain_separator = keccak256(encode(&[
        Token::FixedBytes(domain_type_hash.to_vec()),
        Token::FixedBytes(name_hash.to_vec()),
        Token::FixedBytes(version_hash.to_vec()),
        Token::Uint(U256::from(state.chain_id)),
        Token::Address(state.contract_address),
    ]));
    // 4) 按字段顺序编码 settlement struct hash。
    let struct_hash = keccak256(encode(&[
        Token::FixedBytes(type_hash.to_vec()),
        Token::FixedBytes(session_bytes.to_vec()),
        Token::Address(settlement.player.parse::<Address>()?),
        Token::Uint(U256::from(settlement.kills)),
        Token::Uint(U256::from(settlement.survival_ms)),
        Token::Uint(U256::from(settlement.gold_earned)),
        Token::Uint(U256::from(settlement.ended_at)),
        Token::Uint(U256::from(settlement.ruleset_version)),
        Token::FixedBytes(config_hash_bytes.to_vec()),
    ]));
    // 5) 拼接 EIP-712 digest: 0x1901 || domainSeparator || structHash。
    let mut digest_input = Vec::with_capacity(66);
    digest_input.extend_from_slice(&[0x19, 0x01]);
    digest_input.extend_from_slice(&domain_separator);
    digest_input.extend_from_slice(&struct_hash);
    let digest = keccak256(digest_input);
    // 6) 使用后端 signer 私钥对 digest 签名并返回 0x hex。
    let signature = state.signer_wallet.sign_hash(H256::from(digest))?;
    Ok(format!("0x{}", hex::encode(signature.to_vec())))
}

/// 查询玩家是否已持有霜翎逐月解锁道具（tokenId=2）。
async fn read_bow_unlocked(
    state: &AppState,
    player: Address,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let balance = read_erc1155_balance(state, player, 2u64).await?;
    Ok(balance > U256::zero())
}

/// 通用 ERC1155 `balanceOf` 读取逻辑。
async fn read_erc1155_balance(
    state: &AppState,
    owner: Address,
    token_id: u64,
) -> Result<U256, Box<dyn std::error::Error + Send + Sync>> {
    match read_erc1155_balance_via_rpc(state, owner, token_id).await {
        Ok(balance) => Ok(balance),
        Err(rpc_error) => {
            eprintln!("[chain] rpc balanceOf probe failed, falling back to cast: {rpc_error}");
            read_erc1155_balance_via_cast(state, owner, token_id).map_err(|cast_error| {
                format!("rpc error: {rpc_error}; cast fallback error: {cast_error}").into()
            })
        }
    }
}

/// 优先使用原生 JSON-RPC 读取 ERC1155 `balanceOf`。
async fn read_erc1155_balance_via_rpc(
    state: &AppState,
    owner: Address,
    token_id: u64,
) -> Result<U256, Box<dyn std::error::Error + Send + Sync>> {
    let provider = Provider::<Http>::try_from(state.rpc_url.clone())?;
    // 手工拼接 ERC1155 balanceOf calldata，避免引入额外合约绑定代码。
    let selector = &keccak256("balanceOf(address,uint256)")[..4];
    let mut calldata = selector.to_vec();
    calldata.extend_from_slice(&encode(&[
        Token::Address(owner),
        Token::Uint(U256::from(token_id)),
    ]));

    // 直接发起 eth_call，避免交易包装层在不同本地链实现上的兼容差异。
    let raw: Bytes = provider
        .request(
            "eth_call",
            serde_json::json!([
                {
                    "to": format!("{:#x}", state.contract_address),
                    "data": format!("0x{}", hex::encode(calldata)),
                },
                "latest"
            ]),
        )
        .await?;
    let decoded = decode(&[ParamType::Uint(256)], raw.as_ref())?;
    let balance = decoded
        .first()
        .and_then(|token| token.clone().into_uint())
        .ok_or("invalid bow balance response")?;
    Ok(balance)
}

/// 当本机 `ethers-providers -> Anvil` 出现连接兼容问题时，回退到 `cast call`。
fn read_erc1155_balance_via_cast(
    state: &AppState,
    owner: Address,
    token_id: u64,
) -> Result<U256, Box<dyn std::error::Error + Send + Sync>> {
    let output = Command::new("cast")
        .args([
            "call",
            "--rpc-url",
            state.rpc_url.as_str(),
            &format!("{:#x}", state.contract_address),
            "balanceOf(address,uint256)(uint256)",
            &format!("{:#x}", owner),
            &token_id.to_string(),
        ])
        .output()?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr)
            .trim()
            .to_string()
            .into());
    }

    let raw = String::from_utf8(output.stdout)?.trim().to_string();
    parse_u256_output(&raw)
}

/// 兼容 `cast call` 的十进制与十六进制返回格式。
fn parse_u256_output(value: &str) -> Result<U256, Box<dyn std::error::Error + Send + Sync>> {
    if value.is_empty() {
        return Err("empty u256 output".into());
    }
    if let Some(hex) = value.strip_prefix("0x") {
        return Ok(U256::from_str_radix(hex, 16)?);
    }
    Ok(U256::from_dec_str(value)?)
}

/// 读取霜翎逐月解锁状态并带重试，用于应对本地链短暂抖动。
async fn read_bow_unlocked_with_retry(state: &AppState, player: Address) -> Result<bool, ApiError> {
    let mut last_error = None;
    // 轻量退避重试：160ms -> 320ms -> 失败。
    for attempt in 0..3 {
        match read_bow_unlocked(state, player).await {
            Ok(unlocked) => return Ok(unlocked),
            Err(error) => {
                last_error = Some(error.to_string());
                if attempt < 2 {
                    tokio::time::sleep(Duration::from_millis(160 * (attempt + 1) as u64)).await;
                }
            }
        }
    }

    Err(ApiError::new(
        StatusCode::SERVICE_UNAVAILABLE,
        "CHAIN_UNAVAILABLE",
        chain_unavailable_message(last_error.as_deref()),
        true,
    ))
}

/// 检查链与合约是否就绪（通过一次只读调用探活）。
async fn ensure_chain_ready(state: &AppState) -> Result<(), String> {
    // 直接读取 signer 地址的 tokenId=2 余额，若可读说明 RPC+合约均可达。
    read_erc1155_balance(state, state.signer_wallet.address(), 2u64)
        .await
        .map(|_| ())
        .map_err(|error| {
            let detail = error.to_string();
            eprintln!("[health] chain readiness probe failed: {detail}");
            chain_unavailable_message(Some(&detail))
        })
}

/// 统一本地链不可用提示文案。
fn chain_unavailable_message(detail: Option<&str>) -> String {
    // 当前对外统一文案，细节错误仅留作内部调试。
    let base =
        "本地链或游戏合约尚未就绪，请确认 Anvil 正在运行，并重新执行 make deploy 或 make dev。";
    let _ = detail;
    base.to_string()
}

/// 解析并校验 EVM 地址输入。
fn parse_address(value: &str) -> Result<Address, ApiError> {
    value.parse::<Address>().map_err(|_| {
        ApiError::new(
            StatusCode::BAD_REQUEST,
            "INVALID_REQUEST",
            "地址格式不合法。",
            false,
        )
    })
}

/// 把 `0x` hex 字符串解析为 bytes32。
fn parse_bytes32(value: &str) -> Result<[u8; 32], Box<dyn std::error::Error>> {
    let trimmed = value.strip_prefix("0x").unwrap_or(value);
    let bytes = hex::decode(trimmed)?;
    // hex 长度必须严格为 32 字节，避免 EIP-712 编码错位。
    if bytes.len() != 32 {
        return Err("expected 32-byte hex value".into());
    }
    let mut out = [0u8; 32];
    out.copy_from_slice(&bytes);
    Ok(out)
}

/// 基于玩家地址和当前时间派生伪随机种子。
fn derive_seed(player: Address, now: u64) -> u64 {
    // 使用地址+时间做 hash，生成每局不同但可复算的伪随机种子。
    let hash = keccak256([player.as_bytes(), &now.to_be_bytes()].concat());
    u64::from_be_bytes(hash[..8].try_into().expect("seed bytes"))
}

/// 基于玩家、seed、时间派生唯一 sessionId。
fn derive_session_id(player: Address, seed: u64, now: u64) -> String {
    // sessionId 作为后续链上 claim 防重放主键，需保证局级唯一。
    format!(
        "0x{}",
        hex::encode(keccak256(
            [player.as_bytes(), &seed.to_be_bytes(), &now.to_be_bytes()].concat()
        ))
    )
}

/// 将地址格式化为统一的小写 0x 字符串。
fn format_address(address: Address) -> String {
    format!("{address:#x}")
}

/// 获取当前 Unix 时间戳（秒）。
fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("time")
        .as_secs() as i64
}

/// 把 Unix 秒时间转换为 RFC3339 字符串。
fn format_rfc3339(unix: i64) -> Result<String, time::error::Format> {
    OffsetDateTime::from_unix_timestamp(unix)
        .expect("timestamp")
        .format(&Rfc3339)
}

/// 把内部错误包装为统一的 500 API 错误格式。
fn internal_error(error: impl std::fmt::Display) -> ApiError {
    ApiError::new(
        StatusCode::INTERNAL_SERVER_ERROR,
        "INTERNAL_ERROR",
        error.to_string(),
        false,
    )
}
