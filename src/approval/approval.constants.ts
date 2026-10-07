export const AStatus = { DRAFT: 0, PENDING: 1, APPROVED: 2, REJECTED: -1, REVOKED: -2 } as const;
const LABEL: Record<number, string> = { 0: 'Nháp', 1: 'Đang chờ duyệt', 2: 'Đã duyệt', [-1]: 'Từ chối', [-2]: 'Đã thu hồi' };
export function statusLabel(n: number): string { return LABEL[n] ?? '?'; }
