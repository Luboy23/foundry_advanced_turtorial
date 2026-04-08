"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useClientMounted } from "@/hooks/useClientMounted";
import { useCreateEvent } from "@/hooks/useCreateEvent";
import { copy } from "@/lib/copy";
import { EVENT_TAGS, type EventTag } from "@/lib/event-metadata";

type CreateEventFormCardProps = {
  owner: `0x${string}` | null;
  resolver: `0x${string}` | null;
  isConnected: boolean;
  isWrongNetwork: boolean;
};

type MetadataMode = "uri" | "local";

type ExtraFieldRow = {
  id: number;
  key: string;
  value: string;
};

const MIN_CLOSE_DURATION_SECONDS = 30;
const MAX_CLOSE_DURATION_SECONDS = 30 * 24 * 60 * 60;
const RESOLUTION_LIVENESS_SECONDS = 30;
const METADATA_MODE_STORAGE_KEY = "create-event-metadata-mode";
const DEFAULT_METADATA_MODE: MetadataMode = "local";

const DURATION_PRESETS = [
  { label: "30s", value: "30s" },
  { label: "60s", value: "60s" },
  { label: "5m", value: "300s" }
] as const;

/** 创建页默认的相对时长输入。 */
function defaultCloseDurationInput() {
  return "30s";
}

/** 解析 `30s` 形式的相对时长输入，失败返回 `null`。 */
function parseCloseDurationSeconds(value: string): number | null {
  const normalized = value.trim();
  const matched = normalized.match(/^([0-9]+)s$/);
  if (!matched) {
    return null;
  }

  const parsed = Number(matched[1]);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.floor(parsed);
}

