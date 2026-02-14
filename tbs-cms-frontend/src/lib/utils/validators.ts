import { z } from 'zod';

import {
  Branch,
  ComplaintSeverity,
  ComplaintType,
  Currency,
  CustomerTier,
  PaymentMethod,
  ServiceType,
  ShippingRoute,
  TaskPriority,
} from '@/lib/types/enums';

// ============================================
// LOGIN
// ============================================

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Vui lòng nhập email' })
    .min(1, 'Vui lòng nhập email')
    .email('Email không hợp lệ'),
  password: z
    .string({ required_error: 'Vui lòng nhập mật khẩu' })
    .min(1, 'Vui lòng nhập mật khẩu')
    .min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

// ============================================
// CREATE ORDER
// ============================================

const createOrderItemSchema = z.object({
  productName: z
    .string({ required_error: 'Vui lòng nhập tên sản phẩm' })
    .min(1, 'Vui lòng nhập tên sản phẩm'),
  productUrl: z
    .string()
    .url('Link sản phẩm không hợp lệ')
    .optional()
    .or(z.literal('')),
  quantity: z
    .number({ required_error: 'Vui lòng nhập số lượng' })
    .int('Số lượng phải là số nguyên')
    .min(1, 'Số lượng tối thiểu là 1'),
  unitPrice: z
    .number({ required_error: 'Vui lòng nhập đơn giá' })
    .min(0, 'Đơn giá không được âm'),
  currency: z.nativeEnum(Currency).optional(),
  note: z.string().optional(),
});

export const createOrderSchema = z.object({
  customerId: z
    .string({ required_error: 'Vui lòng chọn khách hàng' })
    .min(1, 'Vui lòng chọn khách hàng'),
  serviceType: z.nativeEnum(ServiceType, {
    required_error: 'Vui lòng chọn loại dịch vụ',
    invalid_type_error: 'Loại dịch vụ không hợp lệ',
  }),
  branch: z.nativeEnum(Branch, {
    required_error: 'Vui lòng chọn chi nhánh',
    invalid_type_error: 'Chi nhánh không hợp lệ',
  }),
  shippingRoute: z.nativeEnum(ShippingRoute).optional(),
  currency: z.nativeEnum(Currency).optional(),
  note: z.string().max(500, 'Ghi chú tối đa 500 ký tự').optional(),
  items: z
    .array(createOrderItemSchema)
    .min(1, 'Đơn hàng phải có ít nhất 1 sản phẩm'),
});

export type CreateOrderFormValues = z.infer<typeof createOrderSchema>;

// ============================================
// CREATE CUSTOMER
// ============================================

export const createCustomerSchema = z.object({
  fullName: z
    .string({ required_error: 'Vui lòng nhập họ tên' })
    .min(1, 'Vui lòng nhập họ tên')
    .max(100, 'Họ tên tối đa 100 ký tự'),
  companyName: z.string().max(200, 'Tên công ty tối đa 200 ký tự').optional(),
  phone: z
    .string({ required_error: 'Vui lòng nhập số điện thoại' })
    .min(1, 'Vui lòng nhập số điện thoại')
    .regex(
      /^(0|\+84)\d{9,10}$/,
      'Số điện thoại không hợp lệ (VD: 0912345678)',
    ),
  email: z
    .string()
    .email('Email không hợp lệ')
    .optional()
    .or(z.literal('')),
  address: z.string().max(300, 'Địa chỉ tối đa 300 ký tự').optional(),
  taxCode: z
    .string()
    .regex(/^\d{10}(-\d{3})?$/, 'Mã số thuế không hợp lệ')
    .optional()
    .or(z.literal('')),
  tier: z.nativeEnum(CustomerTier).optional(),
  creditLimit: z
    .number()
    .min(0, 'Hạn mức công nợ không được âm')
    .optional(),
  depositRate: z
    .number()
    .int('Tỷ lệ cọc phải là số nguyên')
    .min(0, 'Tỷ lệ cọc tối thiểu 0%')
    .max(100, 'Tỷ lệ cọc tối đa 100%')
    .optional(),
  branch: z.nativeEnum(Branch).optional(),
  saleId: z.string().optional(),
  note: z.string().max(500, 'Ghi chú tối đa 500 ký tự').optional(),
});

export type CreateCustomerFormValues = z.infer<typeof createCustomerSchema>;

// ============================================
// CREATE VOUCHER (Payment / Receipt)
// ============================================

