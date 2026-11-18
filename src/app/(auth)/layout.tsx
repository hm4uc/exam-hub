// Khung trang đăng nhập/đăng ký: một tờ giấy đặt giữa nền, kẻ dòng mờ như giấy kiểm tra.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-start justify-center px-4 py-10 sm:items-center">
      <div className="w-full max-w-sm">
        <p className="mb-6 flex items-center gap-2 text-lg font-bold tracking-tight text-brand">
          <svg aria-hidden width="28" height="28" viewBox="0 0 28 28" className="shrink-0">
            <rect x="3" y="2" width="22" height="24" rx="3" fill="currentColor" opacity=".12" />
            <rect x="3" y="2" width="22" height="24" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="10" cy="10" r="2.6" fill="currentColor" />
            <circle cx="10" cy="18" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M15 10h6M15 18h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Exam Hub
        </p>
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-7">{children}</div>
      </div>
    </main>
  );
}
