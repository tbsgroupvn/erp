/**
 * API Service Layer
 *
 * Centralized API client with:
 * - Axios configuration
 * - Auth token management
 * - Error handling
 * - TypeScript interfaces
 */

import axios, { AxiosError } from 'axios';

// ============================================
// CONFIGURATION
// ============================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
  withCredentials: true, // Required to send HttpOnly cookies
});

// ============================================
// REQUEST INTERCEPTOR (Auth Token)
// ============================================

api.interceptors.request.use(
  (config) => {
    // Access token is managed by the Zustand auth store via the main API client.
    // This legacy client relies on withCredentials for cookie-based auth.
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ============================================
// RESPONSE INTERCEPTOR (Error Handling)
// ============================================

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      // Server responded with error
      const { status, data } = error.response;

      switch (status) {
        case 401:
          // Unauthorized - redirect to login
          window.location.href = (process.env.NEXT_PUBLIC_BASE_PATH || '') + '/login';
          break;
        case 403:
          // Forbidden
          console.error('Access denied:', data);
          break;
        case 404:
          // Not found
          console.error('Resource not found:', error.config?.url);
          break;
        case 500:
          // Server error
          console.error('Server error:', data);
          break;
        default:
          console.error('API error:', data);
      }
    } else if (error.request) {
      // No response received
      console.error('Network error:', error.message);
    } else {
      // Request setup error
      console.error('Request error:', error.message);
    }

    return Promise.reject(error);
  }
);

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface ContractOption {
  id: string;
  code: string;
  title: string;
  totalValue: number;
  paidAmount: number;
  customerId: string;
  customerName: string;
}

export interface OrderOption {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  depositPaid: number;
  status: string;
}

export interface CreatePaymentVoucherPayload {
  type: 'RECEIPT' | 'PAYMENT';
  amount: number;
  currency: string;
  paymentMethod: string;
  beneficiary: string;
  reason: string;
  allocations: Array<{
    targetType: 'CONTRACT' | 'ORDER';
    targetId: string;
    amount: number;
    purposeType: 'DEPOSIT' | 'SETTLEMENT' | 'INSTALLMENT';
    note?: string;
  }>;
}

export interface DashboardOrder {
  id: string;
  code: string;
  customerName: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: string;
  dueDate: string;
  daysOverdue: number;
  createdAt: string;
  commissionStatus: 'PENDING' | 'APPROVED' | 'PAID';
  commissionAmount: number;
}

export interface CustomerDebt {
  customerId: string;
  totalDebt: number;
  overdueDebt: number;
  receivables: Array<{
    orderId: string;
    orderCode: string;
    amount: number;
    dueDate: string;
    daysOverdue: number;
  }>;
}

// ============================================
// CONTRACTS API
// ============================================

export const contractsApi = {
  /**
   * Search contracts by query
   */
  search: async (query: string = ''): Promise<ContractOption[]> => {
    const { data } = await api.get('/contracts', {
      params: {
        q: query,
        status: 'ACTIVE',
        limit: 100,
      },
    });
    return data;
  },

  /**
   * Get contract by ID
   */
  getById: async (id: string): Promise<ContractOption> => {
    const { data } = await api.get(`/contracts/${id}`);
    return data;
  },
};

// ============================================
// ORDERS API
// ============================================

export const ordersApi = {
  /**
   * Search orders by query
   */
  search: async (query: string = ''): Promise<OrderOption[]> => {
    const { data } = await api.get('/orders', {
      params: {
        q: query,
        limit: 100,
      },
    });
    return data;
  },

  /**
   * Get orders for sales dashboard
   */
  getSalesDashboard: async (saleId?: string): Promise<DashboardOrder[]> => {
    const { data } = await api.get('/orders/sales/dashboard', {
      params: { saleId },
    });
    return data;
  },

  /**
   * Send payment request to customer
   */
  requestPayment: async (orderId: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await api.post(`/orders/${orderId}/request-payment`);
    return data;
  },

  /**
   * Get order by ID
   */
  getById: async (id: string): Promise<OrderOption> => {
    const { data } = await api.get(`/orders/${id}`);
    return data;
  },
};

// ============================================
// PAYMENT VOUCHERS API
// ============================================

export const paymentVouchersApi = {
  /**
   * Create payment voucher with allocations
   */
  create: async (payload: CreatePaymentVoucherPayload): Promise<{ id: string; success: boolean }> => {
    const { data } = await api.post('/payment-vouchers', payload);
    return data;
  },

  /**
   * Get payment voucher by ID
   */
  getById: async (id: string): Promise<any> => {
    const { data } = await api.get(`/payment-vouchers/${id}`);
    return data;
  },

  /**
   * List payment vouchers
   */
  list: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{ data: any[]; total: number }> => {
    const { data } = await api.get('/payment-vouchers', { params });
    return data;
  },
};

// ============================================
// CUSTOMERS API
// ============================================

export const customersApi = {
  /**
   * Get customer debt information
   */
  getDebt: async (customerId: string): Promise<CustomerDebt> => {
    const { data } = await api.get(`/customers/${customerId}/debt`);
    return data;
  },

  /**
   * Search customers
   */
  search: async (query: string = ''): Promise<any[]> => {
    const { data } = await api.get('/customers', {
      params: {
        q: query,
        limit: 50,
      },
    });
    return data;
  },
};

// ============================================
// AUTH API
// ============================================

export const authApi = {
  /**
   * Login
   */
  login: async (email: string, password: string): Promise<{ token: string; user: any }> => {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  },

  /**
   * Logout
   */
  logout: () => {
    window.location.href = (process.env.NEXT_PUBLIC_BASE_PATH || '') + '/login';
  },

  /**
   * Get current user
   */
  getCurrentUser: async (): Promise<any> => {
    const { data } = await api.get('/auth/me');
    return data;
  },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format API error message for display
 */
export const formatApiError = (error: any): string => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.message) {
    return error.message;
  }
  return 'Có lỗi xảy ra. Vui lòng thử lại.';
};

/**
 * Check if error is auth error
 */
export const isAuthError = (error: any): boolean => {
  return error.response?.status === 401;
};

/**
 * Check if error is validation error
 */
export const isValidationError = (error: any): boolean => {
  return error.response?.status === 400;
};

// Export default axios instance for custom requests
export default api;
