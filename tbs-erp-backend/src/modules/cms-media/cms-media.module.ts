import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { DatabaseModule } from '@core/database/database.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Module({
  imports: [
    DatabaseModule,
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const filename = `${uniqueSuffix}${ext}`;
          callback(null, filename);
        },
      }),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
      fileFilter: (req, file, callback) => {
        // Allowed mime types
        const allowedMimes = [
          // Images
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/svg+xml',
          // Videos
          'video/mp4',
          'video/webm',
          'video/ogg',
          // Documents
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          // Audio
          'audio/mpeg',
          'audio/wav',
          'audio/ogg',
          // Archives
          'application/zip',
          'application/x-rar-compressed',
        ];

        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(new Error(`File type ${file.mimetype} not allowed`), false);
        }
      },
    }),
  ],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class CmsMediaModule {}
