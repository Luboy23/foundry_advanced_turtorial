use anyhow::Result;
use dotenvy::dotenv;
use std::env;

#[tokio::main]
async fn main() -> Result<()> {
  dotenv().ok();
  tracing_subscriber::fmt()
    .with_env_filter(
      env::var("RUST_LOG").unwrap_or_else(|_| "angrybirds_api=info,tower_http=info".to_string()),
    )
    .init();

  angrybirds_api::run().await
}
