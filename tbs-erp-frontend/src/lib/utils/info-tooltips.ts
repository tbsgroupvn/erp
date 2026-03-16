// ============================================
// TU DIEN HUONG DAN — Dinh nghia + Cach lam cho tung khai niem/trang
// ============================================

export interface InfoTip {
  /** Dinh nghia ngan gon */
  definition: string;
  /** Cach lam / huong dan su dung */
  howTo?: string;
}

/**
 * Key = route path (khong co /) hoac ten khai niem.
 * Dung cho PageHeader, sidebar, form labels, v.v.
 */
export const INFO_TIPS: Record<string, InfoTip> = {
  // ── Tong quan ──────────────────────────────────
  'tong-quan': {
    definition: 'Bảng điều khiển tổng hợp theo vai trò của bạn.',
    howTo: 'Xem số liệu nhanh, đơn cần xử lý, và cảnh báo quan trọng ngay khi đăng nhập.',
  },
  'bao-cao': {
    definition: 'Báo cáo doanh số, tài chính và xuất dữ liệu ra Excel/PDF.',
    howTo: 'Chọn tab loại báo cáo → lọc theo ngày/nhân viên → bấm "Xuất" để tải file.',
  },

  // ── Kinh doanh ─────────────────────────────────
  'khach-hang': {
    definition: 'Quản lý thông tin khách hàng: liên hệ, hạng, hạn mức tín dụng, ví.',
    howTo: 'Bấm "Thêm khách hàng" → điền thông tin → Lưu. Bấm vào tên KH để xem chi tiết, sửa, hoặc đặt đơn.',
  },
  'bao-gia': {
    definition: 'Tạo và quản lý báo giá gửi cho khách hàng trước khi lên đơn.',
    howTo: 'Bấm "Tạo báo giá" → chọn KH → thêm hàng hóa + phí → Gửi duyệt. Sau khi duyệt, có thể chuyển thành đơn hàng.',
  },
  'don-hang': {
    definition: 'Đơn hàng chính (Master Order) chứa các đơn con theo loại dịch vụ.',
    howTo: 'Bấm "Tạo đơn hàng" → chọn KH → thêm đơn con (VCT/MHH/VCTTQ) với hàng hóa → Xác nhận. Theo dõi trạng thái từ mới → hoàn thành.',
  },
  'hop-dong': {
    definition: 'Hợp đồng dài hạn với khách hàng, quy định giá cước và điều khoản.',
    howTo: 'Bấm "Tạo hợp đồng" → chọn KH → nhập điều khoản, thời hạn → Gửi duyệt.',
  },
  'khieu-nai': {
    definition: 'Tiếp nhận và xử lý khiếu nại từ khách hàng (hàng hư, thiếu, chậm...).',
    howTo: 'Bấm "Tạo khiếu nại" → chọn đơn hàng liên quan → mô tả vấn đề + mức độ → Gửi. Theo dõi quy trình: Mở → Điều tra → Giải quyết → Đóng.',
  },

  // ── Van hanh ───────────────────────────────────
  'kho-trung-quoc': {
    definition: 'Kho nhận hàng tại Trung Quốc. Nhận kiện → cân đo → đóng gói → xếp container.',
    howTo: 'Quét mã vạch kiện hàng → nhập cân nặng/kích thước → kiểm tra chất lượng → đóng gói vào container.',
  },
  'container': {
    definition: 'Quản lý container vận chuyển từ TQ về VN. Theo dõi trạng thái từ đóng hàng → vận chuyển → đến nơi.',
    howTo: 'Bấm "Tạo container" → chọn kiện hàng → xác nhận xuất kho. Tab "Theo dõi" xem vị trí container realtime.',
  },
  'thong-quan': {
    definition: 'Quản lý tờ khai hải quan, tính thuế nhập khẩu, và theo dõi luồng thông quan.',
    howTo: 'Container về VN → Tạo tờ khai → nhập mã HS, thuế suất → Nộp. Theo dõi luồng xanh/vàng/đỏ.',
  },
  'kho-viet-nam': {
    definition: 'Kho nhận hàng tại Việt Nam. Nhận container → phân loại → sẵn sàng giao.',
    howTo: 'Container đến → Nhận hàng → Phân loại theo đơn → Cân lại (khối lượng VN) → Sẵn sàng giao.',
  },
  'kiem-tra-chat-luong': {
    definition: 'Kiểm tra chất lượng hàng hóa (QC): chụp ảnh, ghi nhận lỗi, đánh giá.',
    howTo: 'Chọn kiện hàng → Chụp ảnh QC → Ghi nhận kết quả (đạt/không đạt) → Lưu.',
  },
  'chi-phi-van-hanh': {
    definition: 'Chi phí phát sinh trong vận hành: vận chuyển, kho bãi, bảo hiểm, hải quan.',
    howTo: 'Bấm "Thêm chi phí" → chọn loại → nhập số tiền, chứng từ → Phân bổ vào đơn hàng.',
  },
  'giao-hang': {
    definition: 'Điều phối giao hàng từ kho VN đến khách hàng.',
    howTo: 'Chọn đơn cần giao → Phân tài xế + phương tiện → In phiếu giao → Xác nhận đã giao.',
  },
  'phuong-tien': {
    definition: 'Quản lý phương tiện (xe tải, xe máy) và tài xế.',
    howTo: 'Tab "Phương tiện": thêm xe, theo dõi bảo trì. Tab "Tài xế": quản lý thông tin tài xế.',
  },

  // ── Tai chinh ──────────────────────────────────
  'cong-no-phai-thu': {
    definition: 'Số tiền khách hàng còn nợ công ty. Theo dõi thanh toán và quá hạn.',
    howTo: 'Xem danh sách nợ → Lọc theo KH/quá hạn → Ghi nhận thanh toán. Tab "Bù trừ" để đối trừ nợ, "Chưa phân bổ" cho khoản chưa khớp.',
  },
  'cong-no-phai-tra': {
    definition: 'Số tiền công ty còn nợ nhà cung cấp.',
    howTo: 'Xem danh sách khoản phải trả → Lập phiếu chi → Gửi duyệt thanh toán.',
  },
  'phieu-thu-chi': {
    definition: 'Phiếu thu (nhận tiền) và phiếu chi (trả tiền). Mỗi phiếu phải được duyệt.',
    howTo: 'Bấm "Tạo phiếu" → chọn Thu/Chi → nhập số tiền, lý do → Gửi duyệt. Phiếu chi NCC cần duyệt 4 cấp.',
  },
  'hoa-don': {
    definition: 'Hóa đơn xuất cho khách hàng hoặc nhận từ nhà cung cấp.',
    howTo: 'Bấm "Tạo hóa đơn" → chọn đơn hàng → kiểm tra số tiền → Xuất hóa đơn.',
  },
  'so-cai': {
    definition: 'Sổ cái tổng hợp: ghi nhận mọi bút toán kế toán.',
    howTo: 'Xem bút toán theo tài khoản/ngày. Tab "Tỷ giá" quản lý tỷ giá CNY/VND, "Tài sản" quản lý TSCĐ, "Ngân sách" lập kế hoạch chi tiêu.',
  },
  'mua-hang': {
    definition: 'Tạo yêu cầu mua hàng (PR) và đơn đặt mua (PO) cho nhà cung cấp.',
    howTo: 'Bấm "Tạo yêu cầu mua" → chọn vật tư → gửi duyệt. Sau duyệt → chuyển thành PO → đặt NCC.',
  },
  'hoa-hong': {
    definition: 'Tính và theo dõi hoa hồng bán hàng cho nhân viên sale.',
    howTo: 'Hệ thống tự tính hoa hồng khi đơn hoàn thành + KH thanh toán. Xem báo cáo hoa hồng theo nhân viên/kỳ.',
  },

  // ── Nhan su ────────────────────────────────────
  'nhan-su': {
    definition: 'Quản lý thông tin nhân viên: hồ sơ, phòng ban, chức vụ.',
    howTo: 'Bấm "Thêm nhân viên" → điền thông tin cá nhân, phòng ban → Lưu.',
  },
  'cham-cong': {
    definition: 'Chấm công hàng ngày (vào/ra), xem lịch sử, quản lý nghỉ phép.',
    howTo: 'Bấm "Chấm vào" khi đến, "Chấm ra" khi về. Tab "Nghỉ phép" để xin nghỉ hoặc duyệt đơn nghỉ.',
  },
  'luong': {
    definition: 'Bảng lương hàng tháng: lương cơ bản, phụ cấp, khấu trừ, thực lĩnh.',
    howTo: 'HR tạo bảng lương → Kế toán duyệt → Nhân viên xem phiếu lương của mình.',
  },

  // ── Workplace ──────────────────────────────────
  'tro-chuyen': {
    definition: 'Nhắn tin nội bộ giữa các nhân viên, hỗ trợ file, reaction, ghim tin.',
    howTo: 'Chọn người/nhóm chat → Nhắn tin → Đính kèm file nếu cần. Ghim tin quan trọng bằng nút "Ghim".',
  },
  'lich': {
    definition: 'Lịch làm việc, lịch họp, đặt phòng họp.',
    howTo: 'Bấm vào ngày trên lịch → "Tạo sự kiện" → mời người tham gia → Đặt phòng nếu cần.',
  },
  'bang-tin': {
    definition: 'Bảng tin nội bộ công ty: thông báo, tin tức, bài viết từ ban lãnh đạo.',
    howTo: 'Đọc bài viết mới → Like/Comment. Người có quyền có thể đăng bài mới.',
  },
  'tai-lieu': {
    definition: 'Lưu trữ tài liệu và wiki kiến thức nội bộ.',
    howTo: 'Tab "Tài liệu": tải lên/quản lý file theo thư mục. Tab "Wiki": viết và tìm kiếm bài wiki.',
  },
  'okr': {
    definition: 'OKR (Objectives & Key Results): đặt mục tiêu và theo dõi tiến độ.',
    howTo: 'Tạo mục tiêu (O) → Thêm kết quả then chốt (KR) → Cập nhật tiến độ hàng tuần.',
  },
  'cong-viec': {
    definition: 'Quản lý công việc cá nhân và nhóm: tạo task, giao việc, theo dõi tiến độ.',
    howTo: 'Bấm "Tạo công việc" → điền tiêu đề, mô tả, hạn → Giao cho người thực hiện. Kéo thả để đổi trạng thái.',
  },
  'ai-assistant': {
    definition: 'Công cụ hỗ trợ: AI trợ lý, video họp, tự động hóa quy trình.',
    howTo: 'Tab "AI": hỏi đáp, tra cứu nhanh. Tab "Video họp": tạo phòng họp online. Tab "Automation": thiết lập quy trình tự động.',
  },

  // ── Quan tri ───────────────────────────────────
  'phe-duyet': {
    definition: 'Xem và duyệt các yêu cầu: phiếu chi, báo giá, đơn hủy, chiết khấu...',
    howTo: 'Tab "Chờ tôi duyệt" → xem chi tiết → Duyệt hoặc Từ chối. Tab "Ủy quyền" để ủy quyền khi vắng mặt.',
  },
  'quan-ly-user': {
    definition: 'Quản lý tài khoản người dùng: tạo, phân quyền, khóa/mở.',
    howTo: 'Bấm "Thêm user" → chọn vai trò (Sale, Kế toán, Kho...) → Lưu. Mỗi vai trò có quyền truy cập khác nhau.',
  },
  'cai-dat': {
    definition: 'Cài đặt hệ thống: bảo mật 2FA, quy trình phê duyệt, phí dịch vụ...',
    howTo: 'Chọn mục cần cài đặt → Thay đổi giá trị → Lưu.',
  },

  // ── Khai niem nghiep vu ────────────────────────
  'master-order': {
    definition: 'Đơn hàng chính, chứa 1 hoặc nhiều đơn con (sub-order) cho cùng 1 khách hàng.',
    howTo: 'Mỗi đơn con có loại dịch vụ riêng (VCT, MHH, VCTTQ). Trạng thái đơn chính phụ thuộc vào các đơn con.',
  },
  'sub-order': {
    definition: 'Đơn con trong đơn hàng, ứng với 1 loại dịch vụ cụ thể.',
    howTo: 'Đơn con có trạng thái riêng: Mới → Đã cọc → Đặt NCC → Kho TQ → Vận chuyển → Kho VN → Giao → Hoàn thành.',
  },
  'vct': {
    definition: 'Vận chuyển thuê (VCT): khách đã mua hàng, chỉ cần vận chuyển từ TQ về VN.',
    howTo: 'Tính phí theo cân nặng/thể tích. Khách tự mua hàng, gửi về kho TQ.',
  },
  'mhh': {
    definition: 'Mua hộ hàng (MHH): công ty mua hàng hộ khách tại TQ rồi vận chuyển về.',
    howTo: 'Nhập link sản phẩm + số lượng → Báo giá cho KH → Đặt NCC → Vận chuyển về.',
  },
  'vcttq': {
    definition: 'Vận chuyển toàn quốc (VCTTQ): giao hàng nội địa Việt Nam.',
    howTo: 'Hàng từ kho VN → Phân tài xế → Giao đến địa chỉ KH.',
  },
  'deposit': {
    definition: 'Tiền cọc khách phải trả trước khi xử lý đơn hàng.',
    howTo: 'Tỷ lệ cọc theo hạng KH (VIP 0%, Thường 50-100%). Đơn chỉ xử lý sau khi đủ cọc.',
  },
  'chargeable-weight': {
    definition: 'Trọng lượng tính cước = MAX(cân nặng thực, cân quy đổi từ kích thước).',
    howTo: 'Công thức quy đổi: Dài x Rộng x Cao / 6000 (cm → kg). Lấy số lớn hơn giữa thực tế và quy đổi.',
  },
  'cn-weight': {
    definition: 'Cân nặng đo tại kho Trung Quốc (khi nhận kiện).',
  },
  'vn-weight': {
    definition: 'Cân nặng đo tại kho Việt Nam (khi nhận container). Dùng để đối chiếu với cân TQ.',
  },
  'credit-limit': {
    definition: 'Hạn mức tín dụng: số tiền tối đa khách được nợ.',
    howTo: 'Khi nợ vượt hạn mức → hệ thống chặn tạo đơn mới. Liên hệ kế toán để tăng hạn mức.',
  },
  'wallet': {
    definition: 'Ví nội bộ của khách hàng, dùng để trừ tiền hàng tự động.',
    howTo: 'Kế toán nạp tiền vào ví (cần mã giao dịch ngân hàng) → Hệ thống tự trừ khi có đơn.',
  },
  'approval-flow': {
    definition: 'Luồng phê duyệt nhiều cấp cho các thao tác quan trọng.',
    howTo: 'Tạo yêu cầu → Tự động gửi đến người duyệt theo thứ tự → Mỗi cấp duyệt/từ chối.',
  },
  'supplier-order': {
    definition: 'Đơn đặt hàng nhà cung cấp (NCC) tại Trung Quốc.',
    howTo: 'Tạo đơn NCC → Báo giá → Xác nhận → Theo dõi giao hàng đến kho TQ.',
  },
  'exchange-rate': {
    definition: 'Tỷ giá CNY/VND áp dụng khi quy đổi giá hàng từ Nhân dân tệ sang Việt Nam đồng.',
    howTo: 'Kế toán cập nhật tỷ giá hàng ngày. Đơn hàng sẽ dùng tỷ giá tại thời điểm tạo.',
  },
  'bu-tru': {
    definition: 'Bù trừ công nợ: khấu trừ qua lại giữa khoản phải thu và phải trả.',
    howTo: 'Chọn khoản phải thu + phải trả cần bù trừ → Nhập số tiền → Xác nhận.',
  },
  'debt-netting': {
    definition: 'Bù trừ công nợ giữa các bên liên quan.',
    howTo: 'Chọn các khoản nợ đối ứng → Xác nhận bù trừ → Hệ thống tự cập nhật số dư.',
  },
};

/**
 * Lay InfoTip theo route path hoac key.
 * Vi du: getInfoTip('/don-hang') hoac getInfoTip('don-hang')
 */
export function getInfoTip(key: string): InfoTip | undefined {
  // Chuan hoa: bo / dau, bo tat ca / thanh -
  const normalized = key.replace(/^\//, '').replace(/\//g, '-').replace(/^tai-chinh-/, '');
  return INFO_TIPS[normalized] || INFO_TIPS[key.replace(/^\//, '')];
}
