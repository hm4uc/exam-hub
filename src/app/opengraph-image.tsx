import { ImageResponse } from 'next/og';

export const alt = 'Exam Hub — Kiểm tra trực tuyến';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0e1e4a',
          color: '#ffffff',
          padding: '64px 72px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <svg width="56" height="56" viewBox="0 0 28 28" fill="none">
            <rect x="3" y="2" width="22" height="24" rx="3" fill="#ffffff" fillOpacity="0.14" stroke="#ffffff" strokeWidth="2" />
            <circle cx="10" cy="10" r="2.6" fill="#ffffff" />
            <circle cx="10" cy="18" r="2.6" stroke="#7da5fa" strokeWidth="1.8" />
            <path d="M15 10h6M15 18h6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em' }}>Exam Hub</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 62, fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.03em' }}>
            Kiểm tra trực tuyến nhanh, chuẩn công thức
          </div>
          <div style={{ fontSize: 28, color: '#bfcdEE', lineHeight: 1.4 }}>
            Mở link làm bài ngay · Tự động lưu khi mất mạng · Chấm điểm và xem đáp án tức thì
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          {['1', '2', '3', '4'].map((n, i) => (
            <div
              key={n}
              style={{
                width: 48,
                height: 48,
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                fontWeight: 700,
                background: i < 3 ? '#1d40a0' : 'transparent',
                border: '3px solid #7da5fa',
                color: '#ffffff',
              }}
            >
              {n}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
