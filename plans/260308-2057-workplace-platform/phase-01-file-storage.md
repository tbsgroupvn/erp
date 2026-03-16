# Phase 01: File Storage Infrastructure (MinIO)

Status: ⬜ Pending
Dependencies: Không
Est. Time: 2-3 ngày

## Objective

Xây dựng hạ tầng lưu trữ file bằng MinIO (S3-compatible) — nền tảng cho Chat (gửi file), Drive (quản lý tài liệu), và tất cả module cần upload.

## Why First?

MinIO là **nền tảng** cho Phase 02 (Chat file), Phase 04 (Drive), và nhiều module khác. Phải có trước khi xây các tính năng.

## Requirements

### Functional
- [ ] Docker container MinIO chạy cùng docker-compose
- [ ] Upload file API (multipart/form-data)
- [ ] Download file, stream file
- [ ] Delete file
- [ ] Generate presigned URL (cho download trực tiếp)
- [ ] Thumbnail generation cho ảnh (sharp)
- [ ] File metadata (tên, size, MIME type, uploader, ngày)
- [ ] Quota quản lý (theo user hoặc phòng ban)

### Non-Functional
- [ ] Max file size: 100MB (configurable)
- [ ] Accepted types: whitelist (images, docs, videos, archives)
- [ ] Virus scan hook (tùy chọn)
- [ ] Storage limit per bucket/user

## Implementation Steps

1. [ ] Thêm MinIO vào docker-compose.dev.yml
2. [ ] Tạo `src/core/storage/` module
    - `storage.module.ts`
    - `storage.service.ts` (MinIO client wrapper)
    - `storage.config.ts` (env vars: endpoint, access key, bucket)
3. [ ] Tạo `FileUploadInterceptor` dùng Multer + sharp
4. [ ] Tạo `StorageController` với endpoints:
    - `POST /api/v1/storage/upload` — upload file
    - `GET /api/v1/storage/files/:id` — file metadata
    - `GET /api/v1/storage/files/:id/download` — download
    - `GET /api/v1/storage/files/:id/presigned` — presigned URL
    - `DELETE /api/v1/storage/files/:id` — delete
5. [ ] Thêm Prisma model `StoredFile` (id, filename, mimeType, size, bucket, key, uploadedBy, createdAt)
6. [ ] Tạo thumbnail service cho images
7. [ ] Test upload/download flow

## Files to Create/Modify

### New Files
- `src/core/storage/storage.module.ts`
- `src/core/storage/storage.service.ts`
- `src/core/storage/storage.config.ts`
- `src/core/storage/storage.controller.ts`
- `src/core/storage/dto/upload-file.dto.ts`
- `src/core/storage/interceptors/file-upload.interceptor.ts`
- `src/core/storage/thumbnail.service.ts`

### Modified Files
- `docker-compose.dev.yml` — thêm MinIO service
- `prisma/schema/system.prisma` — thêm StoredFile model
- `src/app.module.ts` — import StorageModule
- `.env.example` — thêm MinIO env vars

## Test Criteria
- [ ] Upload file 1MB → trả về metadata + file ID
- [ ] Download file bằng ID → trả về đúng file
- [ ] Upload ảnh → tự động tạo thumbnail
- [ ] Upload file > max size → trả về lỗi 413
- [ ] Presigned URL có thể download trực tiếp từ browser
- [ ] Delete file → file bị xóa khỏi MinIO + DB

---
Next Phase: [Phase 02 - Chat Nâng cao](./phase-02-chat.md)
