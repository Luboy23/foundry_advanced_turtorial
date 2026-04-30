const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const contractsDir = path.join(rootDir, "contracts");
const frontendDir = path.join(rootDir, "frontend");
const indexerDir = path.join(rootDir, "services", "indexer");
const deploymentsFile = path.join(contractsDir, "deployments", "local.json");

const runtimeConfigFile = path.join(frontendDir, "public", "contract-config.json");
const frontendEnvFile = path.join(frontendDir, ".env.local");
const indexerEnvFile = path.join(indexerDir, ".env.local");
const currentBillFile = path.join(frontendDir, "server-data", "bills", "current.json");
const claimPackageFile = path.join(frontendDir, "server-data", "claim-packages", "current.json");
const batchDraftFile = path.join(frontendDir, "server-data", "batches", "current.json");
const monthlyConfigsFile = path.join(frontendDir, "server-data", "batches", "monthly-configs.json");
const frontendAbiDir = path.join(frontendDir, "abi");

const abiTargets = [
  {
    source: path.join(contractsDir, "out", "RevenueBatchRegistry.sol", "RevenueBatchRegistry.json"),
    target: path.join(frontendDir, "abi", "RevenueBatchRegistry.json"),
  },
  {
    source: path.join(contractsDir, "out", "CreatorRevenueDistributor.sol", "CreatorRevenueDistributor.json"),
    target: path.join(frontendDir, "abi", "CreatorRevenueDistributor.json"),
  },
];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEFAULT_CHAIN_ID = 31337;
const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_INDEXER_BASE_URL = "http://127.0.0.1:42069";
const ETH_DECIMALS = 18n;
const ETH_BASE_UNITS = 10n ** ETH_DECIMALS;
const SUMMARY_DISPLAY = { minFractionDigits: 2, maxFractionDigits: 4 };
const DETAIL_DISPLAY = { minFractionDigits: 2, maxFractionDigits: 6 };
function buildRollingMonthLabels(activeBatchLabel, total = 4) {
  const [year, month] = String(activeBatchLabel).split("-").map((value) => Number(value));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return [String(activeBatchLabel)];
  }

  const labels = [];
  for (let offset = total - 1; offset >= 0; offset -= 1) {
    let nextYear = year;
    let nextMonth = month - offset;

    while (nextMonth <= 0) {
      nextMonth += 12;
      nextYear -= 1;
    }

    labels.push(`${nextYear}-${String(nextMonth).padStart(2, "0")}`);
  }

  return labels;
}

function keccak256Hex(value) {
  const result = spawnSync("cast", ["keccak", value], { encoding: "utf8" });
  if (result.status !== 0) {
    const message = result.stderr?.trim() || result.stdout?.trim() || "cast keccak failed";
    throw new Error(`Unable to hash batch label ${value}: ${message}`);
  }

  return result.stdout.trim().toLowerCase();
}

function buildBatchLabelMap(activeBatchLabel, activeBatchId) {
  const labels = buildRollingMonthLabels(activeBatchLabel);
  const pairs = labels.map((label) => [keccak256Hex(label), label]);
  pairs.push([String(activeBatchId).toLowerCase(), activeBatchLabel]);
  return Object.fromEntries(pairs);
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (!next) continue;

    if (arg === "--rpc-url") {
      parsed.rpcUrl = next;
      index += 1;
    } else if (arg === "--chain-id") {
      parsed.chainId = next;
      index += 1;
    } else if (arg === "--indexer-base-url") {
      parsed.indexerBaseUrl = next;
      index += 1;
    }
  }

  return parsed;
}

function normalizeChainId(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CHAIN_ID;
}

function normalizeRpcUrl(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : DEFAULT_RPC_URL;
}

function normalizeIndexerBaseUrl(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : DEFAULT_INDEXER_BASE_URL;
}

function normalizeStartBlock(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function copyAbis() {
  ensureDir(path.join(frontendAbiDir, "placeholder.json"));
  const expectedAbiFiles = new Set(abiTargets.map((target) => path.basename(target.target)));

  for (const fileName of fs.readdirSync(frontendAbiDir)) {
    const filePath = path.join(frontendAbiDir, fileName);
    const stats = fs.statSync(filePath);
    if (!stats.isFile() || path.extname(fileName) !== ".json" || expectedAbiFiles.has(fileName)) {
      continue;
    }

    fs.unlinkSync(filePath);
  }

  for (const target of abiTargets) {
    const artifact = readJson(target.source);
    if (!artifact || !Array.isArray(artifact.abi)) {
      throw new Error(`Missing or invalid ABI artifact: ${path.relative(rootDir, target.source)}`);
    }

    ensureDir(target.target);
    fs.writeFileSync(target.target, `${JSON.stringify(artifact.abi, null, 2)}\n`);
  }
}

function mergeEnvFile(filePath, nextValues) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8").split(/\r?\n/) : [];
  const managedKeys = new Set(Object.keys(nextValues));

  const preserved = existing.filter((line) => {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) {
      return line.length > 0;
    }
    const key = line.slice(0, line.indexOf("=")).trim();
    return !managedKeys.has(key);
  });

  const nextLines = [
    ...preserved,
    ...Object.entries(nextValues).map(([key, value]) => `${key}=${value}`),
    "",
  ];

  ensureDir(filePath);
  fs.writeFileSync(filePath, nextLines.join("\n"));
}