export const createVoucherSchema = z.object({
  type: z.enum(['RECEIPT', 'PAYMENT'], {
    required_error: 'Vui lòng chọn loại chứng từ',
  }),
  orderId: z
    .string({ required_error: 'Vui lòng chọn đơn hàng' })
    .min(1, 'Vui lòng chọn đơn hàng'),
  amount: z
    .number({ required_error: 'Vui lòng nhập số tiền' })
    .positive('Số tiền phải lớn hơn 0'),
  currency: z.nativeEnum(Currency).optional(),
  paymentMethod: z.nativeEnum(PaymentMethod, {
    required_error: 'Vui lòng chọn phương thức thanh toán',
    invalid_type_error: 'Phương thức thanh toán không hợp lệ',
  }),
  costType: z
    .string({ required_error: 'Vui lòng chọn loại chi phí' })
    .min(1, 'Vui lòng chọn loại chi phí'),
  beneficiary: z
    .string({ required_error: 'Vui lòng nhập người thụ hưởng' })
    .min(1, 'Vui lòng nhập người thụ hưởng'),
  reason: z
    .string({ required_error: 'Vui lòng nhập lý do' })
    .min(20, 'Lý do phải có ít nhất 20 ký tự'),
  attachments: z.array(z.string().url('URL chứng từ không hợp lệ')).optional(),
});

export type CreateVoucherFormValues = z.infer<typeof createVoucherSchema>;

// ============================================
// MEASURE PACKAGE
// ============================================

export const measurePackageSchema = z.object({
  actualWeight: z
    .number({ required_error: 'Vui lòng nhập cân nặng thực' })
    .positive('Cân nặng phải lớn hơn 0')
    .max(99999, 'Cân nặng vượt quá giới hạn'),
  length: z
    .number({ required_error: 'Vui lòng nhập chiều dài' })
    .positive('Chiều dài phải lớn hơn 0')
    .max(99999, 'Chiều dài vượt quá giới hạn'),
  width: z
    .number({ required_error: 'Vui lòng nhập chiều rộng' })
    .positive('Chiều rộng phải lớn hơn 0')
    .max(99999, 'Chiều rộng vượt quá giới hạn'),
  height: z
    .number({ required_error: 'Vui lòng nhập chiều cao' })
    .positive('Chiều cao phải lớn hơn 0')
    .max(99999, 'Chiều cao vượt quá giới hạn'),
  note: z.string().max(300, 'Ghi chú tối đa 300 ký tự').optional(),
});

export type MeasurePackageFormValues = z.infer<typeof measurePackageSchema>;

// ============================================
// CREATE EMPLOYEE
// ============================================

export const createEmployeeSchema = z.object({
  fullName: z.string().min(2, 'Tên ít nhất 2 ký tự'),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  phone: z.string().optional(),
  departmentCode: z.string().min(1, 'Chọn phòng ban'),
  positionTitle: z.string().min(1, 'Nhập chức danh'),
  branch: z.nativeEnum(Branch, { errorMap: () => ({ message: 'Chọn chi nhánh' }) }),
  joinDate: z.string().min(1, 'Chọn ngày vào'),
});

export type CreateEmployeeFormValues = z.infer<typeof createEmployeeSchema>;

// ============================================
// CREATE TASK
// ============================================

export const createTaskSchema = z.object({
  title: z.string().min(3, 'Tiêu đề ít nhất 3 ký tự'),
  description: z.string().optional(),
  assigneeId: z.string().min(1, 'Chọn người thực hiện'),
  priority: z.nativeEnum(TaskPriority).optional(),
  dueDate: z.string().optional(),
});

export type CreateTaskFormValues = z.infer<typeof createTaskSchema>;

// ============================================
// CREATE COMPLAINT
// ============================================

export const createComplaintSchema = z.object({
  customerId: z.string().min(1, 'Chọn khách hàng'),
  orderId: z.string().optional(),
  type: z.nativeEnum(ComplaintType, { errorMap: () => ({ message: 'Chọn loại khiếu nại' }) }),
  severity: z.nativeEnum(ComplaintSeverity, { errorMap: () => ({ message: 'Chọn mức độ' }) }),
  description: z.string().min(10, 'Mô tả ít nhất 10 ký tự'),
});

export type CreateComplaintFormValues = z.infer<typeof createComplaintSchema>;

// ============================================
// CREATE QUOTATION
// ============================================

export const createQuotationSchema = z.object({
  customerId: z.string().min(1, 'Chọn khách hàng'),
  serviceType: z.nativeEnum(ServiceType, { errorMap: () => ({ message: 'Chọn loại dịch vụ' }) }),
  discountRate: z.number().min(0).max(1).optional(),
  items: z.array(z.object({
    description: z.string().min(1, 'Nhập mô tả'),
    quantity: z.number().positive('Số lượng > 0'),
    unitPrice: z.number().positive('Đơn giá > 0'),
  })).min(1, 'Ít nhất 1 mục'),
});

export type CreateQuotationFormValues = z.infer<typeof createQuotationSchema>;
