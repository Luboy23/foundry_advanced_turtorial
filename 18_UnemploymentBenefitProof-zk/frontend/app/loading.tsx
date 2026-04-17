import { statusPageCopy } from "@/lib/copy";

export default function Loading() {
  return (
    <div className="mx-auto flex min-h-[40vh] max-w-4xl items-center justify-center px-4">
      <div className="card text-sm text-text-muted">{statusPageCopy.loadingPage}</div>
    </div>
  );
}
