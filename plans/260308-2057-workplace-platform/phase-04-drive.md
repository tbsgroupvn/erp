# Phase 04: Drive / Tài liệu

Status: ⬜ Pending
Dependencies: Phase 01 (File Storage)
Est. Time: 3-4 ngày

## Objective

Xây dựng hệ thống quản lý tài liệu giống Google Drive: thư mục, upload, preview, chia sẻ, phiên bản, tìm kiếm.

## Existing Foundation

- `document.service.ts` — CRUD documents (nhưng chỉ lưu URL, chưa upload thật)
- `document.controller.ts` — REST endpoints (cơ bản)
- Phase 01 MinIO → file storage thực

## Requirements

### Functional — Backend
- [ ] Folder hierarchy (thư mục lồng nhau, tree structure)
- [ ] Upload file vào folder (dùng StorageService từ Phase 01)
- [ ] Download file
- [ ] File preview URLs (images, PDF, video)
- [ ] Share file/folder với quyền (VIEW, DOWNLOAD, EDIT)
- [ ] Version control: upload phiên bản mới, xem lịch sử
- [ ] Trash (thùng rác): soft delete, restore, permanent delete
- [ ] Search files (tên, uploader, ngày, loại file)
- [ ] Favorite/Star files
- [ ] Quota per user/department

### Functional — Frontend
- [ ] Grid + List view cho files/folders
- [ ] Breadcrumb navigation (Home > Marketing > Q1)
- [ ] Drag-and-drop upload (nhiều file)
- [ ] Context menu (right-click): Download, Share, Move, Delete
- [ ] File preview modal (ảnh, PDF, video, Office docs)
- [ ] Share dialog: chọn người, set quyền
- [ ] Sidebar: Recent files, Starred, Shared with me, Trash
- [ ] Storage usage indicator (đã dùng / quota)
- [ ] Rename file/folder inline

## Implementation Steps

### Backend (1.5-2 ngày)
1. [ ] Tạo/update Prisma models: DriveFolder, DriveFile, FileShare, FileVersion
2. [ ] Tạo `src/modules/drive/drive.module.ts`
3. [ ] Tạo `src/modules/drive/drive.service.ts` — folders, files, share, versions
4. [ ] Tạo `src/modules/drive/drive.controller.ts` — REST endpoints
5. [ ] DTOs: CreateFolderDto, UploadFileDto, ShareDto, MoveDto
6. [ ] Integrate với StorageService (MinIO) cho upload/download
7. [ ] Full-text search trên file metadata
8. [ ] Trash logic: soft delete → 30 days → permanent

### Frontend (1.5-2 ngày)
9. [ ] Tạo `src/app/(dashboard)/tai-lieu/page.tsx` — Drive page
10. [ ] Component: `FileGrid` — grid view files/folders
11. [ ] Component: `FileList` — list/table view
12. [ ] Component: `UploadDropzone` — drag & drop upload
13. [ ] Component: `FilePreview` — modal preview
14. [ ] Component: `ShareDialog` — chia sẻ với quyền
15. [ ] Component: `DriveSidebar` — navigation (My Drive, Shared, Starred, Trash)
16. [ ] Component: `BreadcrumbNav` — folder navigation
17. [ ] React hooks: `useDrive`, `useFiles`, `useUpload`
18. [ ] API client: `src/lib/api/drive.ts`

## Test Criteria
- [ ] Tạo folder → hiển thị trong grid
- [ ] Upload file → file hiện trong folder, progress bar hoạt động
- [ ] Click ảnh → preview modal mở
- [ ] Share file với user khác → họ thấy trong "Shared with me"
- [ ] Delete file → vào Trash, restore được
- [ ] Search "invoice" → tìm đúng files
- [ ] Upload phiên bản mới → version history hiển thị đúng

---
Next Phase: [Phase 05 - Bảng tin](./phase-05-bulletin.md)
