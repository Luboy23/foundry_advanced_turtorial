import type { Address } from "@/types/contract-config";
import type { EncryptedCredentialEnvelope, LocalAgeCredential } from "@/types/domain";

const LOCAL_CREDENTIAL_KEY = "alcohol-age-gate.local-credential-envelope";
const LOCAL_CREDENTIAL_EVENT = "alcohol-age-gate.local-credential-envelope:change";
const DB_NAME = "alcohol-age-gate-credentials";
const DB_VERSION = 1;
const KEY_STORE = "credential-keys";

let cachedEnvelopeRaw: string | null | undefined;
let cachedEnvelope: EncryptedCredentialEnvelope | null = null;

function emitLocalCredentialChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(LOCAL_CREDENTIAL_EVENT));
}

function getServerEnvelopeSnapshot() {
  return null;
}

export function loadCredentialEnvelope(): EncryptedCredentialEnvelope | null {
  if (typeof window === "undefined") {
    return getServerEnvelopeSnapshot();
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_CREDENTIAL_KEY);
    if (raw === cachedEnvelopeRaw) {
      return cachedEnvelope;
    }

    cachedEnvelopeRaw = raw;
    cachedEnvelope = raw ? (JSON.parse(raw) as EncryptedCredentialEnvelope) : null;
    return cachedEnvelope;
  } catch {
    cachedEnvelopeRaw = null;
    cachedEnvelope = null;
    return cachedEnvelope;
  }
}

export function saveCredentialEnvelope(envelope: EncryptedCredentialEnvelope) {
  if (typeof window === "undefined") {
    return;
  }

  const raw = JSON.stringify(envelope);
  window.localStorage.setItem(LOCAL_CREDENTIAL_KEY, raw);
  cachedEnvelopeRaw = raw;
  cachedEnvelope = envelope;
  emitLocalCredentialChange();
}

export function clearCredentialEnvelope() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(LOCAL_CREDENTIAL_KEY);
  cachedEnvelopeRaw = null;
  cachedEnvelope = null;
  emitLocalCredentialChange();
}

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

export function reloadCredentialEnvelope() {
  emitLocalCredentialChange();
}

function ensureBrowserCrypto() {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("当前浏览器暂不支持本地凭证加密存储。");
  }

  return window.crypto;
}

function bytesToBase64(bytes: Uint8Array) {
  let output = "";
  bytes.forEach((value) => {
    output += String.fromCharCode(value);
  });
  return window.btoa(output);
}

function base64ToBytes(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

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

export async function deriveCredentialKeyFromSignature(signature: `0x${string}` | string) {
  const crypto = ensureBrowserCrypto();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(signature));

  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function storeCredentialKey(address: Address, key: CryptoKey) {
  await withKeyStore("readwrite", (store) => store.put(key, address.toLowerCase()));
}

export async function loadCredentialKey(address: Address) {
  const key = await withKeyStore("readonly", (store) => store.get(address.toLowerCase()));
  return (key as CryptoKey | undefined) ?? null;
}

export async function deleteCredentialKey(address: Address) {
  await withKeyStore("readwrite", (store) => store.delete(address.toLowerCase()));
}

export async function encryptCredential(
  credential: LocalAgeCredential,
  key: CryptoKey
): Promise<EncryptedCredentialEnvelope> {
  const crypto = ensureBrowserCrypto();
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(credential));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plaintext);

  return {
    version: 1,
    address: credential.boundBuyerAddress,
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    issuedAt: Date.now(),
    credentialVersion: credential.versionNumber,
    setIdBytes32: credential.setIdBytes32
  };
}

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

  return JSON.parse(new TextDecoder().decode(plaintext)) as LocalAgeCredential;
}

export async function persistEncryptedCredential(args: {
  address: Address;
  credential: LocalAgeCredential;
  signature: `0x${string}` | string;
}) {
  const currentEnvelope = loadCredentialEnvelope();
  if (currentEnvelope && currentEnvelope.address.toLowerCase() !== args.address.toLowerCase()) {
    await deleteCredentialKey(currentEnvelope.address);
  }

  const key = await deriveCredentialKeyFromSignature(args.signature);
  await storeCredentialKey(args.address, key);
  const envelope = await encryptCredential(args.credential, key);
  saveCredentialEnvelope(envelope);

  return envelope;
}

export async function readStoredCredential(address: Address) {
  const envelope = loadCredentialEnvelope();
  if (!envelope || envelope.address.toLowerCase() !== address.toLowerCase()) {
    return null;
  }

  const key = await loadCredentialKey(address);
  if (!key) {
    throw new Error("当前本地凭证暂不可用，请重新领取年龄凭证。");
  }

  const credential = await decryptCredential(envelope, key);
  if (!Number.isInteger(credential.eligibleFromYmd)) {
    throw new Error("当前本地凭证格式已更新，请重新领取年龄凭证。");
  }

  return credential;
}

export async function clearStoredCredential(address?: Address) {
  const envelope = loadCredentialEnvelope();
  const targetAddress = address ?? envelope?.address;

  if (targetAddress) {
    await deleteCredentialKey(targetAddress);
  }

  clearCredentialEnvelope();
}
