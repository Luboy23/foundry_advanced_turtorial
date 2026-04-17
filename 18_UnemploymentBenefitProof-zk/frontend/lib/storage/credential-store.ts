import type { Address, RuntimeConfig } from "@/types/contract-config";
import type { EncryptedCredentialEnvelope, LocalUnemploymentCredential } from "@/types/domain";
import { getRuntimeScope } from "@/lib/runtime-config";

/**
 * 浏览器本地资格凭证存储层。
 *
 * 这一层把“可同步的密文 envelope”和“只能留在本机的 AES key”拆开保存：
 * - 密文放在 localStorage，便于页面刷新和多标签页同步；
 * - 密钥放在 IndexedDB，减少被直接复制的风险；
 * - 最近一次解密结果会放进内存缓存，降低同页重复解密开销。
 */
const LOCAL_CREDENTIAL_EVENT = "unemployment-benefit.local-credential-envelope:change";
const DB_NAME = "unemployment-benefit-credentials";
const DB_VERSION = 1;
const KEY_STORE = "credential-keys";
const sessionCredentialCache = new Map<
  string,
  {
    issuedAt: number;
    credentialVersion: number;
    setIdBytes32: `0x${string}`;
    credential: LocalUnemploymentCredential;
  }
>();

function emitLocalCredentialChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(LOCAL_CREDENTIAL_EVENT));
}

/** 生成 localStorage 中密文 envelope 的命名空间键，确保不同部署和账户互不污染。 */
function getCredentialEnvelopeKey(config: RuntimeConfig, address: Address) {
  return `unemployment-benefit.local-credential-envelope:${getRuntimeScope(config, address)}`;
}

/** 生成 IndexedDB 中 AES key 的命名空间键。 */
function getCredentialKeyStoreKey(config: RuntimeConfig, address: Address) {
  return `credential-key:${getRuntimeScope(config, address)}`;
}

/** 生成进程内会话缓存键，避免同页重复解密同一份凭证。 */
function getCredentialSessionCacheKey(config: RuntimeConfig, address: Address) {
  return `credential-session:${getRuntimeScope(config, address)}`;
}

/** 监听本地凭证变化，统一处理当前标签页与其他标签页的同步刷新。 */
export function subscribeCredentialEnvelope(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = () => onStoreChange();
  window.addEventListener("storage", handleChange);
  window.addEventListener(LOCAL_CREDENTIAL_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(LOCAL_CREDENTIAL_EVENT, handleChange);
  };
}

/** 主动触发一次凭证变化事件，供 Hook 在签发完成后刷新快照。 */
export function reloadCredentialEnvelope() {
  emitLocalCredentialChange();
}

/** 从 localStorage 读取密文 envelope；解析失败时返回 `null`，交给上层决定是否提示错误。 */
export function loadCredentialEnvelope(config: RuntimeConfig, address: Address) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getCredentialEnvelopeKey(config, address));
    return raw ? (JSON.parse(raw) as EncryptedCredentialEnvelope) : null;
  } catch {
    return null;
  }
}

/** 保存最新的密文 envelope，并广播给当前窗口与其他标签页。 */
export function saveCredentialEnvelope(config: RuntimeConfig, address: Address, envelope: EncryptedCredentialEnvelope) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getCredentialEnvelopeKey(config, address), JSON.stringify(envelope));
  emitLocalCredentialChange();
}

/** 清除当前账户的密文、会话缓存并广播刷新。 */
export function clearCredentialEnvelope(config: RuntimeConfig, address: Address) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getCredentialEnvelopeKey(config, address));
  sessionCredentialCache.delete(getCredentialSessionCacheKey(config, address));
  emitLocalCredentialChange();
}

/** 确认浏览器具备 Web Crypto 能力；不支持时直接阻断本地凭证功能。 */
function ensureBrowserCrypto() {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("当前浏览器暂不支持本地凭证加密存储。");
  }

  return window.crypto;
}

/** 把二进制安全地编码成 base64，便于落到 JSON envelope。 */
function bytesToBase64(bytes: Uint8Array) {
  let output = "";
  bytes.forEach((value) => {
    output += String.fromCharCode(value);
  });
  return window.btoa(output);
}

/** 从 base64 恢复二进制字节数组，供 AES-GCM 解密使用。 */
function base64ToBytes(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/**
 * 打开 IndexedDB 中的密钥库。
 *
 * key 之所以不和 envelope 放在同一个 localStorage，是为了降低“复制字符串即可复用”
 * 的风险，让攻击者至少需要同时拿到签名派生 key 或本机 IndexedDB 内容。
 */
async function openCredentialKeyDb() {
  if (typeof window === "undefined" || typeof window.indexedDB === "undefined") {
    throw new Error("当前浏览器暂不支持安全凭证存储。");
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KEY_STORE)) {
        db.createObjectStore(KEY_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("当前未能打开本地凭证存储。"));
  });
}

/** 封装对 IndexedDB 单个 object store 的读写流程，统一错误处理和连接关闭。 */
async function withKeyStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openCredentialKeyDb();

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(KEY_STORE, mode);
    const store = transaction.objectStore(KEY_STORE);
    const request = action(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("当前未能完成本地凭证存储操作。"));
    transaction.onerror = () => reject(transaction.error ?? new Error("当前未能完成本地凭证存储操作。"));
    transaction.oncomplete = () => db.close();
  });
}

