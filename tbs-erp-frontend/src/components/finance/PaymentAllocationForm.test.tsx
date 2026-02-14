/**
 * PaymentAllocationForm Tests
 *
 * Test coverage:
 * - Form validation
 * - Allocation calculations
 * - Dynamic row management
 * - Submit behavior
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentAllocationForm } from './PaymentAllocationForm';

// Mock API
jest.mock('@/services/api', () => ({
  contractsApi: {
    search: jest.fn(() => Promise.resolve([
      {
        id: 'ct-001',
        code: 'HĐ-001',
        title: 'Hợp đồng test',
        totalValue: 100000000,
        paidAmount: 50000000,
        customerId: 'cust-001',
        customerName: 'Công ty ABC',
      },
    ])),
  },
  ordersApi: {
    search: jest.fn(() => Promise.resolve([
      {
        id: 'ord-001',
        code: 'TBS-001',
        customerId: 'cust-001',
        customerName: 'Công ty ABC',
        totalAmount: 50000000,
        depositPaid: 15000000,
        status: 'PENDING_DEPOSIT',
      },
    ])),
  },
  paymentVouchersApi: {
    create: jest.fn(() => Promise.resolve({ id: 'pv-001', success: true })),
  },
}));

describe('PaymentAllocationForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render form with all required fields', () => {
      render(<PaymentAllocationForm />);

      expect(screen.getByLabelText(/số tiền thu/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/hình thức thanh toán/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/người thụ hưởng/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/lý do thu tiền/i)).toBeInTheDocument();
      expect(screen.getByText(/phân bổ thanh toán/i)).toBeInTheDocument();
    });

    it('should render at least one allocation row by default', () => {
      render(<PaymentAllocationForm />);

      // Check for allocation row elements
      expect(screen.getByText(/loại/i)).toBeInTheDocument();
      expect(screen.getByText(/số tiền/i)).toBeInTheDocument();
      expect(screen.getByText(/mục đích/i)).toBeInTheDocument();
    });

    it('should render submit button', () => {
      render(<PaymentAllocationForm />);

      const submitButton = screen.getByRole('button', { name: /tạo phiếu thu/i });
      expect(submitButton).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('should show error when amount is empty', async () => {
      render(<PaymentAllocationForm />);

      const submitButton = screen.getByRole('button', { name: /tạo phiếu thu/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/vui lòng nhập số tiền hợp lệ/i)).toBeInTheDocument();
      });
    });

    it('should show error when payment method not selected', async () => {
      render(<PaymentAllocationForm />);

      const amountInput = screen.getByLabelText(/số tiền thu/i);
      await userEvent.type(amountInput, '1000000');

      const submitButton = screen.getByRole('button', { name: /tạo phiếu thu/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/vui lòng chọn hình thức thanh toán/i)).toBeInTheDocument();
      });
    });

    it('should show error when reason is less than 20 characters', async () => {
      render(<PaymentAllocationForm />);

      const reasonInput = screen.getByLabelText(/lý do thu tiền/i);
      await userEvent.type(reasonInput, 'Short reason');

      const submitButton = screen.getByRole('button', { name: /tạo phiếu thu/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/lý do phải có tối thiểu 20 ký tự/i)).toBeInTheDocument();
      });
    });

    it('should show error when allocation not filled', async () => {
      render(<PaymentAllocationForm />);

      // Fill main form
      await userEvent.type(screen.getByLabelText(/số tiền thu/i), '1000000');
      await userEvent.selectOptions(screen.getByLabelText(/hình thức thanh toán/i), 'CASH');
      await userEvent.type(screen.getByLabelText(/người thụ hưởng/i), 'Test Customer');
      await userEvent.type(
        screen.getByLabelText(/lý do thu tiền/i),
        'This is a valid reason with more than 20 characters'
      );

      const submitButton = screen.getByRole('button', { name: /tạo phiếu thu/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/vui lòng điền đầy đủ thông tin phân bổ/i)).toBeInTheDocument();
      });
    });

    it('should show error when total allocation does not match amount', async () => {
      render(<PaymentAllocationForm />);

      // Fill form with mismatched total
      await userEvent.type(screen.getByLabelText(/số tiền thu/i), '1000000');
      await userEvent.selectOptions(screen.getByLabelText(/hình thức thanh toán/i), 'CASH');
      await userEvent.type(screen.getByLabelText(/người thụ hưởng/i), 'Test Customer');
      await userEvent.type(
        screen.getByLabelText(/lý do thu tiền/i),
        'This is a valid reason with more than 20 characters'
      );

      // Fill allocation with different amount
      const allocationAmountInputs = screen.getAllByPlaceholderText('0');
      await userEvent.type(allocationAmountInputs[0], '500000'); // Only 500k allocated, but 1M received

      const submitButton = screen.getByRole('button', { name: /tạo phiếu thu/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/tổng phân bổ.*phải bằng số tiền thu/i)).toBeInTheDocument();
      });
    });
  });

  describe('Dynamic Rows', () => {
    it('should add new allocation row when clicking "Thêm dòng"', async () => {
      render(<PaymentAllocationForm />);

      const initialRows = screen.getAllByText(/loại/i);
      const initialRowCount = initialRows.length;

      const addButton = screen.getByRole('button', { name: /thêm dòng/i });
      await userEvent.click(addButton);

      const newRows = screen.getAllByText(/loại/i);
      expect(newRows.length).toBe(initialRowCount + 1);
    });

    it('should remove allocation row when clicking trash icon', async () => {
      render(<PaymentAllocationForm />);

      // Add a second row first
      const addButton = screen.getByRole('button', { name: /thêm dòng/i });
      await userEvent.click(addButton);

      const initialRows = screen.getAllByText(/loại/i);
      const initialRowCount = initialRows.length;

      // Remove a row
      const trashButtons = screen.getAllByLabelText(/xóa dòng/i);
      await userEvent.click(trashButtons[1]); // Remove second row

      const newRows = screen.getAllByText(/loại/i);
      expect(newRows.length).toBe(initialRowCount - 1);
    });

    it('should not allow removing the last row', async () => {
      render(<PaymentAllocationForm />);

      const trashButton = screen.getByLabelText(/xóa dòng/i);
      expect(trashButton).toBeDisabled();
    });
  });

  describe('Allocation Calculation', () => {
    it('should show "Phân bổ chính xác" when total matches', async () => {
      render(<PaymentAllocationForm />);

      // Fill form
      await userEvent.type(screen.getByLabelText(/số tiền thu/i), '1000000');

      // Fill allocation with matching amount
      const allocationAmountInputs = screen.getAllByPlaceholderText('0');
      await userEvent.type(allocationAmountInputs[0], '1000000');

      await waitFor(() => {
        expect(screen.getByText(/phân bổ chính xác/i)).toBeInTheDocument();
      });
    });

    it('should show "Chưa khớp" when total does not match', async () => {
      render(<PaymentAllocationForm />);

      await userEvent.type(screen.getByLabelText(/số tiền thu/i), '1000000');

      const allocationAmountInputs = screen.getAllByPlaceholderText('0');
      await userEvent.type(allocationAmountInputs[0], '500000');

      await waitFor(() => {
        expect(screen.getByText(/chưa khớp/i)).toBeInTheDocument();
      });
    });

    it('should calculate total allocated correctly with multiple rows', async () => {
      render(<PaymentAllocationForm />);

      await userEvent.type(screen.getByLabelText(/số tiền thu/i), '1000000');

      // Add second row
      const addButton = screen.getByRole('button', { name: /thêm dòng/i });
      await userEvent.click(addButton);

      // Fill allocations
      const allocationAmountInputs = screen.getAllByPlaceholderText('0');
      await userEvent.type(allocationAmountInputs[0], '600000');
      await userEvent.type(allocationAmountInputs[1], '400000');

      await waitFor(() => {
        expect(screen.getByText(/phân bổ chính xác/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should submit form with valid data', async () => {
      const { paymentVouchersApi } = require('@/services/api');

      render(<PaymentAllocationForm />);

      // Fill form completely
      await userEvent.type(screen.getByLabelText(/số tiền thu/i), '1000000');
      await userEvent.selectOptions(screen.getByLabelText(/hình thức thanh toán/i), 'CASH');
      await userEvent.type(screen.getByLabelText(/người thụ hưởng/i), 'Test Customer');
      await userEvent.type(
        screen.getByLabelText(/lý do thu tiền/i),
        'This is a valid reason with more than 20 characters'
      );

      // Fill allocation
      await userEvent.selectOptions(screen.getByDisplayValue(/-- chọn --/i), 'CONTRACT');
      const allocationAmountInputs = screen.getAllByPlaceholderText('0');
      await userEvent.type(allocationAmountInputs[0], '1000000');

      const submitButton = screen.getByRole('button', { name: /tạo phiếu thu/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(paymentVouchersApi.create).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'RECEIPT',
            amount: 1000000,
            currency: 'VND',
            paymentMethod: 'CASH',
            beneficiary: 'Test Customer',
          })
        );
      });
    });

    it('should disable submit button while submitting', async () => {
      render(<PaymentAllocationForm />);

      // Fill form with valid data
      await userEvent.type(screen.getByLabelText(/số tiền thu/i), '1000000');
      await userEvent.selectOptions(screen.getByLabelText(/hình thức thanh toán/i), 'CASH');
      await userEvent.type(screen.getByLabelText(/người thụ hưởng/i), 'Test Customer');
      await userEvent.type(
        screen.getByLabelText(/lý do thu tiền/i),
        'This is a valid reason with more than 20 characters'
      );

      const allocationAmountInputs = screen.getAllByPlaceholderText('0');
      await userEvent.type(allocationAmountInputs[0], '1000000');

      const submitButton = screen.getByRole('button', { name: /tạo phiếu thu/i });

      expect(submitButton).not.toBeDisabled();

      await userEvent.click(submitButton);

      // Button should be disabled during submission
      await waitFor(() => {
        expect(submitButton).toHaveTextContent(/đang xử lý/i);
      });
    });

    it('should not submit when total mismatch', async () => {
      const { paymentVouchersApi } = require('@/services/api');

      render(<PaymentAllocationForm />);

      await userEvent.type(screen.getByLabelText(/số tiền thu/i), '1000000');
      await userEvent.selectOptions(screen.getByLabelText(/hình thức thanh toán/i), 'CASH');
      await userEvent.type(screen.getByLabelText(/người thụ hưởng/i), 'Test Customer');
      await userEvent.type(
        screen.getByLabelText(/lý do thu tiền/i),
        'This is a valid reason with more than 20 characters'
      );

      const allocationAmountInputs = screen.getAllByPlaceholderText('0');
      await userEvent.type(allocationAmountInputs[0], '500000'); // Mismatch

      const submitButton = screen.getByRole('button', { name: /tạo phiếu thu/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(paymentVouchersApi.create).not.toHaveBeenCalled();
      });
    });
  });

  describe('Currency Formatting', () => {
    it('should only allow numbers in amount input', async () => {
      render(<PaymentAllocationForm />);

      const amountInput = screen.getByLabelText(/số tiền thu/i) as HTMLInputElement;

      await userEvent.type(amountInput, 'abc123def456');

      expect(amountInput.value).toBe('123456');
    });

    it('should allow decimal point in amount', async () => {
      render(<PaymentAllocationForm />);

      const amountInput = screen.getByLabelText(/số tiền thu/i) as HTMLInputElement;

      await userEvent.type(amountInput, '1000.50');

      expect(amountInput.value).toBe('1000.50');
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for all inputs', () => {
      render(<PaymentAllocationForm />);

      expect(screen.getByLabelText(/số tiền thu/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/hình thức thanh toán/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/người thụ hưởng/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/lý do thu tiền/i)).toBeInTheDocument();
    });

    it('should mark required fields with asterisk', () => {
      render(<PaymentAllocationForm />);

      const requiredMarkers = screen.getAllByText('*');
      expect(requiredMarkers.length).toBeGreaterThan(0);
    });

    it('should show error with alert icon', async () => {
      render(<PaymentAllocationForm />);

      const submitButton = screen.getByRole('button', { name: /tạo phiếu thu/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const errorMessages = screen.getAllByRole('alert');
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });
  });
});
