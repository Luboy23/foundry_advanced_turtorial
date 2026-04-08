/**
 * 轻量类型化事件总线。
 * Phaser 场景与 React 之间的通信全部通过事件名和 payload 类型约束完成。
 */
type Listener<T> = (payload: T) => void

export class TypedEventBus<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<Listener<unknown>>>()

  // 订阅返回显式 unsubscribe，调用方可以在 React effect / Phaser shutdown 中统一清理。
  on<Key extends keyof Events>(
    event: Key,
    listener: Listener<Events[Key]>,
  ): () => void {
    const current = this.listeners.get(event) ?? new Set<Listener<unknown>>()
    current.add(listener as Listener<unknown>)
    this.listeners.set(event, current)

    return () => {
      current.delete(listener as Listener<unknown>)

      if (current.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  // emit 不做异步调度，保持“场景发出后 UI 立刻可见”的时序语义。
  emit<Key extends keyof Events>(event: Key, payload: Events[Key]): void {
    const current = this.listeners.get(event)
    if (!current) {
      return
    }

    for (const listener of current) {
      ;(listener as Listener<Events[Key]>)(payload)
    }
  }

  // destroy 流程中统一清空，避免保留旧 controller 的悬挂回调。
  clear(): void {
    this.listeners.clear()
  }
}
