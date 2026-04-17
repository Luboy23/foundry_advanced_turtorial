"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/** `useVisibilityOnce` 的可选配置。 */
type UseVisibilityOnceOptions = {
  rootMargin?: string;
};

/**
 * 元素首次进入可视区域后就保持为 `true` 的可见性 Hook。
 *
 * 用于历史记录、列表等“滚动到再加载”的场景，避免页面初次渲染就拉取所有次要数据。
 */
export function useVisibilityOnce<T extends Element>(options?: UseVisibilityOnceOptions) {
  const [node, setNode] = useState<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const supportsIntersectionObserver = useMemo(
    () => typeof window !== "undefined" && typeof window.IntersectionObserver !== "undefined",
    []
  );

  /** 绑定观察目标；在不支持 IntersectionObserver 的环境中直接视为可见。 */
  const ref = useCallback((nextNode: T | null) => {
    setNode(nextNode);
    if (nextNode && !supportsIntersectionObserver) {
      setIsVisible(true);
    }
  }, [supportsIntersectionObserver]);

  useEffect(() => {
    if (isVisible || !supportsIntersectionObserver) {
      return;
    }

    if (!node) {
      return;
    }

    const observer = new window.IntersectionObserver(
      // 一旦元素首次进入视区，就停止观察，避免后续滚动反复触发。
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: options?.rootMargin ?? "180px 0px"
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isVisible, node, options?.rootMargin, supportsIntersectionObserver]);

  return {
    ref,
    isVisible
  };
}
