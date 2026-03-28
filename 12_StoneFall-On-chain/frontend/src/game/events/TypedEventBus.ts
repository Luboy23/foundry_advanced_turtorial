/**
 * 模块职责：提供 game/events/TypedEventBus.ts 对应的业务能力与对外导出。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

type Listener<T> = (payload: T) => void

/**
 * 类实现：TypedEventBus。
 */
export class TypedEventBus<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<Listener<unknown>>>()

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

  emit<Key extends keyof Events>(event: Key, payload: Events[Key]): void {
    const current = this.listeners.get(event)
    if (!current) {
      return
    }

    for (const listener of current) {
      ;(listener as Listener<Events[Key]>)(payload)
    }
  }

  clear(): void {
    this.listeners.clear()
  }
}
