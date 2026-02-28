// 获取当前已连接的钱包地址（优先读取 WalletConnect 注入的全局状态）。
const getConnectedAccount = async () => {
  if (typeof window === "undefined") return null;

  // 优先使用 WalletConnect.jsx 暴露的状态
  if (window.__walletStatus) {
    return window.__walletStatus.isConnected ? window.__walletStatus.address : null;
  }

  // 回退到原生钱包 API
  if (!window.ethereum) return null;
  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    return Array.isArray(accounts) && accounts.length > 0 ? accounts[0] : null;
  } catch (error) {
    return null;
  }
};

// 订阅钱包账户变化：同时监听自定义事件与钱包原生事件
const onAccountChanged = (handler) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  // 处理钱包原生 accountsChanged 事件
  const handleAccounts = (accounts) => {
    const account =
      Array.isArray(accounts) && accounts.length > 0 ? accounts[0] : null;
    handler(account);
  };

  // 处理 WalletConnect.jsx 发出的自定义事件
  const handleWalletStatus = (event) => {
    const detail = event?.detail || {};
    const account = detail.isConnected ? detail.address : null;
    handler(account || null);
  };

  window.addEventListener("wallet:status", handleWalletStatus);

  if (window.ethereum?.on) {
    window.ethereum.on("accountsChanged", handleAccounts);
  }

  // 返回取消订阅函数
  return () => {
    window.removeEventListener("wallet:status", handleWalletStatus);
    if (window.ethereum?.removeListener) {
      window.ethereum.removeListener("accountsChanged", handleAccounts);
    }
  };
};

export { getConnectedAccount, onAccountChanged };
