import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearStoredCredential,
  loadCredentialEnvelope,
  persistEncryptedCredential,
  readStoredCredential
} from "@/lib/storage/credential-store";
import type { RuntimeConfig } from "@/types/contract-config";
import type { LocalUnemploymentCredential } from "@/types/domain";

function createLocalStorage() {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    }
  };
}

function createFakeIndexedDb() {
  let hasStore = false;
  const values = new Map<string, unknown>();

  function createRequest<T>(resolver: () => T) {
    const request = {
      result: undefined as T | undefined,
      error: null as Error | null,
      onsuccess: null as ((ev: Event) => unknown) | null,
      onerror: null as ((ev: Event) => unknown) | null
    };

    queueMicrotask(() => {
      try {
        request.result = resolver();
        request.onsuccess?.(new Event("success"));
      } catch (error) {
        request.error = error as Error;
        request.onerror?.(new Event("error"));
      }
    });

    return request as unknown as IDBRequest<T>;
  }

  return {
    open: vi.fn(() => {
      const request = {
        result: undefined as IDBDatabase | undefined,
        error: null as Error | null,
        onsuccess: null as ((ev: Event) => unknown) | null,
        onerror: null as ((ev: Event) => unknown) | null,
        onupgradeneeded: null as ((ev: Event) => unknown) | null
      };

      queueMicrotask(() => {
        const db = {
          objectStoreNames: {
            contains: (name: string) => hasStore && name === "credential-keys"
          },
          createObjectStore: () => {
            hasStore = true;
            return {} as IDBObjectStore;
          },
          transaction: () => {
            const transaction: {
              error: Error | null;
              onerror: ((ev: Event) => unknown) | null;
              oncomplete: ((ev: Event) => unknown) | null;
              objectStore: () => IDBObjectStore;
            } = {
              error: null,
              onerror: null,
              oncomplete: null,
              objectStore: () =>
                ({
                  put: (value: unknown, key: string) =>
                    createRequest(() => {
                      values.set(key, value);
                      return value;
                    }),
                  get: (key: string) => createRequest(() => values.get(key)),
                  delete: (key: string) =>
                    createRequest(() => {
                      values.delete(key);
                      return undefined;
                    })
                }) as unknown as IDBObjectStore
            };

            queueMicrotask(() => {
              transaction.oncomplete?.(new Event("complete"));
            });

            return transaction as unknown as IDBTransaction;
          },
          close: () => {}
        } as unknown as IDBDatabase;

        request.result = db;
        if (!hasStore) {
          request.onupgradeneeded?.(new Event("upgradeneeded"));
        }
        request.onsuccess?.(new Event("success"));
      });

      return request as unknown as IDBOpenDBRequest;
    })
  };
}

const config: RuntimeConfig = {
  roleRegistryAddress: "0x1111111111111111111111111111111111111111",
  rootRegistryAddress: "0x2222222222222222222222222222222222222222",
  benefitDistributorAddress: "0x3333333333333333333333333333333333333333",
  verifierAddress: "0x4444444444444444444444444444444444444444",
  chainId: 31337,
  rpcUrl: "http://127.0.0.1:8545",
  deploymentId: "credential-cache-test",
  deploymentStartBlock: 1,
  demoAddresses: {
    government: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    applicant: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    agency: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    ineligibleApplicant: "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
  },
  zkArtifactPaths: {
    wasm: "/zk/unemployment_benefit_proof.wasm",
    zkey: "/zk/unemployment_benefit_proof_final.zkey"
  }
};

const address = config.demoAddresses.applicant;
const credential: LocalUnemploymentCredential = {
  version: 1,
  setId: "v1",
  setIdBytes32: "0x1234",
  versionNumber: 1,
  referenceDate: 1_744_441_600,
  boundApplicantAddress: address,
  walletBinding: "123",
  identityHash: "456",
  secretSalt: "789",
  leaf: "101112",
  merkleRoot: "131415",
  pathElements: ["1", "2"],
  pathIndices: [0, 1],
  issuedAt: 1_700_000_000
};

describe("credential-store session cache", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    const eventTarget = new EventTarget();
    const localStorage = createLocalStorage();
    const indexedDb = createFakeIndexedDb();
    const windowLike = {
      localStorage,
      indexedDB: indexedDb,
      crypto: webcrypto,
      btoa: (value: string) => Buffer.from(value, "binary").toString("base64"),
      atob: (value: string) => Buffer.from(value, "base64").toString("binary"),
      addEventListener: eventTarget.addEventListener.bind(eventTarget),
      removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
      dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget)
    };

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: windowLike
    });
  });

  afterEach(async () => {
    await clearStoredCredential(config, address).catch(() => undefined);
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: originalWindow
    });
    vi.restoreAllMocks();
  });

  it("reuses the in-session decrypted credential until the stored envelope changes", async () => {
    await persistEncryptedCredential({
      config,
      address,
      credential,
      signature: "0xabc123"
    });

    const indexedDb = window.indexedDB as unknown as { open: ReturnType<typeof vi.fn> };
    indexedDb.open.mockImplementation(() => {
      throw new Error("indexedDB should not be opened when the session cache is warm");
    });

    const cachedCredential = await readStoredCredential(config, address);
    expect(cachedCredential).toEqual(credential);

    const envelope = loadCredentialEnvelope(config, address);
    expect(envelope).not.toBeNull();
    window.localStorage.setItem(
      `unemployment-benefit.local-credential-envelope:${config.chainId}:${config.deploymentId}:${address.toLowerCase()}`,
      JSON.stringify({
        ...envelope!,
        issuedAt: envelope!.issuedAt + 1
      })
    );

    await expect(readStoredCredential(config, address)).rejects.toThrow(
      "indexedDB should not be opened when the session cache is warm"
    );
  });
});
