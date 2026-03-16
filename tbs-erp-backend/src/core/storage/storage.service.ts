import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client;
  private readonly defaultBucket: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = config.get<string>('MINIO_ENDPOINT', 'http://localhost:9000');
    this.defaultBucket = config.get<string>('MINIO_BUCKET_DRIVE', 'tbs-drive');

    this.s3 = new S3Client({
      endpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: config.get<string>('MINIO_ROOT_USER', 'minioadmin'),
        secretAccessKey: config.get<string>('MINIO_ROOT_PASSWORD', 'minioadmin123'),
      },
      forcePathStyle: true,
    });
  }

  /**
   * Generate a presigned URL for direct upload from client.
   */
  async getPresignedUploadUrl(
    key: string,
    mimeType: string,
    bucket?: string,
    expiresIn = 3600,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: bucket ?? this.defaultBucket,
      Key: key,
      ContentType: mimeType,
    });
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  /**
   * Generate a presigned URL for download.
   */
  async getPresignedDownloadUrl(
    key: string,
    bucket?: string,
    expiresIn = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucket ?? this.defaultBucket,
      Key: key,
    });
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  /**
   * Delete an object from storage.
   */
  async deleteObject(key: string, bucket?: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: bucket ?? this.defaultBucket, Key: key }),
    );
    this.logger.log(`Deleted object: ${key} from bucket: ${bucket ?? this.defaultBucket}`);
  }

  /**
   * Check if object exists in storage.
   */
  async objectExists(key: string, bucket?: string): Promise<boolean> {
    try {
      await this.s3.send(
        new HeadObjectCommand({ Bucket: bucket ?? this.defaultBucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate a unique storage key for a file.
   */
  generateKey(uploaderId: string, filename: string): string {
    const timestamp = Date.now();
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `uploads/${uploaderId}/${timestamp}_${sanitized}`;
  }
}
