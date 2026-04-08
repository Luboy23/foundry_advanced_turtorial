export class TypedEventBus<TEvents extends Record<string, unknown>> {
  private listeners = new Map<keyof TEvents, Set<(payload: TEvents[keyof TEvents]) => void>>()

  /**
   * 订阅事件并返回取消函数。
   * 设计要点：同一事件使用 Set 去重，避免重复注册同一回调。
   */
  on<TKey extends keyof TEvents>(event: TKey, listener: (payload: TEvents[TKey]) => void): () => void {
    const listeners = this.listeners.get(event) ?? new Set()
    listeners.add(listener as (payload: TEvents[keyof TEvents]) => void)
    this.listeners.set(event, listeners)
    return () => listeners.delete(listener as (payload: TEvents[keyof TEvents]) => void)
  }

  /**
   * 发布事件。
   * 若当前事件无监听器则直接返回，避免无意义循环。
   */
  emit<TKey extends keyof TEvents>(event: TKey, payload: TEvents[TKey]): void {
    const listeners = this.listeners.get(event)
    if (!listeners) return
    listeners.forEach((listener) => listener(payload as TEvents[keyof TEvents]))
  }

  // 清空所有事件监听器，常用于场景销毁与测试清理。
  clear(): void {
    this.listeners.clear()
  }
}