/** 地址缩写展示：`0x1234...abcd`。 */
function shortAddr(address: `0x${string}` | null) {
  if (!address) {
    return copy.common.noData;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** 将 metadata API 错误码映射到统一中文文案。 */
function mapMetadataApiError(errorCode: string | null) {
  switch (errorCode) {
    case "TITLE_REQUIRED":
      return copy.createValidation.titleRequired;
    case "DESCRIPTION_REQUIRED":
      return copy.createValidation.descriptionRequired;
    case "INVALID_EXTRA_FIELDS":
      return copy.createValidation.invalidExtraFields;
    case "COVER_IMAGE_REQUIRED":
      return copy.createValidation.coverImageRequired;
    case "COVER_IMAGE_EMPTY":
      return copy.createValidation.coverImageEmpty;
    case "COVER_IMAGE_TOO_LARGE":
      return copy.createValidation.coverImageTooLarge;
    case "COVER_IMAGE_TYPE_NOT_ALLOWED":
      return copy.createValidation.coverImageTypeNotAllowed;
    case "INVALID_FORM_DATA":
      return copy.createValidation.invalidExtraFields;
    case "INVALID_CATEGORY":
      return copy.createValidation.invalidCategory;
    case "METADATA_FETCH_FAILED":
      return copy.createValidation.metadataFetchFailed;
    case "INVALID_METADATA_JSON":
      return copy.createValidation.invalidMetadataJson;
    case "URI_REQUIRED":
      return copy.createValidation.uriRequired;
    case "INVALID_URI":
      return copy.createValidation.invalidUri;
    default:
      return copy.createValidation.metadataProcessFailed;
  }
}

/**
 * 将“补充信息”行数组归一化为键值对象。
 * 返回 error 时表示输入不可提交（如键缺失或重复）。
 */
function toExtraFieldsRecord(rows: ExtraFieldRow[]): { result: Record<string, string> | null; error: string | null } {
  const output: Record<string, string> = {};

  for (const row of rows) {
    const key = row.key.trim();
    const value = row.value.trim();

    if (!key && !value) {
      continue;
    }

    if (!key && value) {
      return {
        result: null,
        error: copy.createValidation.rowMissingKey
      };
    }

    if (Object.prototype.hasOwnProperty.call(output, key)) {
      return {
        result: null,
        error: copy.createValidation.duplicatedExtraField(key)
      };
    }

    output[key] = value;
  }

  return { result: output, error: null };
}

/** 创建事件表单主体：负责输入校验、metadata 处理与提交交易。 */
export function CreateEventFormCard({ owner, resolver, isConnected, isWrongNetwork }: CreateEventFormCardProps) {
  const router = useRouter();
  const mounted = useClientMounted();
  const { createEvent, isPending, error } = useCreateEvent();

  const [question, setQuestion] = useState("");
  const [closeTimeInput, setCloseTimeInput] = useState(defaultCloseDurationInput);
  const [resolutionSource, setResolutionSource] = useState("");
  const [metadataMode, setMetadataMode] = useState<MetadataMode>(DEFAULT_METADATA_MODE);
  const [metadataURI, setMetadataURI] = useState("/event-metadata/default-finance.json");

  const [localTitle, setLocalTitle] = useState("");
  const [localDescription, setLocalDescription] = useState("");
  const [localTag, setLocalTag] = useState<EventTag>(EVENT_TAGS[0]);
  const [localCoverImage, setLocalCoverImage] = useState<File | null>(null);
  const [localCoverPreviewUrl, setLocalCoverPreviewUrl] = useState<string | null>(null);
  const [coverImageInputKey, setCoverImageInputKey] = useState(0);
  const [extraFields, setExtraFields] = useState<ExtraFieldRow[]>([{ id: 1, key: "", value: "" }]);

  const [touched, setTouched] = useState(false);
  const [metadataFormError, setMetadataFormError] = useState<string | null>(null);
  const [isUploadingMetadata, setIsUploadingMetadata] = useState(false);
  const [timelineNowSec, setTimelineNowSec] = useState<number | null>(null);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    try {
      const storedMode = window.localStorage.getItem(METADATA_MODE_STORAGE_KEY);
      if (storedMode === "uri" || storedMode === "local") {
        setMetadataMode(storedMode);
      }
    } catch {
      // 忽略 localStorage 读取异常，回退默认模式继续可用。
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const syncClock = () => {
      setTimelineNowSec(Math.floor(Date.now() / 1000));
    };

    syncClock();
    const timer = window.setInterval(syncClock, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [mounted]);

  useEffect(() => {
    if (!localCoverImage) {
      setLocalCoverPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(localCoverImage);
    setLocalCoverPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [localCoverImage]);

  const parsedCloseDuration = useMemo(() => parseCloseDurationSeconds(closeTimeInput), [closeTimeInput]);
  const closeTimeValidationMessage = useMemo(() => {
    if (!closeTimeInput.trim()) {
      return copy.createForm.durationInputHint;
    }
    if (parsedCloseDuration === null) {
      return copy.createForm.durationInputHint;
    }
    if (parsedCloseDuration < MIN_CLOSE_DURATION_SECONDS) {
      return copy.createValidation.closeDurationTooShort;
    }
    if (parsedCloseDuration > MAX_CLOSE_DURATION_SECONDS) {
      return copy.createValidation.closeDurationTooLong;
    }
    return null;
  }, [closeTimeInput, parsedCloseDuration]);
  const closeTimeValid = closeTimeValidationMessage === null && parsedCloseDuration !== null;

  const closeTimePreviewSec =
    closeTimeValid && parsedCloseDuration !== null && timelineNowSec !== null
      ? timelineNowSec + parsedCloseDuration
      : null;
  const finalizeTimePreviewSec =
    closeTimePreviewSec !== null ? closeTimePreviewSec + RESOLUTION_LIVENESS_SECONDS : null;

  const closeTimePreview = closeTimePreviewSec !== null ? new Date(closeTimePreviewSec * 1000).toLocaleString() : null;
  const finalizeTimePreview =
    finalizeTimePreviewSec !== null ? new Date(finalizeTimePreviewSec * 1000).toLocaleString() : null;

  const questionValid = question.trim().length > 0;
  const metadataUriValid = metadataURI.trim().length > 0;
  const localMetadataValid =
    localTitle.trim().length > 0 && localDescription.trim().length > 0 && localCoverImage !== null;
  const metadataValid = metadataMode === "uri" ? metadataUriValid : localMetadataValid;

  const canCreate =
    isConnected && !isWrongNetwork && questionValid && closeTimeValid && metadataValid && !isPending && !isUploadingMetadata;

  const previewQuestion = question.trim() || copy.createForm.previewQuestionFallback;
  const previewTag = metadataMode === "local" ? localTag : copy.common.noData;
  const previewMetadataUri =
    metadataMode === "uri"
      ? metadataURI.trim() || copy.common.noData
      : copy.createForm.metadataLocalBuild;
  const previewRulesUri = resolutionSource.trim() || copy.createForm.previewRulesFallback;

  const fieldChecks = [
    { label: copy.createForm.fieldCheckQuestion, ready: questionValid },
    { label: copy.createForm.fieldCheckDuration, ready: closeTimeValid },
    { label: copy.createForm.fieldCheckMetadata, ready: metadataValid }
  ];

  /** 重置本地 metadata 草稿，避免一次提交后残留旧数据。 */
  const resetLocalMetadataDraft = () => {
    setLocalTitle("");
    setLocalDescription("");
    setLocalTag(EVENT_TAGS[0]);
    setLocalCoverImage(null);
    setCoverImageInputKey((prev) => prev + 1);
    setExtraFields([{ id: 1, key: "", value: "" }]);
  };

  /** 切换 metadata 模式，并记忆用户上次选择。 */
  const handleMetadataModeChange = (mode: MetadataMode) => {
    setMetadataMode(mode);
    setMetadataFormError(null);

    if (!mounted) {
      return;
    }

    try {
      window.localStorage.setItem(METADATA_MODE_STORAGE_KEY, mode);
    } catch {
      // 忽略 localStorage 写入异常，不影响创建主流程。
    }
  };

  /** 本地模式：上传封面并由后端生成 metadata JSON，返回 metadataURI。 */
  const uploadLocalMetadata = async () => {
    setMetadataFormError(null);

    if (!localTitle.trim()) {
      setMetadataFormError(copy.createValidation.titleRequired);
      return null;
    }
    if (!localDescription.trim()) {
      setMetadataFormError(copy.createValidation.descriptionRequired);
      return null;
    }
    if (!localCoverImage) {
      setMetadataFormError(copy.createValidation.coverImageRequired);
      return null;
    }

    const extraFieldResult = toExtraFieldsRecord(extraFields);
    if (!extraFieldResult.result) {
      setMetadataFormError(extraFieldResult.error ?? copy.createValidation.extraFieldInvalid);
      return null;
    }

    const formData = new FormData();
    formData.append("title", localTitle.trim());
    formData.append("description", localDescription.trim());
    formData.append("category", localTag);
    formData.append("tags", localTag);
    formData.append("extraFields", JSON.stringify(extraFieldResult.result));
    formData.append("coverImage", localCoverImage);

    setIsUploadingMetadata(true);
    try {
      const response = await fetch("/api/metadata/local", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json()) as { metadataURI?: string; error?: string };
      if (!response.ok) {
        setMetadataFormError(mapMetadataApiError(payload.error ?? null));
        return null;
      }

      if (!payload.metadataURI) {
        setMetadataFormError(copy.createValidation.metadataUriMissingFromApi);
        return null;
      }

      return payload.metadataURI;
    } catch {
      setMetadataFormError(copy.createValidation.metadataUploadFailed);
      return null;
    } finally {
      setIsUploadingMetadata(false);
    }
  };

  /** URI 模式：创建前先校验 metadata 可读性与标签合法性。 */
  const validateUriMetadata = async (uri: string) => {
    setIsUploadingMetadata(true);
    try {
      const response = await fetch(`/api/metadata/validate?uri=${encodeURIComponent(uri)}`, {
        method: "GET"
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) {
        setMetadataFormError(mapMetadataApiError(payload?.error ?? null));
        return false;
      }
      return true;
    } catch {
      setMetadataFormError(copy.createValidation.metadataReadFailed);
      return false;
    } finally {
      setIsUploadingMetadata(false);
    }
  };

  /** 统一创建入口：按当前模式准备 metadata 后发起链上创建。 */
  const handleCreate = async () => {
    setTouched(true);
    setMetadataFormError(null);

    if (!canCreate || parsedCloseDuration === null || !closeTimeValid) {
      return;
    }

    let finalMetadataURI = metadataURI.trim();
    if (metadataMode === "local") {
      // 本地模式先上传资源并拿到最终 metadataURI，再写链上。
      const uploadedMetadataURI = await uploadLocalMetadata();
      if (!uploadedMetadataURI) {
        return;
      }
      finalMetadataURI = uploadedMetadataURI;
    } else {
      // URI 模式直接复用输入地址，但仍需要前置校验以降低链上失败率。
      const valid = await validateUriMetadata(finalMetadataURI);
      if (!valid) {
        return;
      }
    }

    const result = await createEvent({
      question,
      closeDurationSec: parsedCloseDuration,
      resolutionSourceURI: resolutionSource,
      metadataURI: finalMetadataURI
    });

    if (result.success) {
      setQuestion("");
      setCloseTimeInput(defaultCloseDurationInput());
      setTouched(false);
      setMetadataFormError(null);
      if (metadataMode === "local") {
        resetLocalMetadataDraft();
      }
      if (result.eventIdResolved && result.eventId !== null) {
        router.push(`/events/${result.eventId.toString()}`);
      } else {
        router.push("/events");
      }
    }
  };

  const updateExtraField = (id: number, key: "key" | "value", value: string) => {
    setExtraFields((prev) => prev.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  };

  const removeExtraField = (id: number) => {
    setExtraFields((prev) => {
      const next = prev.filter((item) => item.id !== id);
      return next.length > 0 ? next : [{ id: Date.now(), key: "", value: "" }];
    });
  };

  const addExtraField = () => {
    setExtraFields((prev) => [...prev, { id: Date.now(), key: "", value: "" }]);
  };

  return (
    <div className="space-y-4" data-testid="create-event-cockpit">
      <Card className="overflow-hidden border-black/20 bg-gradient-to-br from-emerald-50/80 via-white to-rose-50/40 py-0">
        <CardHeader className="px-5 pb-3 pt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">{copy.createForm.cockpitTitle}</CardTitle>
              <CardDescription>{copy.createForm.cockpitDesc}</CardDescription>
            </div>
            <Badge className={canCreate ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"}>
              {canCreate ? copy.createForm.formReady : copy.createForm.formBlocked}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 px-5 pb-4 text-xs text-neutral-700 sm:grid-cols-3">
          <div className="rounded-lg border border-black/10 bg-white/80 px-3 py-2">
            <div className="text-neutral-500">{copy.createForm.ownerLabel}</div>
            <div className="mt-1 font-semibold text-neutral-900">{shortAddr(owner)}</div>
          </div>
          <div className="rounded-lg border border-black/10 bg-white/80 px-3 py-2">
            <div className="text-neutral-500">{copy.createForm.resolverLabel}</div>
            <div className="mt-1 font-semibold text-neutral-900">{shortAddr(resolver)}</div>
          </div>
          <div className="rounded-lg border border-black/10 bg-white/80 px-3 py-2">
            <div className="text-neutral-500">{copy.createForm.networkLabel}</div>
            <div className={`mt-1 font-semibold ${isWrongNetwork ? "text-amber-700" : "text-emerald-700"}`}>
              {isWrongNetwork ? copy.createForm.networkBlocked : copy.createForm.networkReady}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,640px)_minmax(0,1fr)] xl:items-start">
        <div className="space-y-4">
          {isWrongNetwork && (
            <Card className="border-amber-300 bg-amber-50 py-3">
              <CardContent className="px-4 text-sm text-amber-800">{copy.createForm.networkHint}</CardContent>
            </Card>
          )}

          <Card className="border-black/20 py-4">
            <CardHeader className="px-5 pb-2">
              <CardTitle className="text-base">{copy.createForm.basicGroupTitle}</CardTitle>
              <CardDescription>{copy.createForm.basicGroupDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-700">{copy.createForm.eventQuestion}</label>
                <Input
                  placeholder={copy.createForm.eventQuestionPlaceholder}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onBlur={() => setTouched(true)}
                  data-testid="create-event-question-input"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-700">{copy.createForm.closeDuration}</label>
                <Input
                  inputMode="text"
                  placeholder={copy.createForm.closeDurationPlaceholder}
                  value={closeTimeInput}
                  onChange={(event) => {
                    setCloseTimeInput(event.target.value);
                  }}
                  onBlur={() => setTouched(true)}
                  data-testid="create-event-close-duration-input"
                />

                <div className="space-y-1">
                  <div className="text-xs text-neutral-500">{copy.createForm.durationPresets}</div>
                  <div className="flex flex-wrap gap-2">
                    {DURATION_PRESETS.map((preset) => (
                      <Button
                        key={preset.label}
                        type="button"
                        size="sm"
                        variant={closeTimeInput.trim() === preset.value ? "default" : "outline"}
                        onClick={() => {
                          setCloseTimeInput(preset.value);
                          setTouched(true);
                        }}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                    {closeTimePreview
                      ? copy.createForm.firstSubmitTime(closeTimePreview)
                      : copy.createForm.firstSubmitTimeFallback}
                  </div>
                  <div className="rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                    {finalizeTimePreview
                      ? copy.createForm.firstFinalizeTime(finalizeTimePreview)
                      : copy.createForm.firstFinalizeTimeFallback}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-700">{copy.createForm.rulesUri}</label>
                <Input
                  placeholder={copy.createForm.rulesUriPlaceholder}
                  value={resolutionSource}
                  onChange={(event) => setResolutionSource(event.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-black/20 py-4">
            <CardHeader className="px-5 pb-2">
              <CardTitle className="text-base">{copy.createForm.metadataGroupTitle}</CardTitle>
              <CardDescription>{copy.createForm.metadataGroupDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700">{copy.createForm.metadataMode}</label>
                <div className="flex flex-wrap gap-2 rounded-lg border border-black/10 bg-neutral-50 p-1.5">
                  <Button
                    type="button"
                    className="flex-1 min-w-[140px]"
                    variant={metadataMode === "uri" ? "default" : "ghost"}
                    onClick={() => handleMetadataModeChange("uri")}
                  >
                    {copy.createForm.metadataByUri}
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 min-w-[140px]"
                    variant={metadataMode === "local" ? "default" : "ghost"}
                    onClick={() => handleMetadataModeChange("local")}
                  >
                    {copy.createForm.metadataLocalBuild}
                  </Button>
                </div>
              </div>

              {metadataMode === "uri" ? (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-neutral-700">{copy.createForm.metadataUriLabel}</label>
                  <Input
                    placeholder={copy.createForm.metadataUriPlaceholder}
                    value={metadataURI}
                    onChange={(event) => setMetadataURI(event.target.value)}
                    onBlur={() => setTouched(true)}
                    data-testid="create-event-metadata-uri-input"
                  />
                </div>
              ) : (
                <div className="space-y-3 rounded-lg border border-black/10 bg-neutral-50/80 p-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-neutral-700">{copy.createForm.localTitle}</label>
                      <Input
                        placeholder={copy.createForm.localTitlePlaceholder}
                        value={localTitle}
                        onChange={(event) => setLocalTitle(event.target.value)}
                        onBlur={() => setTouched(true)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-neutral-700">{copy.createForm.localTag}</label>
                      <div className="flex flex-wrap gap-2">
                        {EVENT_TAGS.map((tag) => (
                          <Button
                            key={tag}
                            type="button"
                            variant={localTag === tag ? "default" : "outline"}
                            onClick={() => setLocalTag(tag)}
                          >
                            {tag}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-700">{copy.createForm.localDescription}</label>
                    <textarea
                      className="w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm outline-none focus:border-black"
                      rows={4}
                      placeholder={copy.createForm.localDescriptionPlaceholder}
                      value={localDescription}
                      onChange={(event) => setLocalDescription(event.target.value)}
                      onBlur={() => setTouched(true)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-700">{copy.createForm.coverImage}</label>
                    <Input
                      key={coverImageInputKey}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => setLocalCoverImage(event.target.files?.[0] ?? null)}
                    />
                    {localCoverPreviewUrl ? (
                      <div className="relative h-32 overflow-hidden rounded-lg border border-black/10 bg-neutral-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={localCoverPreviewUrl} alt={copy.createForm.previewCoverFallback} className="h-full w-full object-cover" />
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-neutral-700">{copy.createForm.extraInfo}</label>
                      <Button type="button" variant="outline" size="sm" onClick={addExtraField}>
                        {copy.createForm.addField}
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {extraFields.map((row) => (
                        <div key={row.id} className="rounded-lg border border-black/10 bg-white p-2">
                          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                            <Input
                              placeholder={copy.createForm.fieldKeyPlaceholder}
                              value={row.key}
                              onChange={(event) => updateExtraField(row.id, "key", event.target.value)}
                            />
                            <Input
                              placeholder={copy.createForm.fieldValuePlaceholder}
                              value={row.value}
                              onChange={(event) => updateExtraField(row.id, "value", event.target.value)}
                            />
                            <Button type="button" variant="outline" onClick={() => removeExtraField(row.id)}>
                              {copy.createForm.deleteField}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-black/20 py-4">
            <CardHeader className="px-5 pb-2">
              <CardTitle className="text-base">{copy.createForm.submitGroupTitle}</CardTitle>
              <CardDescription>{copy.createForm.submitGroupDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-5">
              <div className="space-y-1 text-xs text-neutral-600">
                {touched && !questionValid && <p>{copy.createValidation.questionRequired}</p>}
                {touched && !closeTimeValid && <p>{closeTimeValidationMessage}</p>}
                {touched && metadataMode === "uri" && !metadataUriValid && <p>{copy.createValidation.uriRequired}</p>}
                {touched && metadataMode === "local" && localTitle.trim().length === 0 && <p>{copy.createValidation.titleRequired}</p>}
                {touched && metadataMode === "local" && localDescription.trim().length === 0 && <p>{copy.createValidation.descriptionRequired}</p>}
                {touched && metadataMode === "local" && localCoverImage === null && <p>{copy.createValidation.coverImageRequired}</p>}
                {metadataFormError && <p>{metadataFormError}</p>}
                {!isConnected && <p>{copy.createForm.connectRequired}</p>}
                {error && <p>{error}</p>}
              </div>

              <Button onClick={handleCreate} disabled={!canCreate} data-testid="create-event-submit" className="w-full">
                {isUploadingMetadata ? copy.createForm.validatingMetadata : isPending ? copy.createForm.creating : copy.createForm.createEvent}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-black/20 bg-gradient-to-br from-neutral-50 via-white to-emerald-50/40 py-4" data-testid="create-event-preview-card">
            <CardHeader className="px-5 pb-2">
              <CardTitle className="text-base">{copy.createForm.previewTitle}</CardTitle>
              <CardDescription>{copy.createForm.previewDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-5 text-sm">
              <div className="relative overflow-hidden rounded-xl border border-black/10 bg-neutral-100">
                {metadataMode === "local" && localCoverPreviewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={localCoverPreviewUrl} alt={copy.createForm.previewCoverFallback} className="h-44 w-full object-cover" />
                ) : (
                  <div className="flex h-44 items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200 text-xs text-neutral-500">
                    {copy.createForm.previewCoverFallback}
                  </div>
                )}
              </div>

              <div className="space-y-2 rounded-lg border border-black/10 bg-white px-3 py-2">
                <div className="text-xs text-neutral-500">{copy.createForm.previewQuestion}</div>
                <div className="font-semibold text-neutral-900">{previewQuestion}</div>
              </div>

              <div className="grid gap-2 text-xs text-neutral-700 sm:grid-cols-2">
                <div className="rounded-lg border border-black/10 bg-white px-3 py-2">
                  <div className="text-neutral-500">{copy.createForm.previewTag}</div>
                  <div className="mt-1 font-semibold text-neutral-900">{previewTag}</div>
                </div>
                <div className="rounded-lg border border-black/10 bg-white px-3 py-2">
                  <div className="text-neutral-500">{copy.createForm.previewMode}</div>
                  <div className="mt-1 font-semibold text-neutral-900">
                    {metadataMode === "uri" ? copy.createForm.metadataByUri : copy.createForm.metadataLocalBuild}
                  </div>
                </div>
                <div className="rounded-lg border border-black/10 bg-white px-3 py-2 sm:col-span-2">
                  <div className="text-neutral-500">{copy.createForm.previewMetadataUri}</div>
                  <div className="mt-1 break-all font-semibold text-neutral-900">{previewMetadataUri}</div>
                </div>
                <div className="rounded-lg border border-black/10 bg-white px-3 py-2 sm:col-span-2">
                  <div className="text-neutral-500">{copy.createForm.previewRulesUri}</div>
                  <div className="mt-1 break-all font-semibold text-neutral-900">{previewRulesUri}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-black/20 bg-gradient-to-br from-neutral-50 via-white to-rose-50/40 py-4" data-testid="create-event-timeline-card">
            <CardHeader className="px-5 pb-2">
              <CardTitle className="text-base">{copy.createForm.timelineTitle}</CardTitle>
              <CardDescription>{copy.createForm.timelineDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-5 text-sm">
              <div className="space-y-2 rounded-lg border border-black/10 bg-white p-3">
                <TimelineRow label={copy.createForm.timelineNow} value={timelineNowSec !== null ? new Date(timelineNowSec * 1000).toLocaleString() : copy.common.noData} accentClass="bg-neutral-700" />
                <TimelineRow
                  label={copy.createForm.timelineSubmit}
                  value={closeTimePreview ?? copy.common.noData}
                  accentClass={closeTimePreview ? "bg-emerald-500" : "bg-neutral-300"}
                />
                <TimelineRow
                  label={copy.createForm.timelineFinalize}
                  value={finalizeTimePreview ?? copy.common.noData}
                  accentClass={finalizeTimePreview ? "bg-rose-500" : "bg-neutral-300"}
                />
              </div>

              <div className="space-y-2 rounded-lg border border-black/10 bg-white p-3">
                <div className="text-xs text-neutral-500">{copy.createForm.fieldChecks}</div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {fieldChecks.map((item) => (
                    <div key={item.label} className="rounded-md border border-black/10 bg-neutral-50 px-2 py-1.5 text-xs">
                      <div className="text-neutral-500">{item.label}</div>
                      <div className={`mt-1 font-semibold ${item.ready ? "text-emerald-700" : "text-amber-700"}`}>
                        {item.ready ? copy.createForm.statusReady : copy.createForm.statusPending}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** 时间轴节点行。 */
function TimelineRow({ label, value, accentClass }: { label: string; value: string; accentClass: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${accentClass}`} />
      <div className="min-w-0">
        <div className="text-xs text-neutral-500">{label}</div>
        <div className="text-xs font-semibold text-neutral-900">{value}</div>
      </div>
    </div>
  );
}
