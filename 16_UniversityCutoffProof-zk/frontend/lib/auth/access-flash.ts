const FLASH_KEY = "zk-exam-pass:access-flash";

export function writeAccessFlash(message: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(FLASH_KEY, message);
}

export function consumeAccessFlash() {
  if (typeof window === "undefined") {
    return null;
  }
  const value = window.sessionStorage.getItem(FLASH_KEY);
  if (value) {
    window.sessionStorage.removeItem(FLASH_KEY);
  }
  return value;
}
