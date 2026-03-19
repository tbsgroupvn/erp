import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  HttpStatus,
} from '@nestjs/common';
import { DomainException } from '@common/exceptions/domain.exception';
import { ErrorCode } from '@common/exceptions/error-codes';

/**
 * Configuration options for FileValidationPipe.
 */
export interface FileValidationOptions {
  /** Maximum allowed file size in bytes */
  maxSizeBytes: number;
  /** Whitelist of allowed MIME types */
  allowedMimeTypes: string[];
}

/**
 * Reusable pipe for validating uploaded files against size and MIME constraints.
 *
 * Throws DomainException with appropriate error codes:
 * - FILE_TOO_LARGE when file exceeds maxSizeBytes
 * - FILE_TYPE_NOT_ALLOWED when file MIME type is not in the whitelist
 *
 * @example
 * ```typescript
 * @Post('upload')
 * @UseInterceptors(FileInterceptor('file'))
 * uploadFile(
 *   @UploadedFile(new FileValidationPipe(FILE_UPLOAD_LIMITS.IMAGE))
 *   file: Express.Multer.File,
 * ) { ... }
 * ```
 */
@Injectable()
export class FileValidationPipe implements PipeTransform {
  constructor(private readonly options: FileValidationOptions) {}

  transform(
    file: Express.Multer.File,
    _metadata: ArgumentMetadata,
  ): Express.Multer.File {
    // Allow optional file uploads (no file provided)
    if (!file) {
      return file;
    }

    // Validate file size
    if (file.size > this.options.maxSizeBytes) {
      const maxMB = this.options.maxSizeBytes / (1024 * 1024);
      throw new DomainException(
        ErrorCode.FILE_TOO_LARGE,
        `File qu\u00e1 l\u1edbn. T\u1ed1i \u0111a ${maxMB}MB`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate MIME type
    if (!this.options.allowedMimeTypes.includes(file.mimetype)) {
      throw new DomainException(
        ErrorCode.FILE_TYPE_NOT_ALLOWED,
        `Lo\u1ea1i file kh\u00f4ng \u0111\u01b0\u1ee3c ph\u00e9p: ${file.mimetype}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return file;
  }
}