/** 根据用户签名派生 AES-GCM 密钥，使“签名证明身份”和“本地解密资格凭证”复用同一动作。 */
export async function deriveCredentialKeyFromSignature(signature: `0x${string}` | string) {
  const crypto = ensureBrowserCrypto();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(signature));

  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** 把派生出的密钥写入 IndexedDB。 */
export async function storeCredentialKey(config: RuntimeConfig, address: Address, key: CryptoKey) {
  await withKeyStore("readwrite", (store) => store.put(key, getCredentialKeyStoreKey(config, address)));
}

/** 读取当前账户对应的本地密钥。 */
export async function loadCredentialKey(config: RuntimeConfig, address: Address) {
  const key = await withKeyStore("readonly", (store) => store.get(getCredentialKeyStoreKey(config, address)));
  return (key as CryptoKey | undefined) ?? null;
}

/** 删除本地密钥，通常与清空凭证一起调用。 */
export async function deleteCredentialKey(config: RuntimeConfig, address: Address) {
  await withKeyStore("readwrite", (store) => store.delete(getCredentialKeyStoreKey(config, address)));
}

/**
 * 使用 AES-GCM 加密一份私有凭证。
 *
 * envelope 中额外携带 issuedAt / version / setId 信息，目的是让上层可以在不解密正文
 * 的前提下快速判断缓存是否命中。
 */
export async function encryptCredential(
  config: RuntimeConfig,
  address: Address,
  credential: LocalUnemploymentCredential,
  key: CryptoKey
): Promise<EncryptedCredentialEnvelope> {
  const crypto = ensureBrowserCrypto();
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(credential));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plaintext);

  return {
    version: 1,
    scope: getRuntimeScope(config, address),
    address,
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    issuedAt: Date.now(),
    credentialVersion: credential.versionNumber,
    setIdBytes32: credential.setIdBytes32
  };
}

/** 解密一份密文 envelope，恢复出业务层可直接使用的 LocalUnemploymentCredential。 */
export async function decryptCredential(envelope: EncryptedCredentialEnvelope, key: CryptoKey) {
  const crypto = ensureBrowserCrypto();
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(envelope.nonce)
    },
    key,
    base64ToBytes(envelope.ciphertext)
  );

  return JSON.parse(new TextDecoder().decode(plaintext)) as LocalUnemploymentCredential;
}

/** 完整执行“签名派生密钥 -> 加密凭证 -> 写入存储 -> 刷新会话缓存”的本地签发流程。 */
export async function persistEncryptedCredential(args: {
  config: RuntimeConfig;
  address: Address;
  credential: LocalUnemploymentCredential;
  signature: `0x${string}` | string;
}) {
  const key = await deriveCredentialKeyFromSignature(args.signature);
  await storeCredentialKey(args.config, args.address, key);
  const envelope = await encryptCredential(args.config, args.address, args.credential, key);
  // 会话缓存只存在当前标签页，用来避免用户在同一次访问里重复解密同一份凭证。
  sessionCredentialCache.set(getCredentialSessionCacheKey(args.config, args.address), {
    issuedAt: envelope.issuedAt,
    credentialVersion: envelope.credentialVersion,
    setIdBytes32: envelope.setIdBytes32,
    credential: args.credential
  });
  saveCredentialEnvelope(args.config, args.address, envelope);
  return envelope;
}

/**
 * 读取当前账户的本地凭证。
 *
 * 优先命中内存缓存；缓存失效时再读 IndexedDB + localStorage。这样可以把“凭证安全性”和
 * “页面交互流畅度”同时兼顾住。
 */
export async function readStoredCredential(config: RuntimeConfig, address: Address) {
  const envelope = loadCredentialEnvelope(config, address);
  if (!envelope) {
    sessionCredentialCache.delete(getCredentialSessionCacheKey(config, address));
    return null;
  }

  const sessionCacheKey = getCredentialSessionCacheKey(config, address);
  const cached = sessionCredentialCache.get(sessionCacheKey);
  if (
    cached &&
    cached.issuedAt === envelope.issuedAt &&
    cached.credentialVersion === envelope.credentialVersion &&
    cached.setIdBytes32 === envelope.setIdBytes32
  ) {
    return cached.credential;
  }

  const key = await loadCredentialKey(config, address);
  if (!key) {
    sessionCredentialCache.delete(sessionCacheKey);
    throw new Error("当前本地资格凭证暂不可用，请重新领取。");
  }

  const credential = await decryptCredential(envelope, key);
  sessionCredentialCache.set(sessionCacheKey, {
    issuedAt: envelope.issuedAt,
    credentialVersion: envelope.credentialVersion,
    setIdBytes32: envelope.setIdBytes32,
    credential
  });
  return credential;
}

/** 清除当前账户的会话缓存、IndexedDB 密钥和 localStorage 密文。 */
export async function clearStoredCredential(config: RuntimeConfig, address: Address) {
  sessionCredentialCache.delete(getCredentialSessionCacheKey(config, address));
  await deleteCredentialKey(config, address);
  clearCredentialEnvelope(config, address);
}
