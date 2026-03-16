import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => {
  const storagePath = process.env.STORAGE_PATH || './uploads';
  if (storagePath === './uploads' && process.env.NODE_ENV === 'production') {
    throw new Error('STORAGE_PATH must be configured as an absolute path in production');
  }
  return {
    type: process.env.STORAGE_TYPE || 'local',
    path: storagePath,

    // ─── MinIO / S3 ───────────────────────────────────────────────
    minio: {
      endpoint: process.env.MINIO_ENDPOINT || 'http://minio:9000',
      rootUser: process.env.MINIO_ROOT_USER || 'minioadmin',
      rootPassword: process.env.MINIO_ROOT_PASSWORD || 'minioadmin123',
      publicUrl: process.env.MINIO_PUBLIC_URL || 'http://localhost:9000',
      buckets: {
        drive: process.env.MINIO_BUCKET_DRIVE || 'tbs-drive',
        chat: process.env.MINIO_BUCKET_CHAT || 'tbs-chat',
        media: process.env.MINIO_BUCKET_MEDIA || 'tbs-media',
      },
    },
  };
});
