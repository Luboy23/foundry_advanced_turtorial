use std::{env, fs, path::PathBuf};

use braveman_core::{default_ruleset, ruleset_meta};

/// `xtask` 只负责工程工具能力，不参与线上运行时业务逻辑。
/// 当前唯一子命令是导出前端所需的规则配置文件。
/// 小工具入口：导出前端运行所需的规则集与元数据文件。
/// 用法：cargo run -p xtask -- export-config --frontend ../frontend
fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 读取命令行参数，当前仅支持 export-config 子命令。
    let args = env::args().collect::<Vec<_>>();
    if args.get(1).map(String::as_str) != Some("export-config") {
        eprintln!("usage: cargo run -p xtask -- export-config --frontend ../frontend");
        return Ok(());
    }

    // 解析前端目录参数，缺失时直接返回错误避免静默失败。
    let frontend_index = args
        .iter()
        .position(|arg| arg == "--frontend")
        .ok_or("missing --frontend")?;
    let frontend_dir = PathBuf::from(
        args.get(frontend_index + 1)
            .ok_or("missing frontend path")?,
    );
    let output_dir = frontend_dir.join("src/lib");
    // 目标目录不存在时自动创建，保证首次运行可用。
    fs::create_dir_all(&output_dir)?;

    // 导出规则集与版本哈希，供前端在开局与结算时携带到 API，
    // 后端再据此做 rulesetVersion/configHash 的一致性校验。
    fs::write(
        output_dir.join("braveman-ruleset.generated.json"),
        serde_json::to_string_pretty(&serde_json::json!({
            "meta": ruleset_meta(),
            "ruleset": default_ruleset(),
        }))?,
    )?;

    println!("Exported ruleset config to {}", output_dir.display());
    Ok(())
}
