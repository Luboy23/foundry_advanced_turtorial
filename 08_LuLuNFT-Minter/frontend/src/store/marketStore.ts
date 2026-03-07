import { create } from "zustand";

interface MarketState {
  refreshNonce: number;
  bumpRefresh: () => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  refreshNonce: 0,
  bumpRefresh: () =>
    set((state) => ({ refreshNonce: state.refreshNonce + 1 }))
}));

