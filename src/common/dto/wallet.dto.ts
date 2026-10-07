// DTO layer cho hai endpoint ví (Task 5, PART A) — đi qua allow-list rõ ràng
// thay vì trả thẳng object dựng tay trong controller, cùng quy ước với
// customer.dto.ts/user.dto.ts (KEYS xuất riêng để test canh khớp TUYỆT ĐỐI).
//
// ⚠ VND là BigInt (`WalletService` cộng/trừ bằng bigint) — JSON.stringify()
// NÉM TypeError trên BigInt thô, và Number(bigint_lon) làm tròn mất độ chính
// xác âm thầm trên số lớn (bug tiền). Luôn `.toString()` tường minh ở đây,
// không dựa vào chỗ gọi tự nhớ làm.

export const WALLET_AVAILABLE_DTO_KEYS = ['balance', 'available'] as const;

export interface WalletAvailableDto {
  balance: string;
  available: string;
}

export function toWalletAvailableDto(balance: bigint, available: bigint): WalletAvailableDto {
  return { balance: balance.toString(), available: available.toString() };
}

export const WALLET_REPAIR_DTO_KEYS = ['balance'] as const;

export interface WalletRepairDto {
  balance: string;
}

export function toWalletRepairDto(balance: bigint): WalletRepairDto {
  return { balance: balance.toString() };
}
