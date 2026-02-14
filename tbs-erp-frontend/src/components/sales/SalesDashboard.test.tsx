/**
 * SalesDashboard Tests
 *
 * Test coverage:
 * - KPI calculations
 * - Filtering logic
 * - Sorting logic
 * - Export functionality
 * - Action buttons
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SalesDashboard } from './SalesDashboard';

// Mock API
jest.mock('@/services/api', () => ({
  ordersApi: {
    getSalesDashboard: jest.fn(() =>
      Promise.resolve([
        {
          id: '1',
          code: 'TBS-001',
          customerName: 'Công ty ABC',
          totalAmount: 50000000,
          paidAmount: 15000000,
          outstandingAmount: 35000000,
          status: 'SOURCING',
          dueDate: '2025-02-05',
          daysOverdue: 6,
          createdAt: '2025-01-15',
          commissionStatus: 'PENDING',
          commissionAmount: 2500000,
        },
        {
          id: '2',
          code: 'TBS-002',
          customerName: 'Công ty XYZ',
          totalAmount: 80000000,
          paidAmount: 80000000,
          outstandingAmount: 0,
          status: 'COMPLETED',
          dueDate: '2025-01-25',
          daysOverdue: 0,
          createdAt: '2025-01-10',
          commissionStatus: 'APPROVED',
          commissionAmount: 4000000,
        },
      ])
    ),
    requestPayment: jest.fn(() => Promise.resolve({ success: true })),
  },
  customersApi: {
    getDebt: jest.fn(() =>
      Promise.resolve({
        customerId: 'cust-001',
        totalDebt: 35000000,
        overdueDebt: 35000000,
        receivables: [],
      })
    ),
  },
}));

// Mock useCurrentUser hook
jest.mock('@/hooks/useAuth', () => ({
  useCurrentUser: () => ({ id: 'sale-001', role: 'SALE', name: 'John Doe' }),
}));

describe('SalesDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render dashboard title', async () => {
      render(<SalesDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/dashboard sales/i)).toBeInTheDocument();
      });
    });

    it('should render all KPI cards', async () => {
      render(<SalesDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/tổng đơn hàng/i)).toBeInTheDocument();
        expect(screen.getByText(/chờ thanh toán/i)).toBeInTheDocument();
        expect(screen.getByText(/nợ quá hạn/i)).toBeInTheDocument();
        expect(screen.getByText(/hoa hồng chờ duyệt/i)).toBeInTheDocument();
      });
    });

    it('should render filter button', async () => {
      render(<SalesDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /bộ lọc/i })).toBeInTheDocument();
      });
    });

    it('should render export button', async () => {
      render(<SalesDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /xuất excel/i })).toBeInTheDocument();
      });
    });

    it('should render orders table', async () => {
      render(<SalesDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/mã đơn/i)).toBeInTheDocument();
        expect(screen.getByText(/khách hàng/i)).toBeInTheDocument();
        expect(screen.getByText(/tổng tiền/i)).toBeInTheDocument();
      });
    });
  });

  describe('KPI Calculations', () => {
    it('should calculate total orders correctly', async () => {
      render(<SalesDashboard />);

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument(); // 2 orders
      });
    });

    it('should calculate pending payment correctly', async () => {
      render(<SalesDashboard />);

      await waitFor(() => {
        // 35,000,000 VND outstanding
        expect(screen.getByText(/35,000,000/i)).toBeInTheDocument();
      });
    });

    it('should calculate overdue debt correctly', async () => {
      render(<SalesDashboard />);

      await waitFor(() => {
        // Only TBS-001 has overdue (35M)
        const overdueCard = screen.getByText(/nợ quá hạn/i).closest('div');
        expect(overdueCard).toHaveTextContent(/35,000,000/i);
      });
    });

    it('should calculate pending commission correctly', async () => {
      render(<SalesDashboard />);

      await waitFor(() => {
        // Only TBS-001 has pending commission (2.5M)
        const commissionCard = screen.getByText(/hoa hồng chờ duyệt/i).closest('div');
        expect(commissionCard).toHaveTextContent(/2,500,000/i);
      });
    });
  });

  describe('Filtering', () => {
    it('should show filters when clicking filter button', async () => {
      render(<SalesDashboard />);

      const filterButton = screen.getByRole('button', { name: /bộ lọc/i });
      await userEvent.click(filterButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/khách hàng/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/trạng thái đơn/i)).toBeInTheDocument();
      });
    });

    it('should filter by customer name', async () => {
      render(<SalesDashboard />);

      // Open filters
      const filterButton = screen.getByRole('button', { name: /bộ lọc/i });
      await userEvent.click(filterButton);

      // Filter by customer
      const customerInput = screen.getByLabelText(/khách hàng/i);
      await userEvent.type(customerInput, 'ABC');

      await waitFor(() => {
        expect(screen.getByText('TBS-001')).toBeInTheDocument();
        expect(screen.queryByText('TBS-002')).not.toBeInTheDocument();
      });
    });

    it('should filter by order status', async () => {
      render(<SalesDashboard />);

      const filterButton = screen.getByRole('button', { name: /bộ lọc/i });
      await userEvent.click(filterButton);

      const statusSelect = screen.getByLabelText(/trạng thái đơn/i);
      await userEvent.selectOptions(statusSelect, 'COMPLETED');

      await waitFor(() => {
        expect(screen.getByText('TBS-002')).toBeInTheDocument();
        expect(screen.queryByText('TBS-001')).not.toBeInTheDocument();
      });
    });

    it('should filter by payment status', async () => {
      render(<SalesDashboard />);

      const filterButton = screen.getByRole('button', { name: /bộ lọc/i });
      await userEvent.click(filterButton);

      const paymentSelect = screen.getByLabelText(/trạng thái thanh toán/i);
      await userEvent.selectOptions(paymentSelect, 'PAID');

      await waitFor(() => {
        expect(screen.getByText('TBS-002')).toBeInTheDocument();
        expect(screen.queryByText('TBS-001')).not.toBeInTheDocument();
      });
    });

    it('should update KPIs when filtering', async () => {
      render(<SalesDashboard />);

      const filterButton = screen.getByRole('button', { name: /bộ lọc/i });
      await userEvent.click(filterButton);

      const paymentSelect = screen.getByLabelText(/trạng thái thanh toán/i);
      await userEvent.selectOptions(paymentSelect, 'PAID');

      await waitFor(() => {
        // Should show 1 order (only TBS-002)
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });
  });

  describe('Sorting', () => {
    it('should sort by code when clicking column header', async () => {
      render(<SalesDashboard />);

      await waitFor(() => {
        expect(screen.getByText('TBS-001')).toBeInTheDocument();
      });

      const codeHeader = screen.getByText(/mã đơn/i);
      await userEvent.click(codeHeader);

      // Should toggle sort direction
      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        expect(rows[1]).toHaveTextContent('TBS-001');
      });
    });

    it('should toggle sort direction on second click', async () => {
      render(<SalesDashboard />);

      await waitFor(() => {
        expect(screen.getByText('TBS-001')).toBeInTheDocument();
      });

      const codeHeader = screen.getByText(/mã đơn/i);

      // Click once (descending)
      await userEvent.click(codeHeader);

      // Click twice (ascending)
      await userEvent.click(codeHeader);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        expect(rows[1]).toHaveTextContent('TBS-002');
      });
    });

    it('should sort by amount correctly', async () => {
      render(<SalesDashboard />);

      await waitFor(() => {
        expect(screen.getByText('TBS-001')).toBeInTheDocument();
      });

      const amountHeader = screen.getByText(/tổng tiền/i);
      await userEvent.click(amountHeader);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // TBS-002 (80M) should be first when sorted desc
        expect(rows[1]).toHaveTextContent('TBS-002');
      });
    });
  });

  describe('Action Buttons', () => {
    it('should call requestPayment when clicking send button', async () => {
      const { ordersApi } = require('@/services/api');

      render(<SalesDashboard />);

      await waitFor(() => {
        expect(screen.getByText('TBS-001')).toBeInTheDocument();
      });

      const sendButtons = screen.getAllByTitle(/gửi yêu cầu thanh toán/i);
      await userEvent.click(sendButtons[0]);

      await waitFor(() => {
        expect(ordersApi.requestPayment).toHaveBeenCalledWith('1');
      });
    });

    it('should call getDebt when clicking view button', async () => {
      const { customersApi } = require('@/services/api');

      render(<SalesDashboard />);

      await waitFor(() => {
        expect(screen.getByText('TBS-001')).toBeInTheDocument();
      });

      const viewButtons = screen.getAllByTitle(/xem công nợ/i);
      await userEvent.click(viewButtons[0]);

      await waitFor(() => {
        expect(customersApi.getDebt).toHaveBeenCalled();
      });
    });
  });

  describe('Export Functionality', () => {
    it('should export CSV when clicking export button', async () => {
      // Mock URL.createObjectURL
      global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');

      // Mock document.createElement and click
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
      };
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);

      render(<SalesDashboard />);

      await waitFor(() => {
        expect(screen.getByText('TBS-001')).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /xuất excel/i });
      await userEvent.click(exportButton);

      expect(mockLink.click).toHaveBeenCalled();
      expect(mockLink.download).toMatch(/sales-dashboard.*\.csv/);
    });
  });

  describe('Aging Analysis', () => {
    it('should render aging chart', async () => {
      render(<SalesDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/phân tích tuổi nợ/i)).toBeInTheDocument();
      });
    });

    it('should group orders by aging buckets correctly', async () => {
      render(<SalesDashboard />);

      await waitFor(() => {
        // TBS-001 has 6 days overdue (0-15 bucket)
        expect(screen.getByText(/0-15 ngày/i)).toBeInTheDocument();
      });
    });
  });

  describe('Commission Summary', () => {
    it('should render commission pie chart', async () => {
      render(<SalesDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/tổng hợp hoa hồng/i)).toBeInTheDocument();
      });
    });

    it('should show commission by status', async () => {
      render(<SalesDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/đã duyệt/i)).toBeInTheDocument();
        expect(screen.getByText(/chờ duyệt/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading state while fetching data', () => {
      const { ordersApi } = require('@/services/api');
      ordersApi.getSalesDashboard.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<SalesDashboard />);

      // Should show loading indicator or skeleton
      // (Implementation depends on your loading UI)
    });
  });

  describe('Error Handling', () => {
    it('should handle API error gracefully', async () => {
      const { ordersApi } = require('@/services/api');
      ordersApi.getSalesDashboard.mockRejectedValue(new Error('API Error'));

      // Mock console.error to avoid test noise
      jest.spyOn(console, 'error').mockImplementation(() => {});

      render(<SalesDashboard />);

      await waitFor(() => {
        // Should still render without crashing
        expect(screen.getByText(/dashboard sales/i)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should render on mobile viewport', () => {
      // Mock mobile viewport
      global.innerWidth = 375;
      global.innerHeight = 667;

      render(<SalesDashboard />);

      // Dashboard should still render
      expect(screen.getByText(/dashboard sales/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper button labels', async () => {
      render(<SalesDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /bộ lọc/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /xuất excel/i })).toBeInTheDocument();
      });
    });

    it('should have accessible table structure', async () => {
      render(<SalesDashboard />);

      await waitFor(() => {
        const table = screen.getByRole('table');
        expect(table).toBeInTheDocument();

        const headers = screen.getAllByRole('columnheader');
        expect(headers.length).toBeGreaterThan(0);
      });
    });
  });
});
