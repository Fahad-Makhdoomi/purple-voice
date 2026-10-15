import { ImageResponse } from 'next/og';

/** Default social card, generated at build time from the brand tokens' values. */
export const alt = 'Purple Voice — AI voice agents for sales calls';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 72,
        color: 'white',
        background:
          'radial-gradient(circle at 78% 55%, rgba(124,88,248,0.85), rgba(7,6,12,0) 45%), linear-gradient(135deg, #07060c 0%, #150840 100%)',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 34, fontWeight: 700 }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            background: 'radial-gradient(circle at 35% 30%, #9c80fa, #6236f0 55%, #260e78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="34" height="34" viewBox="0 0 40 40">
            <path
              d="M20 4c1.3 8.2 7.8 14.7 16 16-8.2 1.3-14.7 7.8-16 16-1.3-8.2-7.8-14.7-16-16 8.2-1.3 14.7-7.8 16-16Z"
              fill="white"
            />
          </svg>
        </div>
        Purple Voice
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 820 }}>
        <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
          AI voice agents that call, qualify and book for you
        </div>
        <div style={{ marginTop: 24, fontSize: 28, color: 'rgba(255,255,255,0.65)' }}>
          Your numbers · your models · plans from $19/month
        </div>
      </div>
    </div>,
    size,
  );
}
