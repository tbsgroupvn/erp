import { HttpStatus } from '@nestjs/common';
import { FileValidationPipe } from './file-validation.pipe';
import { DomainException } from '@common/exceptions/domain.exception';

describe('FileValidationPipe', () => {
  let pipe: FileValidationPipe;

  beforeEach(() => {
    pipe = new FileValidationPipe({
      maxSizeBytes: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: ['image/png', 'image/jpeg', 'application/pdf'],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return the file unchanged for a valid file', () => {
    // Arrange
    const file = {
      fieldname: 'file',
      originalname: 'test.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: 1 * 1024 * 1024, // 1MB
      buffer: Buffer.alloc(0),
    } as Express.Multer.File;

    // Act
    const result = pipe.transform(file, { type: 'custom' });

    // Assert
    expect(result).toBe(file);
  });

  it('should return null/undefined when no file is provided (optional upload)', () => {
    // Act
    const result = pipe.transform(null as any, { type: 'custom' });

    // Assert
    expect(result).toBeNull();
  });

  it('should return undefined when file is undefined', () => {
    // Act
    const result = pipe.transform(undefined as any, { type: 'custom' });

    // Assert
    expect(result).toBeUndefined();
  });

  it('should throw DomainException with FILE_TOO_LARGE for oversized file', () => {
    // Arrange
    const file = {
      fieldname: 'file',
      originalname: 'large.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: 10 * 1024 * 1024, // 10MB - exceeds 5MB limit
      buffer: Buffer.alloc(0),
    } as Express.Multer.File;

    // Act & Assert
    try {
      pipe.transform(file, { type: 'custom' });
      fail('Expected DomainException to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainException);
      expect((error as DomainException).errorCode).toBe('FILE_TOO_LARGE');
      expect((error as DomainException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
  });

  it('should throw DomainException with FILE_TYPE_NOT_ALLOWED for disallowed MIME type', () => {
    // Arrange
    const file = {
      fieldname: 'file',
      originalname: 'malware.exe',
      encoding: '7bit',
      mimetype: 'application/exe',
      size: 1 * 1024 * 1024,
      buffer: Buffer.alloc(0),
    } as Express.Multer.File;

    // Act & Assert
    try {
      pipe.transform(file, { type: 'custom' });
      fail('Expected DomainException to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainException);
      expect((error as DomainException).errorCode).toBe('FILE_TYPE_NOT_ALLOWED');
      expect((error as DomainException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
  });
});
