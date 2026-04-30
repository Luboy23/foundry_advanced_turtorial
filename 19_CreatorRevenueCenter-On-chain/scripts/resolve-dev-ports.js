const fs = require("fs");
const { spawnSync } = require("child_process");

const DEFAULT_ANVIL_HOST = "127.0.0.1";
const DEFAULT_ANVIL_PORT = 8545;
const DEFAULT_INDEXER_PORT = 42069;
const DEFAULT_WEB_PORT = 3000;
const MAX_PORT_SCAN_ATTEMPTS = 100;

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      continue;
    }

    if (current === "--anvil-host") {
      parsed.anvilHost = next;
      index += 1;
    } else if (current === "--anvil-port") {
      parsed.anvilPort = next;
      index += 1;
    } else if (current === "--indexer-port") {
      parsed.indexerPort = next;
      index += 1;
    } else if (current === "--web-port") {
      parsed.webPort = next;
      index += 1;
    } else if (current === "--write-env-file") {
      parsed.writeEnvFile = next;
      index += 1;
    }
  }

  return parsed;
}

function normalizePort(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
}

function normalizeHost(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : DEFAULT_ANVIL_HOST;
}

function isPortOccupied(port) {
  const result = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], {
    encoding: "utf8",
  });

  if (result.status === 0) {
    return true;
  }

  if (result.status === 1) {
    return false;
  }

  const message = result.stderr?.trim() || result.stdout?.trim() || `lsof exited with code ${result.status}`;
  throw new Error(`检测端口 ${port} 是否占用失败：${message}`);
}

function findAvailablePort({ requestedPort, reservedPorts, serviceName }) {
  let port = requestedPort;

  for (let attempt = 0; attempt < MAX_PORT_SCAN_ATTEMPTS; attempt += 1) {
    if (port > 65535) {
      break;
    }

    if (reservedPorts.has(port)) {
      port += 1;
      continue;
    }

    if (!isPortOccupied(port)) {
      return port;
    }

    port += 1;
  }

  throw new Error(`未能为 ${serviceName} 找到可用端口，请调整起始端口后重试。`);
}

function renderEnvFile(config) {
  return [
    `ANVIL_HOST=${config.anvilHost}`,
    `ANVIL_PORT=${config.anvilPort}`,
    `RPC_URL=${config.rpcUrl}`,
    `INDEXER_PORT=${config.indexerPort}`,
    `INDEXER_BASE_URL=${config.indexerBaseUrl}`,
    `WEB_PORT=${config.webPort}`,
    "",
  ].join("\n");
}

function printSummary(config) {
  const adjustments = [];

  if (config.anvilPort !== config.requestedAnvilPort) {
    adjustments.push(`Anvil ${config.requestedAnvilPort} -> ${config.anvilPort}`);
  }
  if (config.indexerPort !== config.requestedIndexerPort) {
    adjustments.push(`Indexer ${config.requestedIndexerPort} -> ${config.indexerPort}`);
  }
  if (config.webPort !== config.requestedWebPort) {
    adjustments.push(`Next ${config.requestedWebPort} -> ${config.webPort}`);
  }

  if (adjustments.length > 0) {
    console.log(`检测到端口占用，已自动切换：${adjustments.join(", ")}`);
  } else {
    console.log(`使用默认端口：Anvil=${config.anvilPort}, Indexer=${config.indexerPort}, Next=${config.webPort}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const anvilHost = normalizeHost(args.anvilHost);
  const requestedAnvilPort = normalizePort(args.anvilPort, DEFAULT_ANVIL_PORT);
  const requestedIndexerPort = normalizePort(args.indexerPort, DEFAULT_INDEXER_PORT);
  const requestedWebPort = normalizePort(args.webPort, DEFAULT_WEB_PORT);
  const reservedPorts = new Set();

  const anvilPort = findAvailablePort({
    requestedPort: requestedAnvilPort,
    reservedPorts,
    serviceName: "Anvil",
  });
  reservedPorts.add(anvilPort);

  const indexerPort = findAvailablePort({
    requestedPort: requestedIndexerPort,
    reservedPorts,
    serviceName: "Indexer",
  });
  reservedPorts.add(indexerPort);

  const webPort = findAvailablePort({
    requestedPort: requestedWebPort,
    reservedPorts,
    serviceName: "Next.js",
  });

  const config = {
    anvilHost,
    anvilPort,
    requestedAnvilPort,
    indexerPort,
    requestedIndexerPort,
    webPort,
    requestedWebPort,
    rpcUrl: `http://${anvilHost}:${anvilPort}`,
    indexerBaseUrl: `http://127.0.0.1:${indexerPort}`,
  };

  const envContent = renderEnvFile(config);
  if (args.writeEnvFile) {
    fs.writeFileSync(args.writeEnvFile, envContent);
  } else {
    process.stdout.write(envContent);
  }

  printSummary(config);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
