/** Dấu hiệu Exam Hub: tờ phiếu trả lời với một ô đã tô. */
export function LogoMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 28 28" className={`shrink-0 ${className}`}>
      <rect x="3" y="2" width="22" height="24" rx="3" fill="currentColor" opacity=".14" />
      <rect x="3" y="2" width="22" height="24" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="10" cy="10" r="2.6" fill="currentColor" />
      <circle cx="10" cy="18" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M15 10h6M15 18h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
