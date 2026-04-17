import Link from "next/link";
import { sharedCopy, statusPageCopy } from "@/lib/copy";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[40vh] max-w-4xl items-center px-4 py-12">
      <div className="card space-y-4">
        <h1 className="text-2xl font-semibold">{statusPageCopy.notFoundTitle}</h1>
        <p className="text-sm text-text-muted">{statusPageCopy.notFoundDescription}</p>
        <Link href="/" className="btn-primary">
          {sharedCopy.backHome}
        </Link>
      </div>
    </div>
  );
}
