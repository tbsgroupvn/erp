# TÀI LIỆU HỆ THỐNG ERP

> Phiên bản: 4.1 | Cập nhật: 2026-03-06

---

## MỤC LỤC

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Kiến trúc kỹ thuật](#2-kiến-trúc-kỹ-thuật)
3. [Phân quyền & Vai trò](#3-phân-quyền--vai-trò)
4. [Phân hệ nghiệp vụ](#4-phân-hệ-nghiệp-vụ)
5. [Quy trình nghiệp vụ chính](#5-quy-trình-nghiệp-vụ-chính)
6. [Hướng dẫn sử dụng theo vai trò](#6-hướng-dẫn-sử-dụng-theo-vai-trò)
7. [Cấu hình hệ thống](#7-cấu-hình-hệ-thống)
8. [Triển khai & Vận hành](#8-triển-khai--vận-hành)
9. [Chuyển giao hệ thống](#9-chuyển-giao-hệ-thống)
10. [Hệ thống tích hợp & Xử lý nền](#10-hệ-thống-tích-hợp--xử-lý-nền)

---

## 1. TỔNG QUAN HỆ THỐNG

### 1.1 Mô tả

Hệ thống ERP quản lý toàn bộ quy trình kinh doanh của công ty dịch vụ nhập khẩu hàng Trung Quốc, bao gồm:

- **4 loại dịch vụ**: VCT (Vận chuyển thuần), MHH (Mua hàng hộ), UTXNK (Ủy thác xuất nhập khẩu), LCLCN (LCL chính ngạch)
- **2 chi nhánh**: Hà Nội (HN) và Hồ Chí Minh (HCM)
- **3 hệ thống**: ERP Backend (API), ERP Frontend (Nội bộ), CMS Frontend (Website công khai)

### 1.2 Thống kê

| Thành phần | Số lượng |
|---|---|
| Phân hệ nghiệp vụ (backend) | 64 |
| Mô hình dữ liệu (Prisma) | 142 |
| Kiểu liệt kê (Enum) | 89 |
| Vai trò người dùng | 22 |
| Trang giao diện nội bộ | 106 |
| Trang quản trị CMS | 16 |
| Điểm cuối API (HTTP) | 603+ |
| Bộ lắng nghe sự kiện | 116 |
| Tác vụ định kỳ (Cron) | 31 |
| Máy trạng thái nghiệp vụ | 9 |
| Luồng phê duyệt mặc định | 18 |
| Hook giao diện (React) | 48 |
| Module API giao diện | 54 |

### 1.3 Công nghệ sử dụng

| Tầng | Công nghệ |
|---|---|
| Máy chủ | NestJS, Prisma ORM, PostgreSQL, Redis |
| Giao diện nội bộ | Next.js 14 (App Router), Tailwind CSS, shadcn/ui, Zustand, TanStack Query |
| Giao diện website | Next.js 14 (App Router), Tailwind CSS, shadcn/ui |
| Hạ tầng | Docker, Nginx, Let's Encrypt, Certbot |
| Giám sát | Sentry (Theo dõi lỗi) |
| Xác thực | Mã xác thực truy cập + Mã làm mới, Xác thực 2 bước, Bảo vệ giả mạo yêu cầu |

---

## 2. KIẾN TRÚC KỸ THUẬT

### 2.1 Tổng quan kiến trúc

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│ ERP Frontend│    │ CMS Frontend │    │  Mobile/API  │
│  (Next.js)  │    │  (Next.js)   │    │ Ứng dụng khác│
└──────┬──────┘    └──────┬───────┘    └──────┬───────┘
       │                  │                    │
       └──────────┬───────┴────────────────────┘
                  │
            ┌─────▼─────┐
            │   Nginx    │  (Proxy ngược, Chứng chỉ bảo mật, Giới hạn tốc độ)
            └─────┬──────┘
                  │
            ┌─────▼──────┐
            │  Backend   │  (NestJS)
            │  REST API  │
            └──┬─────┬───┘
               │     │
         ┌─────▼┐  ┌─▼─────┐
         │ PgSQL│  │ Redis  │
         │  DB  │  │ Cache  │
         └──────┘  └────────┘
```

### 2.2 Kiến trúc máy chủ

```
tbs-erp-backend/
├── src/
│   ├── core/                    # Dịch vụ hạ tầng
│   │   ├── auth/                # Xác thực mã truy cập, 2 bước, khóa API
│   │   ├── cache/               # Bộ nhớ đệm Redis + hủy + làm nóng
│   │   ├── database/            # Prisma ORM, bản sao đọc, mã hóa
│   │   ├── encryption/          # Mã hóa cấp trường (dữ liệu nhạy cảm)
│   │   ├── event-bus/           # Hệ thống sự kiện nội bộ
│   │   ├── events/              # Sự kiện nghiệp vụ
│   │   ├── graphql/             # GraphQL (truy vấn tổng quan)
│   │   ├── health/              # Kiểm tra sức khỏe (CSDL, Redis, bộ nhớ)
│   │   ├── logger/              # Ghi nhật ký có cấu trúc
│   │   ├── metrics/             # Đo lường hiệu năng
│   │   ├── queue/               # Hàng đợi tác vụ nền
│   │   ├── rbac/                # Kiểm soát truy cập theo vai trò
│   │   ├── sms/                 # Nhà cung cấp tin nhắn (mã xác thực)
│   │   ├── vault/               # Quản lý khóa bí mật
│   │   └── websocket/           # Thông báo thời gian thực
│   ├── modules/                 # 64 phân hệ nghiệp vụ
│   ├── common/                  # Bộ bảo vệ, bộ chặn, bộ trang trí, tiện ích
│   └── config/                  # Cấu hình ứng dụng, nghiệp vụ, thương hiệu
├── prisma/
│   ├── schema/                  # 21 tệp lược đồ
│   └── seed/                    # Dữ liệu mẫu (vai trò, demo)
```

### 2.3 Kiến trúc giao diện

```
tbs-erp-frontend/
├── src/
│   ├── app/
│   │   ├── (auth)/              # Đăng nhập, đăng ký
│   │   ├── (dashboard)/         # 106 trang nội bộ
│   │   ├── admin/               # 16 trang quản trị CMS
│   │   └── (public)/            # Trang công khai
│   ├── components/
│   │   ├── layout/              # Thanh bên, thanh trên
│   │   └── shared/              # Thành phần tái sử dụng
│   ├── features/                # Thành phần theo chức năng
│   └── lib/
│       ├── api/                 # Hàm gọi giao diện lập trình
│       ├── hooks/               # Hook truy vấn
│       ├── providers/           # Xác thực, Truy vấn, Giao diện, Đa ngôn ngữ
│       ├── stores/              # Kho trạng thái Zustand
│       ├── types/               # Kiểu dữ liệu
│       └── utils/               # Hàm trợ giúp, kiểm tra, hằng số
```

### 2.4 Lược đồ Cơ sở dữ liệu (21 tệp, 142 mô hình, 89 kiểu liệt kê)

| Tệp | Mô tả | Mô hình dữ liệu |
|---|---|---|
| `schema.prisma` | Cấu hình nguồn dữ liệu | — |
| `auth.prisma` | Xác thực, Phân quyền, Kiểm toán, Đồng ý, Đăng nhập hộ | User, Session, AuditLog, AuditLogArchive, UserConsent, DataRetentionReport, ImpersonationLog |
| `common.prisma` | Kiểu liệt kê dùng chung | 89 enums |
| `order.prisma` | Đơn hàng, Báo giá, Hợp đồng, MHH | MasterOrder, Order, OrderItem, OrderExtraCharge, OrderStatusHistory, PreAlert, Contract, Quotation, QuotationItem, QuotationTemplate, SupplierOrder, MHHIssue, ServiceFeeConfig, ReturnRequest, CancelPenaltyConfig |
| `crm.prisma` | Khách hàng, Ví điện tử, CRM mở rộng | Customer, Contact, Wallet, WalletTransaction, CustomerInteractionNote, Lead, LeadNote |
| `finance.prisma` | Kế toán, Thu chi, Hóa đơn (26 mô hình) | AccountReceivable, AccountPayable, PaymentVoucher, CashTransaction, Invoice, InvoiceItem, ExchangeRate, DebtNetting, DebtNettingItem, ChartOfAccount, JournalEntry, JournalEntryLine, CommissionRule, CommissionRecord, PurchaseRequest, PurchaseRequestItem, PurchaseOrder, StockItem, StockMovement, CODRecord, ClosedPeriod, PaymentAllocation, PaymentAllocationDetail, ARAgingSnapshot, UnallocatedFundClaim, BankWebhookTransaction |
| `warehouse.prisma` | Kho TQ/VN, QC | Package, WeightAuditLog, LostAndFound, QCPhotoGuideline, PackageConsolidation, StorageLocation, InventoryCount, InventoryCountItem, QCInspection |
| `container.prisma` | Container, Vận chuyển | Container |
| `logistics.prisma` | Xe, Tài xế, Giao hàng | Vehicle, Driver, Delivery, DeliveryPackage, VehicleMaintenance, FuelRecord |
| `hr.prisma` | Nhân sự, Lương, Chấm công, Tuyển dụng | Employee, Attendance, LeaveRequest, OvertimeRequest, PayrollRecord, TrainingRecord, Candidate, OnboardingChecklist, PerformanceNote |
| `complaint.prisma` | Khiếu nại | Complaint |
| `system.prisma` | Phê duyệt, Thông báo, Task, Vendor, Webhook (23 mô hình) | ApprovalFlowDefinition, ApprovalFlowNode, ApprovalFlowEdge, Approval, ApprovalStep, ApprovalCC, ApprovalComment, ApprovalActionLog, ApprovalDelegation, Notification, NotificationRule, EscalationRule, Document, Task, TaskComment, Vendor, VendorRating, LegalDocument, WebhookEndpoint, WebhookDelivery, ApiKey, RevenueTarget, ResponseTemplate |
| `tracking.prisma` | Sự kiện theo dõi | TrackingEvent |
| `operation-cost.prisma` | Chi phí vận hành | OperationCost, CostAllocation |
| `blog.prisma` | Blog nội bộ | BlogCategory, BlogPost, BlogComment |
| `customs.prisma` | Khai báo hải quan (11 mô hình) | CustomsDeclaration, CustomsDeclarationLine, CustomsLineSourceItem, HSCodeLibrary, HSCodeKeyword, ComplianceAlert, CustomsTaxAllocation, CustomsStatusHistory, ComplianceRule, CustomsDocumentChecklist, CustomsServiceRate |
| `cms.prisma` | CMS Website | Page, Media, Menu, MenuItem, SiteSetting, Redirect, ContactSubmission, NewsletterSubscription, FAQ |
| `integration.prisma` | Tích hợp, Outbox, Đối soát | OutboxEvent, DeadLetterEvent, ReconciliationRun, ReconciliationItem, BatchJob, SyncLog |
| `support-ticket.prisma` | Phiếu hỗ trợ khách hàng | SupportTicket, TicketResponse |
| `carrier-reconciliation.prisma` | Đối soát hãng vận chuyển | CarrierReconciliation, CarrierReconItem |
| `cost-adjustment.prisma` | Điều chỉnh chi phí | CostAdjustment |

### 2.5 Tính năng bảo mật

- **Xác thực**: Mã truy cập JWT (15 phút) + mã làm mới (7 ngày), quản lý phiên đăng nhập
- **Xác thực 2 bước**: Mã xác thực thời gian (Google Authenticator) + tin nhắn mã dự phòng
- **Chống giả mạo yêu cầu**: Mẫu cookie gửi kép
- **Mã hóa trường dữ liệu**: Các trường nhạy cảm (số tài khoản ngân hàng, mã số thuế, mã bảo hiểm) được mã hóa ở tầng cơ sở dữ liệu
- **Phạm vi dữ liệu**: Người dùng chỉ thấy dữ liệu thuộc phạm vi vai trò/chi nhánh của mình
- **Nhật ký kiểm toán**: Mọi thao tác tạo/đọc/sửa/xóa đều ghi nhật ký kèm dữ liệu cũ/mới, địa chỉ IP
- **Giới hạn tốc độ**: Cấu hình theo từng điểm cuối (đăng nhập: 5 lần/phút, API: 100 lần/phút)
- **Lọc đầu vào**: Bộ lọc HTML cho mọi dữ liệu người dùng nhập
- **Chính sách bảo mật nội dung**: Tiêu đề CSP nghiêm ngặt trên tất cả giao diện
- **Bảo vệ dữ liệu cá nhân (Nghị định 13)**: Theo dõi sự đồng ý của người dùng, chính sách lưu giữ dữ liệu, lưu trữ nhật ký kiểm toán
- **Đăng nhập hộ**: Đăng nhập hộ khách hàng với nhật ký kiểm toán đầy đủ (CEO/COO/SALES_DIRECTOR/CSKH)

### 2.6 Năm Nguyên tắc Kiến trúc Lõi

Toàn bộ hệ thống được xây dựng dựa trên 5 nguyên tắc kiến trúc bất biến:

#### Nguyên tắc 1: ĐƠN HÀNG LÀ TRUNG TÂM
- Mọi thực thể nghiệp vụ (kiện hàng, phiếu thu/chi, công nợ, khiếu nại, kiểm tra chất lượng, đơn mua hàng nhà cung cấp, phân bổ chi phí, phụ phí) đều liên kết về đơn hàng
- Khi xem chi tiết đơn hàng, hệ thống trả về toàn bộ 10+ quan hệ liên quan (gói hàng, phiếu thanh toán, khiếu nại, giao hàng, kiểm tra chất lượng, đơn nhà cung cấp, sự cố mua hàng hộ, phân bổ chi phí, phụ phí)
- Không tồn tại dữ liệu mồ côi — mọi bản ghi đều truy ngược về đơn hàng gốc

#### Nguyên tắc 2: KHÔNG TIN TƯỞNG
- **Tách biệt nhiệm vụ**: Người tạo phiếu chi không được tự duyệt phiếu do mình tạo
- **Chặn vượt tổng đơn**: Tổng phiếu thu đã duyệt không được vượt tổng giá trị đơn hàng
- **Kiểm tra công nợ tích lũy**: Khi xuất kho, tính cả số tiền chưa thanh toán của đơn hiện tại vào tổng nợ trước khi so sánh với hạn mức tín dụng
- **Cảnh báo chênh lệch giá nhà cung cấp**: Giá thực tế vượt >10% so với báo giá → cảnh báo và ghi nhật ký
- **Bắt buộc ảnh chứng minh**: Nhận hàng từ nhà cung cấp, nhận kiện tại kho Trung Quốc, kiểm tra chất lượng — đều phải đính kèm ít nhất 1 ảnh
- **Bắt buộc chứng từ**: Phiếu thu/chi trên 10 triệu đồng phải đính kèm chứng từ
- **Kiểm soát kỳ kế toán**: Không cho phép tạo phiếu khi kỳ kế toán đã đóng

#### Nguyên tắc 3: QUY TRÌNH MỘT CHIỀU
- **7 máy trạng thái** kiểm soát chuyển đổi trạng thái: Đơn nhà cung cấp, Container, Báo giá, Khiếu nại, Phiếu thu/chi, Kho Trung Quốc, Kho Việt Nam
- Mỗi máy trạng thái định nghĩa rõ: trạng thái cho phép chuyển tiếp, trạng thái kết thúc, và chặn mọi chuyển đổi không hợp lệ
- Không thể bỏ qua bước — hệ thống ném lỗi ngay khi phát hiện chuyển đổi trái phép
- Ví dụ: Kiện hàng ở kho Trung Quốc phải qua `ĐÃ NHẬN → ĐÃ KIỂM → ĐÃ ĐÓNG GÓI → ĐÃ XUẤT` — không thể nhảy cóc

#### Nguyên tắc 4: THỰC TẾ vs KHAI BÁO
- **Dữ liệu gốc bất biến**: Trọng lượng cân tại kho Trung Quốc (cân nặng kho Trung Quốc) và kho Việt Nam (cân nặng kho Việt Nam) được lưu riêng biệt, không ghi đè lẫn nhau
- **Xóa mềm thay vì xóa cứng**: Khi saga bồi hoàn lỗi, bản ghi công nợ/hoa hồng/hóa đơn được đánh dấu `HỦY BỎ` thay vì xóa khỏi cơ sở dữ liệu
- **Xóa mềm dòng hải quan**: Dòng khai báo hải quan sử dụng trường thời điểm xóa — bản ghi cũ vẫn lưu trữ để kiểm toán, truy vấn tự động lọc bỏ bản ghi đã xóa
- **Nhật ký kiểm toán**: Mọi thao tác tạo/đọc/sửa/xóa đều ghi nhật ký với dữ liệu cũ/mới, địa chỉ IP

#### Nguyên tắc 5: PHÂN BỔ BẤT ĐỒNG BỘ
- Khi nhập chi phí vận hành, hệ thống đẩy tác vụ phân bổ vào hàng đợi sự kiện tài chính thay vì xử lý đồng bộ
- Bộ xử lý hàng đợi tự động phân bổ chi phí theo chiến lược đã cấu hình (theo trọng lượng / thể tích / chia đều)
- Đảm bảo không trùng lặp: mỗi tác vụ có mã định danh duy nhất (`cost-alloc-{mã chi phí}`)
- Tự động thử lại khi thất bại, không ảnh hưởng hiệu năng luồng chính

### 2.7 Máy trạng thái nghiệp vụ

Hệ thống sử dụng 9 máy trạng thái để cưỡng chế quy trình nghiệp vụ một chiều:

| Máy trạng thái | Phạm vi | Các chuyển đổi hợp lệ |
|---|---|---|
| Đơn hàng | Vòng đời đơn hàng (13 giai đoạn) | TIẾP NHẬN → BÁO GIÁ → CHỜ CỌC → MUA HÀNG → **NHẬP KHO TQ** → ĐÓNG GÓI → GHÉP CONT → VẬN CHUYỂN → THÔNG QUAN → NHẬP KHO VN → GIAO HÀNG → QUYẾT TOÁN → HOÀN THÀNH (+TẠM GIỮ, SỰ CỐ, HỦY, TRẢ HÀNG). **Lưu ý:** Chuyển tự động MUA HÀNG → NHẬP KHO TQ khi kiện hàng đầu tiên được quét barcode tại kho Trung Quốc. |
| Đơn nhà cung cấp | Đơn mua hàng từ nhà cung cấp Trung Quốc | NHÁP → BÁO GIÁ → ĐÃ ĐẶT → XÁC NHẬN → GIAO 1 PHẦN → ĐÃ GIAO TQ → ĐÃ NHẬN TQ |
| Container | Quản lý container vận chuyển | LÊN KẾ HOẠCH → ĐANG TẢI → VẬN CHUYỂN → ĐÃ ĐẾN → THÔNG QUAN → HOÀN THÀNH (+KẸT CỬA KHẨU) |
| Báo giá | Quy trình báo giá khách hàng | NHÁP → CHỜ DUYỆT → ĐÃ DUYỆT → CHUYỂN ĐỔI / HẾT HẠN / TỪ CHỐI |
| Khiếu nại | Xử lý khiếu nại khách hàng | MỞ → ĐANG ĐIỀU TRA → CHỜ GIẢI QUYẾT → ĐÃ GIẢI QUYẾT → ĐÓNG |
| Phiếu thu/chi | Duyệt phiếu thu chi | CHỜ DUYỆT → ĐÃ DUYỆT / TỪ CHỐI |
| Kho Trung Quốc | Trạng thái kiện hàng tại kho TQ | ĐÃ NHẬN → ĐÃ KIỂM → ĐÃ ĐÓNG GÓI → ĐÃ XUẤT |
| Kho Việt Nam | Trạng thái kiện hàng tại kho VN | ĐÃ NHẬN → ĐÃ PHÂN LOẠI → SẴN SÀNG → ĐÃ GIAO |
| Khai báo hải quan | Quy trình thông quan | NHÁP → ĐÃ NỘP → ĐANG XEM XÉT → ĐÃ DUYỆT/TỪ CHỐI → ĐÃ THÔNG QUAN/GIỮ LẠI |

Mỗi máy trạng thái cung cấp 4 phương thức:
- **Kiểm tra chuyển đổi** — Trả về có/không cho một chuyển đổi cụ thể
- **Cưỡng chế chuyển đổi** — Ném lỗi nếu chuyển đổi không hợp lệ
- **Danh sách trạng thái tiếp theo** — Liệt kê các trạng thái có thể chuyển đến
- **Kiểm tra trạng thái kết thúc** — Xác định trạng thái đã kết thúc (không thể chuyển tiếp)

---

## 3. PHÂN QUYỀN & VAI TRÒ

### 3.1 Danh sách vai trò (22 vai trò)

#### Ban Giám Đốc
| Mã vai trò | Tên tiếng Việt | Quyền chính |
|---|---|---|
| `CEO` | Tổng Giám đốc | Toàn quyền hệ thống |
| `COO` | Giám đốc Điều hành | Toàn quyền vận hành |
| `CFO` | Giám đốc Tài chính | Toàn quyền tài chính |
| `DIRECTOR_OPERATIONS` | Giám đốc Vận hành | Quản lý vận hành |

#### Kinh Doanh
| Mã vai trò | Tên tiếng Việt | Quyền chính |
|---|---|---|
| `SALES_DIRECTOR` | Giám đốc Kinh doanh | Quản lý toàn bộ nhóm kinh doanh, duyệt báo giá, xem doanh thu |
| `SALES_LEADER` | Trưởng nhóm Kinh doanh | Quản lý nhóm, duyệt giảm giá ≤3% |
| `SALE` | Nhân viên Kinh doanh | Tạo đơn, báo giá, quản lý khách hàng thuộc mình |

#### Marketing & CSKH
| Mã vai trò | Tên tiếng Việt | Quyền chính |
|---|---|---|
| `MARKETING_STAFF` | Nhân viên Tiếp thị | Quản lý nội dung website, bài viết, bản tin |
| `CSKH` | Nhân viên Chăm sóc khách hàng | Hỗ trợ khách hàng, theo dõi đơn, khiếu nại |

#### Kế Toán
| Mã vai trò | Tên tiếng Việt | Quyền chính |
|---|---|---|
| `CHIEF_ACCOUNTANT` | Kế toán Trưởng | Duyệt phiếu chi/thu, sổ cái, quyết toán |
| `ACCOUNTANT` | Kế toán viên | Nhập liệu tài chính |
| `ACCOUNTANT_AR` | Kế toán Thanh toán | Quản lý công nợ phải thu/trả |
| `ACCOUNTANT_COST` | Kế toán Chi phí | Quản lý chi phí vận hành |

#### Xuất Nhập Khẩu
| Mã vai trò | Tên tiếng Việt | Quyền chính |
|---|---|---|
| `XNK_MANAGER` | Trưởng phòng XNK | Quản lý container, thông quan |
| `XNK_STAFF` | Nhân viên XNK | Nhập liệu XNK |

#### Kho
| Mã vai trò | Tên tiếng Việt | Quyền chính |
|---|---|---|
| `WAREHOUSE_MANAGER` | Quản lý kho | Quản lý cả kho TQ & VN |
| `WAREHOUSE_CN_AGENT` | Đại lý kho Trung Quốc | Nhận hàng, kiểm tra, đóng gói tại kho Trung Quốc |
| `WAREHOUSE_VN_MANAGER` | Trưởng kho VN | Nhận hàng, sắp xếp, xuất kho VN |
| `WAREHOUSE_VN_STAFF` | Nhân viên kho VN | Hỗ trợ kho VN |

#### Nhân sự & Vận tải
| Mã vai trò | Tên tiếng Việt | Quyền chính |
|---|---|---|
| `HR_MANAGER` | Trưởng phòng Nhân sự | Quản lý nhân viên, lương, chấm công |
| `LOGISTICS_MANAGER` | Trưởng phòng Vận tải | Quản lý xe, tài xế, lộ trình giao hàng |
| `DRIVER` | Tài xế | Nhận lệnh giao hàng, xác nhận giao, thu tiền hộ |

### 3.2 Phạm vi dữ liệu

| Vai trò | Phạm vi dữ liệu |
|---|---|
| Ban Giám đốc (Tổng GĐ, GĐ Điều hành, GĐ Tài chính) | Toàn bộ hệ thống |
| Giám đốc Kinh doanh | Toàn bộ đơn hàng kinh doanh |
| Trưởng nhóm Kinh doanh | Đơn hàng của nhóm mình |
| Nhân viên Kinh doanh | Chỉ đơn hàng khách hàng mình phụ trách |
| Bộ phận Kế toán | Toàn bộ dữ liệu tài chính |
| Bộ phận Kho | Dữ liệu kho theo chi nhánh |
| Tài xế | Chỉ phiếu giao hàng được phân công cho mình |

### 3.3 Hệ thống phê duyệt

**Loại phê duyệt (20 loại):**

| Loại | Mô tả | Người duyệt mặc định |
|---|---|---|
| `DISCOUNT` | Giảm giá >3% | Trưởng nhóm KD → Giám đốc KD |
| `PAYMENT_VOUCHER` | Phiếu chi | Kế toán Trưởng → GĐ Tài chính (nếu >500 triệu) |
| `RECEIPT_VOUCHER` | Phiếu thu | Kế toán Trưởng |
| `ORDER_CANCEL` | Hủy đơn hàng | Trưởng nhóm KD → Tổng GĐ |
| `CREDIT_EXTENSION` | Gia hạn công nợ | Kế toán Trưởng → GĐ Tài chính |
| `DEPOSIT_EXEMPTION` | Miễn/giảm cọc | GĐ Kinh doanh → Tổng GĐ |
| `CONTAINER_PLAN` | Kế hoạch container | Trưởng phòng XNK → GĐ Điều hành |
| `WAREHOUSE_RELEASE` | Xuất kho | Quản lý kho |
| `LEAVE_REQUEST` | Nghỉ phép | Quản lý trực tiếp |
| `OVERTIME_REQUEST` | Tăng ca | Quản lý trực tiếp → Trưởng phòng Nhân sự |
| `PURCHASE_ORDER` | Mua hàng | Trưởng phòng → GĐ Tài chính |
| `QUOTATION_SPECIAL` | Báo giá đặc biệt | GĐ Kinh doanh |
| `EXPENSE_CLAIM` | Hoàn ứng chi phí | Kế toán Trưởng |
| `SALARY_ADJUSTMENT` | Điều chỉnh lương | Trưởng phòng NS → Tổng GĐ |
| `GRACE_PERIOD_REQUEST` | Xin ân hạn cho khách VIP | GĐ Tài chính → Tổng GĐ |
| `EXTRA_CHARGE_APPROVAL` | Phụ phí phát sinh đơn hàng | Trưởng kho VN → Kế toán Trưởng |
| `CREDIT_OVERDRAFT` | Thấu chi tạm thời | Kế toán Trưởng → GĐ Điều hành |
| `CUSTOM` | Tùy chỉnh | Quản trị viên tự định nghĩa |

**Chế độ phê duyệt:**
- `SEQUENTIAL` — Tuần tự theo thứ tự bước
- `PARALLEL_AND` — Tất cả người duyệt phải đồng ý
- `PARALLEL_OR` — Chỉ cần 1 người duyệt đồng ý

**Tính năng nâng cao:**
- Ủy quyền khi vắng mặt
- Tự động leo thang khi quá hạn (có thể cấu hình)
- Thêm người theo dõi
- Định tuyến theo điều kiện (ví dụ: số tiền > 50 triệu → thêm bước Tổng GĐ duyệt)
- Trình thiết kế luồng trực quan (kéo-thả)

---

## 4. PHÂN HỆ NGHIỆP VỤ

### Nhóm A: Kinh doanh & Bán hàng

#### 4.1 Quản lý khách hàng
**Trang:** `/khach-hang`

| Chức năng | Mô tả |
|---|---|
| Danh sách khách hàng | Tìm kiếm, lọc theo hạng/chi nhánh/nhân viên kinh doanh, phân trang |
| Tạo khách hàng mới | `/khach-hang/tao-moi` — Biểu mẫu nhập đầy đủ |
| Chi tiết khách hàng | `/khach-hang/[id]` — Thông tin, đơn hàng, công nợ, liên hệ |
| Hạng khách hàng | MỚI (cọc 100%), THƯỜNG (70%), VIP (50%), ĐỐI TÁC CHIẾN LƯỢC (30%) |
| Ví khách hàng | Nạp tiền, trừ tiền, lịch sử giao dịch |
| Chặn khách hàng | Khóa khi nợ quá hạn, mở khóa khi thanh toán |
| Kiểm soát tín dụng | Điều khoản thanh toán (7/15/30/60 ngày), thời gian ân hạn, lãi chậm trả |
| Ân hạn VIP | Xin ân hạn cho khách VIP — quy trình phê duyệt CFO → CEO |
| Thấu chi tạm thời | Trưởng nhóm kinh doanh đặt hạn mức thấu chi 24 giờ — tự động chặn khi hết hạn |
| Chế độ tỷ giá | Chốt cứng hoặc thả nổi theo khách hàng |

#### 4.2 Báo giá
**Trang:** `/bao-gia`

| Chức năng | Mô tả |
|---|---|
| Tạo báo giá | `/bao-gia/tao-moi` — Chọn khách hàng, dịch vụ, mặt hàng, chiết khấu |
| Duyệt báo giá | Giảm giá >3% → cấp 2, >5% → cấp 3 |
| Quản lý phiên bản | Tạo phiên bản mới từ báo giá cũ |
| Mẫu báo giá | Mẫu có sẵn để tạo nhanh |
| Xuất file | Xuất Excel/PDF với thông tin công ty |
| Chuyển đổi | Báo giá → Hợp đồng → Đơn hàng |

**Trạng thái báo giá (cưỡng chế bởi máy trạng thái):** `NHÁP` → `CHỜ DUYỆT` → `ĐÃ DUYỆT` → `CHUYỂN ĐỔI` / `HẾT HẠN` / `TỪ CHỐI` — chỉ báo giá ở trạng thái `NHÁP` hoặc `CHỜ DUYỆT` mới có thể chỉnh sửa; báo giá bị từ chối có thể quay về `NHÁP` để sửa lại.

#### 4.3 Hợp đồng
**Trang:** `/hop-dong`

| Chức năng | Mô tả |
|---|---|
| Tạo hợp đồng | `/hop-dong/tao-moi` — Từ báo giá hoặc tạo mới |
| Phụ lục | Tạo phụ lục từ hợp đồng chính |
| Phân bổ thanh toán | Liên kết thanh toán với hợp đồng |
| Vòng đời | NHÁP → CHỜ KÝ → ĐÃ KÝ → ĐANG HIỆU LỰC → ĐÃ QUYẾT TOÁN → HOÀN THÀNH |

#### 4.4 Đơn hàng
**Trang:** `/don-hang`

| Chức năng | Mô tả |
|---|---|
| Tạo đơn | `/don-hang/tao-moi` — Chọn khách hàng, dịch vụ, mặt hàng. Hỗ trợ dán từ Excel |
| Nhập Excel | `/don-hang/nhap-excel` — Nhập hàng loạt |
| Chi tiết đơn 360° | `/don-hang/[id]` — Giao diện tab: Thông tin kinh doanh, Hàng hóa, Tài chính, Vận hành, Nhật ký |
| Đơn tổng | Đơn tổng chứa nhiều đơn con (A, B, C) |
| Mẫu đơn hàng | `/don-hang/template` — Mẫu đơn hàng tái sử dụng |
| Phụ phí phát sinh | Thêm phụ phí khi có chi phí ngoài dự kiến — tạm giữ cho đến khi duyệt |
| Giao hàng từng phần | Theo dõi tiến độ hoàn thành: CHƯA → MỘT PHẦN → TOÀN BỘ |
| Trung tâm tài liệu | Tập hợp tất cả tài liệu liên quan đơn (hợp đồng, hóa đơn, hải quan, ảnh QC) |
| Tỷ giá đơn hàng | Chốt cứng hoặc thả nổi tùy theo cấu hình khách hàng |

**13 giai đoạn đơn hàng:** (Chi tiết tại [Mục 5.1](#51-vòng-đời-đơn-hàng))

#### 4.5 Mua hàng hộ
**Trang:** `/don-hang/[id]` (tab Sourcing)

| Chức năng | Mô tả |
|---|---|
| Đặt hàng nhà cung cấp | Tạo đơn nhà cung cấp cho từng mặt hàng/nhóm mặt hàng |
| Theo dõi nhà cung cấp | Theo dõi trạng thái đơn trên sàn thương mại điện tử (1688, Taobao, PDD) |
| QC kiểm hàng | `/kiem-tra-chat-luong` — Chụp ảnh, gửi khách hàng xem trước khi vận chuyển |
| Sự cố mua hàng hộ | Quản lý sự cố: hết hàng, sai hàng, thiếu hàng, giá thay đổi |
| Phí dịch vụ | Cấu hình phí mua hàng hộ theo hạng khách, giá trị đơn, danh mục |
| Bắt buộc ảnh nhận hàng | Khi nhận hàng từ nhà cung cấp, **bắt buộc** đính kèm ít nhất 1 ảnh chứng minh |
| Cảnh báo chênh lệch giá | Nếu giá thực tế vượt >10% so với giá báo giá nhà cung cấp → hệ thống tự động cảnh báo và ghi sự kiện |

**Trạng thái đơn nhà cung cấp (cưỡng chế bởi máy trạng thái):** `NHÁP` → `BÁO GIÁ` → `ĐÃ ĐẶT` → `XÁC NHẬN` → `GIAO MỘT PHẦN` → `ĐÃ GIAO TQ` → `ĐÃ NHẬN TQ` → (hoặc `ĐANG TRẢ` → `ĐÃ HOÀN TIỀN`)

### Nhóm B: Kho vận

#### 4.6 Kho Trung Quốc
**Trang:** `/kho-trung-quoc`

| Chức năng | Mô tả |
|---|---|
| Nhận kiện | Quét mã vận đơn, nhập trọng lượng/kích thước. **Tự động chuyển trạng thái đơn hàng sang NHẬP KHO TQ khi kiện đầu tiên được quét barcode đúng** |
| Quét mã vạch nhanh | Ô quét mã tại đầu trang — bộ nhớ đệm Redis <50ms, hỗ trợ máy quét mã vạch |
| Tính cước | Tự động tính trọng lượng thể tích (hệ số 5000/6000) |
| Cân nặng kho Trung Quốc | Ghi nhận trọng lượng cân tại kho Trung Quốc |
| Kiểm tra chất lượng | Chụp ảnh, kiểm tra số lượng/chất lượng |
| Đóng gói | Đánh kiện, chuẩn bị xuất container |
| Chi tiết kiện | `/kho-trung-quoc/[id]` — Thông tin, ảnh, trọng lượng |
| Hàng rủi ro cao | Đánh dấu kiện rủi ro — yêu cầu khách xác nhận miễn trừ trách nhiệm trước khi giao |
| Hàng vô chủ | `/kho-trung-quoc/that-lac` — Quản lý kiện không xác định được chủ, nhân viên kinh doanh nhận vơ liên kết vào đơn |
| Trạng thái độc lập | Kiện có thể bị tịch thu hải quan hoặc giữ rủi ro cao mà không ảnh hưởng các kiện khác |
| Bắt buộc ảnh nhận kiện | Khi nhận kiện tại kho Trung Quốc, **bắt buộc** chụp ảnh kiện hàng (kiểm tra tại cả tầng dữ liệu đầu vào và tầng xử lý) |

**Máy trạng thái kho Trung Quốc:** `ĐÃ NHẬN` → `ĐÃ KIỂM` → `ĐÃ ĐÓNG GÓI` → `ĐÃ XUẤT` — mỗi bước được cưỡng chế bởi máy trạng thái, không thể nhảy cóc hoặc quay lui.

#### 4.7 Kho Việt Nam
**Trang:** `/kho-viet-nam`

| Chức năng | Mô tả |
|---|---|
| Nhận hàng | Nhập kho từ container |
| Quét mã vạch nhanh | Ô quét mã tại đầu trang — bộ nhớ đệm Redis <50ms |
| Cân lại tại Việt Nam | Cân lại kiện tại VN — tự động cảnh báo nếu chênh lệch >5% so với cân TQ |
| Phân loại | Sắp xếp theo đơn hàng, khách hàng |
| Xuất kho (Chặn cứng) | Cưỡng chế thanh toán trước xuất kho — tính tổng công nợ tích lũy **bao gồm cả số tiền chưa thanh toán của đơn hiện tại** trước khi so sánh với hạn mức tín dụng |
| Tách giao hàng | Cho phép chọn một số kiện để giao trước (không bắt buộc giao hết cùng lúc) |
| Hàng hoàn trả (RTO) | Tab riêng hiển thị hàng giao thất bại được trả về kho |
| Hàng vô chủ | Quản lý hàng không xác định được chủ |
| Kiểm kê kho | `/kho-viet-nam/kiem-ke` — Kiểm kê tồn kho theo vị trí lưu trữ |
| Phiếu xuất hàng | `/kho-viet-nam/pick-list` — Tạo phiếu xuất hàng theo lô |
| Gộp kiện TQ | `/kho-trung-quoc/gop-kien` — Gộp nhiều kiện nhỏ thành 1 kiện lớn |

**Máy trạng thái kho Việt Nam:** `ĐÃ NHẬN` → `ĐÃ PHÂN LOẠI` → `SẴN SÀNG` → `ĐÃ GIAO` — cưỡng chế bởi máy trạng thái.

**Quy trình giao thất bại & hoàn trả (RTO):**

Khi tài xế giao hàng thất bại (khách không có nhà, từ chối nhận, địa chỉ sai), hệ thống thực hiện luồng hoàn trả hoàn chỉnh:

```
1. Tài xế bấm "Giao thất bại"
   POST /warehouse-vn/deliveries/:id/failed
   - Chọn lý do: KH_KHONG_CO_NHA | KH_TU_CHOI | DIA_CHI_SAI | KHAC
   - Nhập ghi chú, đính kèm ảnh bằng chứng
   → Delivery: ĐANG GIAO → THẤT BẠI → TRẢ VỀ KHO (tự động)
   → Gửi thông báo khẩn cấp cho Sale + CSKH

2. Hàng về kho VN → Nhân viên kho scan nhận
   POST /warehouse-vn/deliveries/:id/rto/receive
   → Delivery: TRẢ VỀ KHO → ĐÃ NHẬN LẠI
   → Gửi thông báo Sale + CSKH: "Hàng đã về kho, phí lưu kho tính từ ngày..."

3. Phí lưu kho tự động tích lũy
   - Cron chạy hàng đêm @midnight: accrueStorageFees()
   - Phí: 10.000 VND/ngày (cấu hình qua RTO_DAILY_STORAGE_RATE)
   - Nhắc nhở tự động: 7 ngày (bình thường), 14 ngày (cao), 30 ngày (khẩn cấp → CEO/COO)

4. Lên lịch giao lại
   POST /warehouse-vn/deliveries/:id/rto/reschedule
   - Chọn ngày giao (phải là tương lai)
   - Tự động tính phí lưu kho = số ngày × 10.000 VND
   - Tạo phụ phí RTO_STORAGE → quy trình phê duyệt tự động
   - Tạo delivery mới với ngày giao mới
   → Giao lại thành công → ĐÃ GIAO

5. Hàng tồn >30 ngày → Cảnh báo CEO/COO để quyết định xử lý
```

| Endpoint RTO | Vai trò | Mô tả |
|---|---|---|
| `POST /deliveries/:id/failed` | DRIVER, WH_VN_MANAGER, WH_VN_STAFF | Báo giao thất bại |
| `POST /deliveries/:id/rto/initiate` | DRIVER, WH_VN_MANAGER, WH_VN_STAFF | Khởi tạo trả hàng |
| `POST /deliveries/:id/rto/receive` | WH_VN_MANAGER, WH_VN_STAFF | Kho nhận hàng hoàn |
| `POST /deliveries/:id/rto/reschedule` | WH_VN_MANAGER, WH_VN_STAFF, SALE | Lên lịch giao lại |

#### 4.8 Container
**Trang:** `/container`

| Chức năng | Mô tả |
|---|---|
| Kế hoạch | Lên kế hoạch ghép container |
| Ghép kiện | Gán kiện hàng vào container (chỉ container ở trạng thái LÊN KẾ HOẠCH hoặc ĐANG TẢI) |
| Theo dõi | Theo dõi vị trí container thời gian thực |
| Tỷ lệ lấp đầy | Tỷ lệ lấp đầy container |
| Đề xuất ghép | Hệ thống tự động gợi ý phương án ghép container tối ưu theo tuyến vận chuyển |

**Phân quyền ghép kiện:** Nhân viên kinh doanh (SALE, SALES_LEADER, SALES_DIRECTOR) và nhân viên xuất nhập khẩu (XNK_STAFF, XNK_MANAGER) có quyền xem container và ghép kiện hàng vào container đang mở. Việc tạo container mới và chuyển trạng thái container chỉ do kho vận và logistics thực hiện.

**Trạng thái (cưỡng chế bởi máy trạng thái):** `LÊN KẾ HOẠCH` → `ĐANG TẢI` → `VẬN CHUYỂN` → `ĐÃ ĐẾN` → `THÔNG QUAN` → `HOÀN THÀNH`

**Trạng thái đặc biệt:** `KẸT CỬA KHẨU` — Container bị kẹt tại cửa khẩu, có thể quay lại `VẬN CHUYỂN` hoặc chuyển sang `ĐÃ ĐẾN`. Tự động thông báo khách hàng.

#### 4.9 Giao hàng
**Trang:** `/giao-hang`

| Chức năng | Mô tả |
|---|---|
| Tạo phiếu giao | Chọn đơn hàng, tài xế, xe |
| Phân công | Trưởng kho phân công cho tài xế |
| Bằng chứng giao hàng | Ảnh giao hàng, chữ ký khách hàng |
| Thu tiền hộ | Thu tiền khi giao, đối soát |

**Trạng thái:** `CHỜ` → `ĐÃ PHÂN CÔNG` → `ĐÃ LẤY HÀNG` → `ĐANG GIAO` → `ĐÃ GIAO` / `THẤT BẠI` → `TRẢ VỀ KHO` → `ĐÃ NHẬN LẠI`

**Tính năng mới:**
- **Giao hàng từng phần**: Hỗ trợ giao hàng từng phần — chọn một số kiện để giao, đơn chỉ ĐÃ GIAO khi tất cả kiện đã giao
- **Trả hàng (RTO)**: Khi giao thất bại → bắt buộc nhập lý do → TRẢ VỀ KHO → nhận lại kho → tính phí lưu kho tự động theo ngày
- **Chặn tài xế thu tiền hộ**: Tài xế chưa nộp tiền thu hộ sau 24 giờ bị chặn nhận lệnh giao hàng mới

#### 4.10 Theo dõi vận chuyển
**Trang:** `/theo-doi`

| Chức năng | Mô tả |
|---|---|
| Dòng thời gian | 12 loại sự kiện từ lấy hàng đến giao hàng |
| Tra cứu công khai | Khách hàng tra cứu trên website |
| Theo dõi container | Theo dõi container trên bản đồ |

#### 4.11 Phương tiện & Tài xế
**Trang:** `/phuong-tien`, `/tai-xe`

| Chức năng | Mô tả |
|---|---|
| Quản lý đội xe | Quản lý xe tải, xe van, xe máy |
| Bảo dưỡng | Lịch bảo dưỡng, chi phí |
| Nhiên liệu | Ghi nhận đổ xăng, ODO |
| Tài xế | Quản lý bằng lái, trạng thái (sẵn sàng/đang giao/nghỉ) |

### Nhóm C: Tài chính & Kế toán

#### 4.12 Phiếu thu/chi
**Trang:** `/tai-chinh/phieu-thu-chi`

| Chức năng | Mô tả |
|---|---|
| Phiếu thu | Loại = THU |
| Phiếu chi | Loại = CHI — kiểm tra chống gian lận tự động |
| Duyệt phiếu | Quy trình phê duyệt theo số tiền |
| Chứng từ | Tải lên ảnh chứng từ đính kèm |
| Tách biệt nhiệm vụ | Người tạo phiếu **không thể** tự duyệt phiếu do mình tạo |
| Chặn vượt tổng đơn | Tổng phiếu thu đã duyệt cho một đơn hàng **không thể** vượt tổng giá trị đơn hàng |
| Bắt buộc chứng từ >10 triệu | Phiếu thu/chi trên 10 triệu đồng **bắt buộc** đính kèm chứng từ |
| Kiểm soát số dư quỹ | Phiếu chi bị chặn nếu số dư quỹ không đủ |
| Kiểm soát kỳ kế toán | Không thể tạo phiếu khi kỳ kế toán đã đóng |
| Kiểm tra 3 bên | Cảnh báo nếu tổng chi cho đơn nhà cung cấp vượt báo giá >5% |

**Máy trạng thái phiếu thu/chi:** `CHỜ DUYỆT` → `ĐÃ DUYỆT` / `TỪ CHỐI` — cưỡng chế bởi máy trạng thái, trạng thái kết thúc không thể chuyển tiếp.

**Quy tắc chống gian lận:**
- Phiếu chi >90% tháng trước → đánh dấu nghi ngờ
- Chi phí khác >5 triệu → đánh dấu nghi ngờ
- >5 phiếu/ngày → đánh dấu nghi ngờ
- Lý do <20 ký tự → từ chối
- Ngoài giờ làm việc → đánh dấu nghi ngờ

#### 4.13 Công nợ phải thu
**Trang:** `/tai-chinh/cong-no-phai-thu`

| Chức năng | Mô tả |
|---|---|
| Danh sách công nợ | Lọc theo khách hàng, trạng thái, ngày đến hạn |
| Phân tích tuổi nợ | `/tai-chinh/cong-no-phai-thu/phan-tich-do-tuoi` — Nhóm theo tuổi nợ (hiện tại, 1-30, 31-60, 61-90, trên 90 ngày) |
| Mức độ rủi ro | THẤP, TRUNG BÌNH, CAO, NGHIÊM TRỌNG |
| Tự động khóa | Tự động khóa khách hàng khi nợ quá hạn trên 90 ngày |

#### 4.14 Công nợ phải trả
**Trang:** `/tai-chinh/cong-no-phai-tra`

#### 4.15 Phân bổ thanh toán
| Chức năng | Mô tả |
|---|---|
| Phân bổ cho hợp đồng | Gán thanh toán cho hợp đồng |
| Phân bổ cho đơn hàng | Gán thanh toán cho đơn hàng cụ thể |
| Mục đích | Đặt cọc, Quyết toán, Trả góp, Hoàn tiền, Điều chỉnh |
| Hủy phân bổ | Hủy phân bổ nếu sai |

#### 4.16 Hóa đơn
**Trang:** `/hoa-don`

| Chức năng | Mô tả |
|---|---|
| Tạo hóa đơn | GTGT, Điều chỉnh, Hủy |
| Thuế theo từng mặt hàng | Mỗi dòng hóa đơn chọn loại thuế riêng: Không chịu thuế, 0%, 8%, 10% |
| Gửi thuế | Liên kết MISA/Viettel e-invoice |
| Trạng thái | NHÁP → ĐÃ PHÁT HÀNH → ĐÃ GỬI THUẾ → (ĐIỀU CHỈNH / HỦY) |

#### 4.17 Tỷ giá
**Trang:** `/tai-chinh/ty-gia`

| Chức năng | Mô tả |
|---|---|
| Cập nhật tỷ giá | CNY/VND, USD/VND |
| Tỷ giá CNY thủ công | Chỉ Kế toán Trưởng được đặt tỷ giá CNY — vô hiệu hóa đồng bộ tự động cho Nhân dân tệ |
| Nhật ký kiểm toán | Ghi lại tất cả thay đổi tỷ giá: ai đặt, lúc nào, giá trị cũ/mới |
| Nguồn | Vietcombank (mặc định cho USD), thủ công (CNY) |
| Bộ nhớ đệm | Thời gian lưu 1 giờ |

#### 4.18 Bù trừ công nợ
**Trang:** `/tai-chinh/bu-tru-cong-no`

| Chức năng | Mô tả |
|---|---|
| Tạo bù trừ | Phải thu đối trừ phải trả cho cùng đối tác |
| Duyệt | Quy trình phê duyệt |
| Tối thiểu | 100 nghìn đồng |

#### 4.19 Sổ cái
**Trang:** `/so-cai`

| Chức năng | Mô tả |
|---|---|
| Hệ thống tài khoản | Hệ thống tài khoản (5 loại: Tài sản, Nợ phải trả, Vốn chủ sở hữu, Doanh thu, Chi phí) |
| Bút toán | Bút toán ghi Nợ/Có |
| Kỳ kế toán | Đóng kỳ theo tháng |

#### 4.20 Hoa hồng
**Trang:** `/hoa-hong`

| Chức năng | Mô tả |
|---|---|
| Tính hoa hồng | Tự động theo quy tắc (% lợi nhuận ròng) |
| Duyệt | Tự động nếu dưới 1 triệu đồng, cần duyệt nếu từ 1 triệu trở lên |
| Thu hồi | Thu hồi hoa hồng khi có khiếu nại hoàn tiền/ghi có — tự động trừ lương tháng sau |
| Tạm giữ | Tạm giữ hoa hồng do khiếu nại — hiện huy hiệu vàng kèm lý do |
| Chi trả | Tích hợp với bảng lương (tự động trừ khoản thu hồi) |

#### 4.21 Chi phí vận hành
**Trang:** `/chi-phi-van-hanh`

| Chức năng | Mô tả |
|---|---|
| Phân bổ chi phí | Chia chi phí container/vận chuyển cho từng đơn |
| Phân bổ bất đồng bộ | Khi nhập chi phí → đẩy vào hàng đợi xử lý nền (`finance-events`) → tự động chia theo chiến lược container (theo trọng lượng / thể tích / chia đều). Đảm bảo không trùng lặp nhờ mã tác vụ duy nhất, tự động thử lại khi thất bại |
| Loại chi phí | Cước vận chuyển, Thuế hải quan, Phí bốc xếp, Phí vận tải, Bảo hiểm |

#### 4.22 Ngân sách
**Trang:** `/ngan-sach`

#### 4.23 Tài sản
**Trang:** `/tai-san`

#### 4.24 Thu tiền hộ khi giao hàng
| Chức năng | Mô tả |
|---|---|
| Thu tiền hộ | Tài xế thu tiền khi giao hàng |
| Đối soát | So sánh thu được so với dự kiến |
| Cưỡng chế 24 giờ | Tác vụ tự động 8 giờ sáng: tài xế chưa nộp tiền thu hộ sau 24 giờ → tự động chặn nhận lệnh giao mới |
| Trạng thái | CHỜ → ĐÃ THU → ĐÃ NỘP → ĐÃ ĐỐI SOÁT / THIẾU |

#### 4.25a Tiền chờ phân bổ
**Trang:** `/tai-chinh/chua-phan-bo`

| Chức năng | Mô tả |
|---|---|
| Giao dịch chưa phân bổ | Danh sách tiền khách hàng nạp nhưng chưa gán vào đơn/hợp đồng cụ thể |
| Nhận vơ | Nhân viên kinh doanh tải lên bằng chứng chuyển khoản, chọn khách hàng + đơn hàng để liên kết |
| Duyệt nhận vơ | Kế toán duyệt/từ chối yêu cầu nhận vơ |
| Tài khoản trung gian | Tài khoản 331.99 "Tiền chờ phân bổ" trong hệ thống sổ cái |

### Nhóm D: Nhân sự & Hành chính

#### 4.25 Nhân sự
**Trang:** `/nhan-su`

| Chức năng | Mô tả |
|---|---|
| Hồ sơ nhân viên | `/nhan-su/[id]` — Thông tin cá nhân, phòng ban, lương |
| Tạo mới | `/nhan-su/tao-moi` |
| Trạng thái | Đang làm, Tạm nghỉ, Đã nghỉ |
| Mã hóa | Số tài khoản ngân hàng, mã số thuế, mã bảo hiểm được mã hóa |

#### 4.26 Chấm công
**Trang:** `/cham-cong`

| Chức năng | Mô tả |
|---|---|
| Vào/ra | Kèm định vị GPS |
| Chấm công thủ công | `/cham-cong/manual` — Chụp ảnh tự sướng, định vị tự động, nhập lý do |
| Duyệt chấm công | `/cham-cong/review` — Nhân sự xem ảnh + vị trí, duyệt/từ chối |
| Loại | Văn phòng, Từ xa, Ngoài hiện trường |
| Đi muộn | Tự động đánh dấu đi muộn |
| Tăng ca | Tính giờ tăng ca |

#### 4.27 Nghỉ phép
**Trang:** `/nghi-phep`

| Chức năng | Mô tả |
|---|---|
| Đơn nghỉ phép | Nghỉ phép năm, Nghỉ ốm, Nghỉ cá nhân, Nghỉ thai sản |
| Duyệt | Quy trình phê duyệt |
| Trạng thái | CHỜ DUYỆT → ĐÃ DUYỆT / TỪ CHỐI / ĐÃ HỦY |

#### 4.28 Lương
**Trang:** `/luong`

| Chức năng | Mô tả |
|---|---|
| Bảng lương | Tính theo tháng |
| Thuế thu nhập cá nhân | Giảm trừ bản thân 11 triệu, phụ thuộc 4,4 triệu |
| Bảo hiểm xã hội | 10,5% |
| Trạng thái | NHÁP → ĐÃ DUYỆT → ĐÃ CHI |

### Nhóm E: Hệ thống & Quản trị

#### 4.29 Phê duyệt
**Trang:** `/phe-duyet`

| Chức năng | Mô tả |
|---|---|
| Danh sách chờ | Hiển thị yêu cầu cần duyệt |
| Chi tiết | `/phe-duyet/[id]` — Xem dữ liệu, duyệt/từ chối/trả lại |
| Thiết kế luồng | `/cai-dat/quy-trinh-phe-duyet` — Trình thiết kế kéo-thả trực quan |

#### 4.30 Ủy quyền
**Trang:** `/uy-quyen`

| Chức năng | Mô tả |
|---|---|
| Tạo ủy quyền | Chọn người được ủy quyền, thời gian, loại phê duyệt |
| Tự động | Yêu cầu phê duyệt tự động chuyển hướng khi có ủy quyền đang hoạt động |

#### 4.31 Thông báo
**Trang:** `/thong-bao`

| Chức năng | Mô tả |
|---|---|
| Kênh | APP_PUSH, EMAIL, SMS, ZALO_ZNS |
| Ưu tiên | LOW, NORMAL, HIGH, CRITICAL |
| Thời gian thực | Đẩy qua WebSocket |

#### 4.32 Công việc
**Trang:** `/cong-viec`

| Chức năng | Mô tả |
|---|---|
| Tạo công việc | `/cong-viec/tao-moi` — Phân công cho nhân viên |
| Mức ưu tiên | Thấp, Trung bình, Cao, Khẩn cấp |
| Liên kết | Liên kết đến đơn hàng, khách hàng, phê duyệt |
| Bình luận | Chuỗi bình luận trên công việc |

#### 4.33 Tài liệu
**Trang:** `/tai-lieu`

| Chức năng | Mô tả |
|---|---|
| Tải lên | Hợp đồng, hóa đơn, ảnh, chứng từ |
| Phiên bản | Quản lý phiên bản tệp |
| Nhãn | Gắn nhãn phân loại |
| Liên kết | Gắn với đơn hàng, khách hàng, container, kiện hàng |

#### 4.34 Quản lý người dùng
**Trang:** `/quan-ly-user`

| Chức năng | Mô tả |
|---|---|
| Quản lý tài khoản | Tạo, sửa, khóa tài khoản |
| Gán vai trò | Chọn vai trò từ 22 vai trò |
| Đặt lại mật khẩu | Quản trị viên đặt lại mật khẩu cho người dùng |

#### 4.35 Cài đặt
**Trang:** `/cai-dat`

| Chức năng | Mô tả |
|---|---|
| Bảo mật | `/cai-dat/bao-mat` — 2FA, đổi mật khẩu |
| Quy trình phê duyệt | `/cai-dat/quy-trinh-phe-duyet` — Quản lý định nghĩa luồng phê duyệt |

### Nhóm F: Nhà cung cấp

#### 4.36 Nhà cung cấp
**Trang:** `/nha-cung-cap`

| Chức năng | Mô tả |
|---|---|
| Danh sách | Quản lý nhà cung cấp Trung Quốc |
| Đánh giá | Xếp hạng 1-5 sao theo Chất lượng, Giao hàng, Giá cả, Giao tiếp |
| Mua hàng | `/mua-hang` — Yêu cầu mua hàng → Đơn đặt hàng |

#### 4.37 Kho vật tư
**Trang:** `/kho-vat-tu`

| Chức năng | Mô tả |
|---|---|
| Hàng tồn kho | Quản lý vật tư, mức tối thiểu/tối đa |
| Phiếu xuất nhập | Nhập kho, Xuất kho, Điều chỉnh, Chuyển kho |

### Nhóm G: Quản lý nội dung website

#### 4.38 Trang nội dung
**Trang:** `/cms/pages`

| Chức năng | Mô tả |
|---|---|
| Tạo trang | `/cms/pages/tao-moi` — Trình soạn thảo văn bản |
| Đường dẫn thân thiện | Địa chỉ trang thân thiện với công cụ tìm kiếm |
| Quản lý menu | `/cms/menus` — Quản lý menu điều hướng |
| Quản lý tệp tin | `/cms/media` — Tải lên ảnh, tệp |
| Cài đặt chung | `/cms/settings` — Cài đặt chung website |

#### 4.39 Bài viết
| Chức năng | Mô tả |
|---|---|
| Bài viết | Quản lý bài viết, danh mục |
| Bình luận | Quản lý bình luận |

#### 4.40 Chức năng website khác
| Chức năng | Mô tả |
|---|---|
| Liên hệ | Biểu mẫu liên hệ từ website |
| Bản tin | Đăng ký nhận tin |
| FAQ | Câu hỏi thường gặp |

### Nhóm H: Báo cáo & Dashboard

#### 4.41 Tổng quan
**Trang:** `/tong-quan`

| Chức năng | Mô tả |
|---|---|
| Bảng tổng quan Ban GĐ | Doanh thu, đơn hàng, công nợ, container — cho Ban Giám đốc |
| Chỉ số hiệu suất | Doanh thu, đơn hàng, tuổi nợ phải thu, tỷ lệ lấp đầy container |
| Biểu đồ | Recharts — Biểu đồ đường, cột, tròn |

#### 4.42 Báo cáo
**Trang:** `/bao-cao/doanh-so`, `/bao-cao/tai-chinh`

| Chức năng | Mô tả |
|---|---|
| Doanh số | Báo cáo doanh số theo sale, khách hàng, dịch vụ |
| Tài chính | Báo cáo thu chi, công nợ, lợi nhuận |

### Nhóm I: Khiếu nại & Chất lượng

#### 4.43 Khiếu nại
**Trang:** `/khieu-nai`

| Chức năng | Mô tả |
|---|---|
| Tạo khiếu nại | `/khieu-nai/tao-moi` — Loại: Hư hỏng, Thiếu hàng, Chậm trễ, Chất lượng |
| Mức độ | Thấp, Trung bình, Cao, Nghiêm trọng |
| Xử lý | Phân công người xử lý, điều tra, giải quyết |
| Đền bù | Hoàn tiền, thay thế, ghi có, xin lỗi |
| Leo thang tự động | Tự động leo thang theo mức đền bù (>5 triệu → Giám đốc kinh doanh, >20 triệu → Ban giám đốc) |

**Máy trạng thái khiếu nại:** `MỞ` → `ĐANG ĐIỀU TRA` → `CHỜ GIẢI QUYẾT` → `ĐÃ GIẢI QUYẾT` → `ĐÓNG` — cưỡng chế bởi máy trạng thái, trạng thái kết thúc không thể mở lại.

#### 4.44 Kiểm tra chất lượng
**Trang:** `/kiem-tra-chat-luong`

| Chức năng | Mô tả |
|---|---|
| Tạo kiểm tra | Kiểm tra tại kho Trung Quốc |
| Chụp ảnh | Ảnh tổng quan, chi tiết, lỗi |
| Xếp hạng | 1-5 sao |
| Bắt buộc ảnh | **Bắt buộc** đính kèm ít nhất 1 ảnh khi nộp kết quả kiểm tra (tính tổng từ ảnh tổng quan, chi tiết, và lỗi) |
| Gửi khách hàng | Gửi ảnh cho khách xem trước khi vận chuyển |
| Trạng thái | CHỜ → ĐANG KIỂM → ĐẠT/KHÔNG ĐẠT → KHÁCH XEM → KHÁCH ĐỒNG Ý/TỪ CHỐI |

### Nhóm J: Tích hợp hệ thống

#### 4.45 Móc nối sự kiện
| Chức năng | Mô tả |
|---|---|
| Điểm cuối | Đăng ký địa chỉ nhận thông báo |
| Sự kiện | Tạo đơn, hoàn thành thanh toán, v.v. |
| Thử lại | Tối đa 5 lần, tăng dần thời gian chờ |
| Thư chết | Lưu trữ thông báo gửi thất bại |

#### 4.46 Khóa truy cập API
| Chức năng | Mô tả |
|---|---|
| Tạo khóa API | Tích hợp đối tác |
| Giới hạn tốc độ | Cấu hình theo từng khóa (mặc định 1000 lần/giờ) |
| Phân quyền | Phân quyền chi tiết theo từng điểm cuối |

#### 4.47 Cổng khách hàng
| Chức năng | Mô tả |
|---|---|
| Tra cứu đơn | Khách xem trạng thái đơn hàng |
| Ví điện tử | Nạp tiền, xem lịch sử |
| Nạp tiền | 100 nghìn → 100 triệu đồng mỗi giao dịch |

#### 4.48 Hỗ trợ khách hàng
**Trang:** `/ho-tro`

| Chức năng | Mô tả |
|---|---|
| Tạo phiếu hỗ trợ | `/ho-tro/tao-moi` — Loại: Hỏi đáp, Khiếu nại, Yêu cầu kỹ thuật |
| Chi tiết | `/ho-tro/[id]` — Xem lịch sử trao đổi, phản hồi |
| Ghi chú khách hàng | `/khach-hang/[id]/ho-tro` — Lịch sử tương tác với khách hàng |
| Mẫu phản hồi | Mẫu phản hồi nhanh cho các câu hỏi thường gặp |

#### 4.49 Khách hàng tiềm năng (Leads)
**Trang:** `/khach-hang/tiem-nang`

| Chức năng | Mô tả |
|---|---|
| Tạo khách tiềm năng | Nhập thông tin khách hàng tiềm năng |
| Theo dõi | Trạng thái: MỚI → LIÊN HỆ → ĐÀM PHÁN → CHUYỂN ĐỔI / KHÔNG QUAN TÂM |
| Ghi chú | Ghi chú từng lần tương tác |
| Chuyển đổi | Chuyển đổi thành khách hàng chính thức khi ký hợp đồng |

#### 4.50 Báo cáo nâng cao
**Trang:** `/bao-cao/*`

| Trang | Mô tả |
|---|---|
| `/bao-cao/lai-lo-don-hang` | Lãi lỗ theo từng đơn hàng — so sánh doanh thu vs chi phí |
| `/bao-cao/bien-loi-nhuan` | Biên lợi nhuận theo tháng/quý/năm |
| `/bao-cao/chenh-lech-ty-gia` | Chênh lệch tỷ giá — so sánh tỷ giá chốt đơn vs thanh toán |
| `/bao-cao/du-bao-dong-tien` | Dự báo dòng tiền 30/60/90 ngày |

#### 4.51 Bảng tổng quan chuyên biệt
**Trang:** `/tong-quan/*`

| Trang | Vai trò | Nội dung |
|---|---|---|
| `/tong-quan/kinh-doanh` | GĐ KD, Trưởng KD, Sale | Mục tiêu doanh thu, đơn mới, tỷ lệ chuyển đổi |
| `/tong-quan/cskh` | CSKH | Phiếu hỗ trợ, SLA, khiếu nại, phản hồi KH |

#### 4.52 Cài đặt nâng cao

| Trang | Mô tả |
|---|---|
| `/cai-dat/thong-bao` | Cấu hình quy tắc thông báo — kênh, mức ưu tiên, điều kiện gửi |
| `/cai-dat/leo-thang` | Cấu hình quy tắc leo thang tự động — thời gian, cấp trên |

#### 4.53 Đối soát hãng vận chuyển

| Chức năng | Mô tả |
|---|---|
| Tạo đợt đối soát | So khớp chi phí vận chuyển thực tế với hãng |
| So khớp tự động | Hệ thống tự động so khớp theo mã vận đơn |
| Xử lý chênh lệch | Đánh dấu thiếu/thừa, liên hệ hãng bổ sung |

#### 4.54 Đóng kỳ kế toán
**Trang:** `/tai-chinh/dong-ky`

| Chức năng | Mô tả |
|---|---|
| Đóng kỳ tháng | Khóa kỳ kế toán — không cho phép tạo bút toán/phiếu sau khi đóng |
| Mở lại kỳ | Chỉ CEO/CFO mới có quyền mở lại kỳ đã đóng |
| Bút toán tỷ giá | Tự động tạo bút toán chênh lệch tỷ giá cuối kỳ |

#### 4.55 Bảng giá dịch vụ hải quan
**Trang:** `/thong-quan/bang-gia`

| Chức năng | Mô tả |
|---|---|
| Bảng giá dịch vụ | Cấu hình giá dịch vụ thông quan theo loại hàng |
| Tra cứu mã HS | `/thong-quan/tra-cuu-hs` — Tra cứu mã HS Code theo từ khóa, gợi ý tự động |

#### 4.56 Tối ưu lộ trình giao hàng
**Trang:** `/giao-hang/toi-uu-lo-trinh`

| Chức năng | Mô tả |
|---|---|
| Tối ưu tuyến đường | Gom nhóm phiếu giao theo khu vực, tối ưu thứ tự giao |

---

## 5. QUY TRÌNH NGHIỆP VỤ CHÍNH

### 5.1 Vòng đời đơn hàng (13 giai đoạn)

```
Giai đoạn 1: TIẾP NHẬN
  │  Nhân viên kinh doanh tiếp nhận yêu cầu khách hàng, tạo đơn
  ▼
Giai đoạn 2: BÁO GIÁ
  │  Nhân viên kinh doanh tạo báo giá, gửi khách hàng duyệt
  ▼
Giai đoạn 3: CHỜ ĐẶT CỌC
  │  Khách hàng đặt cọc theo hạng (30-100%)
  │  Tự động hủy sau 3 ngày nếu không cọc
  ▼
Giai đoạn 4: MUA HÀNG — Chỉ dịch vụ mua hàng hộ
  │  Đại lý Trung Quốc đặt hàng nhà cung cấp, theo dõi đơn nhà cung cấp
  ▼
Giai đoạn 5: NHẬP KHO TRUNG QUỐC
  │  Nhận kiện, cân, đo, chụp ảnh, kiểm tra chất lượng
  ▼
Giai đoạn 6: ĐÓNG GÓI
  │  Đánh kiện, dán nhãn, chuẩn bị xuất
  ▼
Giai đoạn 7: GHÉP CONTAINER
  │  Ghép kiện vào container, tối ưu tỷ lệ lấp đầy
  ▼
Giai đoạn 8: VẬN CHUYỂN
  │  Container rời kho Trung Quốc → Việt Nam
  │  Tuyến: Đường biển / Đường bộ / Hàng không
  ▼
Giai đoạn 9: THÔNG QUAN
  │  Thông quan tại cửa khẩu/cảng
  │  Loại: Chính ngạch hoặc Tiểu ngạch
  ▼
Giai đoạn 10: NHẬP KHO VIỆT NAM
  │  Nhận hàng, phân loại, sắp xếp
  ▼
Giai đoạn 11: GIAO HÀNG
  │  Tạo phiếu giao, phân công tài xế, giao hàng
  ▼
Giai đoạn 12: QUYẾT TOÁN
  │  Tính tổng chi phí, tạo công nợ phải thu, thu số còn lại
  ▼
Giai đoạn 13: HOÀN THÀNH
     Đơn hoàn tất. Tính hoa hồng cho nhân viên kinh doanh.

Trạng thái đặc biệt:
  • ON_HOLD — Tạm giữ (chờ giải quyết vấn đề)
  • CANCELLED — Hủy đơn (cần phê duyệt)
  • RETURNED — Trả hàng
  • ISSUE — Có vấn đề cần xử lý
```

**Đơn hàng là gốc tổng hợp (Aggregate Root):** Khi truy vấn chi tiết đơn hàng, hệ thống trả về toàn bộ các quan hệ liên quan:
- Thông tin khách hàng, đơn tổng (nếu có), danh sách mặt hàng
- Lịch sử chuyển đổi trạng thái
- Danh sách kiện hàng (gói hàng)
- Phiếu thu/chi liên quan
- Khiếu nại, giao hàng, kiểm tra chất lượng
- Đơn mua từ nhà cung cấp, sự cố mua hàng hộ
- Phân bổ chi phí, phụ phí phát sinh

**Bồi hoàn an toàn:** Khi saga hoàn thành đơn hàng gặp lỗi, các bước bồi hoàn sử dụng **xóa mềm** (đánh dấu `HỦY BỎ`) thay vì xóa cứng — đảm bảo dữ liệu kiểm toán luôn toàn vẹn.

### 5.2 Quy trình mua hàng hộ

```
1. Nhân viên kinh doanh tạo đơn mua hàng hộ với mặt hàng (liên kết sản phẩm, số lượng, kích cỡ, màu)
2. Khách hàng đặt cọc → Trạng thái chuyển sang MUA HÀNG
3. Đại lý Trung Quốc tạo đơn nhà cung cấp cho mỗi mặt hàng/nhóm mặt hàng
   NHÁP → BÁO GIÁ → ĐÃ ĐẶT → XÁC NHẬN → ĐÃ GIAO TQ → ĐÃ NHẬN TQ
4. Kho Trung Quốc nhận hàng (quét barcode → đơn hàng tự động chuyển sang NHẬP KHO TQ) → Kiểm tra chất lượng → Gửi ảnh cho khách hàng
5. Khách hàng xem xét → ĐỒNG Ý / TỪ CHỐI
   - Từ chối → Sự cố mua hàng hộ → ĐANG TRẢ → ĐÃ HOÀN TIỀN
   - Đồng ý → tiếp tục quy trình bình thường
6. Đóng gói → Ghép container → Vận chuyển → Kho VN → Giao hàng
7. Quyết toán: Giá hàng + Phí dịch vụ (3-8%) + Vận chuyển nội địa TQ + Vận chuyển TQ→VN
```

### 5.3 Quy trình phê duyệt

```
1. Người dùng gửi yêu cầu (ví dụ: phiếu chi 100M)
2. Hệ thống tìm định nghĩa luồng phù hợp (loại kích hoạt = PHIẾU CHI)
3. Bộ xử lý đồ thị duyệt các nút:
   BẮT ĐẦU → ĐIỀU KIỆN (số tiền > 50 triệu?)
     → Có: NGƯỜI DUYỆT (Kế toán Trưởng) → NGƯỜI DUYỆT (GĐ Tài chính) → KẾT THÚC
     → Không: NGƯỜI DUYỆT (Kế toán Trưởng) → KẾT THÚC
4. Tạo bước phê duyệt cho mỗi nút người duyệt
5. Thông báo người duyệt (đẩy ứng dụng + thư điện tử)
6. Người duyệt: DUYỆT / TỪ CHỐI / TRẢ LẠI / ỦY QUYỀN
7. Nếu quá hạn → Tự động leo thang lên cấp trên
8. Kết quả: ĐÃ DUYỆT → Thực thi hành động / TỪ CHỐI → Thông báo người yêu cầu
```

### 5.4 Quy trình thanh toán

```
1. Kế toán tạo phiếu thu/chi
2. Nếu chi: Kiểm tra chống gian lận → Đạt → Gửi phê duyệt
3. Duyệt → Tạo giao dịch tiền mặt
4. Kế toán phân bổ thanh toán:
   - Nguồn: Phiếu thu chi / Ví điện tử / Ghi có
   - Đích: Hợp đồng hoặc Đơn hàng
   - Mục đích: Đặt cọc / Quyết toán / Trả góp / Hoàn tiền
5. Cập nhật: Số dư công nợ phải thu/trả, trạng thái cọc đơn hàng
6. Tạo bút toán kép (ghi Nợ/Có)
```

### 5.5 Quy trình giao hàng

```
1. Kho Việt Nam tạo phiếu giao hàng (chọn đơn hàng, địa chỉ)
2. Trưởng kho phân công → Chỉ định tài xế + Xe
3. Tài xế nhận lệnh (trạng thái: ĐÃ PHÂN CÔNG)
4. Tài xế lấy hàng (ĐÃ LẤY HÀNG)
5. Đang giao (ĐANG GIAO)
6. Giao thành công:
   - Tải lên bằng chứng giao hàng + chữ ký
   - Thu tiền hộ nếu có → Ghi nhận thu tiền
   - Trạng thái: ĐÃ GIAO
7. Giao thất bại:
   - Bắt buộc chọn lý do trả hàng
   - Trạng thái: THẤT BẠI → TRẢ VỀ KHO → ĐÃ NHẬN LẠI
   - Tính phí lưu kho: số_ngày × phí/ngày, cộng vào công nợ khách
8. Giao hàng từng phần:
   - Chọn một số kiện để giao trước (giao từng phần)
   - Đơn chỉ ĐÃ GIAO khi TẤT CẢ kiện đã giao
   - Tiến độ hoàn thành: CHƯA → MỘT PHẦN → TOÀN BỘ
```

---

## 6. HƯỚNG DẪN SỬ DỤNG THEO VAI TRÒ

### 6.1 Nhân viên Kinh doanh (SALE)

**Đăng nhập:** Vào giao diện nội bộ → Đăng nhập bằng email + mật khẩu

**Công việc hàng ngày:**
1. **Kiểm tra tổng quan** (`/tong-quan`) — Xem đơn hàng, chỉ số hiệu suất
2. **Quản lý khách hàng** (`/khach-hang`)
   - Tạo khách hàng mới khi có khách tiềm năng
   - Cập nhật thông tin liên hệ
3. **Tạo báo giá** (`/bao-gia/tao-moi`)
   - Chọn khách hàng, loại dịch vụ
   - Thêm mặt hàng (sản phẩm, số lượng, đơn giá)
   - Gửi để duyệt nếu có chiết khấu >3%
4. **Tạo đơn hàng** (`/don-hang/tao-moi`)
   - Từ báo giá đã duyệt hoặc tạo trực tiếp
   - Theo dõi trạng thái đơn
5. **Theo dõi đơn** (`/don-hang`)
   - Lọc theo trạng thái
   - Xem dòng thời gian chi tiết
6. **Xử lý khiếu nại** (`/khieu-nai`)
   - Tạo khiếu nại khi khách hàng phản ánh
7. **Kiểm tra phê duyệt** (`/phe-duyet`)
   - Xem trạng thái các yêu cầu đã gửi

### 6.2 Đại lý kho Trung Quốc

**Công việc hàng ngày:**
1. **Nhận kiện** (`/kho-trung-quoc`)
   - Quét mã vận đơn Trung Quốc
   - Nhập trọng lượng, kích thước
   - Chụp ảnh kiện hàng
2. **QC kiểm tra** (`/kiem-tra-chat-luong`)
   - Kiểm tra số lượng, chất lượng
   - Chụp ảnh chi tiết, ảnh lỗi (nếu có)
   - Gửi cho khách xem xét
3. **Đóng gói**
   - Đánh kiện, dán nhãn
   - Gán kiện vào container

### 6.3 Kế toán

**Công việc hàng ngày:**
1. **Phiếu thu/chi** (`/tai-chinh/phieu-thu-chi`)
   - Tạo phiếu, tải lên chứng từ
   - Gửi duyệt
2. **Công nợ phải thu** (`/tai-chinh/cong-no-phai-thu`)
   - Theo dõi tuổi nợ phải thu
   - Nhắc nợ khách quá hạn
3. **Phân bổ thanh toán**
   - Gán tiền thu vào hợp đồng/đơn hàng
4. **Tỷ giá** (`/tai-chinh/ty-gia`)
   - Cập nhật tỷ giá CNY/VND hàng ngày (Kế toán Trưởng đặt thủ công cho CNY)
   - Xem nhật ký kiểm toán tỷ giá
5. **Hóa đơn** (`/hoa-don`)
   - Xuất hóa đơn GTGT
   - Gửi hóa đơn điện tử lên cơ quan thuế

**Cuối tháng:**
1. Đóng kỳ kế toán (`/so-cai`)
2. Tính lương (`/luong`)
3. Đối soát tiền thu hộ
4. Bù trừ công nợ nếu có

### 6.4 Tài xế

**Công việc hàng ngày:**
1. **Xem phiếu giao** (`/giao-hang`) — Danh sách được phân công cho mình
2. **Lấy hàng** — Nhận hàng từ kho
3. **Giao hàng** — Đến địa chỉ khách hàng
4. **Xác nhận** — Tải lên ảnh bằng chứng giao hàng, chữ ký khách hàng
5. **Thu tiền hộ** — Nếu đơn có thu tiền hộ, thu tiền và ghi nhận

### 6.5 Ban Giám Đốc

**Công việc:**
1. **Tổng quan** (`/tong-quan`) — Xem toàn bộ chỉ số hiệu suất
2. **Phê duyệt** (`/phe-duyet`) — Duyệt các yêu cầu leo thang
3. **Báo cáo** (`/bao-cao/doanh-so`, `/bao-cao/tai-chinh`)
4. **Cài đặt** — Quản lý người dùng, quy trình phê duyệt

---

## 7. CẤU HÌNH HỆ THỐNG

### 7.1 Quy tắc nghiệp vụ (có thể cấu hình)

Tất cả quy tắc nghiệp vụ được cấu hình qua biến môi trường:

#### Đặt cọc và hạng khách hàng
| Biến | Mặc định | Mô tả |
|---|---|---|
| `DEPOSIT_RATE_NEW` | 1.0 (100%) | Tỷ lệ cọc khách mới |
| `DEPOSIT_RATE_REGULAR` | 0.7 (70%) | Tỷ lệ cọc khách thường |
| `DEPOSIT_RATE_VIP` | 0.5 (50%) | Tỷ lệ cọc khách VIP |
| `DEPOSIT_RATE_STRATEGIC` | 0.3 (30%) | Tỷ lệ cọc đối tác chiến lược |
| `DEPOSIT_AUTO_CANCEL_DAYS` | 3 | Tự động hủy đơn nếu không cọc |
| `TIER_REGULAR_MIN_ORDERS` | 10 | Số đơn tối thiểu lên REGULAR |
| `TIER_VIP_MIN_ORDERS` | 20 | Số đơn tối thiểu lên VIP |

#### Phê duyệt và tài chính
| Biến | Mặc định | Mô tả |
|---|---|---|
| `APPROVAL_ESCALATE_HOURS` | 24 | Giờ trước khi tự động leo thang |
| `DISCOUNT_LEVEL2` | 0.03 (3%) | Ngưỡng giảm giá cần Trưởng nhóm duyệt |
| `DISCOUNT_LEVEL3` | 0.05 (5%) | Ngưỡng giảm giá cần Giám đốc kinh doanh duyệt |
| `HIGH_VALUE_ORDER` | 100,000,000 | Đơn giá trị cao (VND) — thêm bước duyệt |
| `MAX_VOUCHER_AMOUNT` | 500,000,000 | Phiếu chi tối đa (VND) |
| `AR_DUE_DATE_DAYS` | 30 | Ngày đến hạn mặc định công nợ phải thu |

#### Hoa hồng và thu tiền hộ
| Biến | Mặc định | Mô tả |
|---|---|---|
| `DEFAULT_COMMISSION_RATE` | 0.03 (3%) | Tỷ lệ hoa hồng mặc định |
| `COMMISSION_AUTO_APPROVE` | 1,000,000 | Tự động duyệt nếu <1M VND |
| `COD_SHORTAGE_TOLERANCE` | 0.01 (1%) | Dung sai thiếu tiền thu hộ |

#### Cưỡng chế thu tiền hộ và tỷ giá
| Biến | Mặc định | Mô tả |
|---|---|---|
| `COD_ENFORCEMENT_HOURS` | 24 | Giờ trước khi chặn tài xế chưa nộp tiền thu hộ |
| `WEIGHT_VARIANCE_THRESHOLD_PERCENT` | 5 | % chênh lệch cân nặng TQ/VN để cảnh báo |
| `RTO_DAILY_STORAGE_RATE` | 10,000 | Phí lưu kho hàng hoàn trả (VND/ngày) |
| `EXCHANGE_RATE_DEFAULT_MODE` | FLOATING | Chế độ tỷ giá mặc định (FIXED/FLOATING) |
| `OVERDRAFT_DEFAULT_EXPIRY_HOURS` | 24 | Giờ hết hạn thấu chi tạm thời |

#### Khiếu nại
| Biến | Mặc định | Mô tả |
|---|---|---|
| `COMPENSATION_GD_KD_THRESHOLD` | 5,000,000 | Đền bù cần Giám đốc kinh doanh duyệt |
| `COMPENSATION_BGD_THRESHOLD` | 20,000,000 | Đền bù cần Ban giám đốc duyệt |

#### Lương
| Biến | Mặc định | Mô tả |
|---|---|---|
| `PERSONAL_DEDUCTION` | 11,000,000 | Giảm trừ bản thân (VND) |
| `DEPENDENT_DEDUCTION` | 4,400,000 | Giảm trừ phụ thuộc (VND) |
| `INSURANCE_RATE` | 0.105 (10.5%) | Tỷ lệ BHXH |

### 7.2 Cấu hình thương hiệu

Hệ thống hỗ trợ thương hiệu trắng — thay đổi thương hiệu qua biến môi trường:

| Biến | Mô tả |
|---|---|
| `COMPANY_NAME` | Tên công ty ngắn |
| `COMPANY_FULL_NAME` | Tên đầy đủ |
| `COMPANY_DOMAIN` | Tên miền chính |
| `CUSTOMER_CODE_PREFIX` | Tiền tố mã khách hàng (vd: ERP-KH-) |
| `SUPPORT_EMAIL` | Email hỗ trợ |
| `APP_TITLE` | Tiêu đề ứng dụng |
| `NEXT_PUBLIC_COMPANY_NAME` | Tên hiển thị giao diện |
| `NEXT_PUBLIC_AUTH_COOKIE` | Tên cookie xác thực |

### 7.3 Chỉ tiêu cam kết dịch vụ (cố định)

| Chỉ tiêu | Mục tiêu |
|---|---|
| Phản hồi chăm sóc khách hàng | 15 phút |
| Kinh doanh liên hệ khách hàng | 2 giờ |
| Gửi báo giá | 4 giờ |
| Phản hồi phê duyệt | 2 giờ |
| Kho nhận hàng | 24 giờ |
| Giao hàng | 3 ngày |

---

## 8. TRIỂN KHAI & VẬN HÀNH

### 8.1 Yêu cầu hệ thống

| Quy mô | CPU | RAM | SSD | Bandwidth |
|---|---|---|---|---|
| Nhỏ (<50 users) | 2 vCPU | 4 GB | 50 GB | 100 Mbps |
| Vừa (50-200 users) | 4 vCPU | 8 GB | 100 GB | 200 Mbps |
| Lớn (200+ users) | 8+ vCPU | 16+ GB | 200+ GB | 500 Mbps |

**OS khuyến nghị:** Ubuntu 22.04 LTS hoặc 24.04 LTS

### 8.2 Phương thức triển khai

#### Phương thức 1: Tự cài đặt (sản phẩm)
```bash
git clone <repo-url>
cd ERPv1
chmod +x scripts/setup.sh
./scripts/setup.sh
```
→ Chi tiết: `docs/SELF_HOSTED.md`

#### Phương thức 2: Dùng thử
```bash
docker compose -f docker-compose.selfhost.yml -f docker-compose.demo.yml up -d
```
→ Chi tiết: `docs/DEMO.md`

### 8.3 Sao lưu

- **Cơ sở dữ liệu**: `pg_dump --format=custom` hàng ngày, lưu trữ nhật ký ghi cho khôi phục theo thời điểm
- **Sao lưu từ xa**: Tự động tải lên S3/R2 (Cloudflare) hàng đêm lúc 2h sáng
- **Tệp tin/Phương tiện**: đồng bộ tới máy chủ sao lưu
- **Chính sách lưu giữ**: 30 ngày sao lưu hàng ngày, 12 tháng sao lưu hàng tháng
- **Xác minh**: Tập lệnh tự động kiểm tra tính toàn vẹn sao lưu (pg_restore --list)
- Script: `scripts/backup.sh`, biến: `S3_ENDPOINT`, `BACKUP_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

### 8.4 Giám sát

| Công cụ | Mục đích |
|---|---|
| Sentry | Theo dõi lỗi và cảnh báo |
| Điểm kiểm tra sức khỏe | `/health` — Kiểm tra CSDL, Redis, Bộ nhớ |
| Bộ đo lường | Thời gian xử lý yêu cầu, thông lượng |
| Nhật ký kiểm toán | Tất cả thao tác người dùng |

### 8.5 Cập nhật

```bash
chmod +x scripts/update.sh
./scripts/update.sh
```
Quy trình: Kéo mã nguồn → Dựng ảnh → Di chuyển cơ sở dữ liệu → Khởi động lại dịch vụ → Kiểm tra sức khỏe

---

## 9. CHUYỂN GIAO HỆ THỐNG

### 9.1 Danh mục kiểm tra chuyển giao

#### Hạ tầng
- [ ] Máy chủ đã cài đặt đúng cấu hình
- [ ] Tên miền DNS đã trỏ đúng (3 tên miền: nội bộ, website, giao diện lập trình)
- [ ] Chứng chỉ bảo mật đang hoạt động
- [ ] Tập lệnh sao lưu đã cấu hình lịch tự động
- [ ] Giám sát và cảnh báo đã cài đặt

#### Dữ liệu
- [ ] Cơ sở dữ liệu đã di chuyển lược đồ mới nhất
- [ ] Dữ liệu mẫu đã chạy (vai trò, quyền hạn)
- [ ] Tài khoản quản trị viên đã tạo
- [ ] Tỷ giá đã cập nhật
- [ ] Định nghĩa luồng phê duyệt đã cấu hình

#### Cấu hình
- [ ] `.env` đã điền đầy đủ và chính xác
- [ ] Cấu hình thương hiệu đúng (tên công ty, tên miền, logo)
- [ ] Quy tắc nghiệp vụ phù hợp (tỷ lệ cọc, hoa hồng, cam kết dịch vụ)
- [ ] Email/SMS provider đã cấu hình
- [ ] Điểm nhận thông báo đã đăng ký (nếu cần)

### 9.2 Tài khoản ban đầu

Sau khi cài đặt, hệ thống tạo sẵn tài khoản quản trị viên:
- **Thư điện tử**: Theo biến `SEED_EMAIL_DOMAIN`
- **Mật khẩu**: Thay đổi ngay sau lần đầu đăng nhập
- **Bật 2FA** cho tất cả tài khoản admin

### 9.3 Các bước cấu hình ban đầu

1. **Tạo tài khoản nhân viên** — `/quan-ly-user` — Tạo tài khoản cho mỗi nhân viên, gán vai trò
2. **Nhập hồ sơ nhân sự** — `/nhan-su/tao-moi` — Liên kết tài khoản → hồ sơ nhân viên
3. **Cấu hình quy trình phê duyệt** — `/cai-dat/quy-trinh-phe-duyet` — Tạo luồng phê duyệt cho từng loại
4. **Cấu hình phí dịch vụ MHH** — Nếu dùng dịch vụ MHH
5. **Nhập khách hàng** — `/khach-hang/tao-moi` hoặc nhập hàng loạt
6. **Nhập nhà cung cấp** — `/nha-cung-cap`
7. **Cập nhật tỷ giá** — `/tai-chinh/ty-gia`
8. **Cấu hình CMS** — `/cms/pages`, `/cms/menus`, `/cms/settings`

### 9.4 Đào tạo

| Nhóm | Nội dung | Thời lượng |
|---|---|---|
| Ban GĐ | Tổng quan, báo cáo, phê duyệt | 1 buổi (2h) |
| Kinh doanh | Khách hàng, báo giá, đơn hàng, khiếu nại | 2 buổi (4h) |
| Kế toán | Thu chi, công nợ, sổ cái, lương | 2 buổi (4h) |
| Kho TQ | Nhận hàng, QC, đóng gói | 1 buổi (2h) |
| Kho VN | Nhận hàng, xuất kho, giao hàng | 1 buổi (2h) |
| Quản trị hệ thống | Máy chủ, sao lưu, cập nhật, xử lý sự cố | 2 buổi (4h) |

### 9.5 Tài liệu đi kèm

| File | Mô tả |
|---|---|
| `docs/SYSTEM_DOCUMENTATION.md` | Tài liệu này |
| `docs/SELF_HOSTED.md` | Hướng dẫn cài đặt self-hosted |
| `docs/DEMO.md` | Hướng dẫn demo |
| `.env.example` (backend) | Mẫu biến môi trường máy chủ |
| `.env.example` (frontend) | Mẫu biến môi trường giao diện |
| `.env.demo` | Cấu hình sẵn cho dùng thử |

### 9.6 Hỗ trợ kỹ thuật

**Khi gặp lỗi:**
1. Kiểm tra nhật ký: `docker compose logs -f backend`
2. Kiểm tra sức khỏe: `curl https://api.domain.com/health`
3. Kiểm tra cơ sở dữ liệu: `docker compose exec postgres psql -U erp -d erp_db`
4. Khởi động lại dịch vụ: `docker compose restart backend`

**Quy trình sửa lỗi nhanh:**
1. Sửa mã nguồn trên nhánh riêng
2. Kiểm thử cục bộ
3. Gộp vào nhánh chính
4. Chạy `scripts/update.sh` trên server

---

## 10. HỆ THỐNG TÍCH HỢP & XỬ LÝ NỀN

### 10.1 Kiến trúc sự kiện

Hệ thống sử dụng kiến trúc hướng sự kiện (Event-Driven Architecture) với 116 bộ lắng nghe sự kiện phân bố trên toàn bộ module. Các sự kiện chính:

| Nhóm sự kiện | Ví dụ | Hành động |
|---|---|---|
| Đơn hàng | `order.completed`, `order.cancelled` | Tạo công nợ, tính hoa hồng, cập nhật KPI |
| Thanh toán | `payment.received`, `payment.allocated` | Cập nhật công nợ, kiểm tra cọc, mở khóa đơn |
| Kho | `package.received`, `package.shipped` | Cập nhật trạng thái đơn, thông báo KH |
| Container | `container.arrived`, `container.customs` | Cập nhật kiện, thông quan, thông báo |
| Giao hàng | `delivery.failed`, `delivery.rto.received` | Thông báo Sale/CSKH, tính phí lưu kho |
| Phê duyệt | `approval.completed`, `approval.rejected` | Thực thi hành động, thông báo người yêu cầu |
| Tài chính | `cost.allocated`, `ar.overdue` | Phân bổ chi phí, cảnh báo nợ |

### 10.2 Outbox Pattern (Đảm bảo gửi sự kiện)

Hệ thống sử dụng mẫu Outbox để đảm bảo sự kiện không bị mất khi xử lý giao dịch:
- Sự kiện được ghi vào bảng `OutboxEvent` trong cùng giao dịch CSDL
- Dịch vụ nền quét bảng Outbox định kỳ (mỗi 10 giây) và phát sự kiện
- Tự động thử lại tối đa 5 lần với khoảng cách tăng dần
- Sự kiện thất bại sau 5 lần → chuyển sang hàng đợi thư chết (Dead Letter Queue)

### 10.3 Hàng đợi tác vụ nền (BullMQ)

| Hàng đợi | Mục đích | Timeout |
|---|---|---|
| `finance-events` | Phân bổ chi phí, tạo bút toán | 60 giây |
| `notification-events` | Gửi thông báo đa kênh | 30 giây |
| `warehouse-events` | Cập nhật trạng thái kho | 30 giây |
| `order-events` | Saga hoàn thành đơn | 120 giây |

**Giám sát hàng đợi:**
- BullBoard UI có xác thực (chỉ CEO, COO, DIRECTOR_OPERATIONS)
- Tự động cảnh báo khi hàng đợi có >100 tác vụ chờ
- Dead Letter Queue với giao diện replay

### 10.4 Tác vụ định kỳ (31 Cron Jobs)

| Thời gian | Tác vụ | Module |
|---|---|---|
| Hàng đêm @midnight | Tính phí lưu kho RTO | warehouse-vn |
| Hàng đêm @midnight | Chụp ảnh tuổi nợ phải thu | accounts-receivable |
| 8:00 sáng hàng ngày | Cưỡng chế COD 24h (chặn tài xế) | cod |
| 9:00 sáng ngày thường | Nhắc nhở RTO tồn kho (7/14/30 ngày) | notification |
| Mỗi 5 phút | Quét Outbox gửi sự kiện | events/outbox |
| Mỗi 10 phút | Giám sát Dead Letter Queue | events/dlq-monitor |
| Mỗi giờ | Đồng bộ tỷ giá (USD) | exchange-rate |
| Mỗi giờ | Làm nóng bộ nhớ đệm | cache |
| Mỗi ngày | Kiểm tra chứng chỉ đào tạo sắp hết hạn | employee |
| Mỗi ngày | Kiểm tra báo giá hết hạn | quotation |
| Mỗi ngày | Tự động đóng kênh hải quan quá hạn | customs-declaration |
| Cuối tháng | Leo thang phê duyệt quá hạn | approval |

### 10.5 Đối soát & Reconciliation

| Loại đối soát | Mô tả |
|---|---|
| Đối soát hãng vận chuyển | So khớp chi phí vận chuyển thực tế vs hóa đơn hãng |
| Đối soát ngân hàng | So khớp giao dịch ngân hàng với phiếu thu/chi |
| Đối soát tỷ giá | Tính chênh lệch tỷ giá giữa thời điểm chốt đơn và thanh toán |

### 10.6 Circuit Breaker & Retry

- Các lời gọi API bên ngoài (ngân hàng, hải quan, SMS) có Circuit Breaker
- Trạng thái: CLOSED → OPEN (sau 5 lỗi liên tiếp) → HALF_OPEN (thử lại sau 30 giây)
- Webhook retry: tối đa 5 lần, tăng dần (1s, 4s, 16s, 64s, 256s)
- Timeout cấu hình theo từng API: `integration-timeout.config.ts`

---

## PHỤ LỤC

### A. Danh sách kiểu liệt kê đầy đủ

<details>
<summary>Nhấn để xem tất cả kiểu liệt kê</summary>

| Kiểu liệt kê | Các giá trị |
|---|---|
| ServiceType | VCT, MHH, UTXNK, LCLCN |
| OrderStatus | CONSULTING, QUOTATION, PENDING_DEPOSIT, SOURCING, WAREHOUSE_CN, PACKING, CONSOLIDATION, IN_TRANSIT, CUSTOMS, WAREHOUSE_VN, DELIVERING, SETTLEMENT, COMPLETED, ON_HOLD, CANCELLED, RETURNED, ISSUE |
| CustomerTier | NEW, REGULAR, VIP, STRATEGIC |
| PaymentMethod | WALLET, BANK_TRANSFER, CASH, COD, CREDIT |
| Currency | VND, CNY, USD |
| ApprovalStatus | PENDING, APPROVED, REJECTED, CANCELLED, RETURNED, WITHDRAWN |
| ApprovalType | DISCOUNT, PAYMENT_VOUCHER, RECEIPT_VOUCHER, ORDER_CANCEL, CREDIT_EXTENSION, DEPOSIT_EXEMPTION, CONTAINER_PLAN, WAREHOUSE_RELEASE, LEAVE_REQUEST, OVERTIME_REQUEST, PURCHASE_ORDER, QUOTATION_SPECIAL, EXPENSE_CLAIM, SALARY_ADJUSTMENT, GRACE_PERIOD_REQUEST, EXTRA_CHARGE_APPROVAL, CREDIT_OVERDRAFT, CUSTOM |
| ApprovalMode | SEQUENTIAL, PARALLEL_AND, PARALLEL_OR |
| ShippingRoute | SEA, ROAD, AIR |
| Branch | HN, HCM |
| ContainerStatus | PLANNING, LOADING, IN_TRANSIT, ON_HOLD_BORDER, ARRIVED, CUSTOMS, COMPLETED |
| DeliveryStatus | PENDING, DISPATCHED, PICKED_UP, DELIVERING, DELIVERED, FAILED, RETURN_TO_ORIGIN, RTO_RECEIVED |
| SupplierOrderStatus | DRAFT, QUOTED, ORDERED, CONFIRMED, PARTIALLY_SHIPPED, SHIPPED_CN, RECEIVED_CN, RETURN_IN_PROGRESS, REFUNDED, CANCELLED, ISSUE |
| QCStatus | PENDING, INSPECTING, PASSED, FAILED, PARTIAL, CUSTOMER_REVIEW, CUSTOMER_APPROVED, CUSTOMER_REJECTED |
| ComplaintType | DAMAGE, MISSING, DELAY, QUALITY, OTHER |
| ComplaintSeverity | LOW, MEDIUM, HIGH, CRITICAL |
| MHHIssueType | OUT_OF_STOCK, WRONG_ITEM, DAMAGED, INCOMPLETE, QUALITY, PRICE_CHANGE, DELAY, OTHER |
| ContractStatus | DRAFT, PENDING_SIGNATURE, SIGNED, ACTIVE, SETTLED, COMPLETED, CANCELLED, SUSPENDED |
| InvoiceStatus | DRAFT, ISSUED, SENT_TAX, CANCELLED, ADJUSTED |
| UserRole | CEO, COO, CFO, DIRECTOR_OPERATIONS, SALES_DIRECTOR, SALES_LEADER, SALE, MARKETING_STAFF, CSKH, CHIEF_ACCOUNTANT, ACCOUNTANT, ACCOUNTANT_AR, ACCOUNTANT_COST, HR_MANAGER, LOGISTICS_MANAGER, XNK_MANAGER, XNK_STAFF, WAREHOUSE_MANAGER, WAREHOUSE_CN_AGENT, WAREHOUSE_VN_MANAGER, WAREHOUSE_VN_STAFF, DRIVER |
| TaxType | NO_TAX, ZERO_PERCENT, EIGHT_PERCENT, TEN_PERCENT |
| CommissionStatus | PENDING, APPROVED, ON_HOLD, PAID, REJECTED, CANCELLED |
| AccountStatus | OPEN, PARTIAL, PAID, OVERDUE, WRITTEN_OFF, CANCELLED |
| FulfillmentStatus | NONE, PARTIAL, FULL |
| PackageIndependentStatus | NORMAL, CONFISCATED_BY_CUSTOMS, HIGH_RISK_HOLD |
| PreAlertStatus | PENDING, MATCHED, EXPIRED |
| ReturnRequestStatus | PENDING, APPROVED, REJECTED, COMPLETED, CANCELLED |
| CustomsDeclarationStatus | DRAFT, SUBMITTED, REVIEWING, APPROVED, REJECTED, CLEARED, HELD |
| CustomsChannel | GREEN, YELLOW, RED |
| OutboxStatus | PENDING, SENT, FAILED |
| ReconRunStatus | PENDING, PROCESSING, COMPLETED, FAILED |
| BatchJobStatus | PENDING, PROCESSING, COMPLETED, FAILED |
| CostAdjustmentStatus | PENDING, APPROVED, REJECTED |
| CarrierReconStatus | DRAFT, PROCESSING, COMPLETED, DISPUTED |

</details>

### B. Quy tắc mã định danh

| Thực thể | Quy tắc | Ví dụ |
|---|---|---|
| Đơn hàng | `{PREFIX}-ORD-YYMMDD-XXXX` | ERP-ORD-260101-0001 |
| Đơn tổng | `#NV{code}.{DDMMYY}.XXXX` | #NV001.070226.0001 |
| Khách hàng | `{PREFIX}-KH-XXXXXX` | ERP-KH-000001 |
| Báo giá | `QUO-YYYYMM-XXXX` | QUO-202601-0001 |
| Hợp đồng | `HĐ-NV{code}-YYYY-XXX` | HĐ-NV001-2026-001 |
| Container | `{PREFIX}-CNT-YYMMDD-XX` | ERP-CNT-260101-01 |
| Phiếu chi/thu | Mã tự động tăng | |
| Khiếu nại | `QMS-YYYYMM-XXXX` | QMS-202601-0001 |
| Đơn nhà cung cấp | `SO-YYYYMM-XXXX` | SO-202601-0001 |
| Kiểm tra chất lượng | `QC-YYYYMM-XXXX` | QC-202601-0001 |
| Sự cố mua hàng hộ | `MHH-ISS-YYYYMM-XXXX` | MHH-ISS-202601-0001 |

### C. Sơ đồ quan hệ chính

```
Customer ──┬── Order ──┬── OrderItem ──── SupplierOrder
           │           ├── OrderExtraCharge
           │           ├── OrderStatusHistory
           │           ├── Package ────── TrackingEvent
           │           ├── Delivery ──┬── DeliveryPackage
           │           │              └── CODRecord
           │           ├── PaymentVoucher
           │           ├── AccountReceivable ── ARAgingSnapshot
           │           ├── Complaint
           │           ├── QCInspection
           │           ├── MHHIssue
           │           ├── ReturnRequest
           │           └── CostAllocation
           │
           ├── Contract ── PaymentAllocation ── PaymentAllocationDetail
           ├── Quotation ── QuotationItem
           ├── Wallet ──── WalletTransaction ── BankWebhookTransaction
           ├── Contact
           ├── CustomerInteractionNote
           ├── Lead ──── LeadNote
           └── SupportTicket ── TicketResponse

User ──┬── Session
       ├── AuditLog ──── AuditLogArchive
       ├── Employee ──┬── Attendance
       │              ├── LeaveRequest
       │              ├── PayrollRecord
       │              ├── OvertimeRequest
       │              ├── TrainingRecord
       │              └── PerformanceNote
       ├── Task ──── TaskComment
       ├── Notification
       └── Document

Container ──┬── Package ── PackageConsolidation
            ├── Order
            ├── TrackingEvent
            └── OperationCost ── CostAdjustment

ApprovalFlowDefinition ──┬── ApprovalFlowNode
                         ├── ApprovalFlowEdge
                         └── Approval ──┬── ApprovalStep
                                        ├── ApprovalComment
                                        ├── ApprovalCC
                                        ├── ApprovalActionLog
                                        └── ApprovalDelegation

OutboxEvent ── DeadLetterEvent
ReconciliationRun ── ReconciliationItem
CarrierReconciliation ── CarrierReconItem
BatchJob
SyncLog
```

### D. Website công khai

Cả ERP Frontend và CMS Frontend đều có hệ thống trang công khai cho khách hàng:

| URL | Trang | Mô tả |
|---|---|---|
| `/` | Trang chủ | Phần giới thiệu nổi bật, huy hiệu uy tín, đánh giá khách hàng, đối tác |
| `/dich-vu` | Dịch vụ | Tổng quan 4 loại dịch vụ |
| `/dich-vu/mua-hang-ho` | Mua hàng hộ | Chi tiết dịch vụ MHH |
| `/dich-vu/van-chuyen-hang-hoa` | Vận chuyển | Chi tiết dịch vụ VCT |
| `/dich-vu/uy-thac-xuat-nhap-khau` | Ủy thác XNK | Chi tiết dịch vụ UTXNK |
| `/dich-vu/lcl-chinh-ngach` | LCL chính ngạch | Chi tiết dịch vụ LCLCN |
| `/gioi-thieu` | Giới thiệu | Giới thiệu công ty |
| `/chuyen-gia` | Chuyên gia | Đội ngũ chuyên gia |
| `/tin-tuc` | Tin tức | Danh sách bài viết/tin tức |
| `/tra-cuu` | Tra cứu | Tra cứu vận đơn cho khách hàng |
| `/tinh-phi` | Tính phí | Máy tính phí vận chuyển |
| `/so-sanh` | So sánh | So sánh dịch vụ |
| `/hoi-dap` | Hỏi đáp | FAQ |
| `/lien-he` | Liên hệ | Form liên hệ |
| `/dang-ky` | Đăng ký | Đăng ký tài khoản khách hàng |
| `/chinh-sach-bao-mat` | Chính sách bảo mật | Chính sách bảo mật thông tin |
| `/dieu-khoan-su-dung` | Điều khoản | Điều khoản sử dụng dịch vụ |
| `/[slug]` | Trang CMS | Trang nội dung động do quản trị viên tạo |

### E. Ma trận phân quyền đường dẫn (Vai trò → Quyền truy cập)

<details>
<summary>Nhấn để xem bảng phân quyền chi tiết</summary>

| Đường dẫn | TGĐ/PGĐ | GĐ KD | Trưởng KD | NV KD | CSKH | KTT | KT CNo | KT CP | GĐ XNK | NV XNK | Kho TQ | GĐ Kho VN | NV Kho VN | Tài xế | GĐ NS | Vận tải | Marketing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| /tong-quan | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| /don-hang | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | — |
| /bao-gia | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — | — | — | — |
| /hop-dong | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — | — | — | — |
| /khach-hang | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — | — | ✅ |
| /khieu-nai | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — | — | — |
| /kho-trung-quoc | ✅ | — | — | — | — | — | — | — | ✅ | ✅ | ✅ | — | — | — | — | — | — |
| /kho-viet-nam | ✅ | — | — | — | — | — | — | — | ✅ | ✅ | — | ✅ | ✅ | — | — | — | — |
| /container | ✅ | — | — | — | — | — | — | — | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| /giao-hang | ✅ | — | — | — | — | — | — | — | — | — | — | ✅ | ✅ | ✅ | — | ✅ | — |
| /tai-chinh/* | ✅ | — | — | — | — | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| /so-cai | ✅ | — | — | — | — | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |
| /luong | ✅ | — | — | — | — | ✅ | — | — | — | — | — | — | — | — | ✅ | — | — |
| /hoa-hong | ✅ | ✅ | — | — | — | ✅ | — | — | — | — | — | — | — | — | — | — | — |
| /nhan-su | ✅ | — | — | — | — | — | — | — | — | — | — | — | — | — | ✅ | — | — |
| /phe-duyet | ✅ | ✅ | ✅ | — | — | ✅ | — | — | ✅ | — | — | ✅ | — | — | ✅ | ✅ | — |
| /uy-quyen | ✅ | ✅ | ✅ | — | — | ✅ | — | — | ✅ | — | — | ✅ | — | — | ✅ | ✅ | — |
| /bao-cao | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | — | — | — | — | — | — | — | ✅ |
| /cong-viec | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| /cham-cong | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| /thong-bao | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

</details>

### F. Cấu trúc menu thanh bên (Nhóm điều hướng)

```
1. 📊 Tổng quan
   └── /tong-quan

2. 💼 Kinh doanh
   ├── /don-hang          (Đơn hàng)
   ├── /bao-gia           (Báo giá)
   ├── /hop-dong          (Hợp đồng)
   ├── /khach-hang        (Khách hàng)
   └── /khach-hang/tiem-nang (Khách tiềm năng)

3. 🏭 Kho vận
   ├── /kho-trung-quoc    (Kho Trung Quốc)
   ├── /kho-viet-nam      (Kho Việt Nam)
   ├── /container         (Container)
   ├── /theo-doi          (Theo dõi)
   ├── /kiem-tra-chat-luong (QC)
   └── /chi-phi-van-hanh  (Chi phí vận hành)

4. 🚛 Vận tải
   ├── /giao-hang         (Giao hàng)
   ├── /phuong-tien       (Phương tiện)
   └── /tai-xe            (Tài xế)

5. 💰 Tài chính
   ├── /tai-chinh/cong-no-phai-thu   (Công nợ phải thu)
   ├── /tai-chinh/cong-no-phai-tra   (Công nợ phải trả)
   ├── /tai-chinh/phieu-thu-chi      (Phiếu thu/chi)
   ├── /tai-chinh/hoa-don            (Hóa đơn)
   ├── /so-cai                       (Sổ cái)
   ├── /tai-san                      (Tài sản)
   ├── /ngan-sach                    (Ngân sách)
   ├── /tai-chinh/ty-gia             (Tỷ giá)
   ├── /tai-chinh/bu-tru-cong-no    (Bù trừ công nợ)
   └── /mua-hang + /nha-cung-cap    (Mua hàng & NCC)

6. 👥 Nhân sự
   ├── /nhan-su           (Nhân viên)
   ├── /cham-cong         (Chấm công)
   ├── /nghi-phep         (Nghỉ phép)
   ├── /luong             (Lương)
   └── /hoa-hong          (Hoa hồng)

7. 📈 Báo cáo
   ├── /bao-cao/doanh-so           (Doanh số)
   ├── /bao-cao/tai-chinh          (Tài chính)
   ├── /bao-cao/lai-lo-don-hang    (Lãi lỗ đơn hàng)
   ├── /bao-cao/bien-loi-nhuan     (Biên lợi nhuận)
   ├── /bao-cao/chenh-lech-ty-gia  (Chênh lệch tỷ giá)
   └── /bao-cao/du-bao-dong-tien   (Dự báo dòng tiền)

8. ⚙️ Hệ thống
   ├── /cong-viec         (Công việc)
   ├── /khieu-nai         (Khiếu nại)
   ├── /ho-tro            (Hỗ trợ khách hàng)
   ├── /tai-lieu          (Tài liệu)
   ├── /thong-bao         (Thông báo)
   ├── /phe-duyet         (Phê duyệt)
   ├── /uy-quyen          (Ủy quyền)
   ├── /quan-ly-user      (Quản lý User)
   └── /cai-dat           (Cài đặt + Thông báo + Leo thang)
```

### G. Trang tổng quan theo vai trò

Hệ thống tự động hiển thị trang tổng quan phù hợp dựa trên vai trò:

| Vai trò | Loại trang tổng quan | Nội dung chính |
|---|---|---|
| TGĐ, PGĐ | Tổng quan Ban giám đốc | Chỉ số hiệu suất tổng hợp: doanh thu, đơn hàng, công nợ, container, biểu đồ xu hướng |
| GĐ Kinh doanh, Trưởng KD, NV KD | Tổng quan Kinh doanh | Kênh bán hàng, mục tiêu, khách hàng mới, tỷ lệ chuyển đổi |
| CSKH | Tổng quan CSKH | Yêu cầu hỗ trợ, cam kết dịch vụ, khiếu nại, phản hồi khách hàng |
| Kế toán trưởng, Kế toán, KT công nợ/chi phí | Tổng quan Tài chính | Dòng tiền, phân tích tuổi nợ, tỷ giá, phiếu chi/thu |
| Kho/XNK, Tài xế | Tổng quan Kho vận | Tồn kho, lô hàng, container, giao hàng |
| GĐ Nhân sự | Tổng quan Nhân sự | Quân số, chấm công, nghỉ phép, lương |

### H. Chi tiết 15 luồng phê duyệt mặc định

Hệ thống khởi tạo sẵn 15 quy trình phê duyệt. Quản trị viên có thể tùy chỉnh tại `/cai-dat/quy-trinh-phe-duyet`.

#### Luồng Kinh doanh (1-4)

**1. Giảm giá (DISCOUNT)**
```
Condition: discountPercent
  ≤3%  → SALES_LEADER (24h) → ACCOUNTANT_AR (24h) → END
  3-5% → SALES_DIRECTOR (24h) → ACCOUNTANT_AR (24h) → END
  >5%  → COO (48h) → END
```

**2. Hủy đơn hàng (ORDER_CANCEL)**
```
Condition: cancellationStage
  NO_DEPOSIT:      SALES_LEADER (24h) → END
  DEPOSIT_PAID:    SALES_DIRECTOR (24h) → SALES_LEADER (24h) → END
  GOODS_PURCHASED: COO (48h) → SALES_DIRECTOR (24h) → SALES_LEADER (24h) → END
```

**3. Gia hạn công nợ (CREDIT_EXTENSION)**
```
SALES_LEADER (24h) → CHIEF_ACCOUNTANT (24h) → COO (48h) → END
```

**4. Miễn/giảm cọc (DEPOSIT_EXEMPTION)**
```
SALES_LEADER (24h) → CHIEF_ACCOUNTANT (24h) → END
```

#### Luồng Tài chính (5-7)

**5. Phiếu chi (PAYMENT_VOUCHER)**
```
Condition: amount
  ≤50M VND → ACCOUNTANT_AR (24h) → COO (48h) → END
  >50M VND → CHIEF_ACCOUNTANT (24h) → COO (48h) → END
```

**6. Phiếu thu (RECEIPT_VOUCHER)**
```
ACCOUNTANT_AR (24h) → CHIEF_ACCOUNTANT (24h) → END
```

**7. Hoàn ứng chi phí (EXPENSE_CLAIM)**
```
ACCOUNTANT_COST (24h) → CHIEF_ACCOUNTANT (24h) → COO (48h) → END
```

#### Luồng Kho vận (8-10)

**8. Kế hoạch Container (CONTAINER_PLAN)**
```
XNK_STAFF (24h) → XNK_MANAGER (24h) → COO (48h) → END
```

**9. Xuất kho (WAREHOUSE_RELEASE)**
```
WAREHOUSE_VN_STAFF (12h) → WAREHOUSE_VN_MANAGER (24h) → XNK_MANAGER (24h) → END
```

**10. Mua hàng (PURCHASE_ORDER)**
```
Condition: amount
  ≤50M → XNK_STAFF (24h) → XNK_MANAGER (24h) → END
  >50M → XNK_STAFF (24h) → XNK_MANAGER (24h) → CHIEF_ACCOUNTANT (24h) → END
```

#### Luồng Nhân sự (11-13)

**11. Nghỉ phép (LEAVE_REQUEST)**
```
DIRECT_MANAGER (24h) → END
```

**12. Tăng ca (OVERTIME_REQUEST)**
```
DIRECT_MANAGER (24h) → END
```

**13. Điều chỉnh lương (SALARY_ADJUSTMENT)**
```
CHIEF_ACCOUNTANT (48h) → COO (48h) → END
```

#### Luồng Đặc biệt (14-15)

**14. Báo giá đặc biệt (QUOTATION_SPECIAL)**
```
Condition: orderAmount
  ≤100M → SALES_LEADER (24h) → END
  >100M → SALES_LEADER (24h) → SALES_DIRECTOR (24h) → END
```

**15. Quy trình tùy chỉnh (CUSTOM)** — Mẫu trống để quản trị viên tự thiết kế.

#### Luồng trước khi vận hành (16-18)

**16. Ân hạn cho khách VIP (GRACE_PERIOD_REQUEST)**
```
Sale → CFO (48h) → CEO (48h) → END
```

**17. Phụ phí phát sinh (EXTRA_CHARGE_APPROVAL)**
```
WAREHOUSE_VN_MANAGER (24h) → CHIEF_ACCOUNTANT (24h) → END
```

**18. Thấu chi tạm thời (CREDIT_OVERDRAFT)**
```
CHIEF_ACCOUNTANT (24h) → COO (48h) → END
```

### I. Danh sách hàm tái sử dụng giao diện (48 hàm)

<details>
<summary>Nhấn để xem danh sách hàm tái sử dụng</summary>

**Lõi hệ thống:**
- `use-auth` — Đăng nhập, đăng xuất, hồ sơ, đổi mật khẩu
- `use-users` — Quản lý người dùng
- `use-notifications` — Xử lý thông báo
- `use-websocket` — Kết nối thời gian thực
- `use-pagination` — Phân trang
- `use-debounce` / `use-debounced-value` — Chống gọi trùng lặp
- `use-focus-management` — Hỗ trợ tiếp cận

**Kinh doanh:**
- `use-orders` — CRUD đơn hàng
- `use-order-templates` — Mẫu đơn hàng
- `use-quotations` — Báo giá
- `use-customers` — Khách hàng
- `use-contracts` — Hợp đồng
- `use-supplier-orders` — Đơn NCC (MHH)
- `use-mhh-issues` — Sự cố MHH
- `use-commission` — Hoa hồng

**Tài chính:**
- `use-finance` — Thu chi, phiếu
- `use-cod` — COD
- `use-debt-netting` — Bù trừ công nợ
- `use-exchange-rate` — Tỷ giá
- `use-unallocated-funds` — Tiền chờ phân bổ
- `use-ar-aging` — Phân tích tuổi nợ

**Kho vận:**
- `use-warehouse` — Warehouse chung
- `use-warehouse-cn` — Kho TQ
- `use-warehouse-vn` — Kho VN
- `use-containers` — Container
- `use-tracking` — Tracking
- `use-fleet` — Phương tiện
- `use-drivers` — Tài xế

**Nhân sự:**
- `use-employees` — Nhân viên
- `use-payroll` — Lương
- `use-attendance` — Chấm công
- `use-manual-check-ins` — Chấm công thủ công

**Mua hàng:**
- `use-vendors` — Nhà cung cấp
- `use-purchases` — Mua hàng
- `use-inventory` — Kho vật tư

**Hệ thống:**
- `use-tasks` — Công việc
- `use-complaints` — Khiếu nại
- `use-documents` — Tài liệu
- `use-approvals` — Phê duyệt
- `use-approval-flows` — Cấu hình luồng phê duyệt
- `use-dashboard` — Dữ liệu trang tổng quan
- `use-reports` — Báo cáo

**CRM mở rộng:**
- `use-leads` — Khách hàng tiềm năng
- `use-support-tickets` — Phiếu hỗ trợ
- `use-customs-split` — Tách hải quan
- `use-return-request` — Yêu cầu trả hàng
- `use-sales-dashboard` — Bảng tổng quan kinh doanh

**Blog/Quản trị nội dung:**
- `use-blog-posts` — Bài viết
- `use-draft` — Lưu nháp tự động

</details>

### J. Tham chiếu điểm cuối giao diện lập trình

<details>
<summary>Nhấn để xem toàn bộ điểm cuối API (603+)</summary>

#### Đơn hàng — `/orders`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/orders` | Tạo đơn hàng (kiểm tra tín dụng) |
| GET | `/orders` | Danh sách đơn (có lọc) |
| GET | `/orders/:id` | Chi tiết đơn |
| PATCH | `/orders/:id` | Cập nhật (CONSULTING/QUOTATION) |
| PATCH | `/orders/:id/status` | Chuyển trạng thái (FSM) |
| POST | `/orders/:id/cancel` | Hủy đơn |
| POST | `/orders/calculate-mhh-price` | Tính giá MHH |
| POST | `/orders/:id/mhh-issues` | Tạo sự cố MHH |
| GET | `/orders/:id/mhh-issues` | DS sự cố MHH |
| PATCH | `/orders/mhh-issues/:id/status` | Cập nhật sự cố |
| POST | `/orders/mhh-issues/:id/resolve` | Giải quyết sự cố |
| POST | `/orders/mhh-issues/:id/customer-decision` | KH quyết định (KEEP/RETURN/EXCHANGE) |
| GET | `/orders/:id/360` | Giao diện 360° tổng hợp đơn hàng |
| POST | `/orders/:id/extra-charges` | Thêm phụ phí phát sinh |
| PATCH | `/orders/extra-charges/:id/approve` | Duyệt phụ phí |
| PATCH | `/orders/extra-charges/:id/reject` | Từ chối phụ phí |
| GET | `/documents/order/:orderId/hub` | Trung tâm tài liệu đơn hàng |

#### Báo giá — `/quotations`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/quotations` | Tạo báo giá |
| GET | `/quotations` | Danh sách |
| GET | `/quotations/:id` | Chi tiết |
| PATCH | `/quotations/:id` | Cập nhật (DRAFT/REJECTED) |
| POST | `/quotations/:id/approve` | Duyệt |
| POST | `/quotations/:id/reject` | Từ chối |
| POST | `/quotations/:id/convert` | Chuyển thành đơn hàng |
| POST | `/quotations/:id/duplicate` | Nhân bản |
| GET | `/quotations/:id/export/excel` | Xuất Excel |
| GET | `/quotations/:id/export/pdf` | Xuất PDF |
| POST | `/quotations/templates` | Tạo mẫu |
| POST | `/quotations/from-template/:id` | Tạo từ mẫu |
| POST | `/quotations/:id/save-as-template` | Lưu thành mẫu |

#### Hợp đồng — `/contracts`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/contracts` | Tạo hợp đồng |
| GET | `/contracts` | Danh sách |
| GET | `/contracts/:id` | Chi tiết |
| PUT | `/contracts/:id` | Cập nhật (DRAFT) |
| POST | `/contracts/:id/status` | Chuyển trạng thái |
| DELETE | `/contracts/:id` | Xóa (DRAFT) |

#### Đơn nhà cung cấp — `/supplier-orders`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/supplier-orders` | Tạo đơn NCC |
| GET | `/supplier-orders` | Danh sách |
| GET | `/supplier-orders/order/:orderId` | DS theo đơn hàng |
| GET | `/supplier-orders/:id` | Chi tiết |
| PATCH | `/supplier-orders/:id` | Cập nhật |
| PATCH | `/supplier-orders/:id/status` | Chuyển trạng thái (FSM) |
| POST | `/supplier-orders/:id/received` | Xác nhận nhận hàng |

#### Khách hàng — `/customers`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/customers` | Tạo KH |
| GET | `/customers` | Danh sách |
| GET | `/customers/:id` | Chi tiết |
| PATCH | `/customers/:id` | Cập nhật |
| GET | `/customers/:id/wallet` | Số dư ví |
| POST | `/customers/:id/wallet/topup` | Nạp ví |

#### Nhà cung cấp — `/vendors`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/vendors` | Tạo NCC |
| GET | `/vendors` | Danh sách |
| GET | `/vendors/approved` | DS đã duyệt |
| GET | `/vendors/:id` | Chi tiết + đánh giá |
| PATCH | `/vendors/:id` | Cập nhật |
| POST | `/vendors/:id/rate` | Đánh giá (1-5) |
| PATCH | `/vendors/:id/toggle-approval` | Duyệt/bỏ duyệt |

#### Kho Trung Quốc — `/warehouse-cn`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/warehouse-cn/receive` | Nhận kiện |
| POST | `/warehouse-cn/packages/:id/measure` | Đo kích thước/cân |
| PATCH | `/warehouse-cn/packages/:id/status` | Cập nhật trạng thái |
| GET | `/warehouse-cn/packages` | Danh sách kiện |
| GET | `/warehouse-cn/packages/:id` | Chi tiết kiện |
| GET | `/warehouse-cn/scan/:trackingNumber` | Quét mã vạch nhanh (bộ nhớ đệm Redis) |
| PATCH | `/warehouse-cn/packages/:id/mark-high-risk` | Đánh dấu hàng rủi ro cao |
| POST | `/warehouse-cn/packages/:id/accept-disclaimer` | Khách xác nhận miễn trừ trách nhiệm rủi ro |
| PATCH | `/warehouse-cn/packages/:id/independent-status` | Đặt trạng thái độc lập (tịch thu/giữ rủi ro) |

#### Kho Việt Nam — `/warehouse-vn`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/warehouse-vn/receive` | Nhận từ container |
| GET | `/warehouse-vn/packages` | Danh sách kiện |
| PATCH | `/warehouse-vn/packages/sort` | Phân loại hàng loạt |
| POST | `/warehouse-vn/dispatch` | Tạo phiếu giao |
| POST | `/warehouse-vn/deliveries/:id/confirm` | Xác nhận giao hàng |
| GET | `/warehouse-vn/delivery-plan` | Kế hoạch giao hàng |
| POST | `/warehouse-vn/packages/:id/reweigh` | Cân lại kiện (VN weight) |
| POST | `/warehouse-vn/deliveries/:id/failed` | Báo giao thất bại (auto RTO) |
| POST | `/warehouse-vn/deliveries/:id/rto/initiate` | Khởi tạo trả hàng (RTO) |
| POST | `/warehouse-vn/deliveries/:id/rto/receive` | Nhận hàng hoàn trả |
| POST | `/warehouse-vn/deliveries/:id/rto/reschedule` | Lên lịch giao lại |
| GET | `/warehouse-vn/rto` | Danh sách hàng hoàn trả |
| GET | `/warehouse-vn/rto/:deliveryId/fee-breakdown` | Chi tiết phí lưu kho |

#### Tiền chờ phân bổ — `/finance/unallocated`
| Method | Path | Mô tả |
|---|---|---|
| GET | `/finance/unallocated` | Danh sách giao dịch chưa phân bổ |
| POST | `/finance/unallocated/claim` | Nhận vơ giao dịch (Sale) |
| GET | `/finance/unallocated/claims` | Danh sách yêu cầu nhận vơ |
| PATCH | `/finance/unallocated/claims/:id/approve` | Duyệt nhận vơ (Kế toán) |
| PATCH | `/finance/unallocated/claims/:id/reject` | Từ chối nhận vơ |

#### Đăng nhập hộ — `/auth`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/auth/impersonate/:customerId` | Đăng nhập hộ khách hàng |
| POST | `/auth/end-impersonation` | Kết thúc đăng nhập hộ |

#### Container — `/containers`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/containers` | Tạo container |
| GET | `/containers` | Danh sách |
| GET | `/containers/:id` | Chi tiết |
| PATCH | `/containers/:id` | Cập nhật |
| POST | `/containers/:id/add-packages` | Ghép kiện |
| PATCH | `/containers/:id/status` | Chuyển trạng thái |
| GET | `/containers/:id/fill-rate` | Tỷ lệ lấp đầy |

#### Kiểm tra chất lượng — `/qc`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/qc/inspections` | Tạo QC |
| GET | `/qc/inspections` | Danh sách |
| GET | `/qc/inspections/:id` | Chi tiết |
| POST | `/qc/inspections/:id/start` | Bắt đầu kiểm tra |
| POST | `/qc/inspections/:id/submit` | Nộp kết quả |
| POST | `/qc/inspections/:id/send-to-customer` | Gửi KH review |
| POST | `/qc/inspections/:id/customer-decision` | KH duyệt/từ chối |
| POST | `/qc/inspections/:id/photos` | Thêm ảnh |

#### Theo dõi vận chuyển — `/tracking`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/tracking/events` | Thêm tracking event |
| GET | `/tracking/packages/:id` | Lịch sử kiện |
| GET | `/tracking/containers/:id` | Lịch sử container |
| POST | `/tracking/sync/:trackingNumber` | Đồng bộ bên ngoài |
| GET | `/tracking/packages/:id/eta` | Dự kiến giao hàng |

#### Phiếu thu/chi — `/cash`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/cash/vouchers` | Tạo phiếu thu/chi |
| GET | `/cash/vouchers` | Danh sách |
| PATCH | `/cash/vouchers/:id/approve` | Duyệt phiếu |
| PATCH | `/cash/vouchers/:id/reject` | Từ chối |
| GET | `/cash/flow` | Tổng hợp dòng tiền |

#### Công nợ phải thu — `/ar`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/ar` | Tạo AR |
| GET | `/ar` | Danh sách |
| GET | `/ar/overdue` | DS quá hạn |
| GET | `/ar/aging` | Phân tích tuổi nợ |
| GET | `/ar/aging/summary` | Tổng hợp toàn công ty |
| GET | `/ar/aging/high-risk` | KH rủi ro cao |
| GET | `/ar/aging/customer/:id` | Tuổi nợ theo KH |
| PATCH | `/ar/:id/payment` | Ghi nhận thanh toán |

#### Công nợ phải trả — `/ap`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/ap` | Tạo AP |
| GET | `/ap` | Danh sách |
| GET | `/ap/summary` | Tổng hợp công nợ phải trả |
| PATCH | `/ap/:id/payment` | Ghi nhận thanh toán |

#### Sổ cái — `/general-ledger`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/general-ledger/journal-entries` | Tạo bút toán |
| GET | `/general-ledger/journal-entries` | Danh sách |
| GET | `/general-ledger/trial-balance` | Bảng cân đối |
| GET | `/general-ledger/accounts/:code/balance` | Số dư tài khoản |
| POST | `/general-ledger/close-period` | Đóng kỳ |
| GET | `/general-ledger/chart-of-accounts` | Hệ thống tài khoản |

#### Hóa đơn — `/invoices`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/invoices` | Tạo hóa đơn |
| GET | `/invoices` | Danh sách |
| GET | `/invoices/:id` | Chi tiết |
| PATCH | `/invoices/:id/issue` | Phát hành |
| PATCH | `/invoices/:id/cancel` | Hủy |
| POST | `/invoices/:id/adjust` | Tạo điều chỉnh |

#### Mua hàng — `/purchases`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/purchases/requests` | Tạo PR |
| PATCH | `/purchases/requests/:id/approve` | Duyệt PR |
| POST | `/purchases/requests/:id/convert` | Yêu cầu mua → Đơn mua |
| POST | `/purchases/orders` | Tạo PO |
| POST | `/purchases/orders/:id/receipt` | Nhận hàng |

#### Kho vật tư — `/inventory`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/inventory/items` | Tạo mặt hàng tồn kho |
| POST | `/inventory/movements` | Ghi nhận xuất/nhập kho |
| GET | `/inventory/stock` | Tồn kho hiện tại |
| GET | `/inventory/alerts/low-stock` | Cảnh báo tồn thấp |

#### Phương tiện — `/fleet`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/fleet/vehicles` | Tạo xe |
| GET | `/fleet/vehicles` | Danh sách |
| GET | `/fleet/vehicles/available` | Xe có sẵn |
| POST | `/fleet/vehicles/:id/maintenance` | Lên lịch bảo dưỡng |
| POST | `/fleet/vehicles/:id/fuel` | Ghi đổ xăng |

#### Tài xế — `/drivers`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/drivers` | Tạo tài xế |
| GET | `/drivers` | Danh sách |
| GET | `/drivers/available` | Tài xế rảnh |
| POST | `/drivers/:id/assign-vehicle` | Gán xe |
| PATCH | `/drivers/:id/status` | Cập nhật trạng thái |

#### Nhân viên — `/employees`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/employees` | Tạo NV |
| GET | `/employees` | Danh sách |
| GET | `/employees/headcount` | Quân số |
| GET | `/employees/:id` | Chi tiết |
| POST | `/employees/:id/deactivate` | Nghỉ việc |

#### Chấm công — `/attendance`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/attendance/check-in` | Check-in (GPS) |
| POST | `/attendance/check-out` | Check-out |
| GET | `/attendance/my` | Chấm công tháng |
| GET | `/attendance/team` | Tổng hợp nhóm |
| POST | `/attendance/leave` | Đơn nghỉ phép |
| POST | `/attendance/leave/:id/approve` | Duyệt |
| POST | `/attendance/overtime` | Đơn tăng ca |
| POST | `/attendance/manual-check-in` | Chấm công thủ công (selfie + GPS) |
| GET | `/attendance/manual-check-ins` | Danh sách chấm công chờ duyệt |
| PATCH | `/attendance/manual-check-ins/:id/approve` | Duyệt chấm công thủ công |
| PATCH | `/attendance/manual-check-ins/:id/reject` | Từ chối chấm công thủ công |

#### Lương — `/payroll`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/payroll/calculate` | Tính lương tháng |
| POST | `/payroll/approve` | Duyệt bảng lương |
| GET | `/payroll` | Danh sách |
| GET | `/payroll/:employeeId/payslip` | Phiếu lương |

#### Khiếu nại — `/complaints`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/complaints` | Tạo khiếu nại |
| GET | `/complaints` | Danh sách |
| GET | `/complaints/statistics` | Thống kê |
| POST | `/complaints/:id/assign` | Gán handler |
| POST | `/complaints/:id/resolve` | Giải quyết |
| POST | `/complaints/:id/escalate` | Leo thang |

#### Phê duyệt — `/approvals`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/approvals` | Gửi yêu cầu phê duyệt |
| GET | `/approvals/pending` | Chờ tôi duyệt |
| GET | `/approvals/submitted` | Tôi đã gửi |
| GET | `/approvals/counts` | Đếm chờ duyệt |
| GET | `/approvals/:id` | Chi tiết |
| POST | `/approvals/:id/approve` | Duyệt |
| POST | `/approvals/:id/reject` | Từ chối |
| POST | `/approvals/:id/delegate` | Ủy quyền |
| POST | `/approvals/:id/withdraw` | Rút lại |
| POST | `/approvals/:id/return` | Trả lại sửa |
| POST | `/approvals/:id/comments` | Bình luận |

#### Trang tổng quan — `/dashboard`
| Method | Path | Mô tả |
|---|---|---|
| GET | `/dashboard/overview` | Tổng quan (BGĐ) |
| GET | `/dashboard/orders` | Thống kê đơn |
| GET | `/dashboard/finance` | Thống kê tài chính |
| GET | `/dashboard/warehouse` | Thống kê kho |
| GET | `/dashboard/hr` | Thống kê nhân sự |

#### Thông báo — `/notifications`
| Method | Path | Mô tả |
|---|---|---|
| GET | `/notifications` | Danh sách |
| POST | `/notifications/send` | Gửi cho user |
| POST | `/notifications/send-role` | Gửi cho role |
| PATCH | `/notifications/:id/read` | Đánh dấu đã đọc |
| POST | `/notifications/read-all` | Đọc tất cả |
| GET | `/notifications/unread-count` | Đếm chưa đọc |

#### Công việc — `/tasks`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/tasks` | Tạo task |
| GET | `/tasks` | Danh sách |
| GET | `/tasks/my` | Task của tôi |
| GET | `/tasks/overdue` | Quá hạn |
| PATCH | `/tasks/:id/status` | Chuyển trạng thái |
| POST | `/tasks/:id/comments` | Bình luận |

#### Tài liệu — `/documents`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/documents` | Tải lên (giới hạn 20 lần/phút) |
| GET | `/documents` | Danh sách |
| GET | `/documents/:id/download` | Tải xuống |
| POST | `/documents/:id/version` | Tải lên phiên bản mới |

#### Cấu hình phí dịch vụ — `/service-fee-configs`
| Method | Path | Mô tả |
|---|---|---|
| POST | `/service-fee-configs` | Tạo rule phí MHH |
| GET | `/service-fee-configs` | Danh sách |
| GET | `/service-fee-configs/:id` | Chi tiết |
| PATCH | `/service-fee-configs/:id` | Cập nhật |
| DELETE | `/service-fee-configs/:id` | Xóa |

#### Kiểm tra sức khỏe — `/health`
| Method | Path | Mô tả |
|---|---|---|
| GET | `/health` | Kiểm tra sức khỏe (CSDL, Redis, Bộ nhớ) |

#### Công khai (Không cần xác thực) — `/public`
| Method | Path | Mô tả |
|---|---|---|
| GET | `/public/cms-pages` | Trang CMS công khai |
| GET | `/public/tracking` | Tra cứu vận đơn |
| GET | `/public/pricing` | Thông tin giá |

</details>

---

> **Tài liệu này được tạo tự động từ phân tích mã nguồn hệ thống.**
> Phiên bản: 4.0 | Ngày: 2026-03-04
