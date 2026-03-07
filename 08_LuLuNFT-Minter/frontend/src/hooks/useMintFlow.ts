"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UploadCounts = {
  imageDone: number;
  imageTotal: number;
  metaDone: number;
  metaTotal: number;
};

type UploadPhase = "images" | "metadata" | null;

type BaseImageItem = {
  name: string;
  preview: string;
  blob: Blob;
  meta: string;
  customName?: string;
  customSymbol?: string;
  imageUrl?: string;
  imagePath?: string;
};

export const useMintFlow = <TImageItem extends BaseImageItem>({
  imageItems,
  setImageItems,
  getEffectiveName,
  getEffectiveSymbol,
  collectionName = "LuLuNFT藏品工坊",
  description = "LuLuNFT藏品工坊 本地铸造"
}: {
  imageItems: TImageItem[];
  setImageItems: (
    next: TImageItem[] | ((prev: TImageItem[]) => TImageItem[])
  ) => void;
  getEffectiveName: (item: TImageItem, index: number) => string;
  getEffectiveSymbol: (item: TImageItem) => string;
  collectionName?: string;
  description?: string;
}) => {
  const [uploadCounts, setUploadCounts] = useState<UploadCounts>({
    imageDone: 0,
    imageTotal: 0,
    metaDone: 0,
    metaTotal: 0
  });
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>(null);
  const [uploadStage, setUploadStage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  // 用 AbortController 控制当前上传会话的中断（图片和 metadata 共用）
  const abortRef = useRef<AbortController | null>(null);

  const resetUpload = useCallback(() => {
    // 重置进度与错误，确保每次铸造流程都是干净状态
    setUploadCounts({
      imageDone: 0,
      imageTotal: 0,
      metaDone: 0,
      metaTotal: 0
    });
    setUploadPhase(null);
    setUploadStage(null);
    setUploadError(null);
    setIsCancelling(false);
    abortRef.current = null;
  }, []);

  // 统一走本地 API：上传到 HTTP 静态资源目录（由后端 route.ts 处理）
  const uploadToHttpStorage = useCallback(
    async (
      blob: Blob,
      filename: string,
      signal?: AbortSignal,
      context?: { runId?: string; index?: number; kind?: string }
    ) => {
      const formData = new FormData();
      formData.append(
        "file",
        new File([blob], filename, { type: blob.type })
      );
      if (context?.runId) formData.append("runId", context.runId);
      if (context?.index !== undefined) {
        formData.append("index", String(context.index));
      }
      if (context?.kind) formData.append("kind", context.kind);

      const response = await fetch("/api/storage", {
        method: "POST",
        body: formData,
        signal
      });

      if (!response.ok) {
        const payload = (await response.json()) as {
          error?: string;
          detail?: string;
        };
        throw new Error(
          payload.detail
            ? `${payload.error ?? "上传失败"}：${payload.detail}`
            : payload.error ?? "静态资源服务不可用"
        );
      }

      const payload = (await response.json()) as {
        url?: string;
        path?: string;
      };
      if (!payload.url) {
        throw new Error("未获取静态资源地址");
      }

      // uri/url 统一给 tokenURI 使用；path 用于前端高级信息展示
      return {
        uri: payload.url,
        url: payload.url,
        path: payload.path
      };
    },
    []
  );

  // 分阶段上传图片与元数据，顺序执行以便进度可追踪、可中断
  const startUpload = useCallback(async () => {
    if (imageItems.length === 0) {
      return [] as string[];
    }

    try {
      // runId 将同一次铸造的图片与 metadata 归档到同一目录，便于排错
      const runId = `run-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2, 8)}`;
      setUploadError(null);
      abortRef.current = new AbortController();
      setUploadCounts({
        imageDone: 0,
        imageTotal: imageItems.length,
        metaDone: 0,
        metaTotal: imageItems.length
      });
      setUploadPhase("images");

      const tokenUris: string[] = [];
      for (let i = 0; i < imageItems.length; i++) {
        const item = imageItems[i];
        // 加随机后缀避免同名文件覆盖
        const rand = Math.random().toString(16).slice(2, 8);
        const originalName = item.name || `image-${i + 1}.webp`;
        const dotIndex = originalName.lastIndexOf(".");
        const baseName =
          dotIndex > 0 ? originalName.slice(0, dotIndex) : originalName;
        const extension =
          dotIndex > 0 ? originalName.slice(dotIndex) : "";
        const uniqueImageName = `${baseName}-${i + 1}-${rand}${extension}`;
        const uniqueMetaName = `metadata-${i + 1}-${rand}.json`;
        setUploadPhase("images");
        setUploadStage(`上传图片 ${i + 1}/${imageItems.length}...`);
        if (abortRef.current?.signal.aborted) {
          throw new Error("已取消");
        }

        // 先上传图片，得到静态资源 URL
        const imageUpload = await uploadToHttpStorage(
          item.blob,
          uniqueImageName,
          abortRef.current?.signal,
          { runId, index: i, kind: "image" }
        );
        setImageItems((prev) =>
          prev.map((prevItem, index) =>
                index === i
                  ? {
                      ...prevItem,
                      imageUrl: imageUpload.url,
                      imagePath: imageUpload.path
                    }
                  : prevItem
              )
          );
        setUploadCounts((prev) => ({
          ...prev,
          imageDone: Math.min(prev.imageTotal, i + 1)
        }));

        const name = getEffectiveName(item, i);
        const symbol = getEffectiveSymbol(item);
        // 再生成并上传元数据，得到 tokenURI
        const metadata = {
          name,
          symbol,
          collection: collectionName,
          description,
          image: imageUpload.uri,
          attributes: [
            {
              trait_type: "符号",
              value: symbol
            }
          ]
        };

        setUploadStage(`上传元数据 ${i + 1}/${imageItems.length}...`);
        setUploadPhase("metadata");
        if (abortRef.current?.signal.aborted) {
          throw new Error("已取消");
        }

        const metadataBlob = new Blob([JSON.stringify(metadata)], {
          type: "application/json"
        });
        const tokenUpload = await uploadToHttpStorage(
          metadataBlob,
          uniqueMetaName,
          abortRef.current?.signal,
          { runId, index: i, kind: "metadata" }
        );
        // metadata 文件地址就是合约写入的 tokenURI
        tokenUris.push(tokenUpload.uri);
        setUploadCounts((prev) => ({
          ...prev,
          metaDone: Math.min(prev.metaTotal, i + 1)
        }));
      }

      setUploadStage(null);
      setUploadPhase(null);
      abortRef.current = null;
      setIsCancelling(false);
      return tokenUris;
    } catch (error) {
      // 无论失败还是中断，都要清理会话状态
      setUploadStage(null);
      setUploadPhase(null);
      abortRef.current = null;
      setIsCancelling(false);
      throw error;
    }
  }, [
    collectionName,
    description,
    getEffectiveName,
    getEffectiveSymbol,
    imageItems,
    setImageItems,
    uploadToHttpStorage
  ]);

  // 触发中断信号，前端停止后续上传
  const cancelUpload = useCallback(() => {
    if (!abortRef.current) return;
    setIsCancelling(true);
    abortRef.current.abort();
  }, []);

  useEffect(() => {
    // 没有图片时重置进度
    if (imageItems.length === 0) {
      resetUpload();
    }
  }, [imageItems.length, resetUpload]);

  return {
    uploadCounts,
    uploadPhase,
    uploadStage,
    uploadError,
    setUploadError,
    isCancelling,
    resetUpload,
    cancelUpload,
    startUpload
  };
};