function addThousandsSeparators(input) {
  return input.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatAssetAmount(baseUnits, options = SUMMARY_DISPLAY) {
  const normalized = typeof baseUnits === "bigint" ? baseUnits : BigInt(String(baseUnits));
  const negative = normalized < 0n;
  const absolute = negative ? -normalized : normalized;
  const whole = absolute / ETH_BASE_UNITS;
  const fractionRaw = (absolute % ETH_BASE_UNITS).toString().padStart(Number(ETH_DECIMALS), "0");
  const minimum = options.minFractionDigits ?? 2;
  const maximum = options.maxFractionDigits ?? minimum;
  let fraction = fractionRaw.slice(0, maximum).replace(/0+$/, "");

  if (fraction.length < minimum) {
    fraction = fractionRaw.slice(0, minimum);
  }

  return `${negative ? "-" : ""}${addThousandsSeparators(whole.toString())}.${fraction.padEnd(minimum, "0")}`;
}

function writeServerData(deployment) {
  const grossAmountBigInt = BigInt(deployment.activeGrossAmount);
  const creatorNetAmountBigInt = BigInt(deployment.activeCreatorNetAmount);
  const collaboratorAmountBigInt = (grossAmountBigInt - creatorNetAmountBigInt) / 2n;
  const adRevenue = (grossAmountBigInt * 80n) / 100n;
  const membershipBonus = grossAmountBigInt - adRevenue;
  const grossAmount = grossAmountBigInt.toString();
  const creatorNetAmount = creatorNetAmountBigInt.toString();
  const collaboratorAmount = collaboratorAmountBigInt.toString();

  const bill = {
    monthLabel: deployment.activeBatchLabel,
    batchId: deployment.activeBatchLabel,
    batchIdHex: deployment.activeBatchId,
    billId: deployment.activeBillId,
    claimIdHex: deployment.activeClaimId,
    creatorAddress: deployment.creator,
    assetSymbol: "ETH",
    grossAmount,
    creatorNetAmount,
    grossAmountDisplay: formatAssetAmount(grossAmount, SUMMARY_DISPLAY),
    creatorNetAmountDisplay: formatAssetAmount(creatorNetAmount, SUMMARY_DISPLAY),
    status: "claimable",
    breakdown: [
      {
        label: "广告分成收益",
        amount: adRevenue.toString(),
        amountDisplay: formatAssetAmount(adRevenue, DETAIL_DISPLAY),
        description: `基于 ${deployment.activeBatchLabel} 平台结算结果`,
      },
      {
        label: "会员激励奖金",
        amount: membershipBonus.toString(),
        amountDisplay: formatAssetAmount(membershipBonus, DETAIL_DISPLAY),
        description: `基于 ${deployment.activeBatchLabel} 互动激励汇总`,
      },
    ],
    splitRuleSnapshot: [
      {
        role: "creator",
        label: "个人所得",
        recipient: deployment.creator,
        bps: 6000,
        amount: creatorNetAmount,
        amountDisplay: formatAssetAmount(creatorNetAmount, DETAIL_DISPLAY),
      },
      {
        role: "collaborator",
        label: "编导",
        recipient: deployment.collaboratorA,
        bps: 2000,
        amount: collaboratorAmount,
        amountDisplay: formatAssetAmount(collaboratorAmount, DETAIL_DISPLAY),
      },
      {
        role: "collaborator",
        label: "摄影",
        recipient: deployment.collaboratorB,
        bps: 2000,
        amount: collaboratorAmount,
        amountDisplay: formatAssetAmount(collaboratorAmount, DETAIL_DISPLAY),
      },
    ],
  };

  const claimPackage = {
    batchIdHex: deployment.activeBatchId,
    claimIdHex: deployment.activeClaimId,
    creator: deployment.creator,
    grossAmount,
    recipients: [deployment.creator, deployment.collaboratorA, deployment.collaboratorB],
    bps: [6000, 2000, 2000],
    merkleProof: [],
  };

  const batchDraft = {
    batchId: deployment.activeBatchLabel,
    batchIdHex: deployment.activeBatchId,
    monthLabel: deployment.activeBatchLabel,
    status: "published",
    assetSymbol: "ETH",
    grossAmount,
    grossAmountDisplay: formatAssetAmount(grossAmount, SUMMARY_DISPLAY),
    creatorCount: 1,
    collaboratorCount: 2,
    activeCreator: deployment.creator,
    lastSyncedAt: new Date().toISOString(),
  };

  ensureDir(currentBillFile);
  fs.writeFileSync(currentBillFile, `${JSON.stringify(bill, null, 2)}\n`);
  ensureDir(claimPackageFile);
  fs.writeFileSync(claimPackageFile, `${JSON.stringify(claimPackage, null, 2)}\n`);
  ensureDir(batchDraftFile);
  fs.writeFileSync(batchDraftFile, `${JSON.stringify(batchDraft, null, 2)}\n`);
  ensureDir(monthlyConfigsFile);
  fs.writeFileSync(
    monthlyConfigsFile,
    `${JSON.stringify(
      [
        {
          monthLabel: deployment.activeBatchLabel,
          grossAmount,
          updatedAt: new Date().toISOString(),
          isLocked: true,
          lockedAt: new Date().toISOString(),
        },
      ],
      null,
      2
    )}\n`
  );
}

function main() {
  const args = parseArgs();
  const deployment = readJson(deploymentsFile);

  if (!deployment) {
    throw new Error(`Missing deployment manifest: ${path.relative(rootDir, deploymentsFile)}`);
  }

  copyAbis();

  const batchLabelMap = buildBatchLabelMap(deployment.activeBatchLabel, deployment.activeBatchId);

  const runtimeConfig = {
    batchRegistryAddress: deployment.batchRegistryAddress ?? ZERO_ADDRESS,
    distributorAddress: deployment.distributorAddress ?? ZERO_ADDRESS,
    chainId: normalizeChainId(args.chainId),
    rpcUrl: normalizeRpcUrl(args.rpcUrl),
    deploymentId: `creator-revenue-center-${normalizeChainId(args.chainId)}`,
    demoAddresses: {
      platform: deployment.owner ?? ZERO_ADDRESS,
      creator: deployment.creator ?? ZERO_ADDRESS,
      collaboratorA: deployment.collaboratorA ?? ZERO_ADDRESS,
      collaboratorB: deployment.collaboratorB ?? ZERO_ADDRESS,
    },
    activeBatchId: deployment.activeBatchId,
    activeBatchLabel: deployment.activeBatchLabel,
    activeBillId: deployment.activeBillId,
    activeBatchRoot: deployment.activeBatchRoot,
    activeMetadataHash: deployment.activeMetadataHash,
    startBlock: normalizeStartBlock(deployment.startBlock),
    indexerBaseUrl: normalizeIndexerBaseUrl(args.indexerBaseUrl),
    batchLabelMap,
  };

  ensureDir(runtimeConfigFile);
  fs.writeFileSync(runtimeConfigFile, `${JSON.stringify(runtimeConfig, null, 2)}\n`);

  mergeEnvFile(frontendEnvFile, {
    NEXT_PUBLIC_BATCH_REGISTRY_ADDRESS: runtimeConfig.batchRegistryAddress,
    NEXT_PUBLIC_DISTRIBUTOR_ADDRESS: runtimeConfig.distributorAddress,
    NEXT_PUBLIC_CHAIN_ID: String(runtimeConfig.chainId),
    NEXT_PUBLIC_RPC_URL: runtimeConfig.rpcUrl,
    NEXT_PUBLIC_DEPLOYMENT_ID: runtimeConfig.deploymentId,
    NEXT_PUBLIC_START_BLOCK: String(runtimeConfig.startBlock),
    NEXT_PUBLIC_INDEXER_BASE_URL: runtimeConfig.indexerBaseUrl,
    NEXT_PUBLIC_BATCH_LABEL_MAP: JSON.stringify(runtimeConfig.batchLabelMap),
  });

  mergeEnvFile(indexerEnvFile, {
    PONDER_CHAIN_ID: String(runtimeConfig.chainId),
    PONDER_RPC_URL: runtimeConfig.rpcUrl,
    PONDER_BATCH_REGISTRY_ADDRESS: runtimeConfig.batchRegistryAddress,
    PONDER_DISTRIBUTOR_ADDRESS: runtimeConfig.distributorAddress,
    PONDER_START_BLOCK: String(runtimeConfig.startBlock),
    INDEXER_BASE_URL: runtimeConfig.indexerBaseUrl,
    PONDER_BATCH_LABEL_MAP: JSON.stringify(runtimeConfig.batchLabelMap),
  });

  writeServerData(deployment);
}

main();
