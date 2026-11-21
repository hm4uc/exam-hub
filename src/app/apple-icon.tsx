import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0e1e4a',
          borderRadius: 38,
        }}
      >
        <svg width="118" height="118" viewBox="0 0 28 28" fill="none">
          <rect x="3" y="2" width="22" height="24" rx="3" fill="#ffffff" fillOpacity="0.14" stroke="#ffffff" strokeWidth="2" />
          <circle cx="10" cy="10" r="2.6" fill="#ffffff" />
          <circle cx="10" cy="18" r="2.6" stroke="#7da5fa" strokeWidth="1.8" />
          <path d="M15 10h6M15 18h6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    ),
    size,
  );
}
