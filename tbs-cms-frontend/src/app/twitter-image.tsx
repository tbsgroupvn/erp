import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'TBS ERP - Nhập hàng chính ngạch';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 128,
          background: 'linear-gradient(to bottom right, #1e40af, #3b82f6)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '40px',
          }}
        >
          <div
            style={{
              width: '120px',
              height: '120px',
              background: 'white',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '72px',
              fontWeight: 'bold',
              color: '#1e40af',
              marginRight: '30px',
            }}
          >
            TBS
          </div>
        </div>
        <div
          style={{
            fontSize: '64px',
            fontWeight: 'bold',
            marginBottom: '20px',
          }}
        >
          TBS ERP
        </div>
        <div
          style={{
            fontSize: '36px',
            opacity: 0.9,
            textAlign: 'center',
            maxWidth: '900px',
          }}
        >
          Hệ thống quản lý vận chuyển Trung Quốc - Việt Nam
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
