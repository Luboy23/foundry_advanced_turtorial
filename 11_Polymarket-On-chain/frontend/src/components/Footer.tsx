import Link from "next/link";

import { PROJECT_GITHUB } from "@/lib/config";
import { copy } from "@/lib/copy";

/** 页面底部栏：版权信息与项目外链。 */
export function Footer() {
  return (
    <footer className="mt-10 border-t border-black/20">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-5 text-xs text-neutral-600">
        <span>{copy.footer.copyright}</span>
        <Link href={PROJECT_GITHUB} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          {copy.footer.github}
        </Link>
      </div>
    </footer>
  );
}
