import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-5 text-center">
      <div className="soft-pill">页面不存在</div>
      <h1 className="page-title">未找到页面</h1>
      <p className="max-w-xl text-sm leading-7 text-text-muted">请返回首页。</p>
      <Link href="/" className="rounded-full bg-brand-pink px-6 py-3 text-sm font-bold text-white">
        返回首页
      </Link>
    </div>
  );
}
