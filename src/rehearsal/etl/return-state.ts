/**
 * 04b §9 (docs/rewrite-spec/04b-tra-ve-nguoi-nop-sua.md): tbl_return_config,
 * tbl_return_fields, tbl_return_state. Ánh xạ THUẦN.
 */
import { Prisma } from '@prisma/client';
import { EtlSafeError, Row, enumVal, optInt32, optStr, reqInt32, reqStr } from './convert';
import { EtlContext, MapResult, TableSpec, ok, skip } from './spec';

const CHECKPOINT_TYPES = ['approval', 'biz'] as const;
const EDIT_MODES = ['off', 'all', 'whitelist'] as const;
const STATES = ['returned', 'resubmitted'] as const;
const OBJECT_TYPES = ['approval_request', 'payment'] as const;

// ------------------------------------------------------------ tbl_return_config
export const RETURN_CONFIG_COLUMNS = [
  'id', 'checkpoint_type', 'checkpoint_ref', 'edit_mode', 'require_reason', 'updated_by', 'updated_at',
] as const;

export function mapReturnConfig(r: Row, ctx: EtlContext): MapResult<Prisma.ReturnConfigCreateManyInput> {
  const checkpointType = enumVal(r, 'checkpoint_type', CHECKPOINT_TYPES);
  const checkpointRef = reqStr(r, 'checkpoint_ref');
  // A4 (§9.3 "không nạp"): cấu hình approval trỏ bước không tồn tại (rác test).
  if (checkpointType === 'approval' && !ctx.approvalStepIds.has(Number(checkpointRef))) {
    return skip('04b A4 cấu hình trỏ bước duyệt không tồn tại');
  }
  return ok({
    id: reqInt32(r, 'id'),
    checkpointType,
    checkpointRef,
    editMode: enumVal(r, 'edit_mode', EDIT_MODES),
    requireReason: reqInt32(r, 'require_reason') !== 0, // tinyint → Boolean (<>0)
    updatedBy: optStr(r, 'updated_by'), // '' giữ
    updatedAt: optInt32(r, 'updated_at'),
  });
}

// ------------------------------------------------------------ tbl_return_fields
export const RETURN_CONFIG_FIELD_COLUMNS = ['id', 'config_id', 'field_key'] as const;

export function mapReturnConfigField(
  r: Row,
  ctx: EtlContext,
): MapResult<Prisma.ReturnConfigFieldCreateManyInput> {
  const configId = reqInt32(r, 'config_id');
  // A5 (§9.3 "không nạp"): field mồ côi — FK đích cần config đã nạp.
  if (!ctx.loaded.ReturnConfig?.has(configId)) return skip('04b A5 field mồ côi (config không nạp)');
  return ok({ id: reqInt32(r, 'id'), configId, fieldKey: reqStr(r, 'field_key') });
}

// ------------------------------------------------------------ tbl_return_state
export const RETURN_STATE_COLUMNS = [
  'id', 'object_type', 'object_id', 'checkpoint_type', 'checkpoint_ref', 'state', 'reason', 'round',
  'fields_opened', 'data_before', 'data_after', 'returned_by', 'returned_at', 'resubmitted_at',
] as const;

/**
 * JSON cột 04b nạp dạng CHUỖI GỐC và ép `::jsonb` phía Postgres (jsonb giữ numeric
 * CHÍNH XÁC: 1.50 vẫn 1.50, số 20 chữ số không mất) — KHÔNG đi qua JSON.parse
 * để ghi (JSON.parse biến số thành double). JSON.parse chỉ dùng để KIỂM hợp lệ.
 */
function assertJson(col: string, s: string): string {
  try {
    JSON.parse(s);
  } catch {
    throw new EtlSafeError(`ETL cột ${col}: JSON không hợp lệ ⇒ DỪNG`);
  }
  return s;
}

function jsonTextOrNull(col: string, s: string | null): string | null {
  return s === null || s === '' ? null : assertJson(col, s);
}

/** Dòng ReturnState đã kiểm — JSON là văn bản gốc, runner ghi bằng SQL `::jsonb`. */
export interface ReturnStateRow {
  id: number;
  objectType: string;
  objectId: number;
  checkpointType: 'approval' | 'biz';
  checkpointRef: string;
  state: 'returned' | 'resubmitted';
  reason: string;
  round: number;
  fieldsOpened: string;
  dataBefore: string | null;
  dataAfter: string | null;
  returnedBy: string;
  returnedAt: number;
  resubmittedAt: number | null;
}

export function mapReturnState(r: Row, ctx: EtlContext): MapResult<ReturnStateRow> {
  const notes: string[] = [];
  const objectType = enumVal(r, 'object_type', OBJECT_TYPES);
  const objectId = reqInt32(r, 'object_id'); // prod bigint → Int (Q8)
  // A1 (§9.3 "không nạp"): trạng thái trỏ phiếu duyệt không tồn tại.
  if (objectType === 'approval_request' && !ctx.approvalRequestIds.has(objectId)) {
    return skip('04b A1 trỏ phiếu duyệt không tồn tại');
  }
  // Trạng thái của phiếu rác test ZZ đã loại (09a §3) ⇒ loại theo.
  if (objectType === 'payment' && ctx.skipped.SupplierPayment?.has(objectId)) {
    return skip('09a §3 thuộc phiếu rác test ZZ đã loại');
  }
  const state = enumVal(r, 'state', STATES);

  const foRaw = optStr(r, 'fields_opened');
  let fieldsOpened: unknown;
  try {
    fieldsOpened = foRaw === null ? null : JSON.parse(foRaw);
  } catch {
    fieldsOpened = null;
  }
  if (!Array.isArray(fieldsOpened) || !fieldsOpened.every((x) => typeof x === 'string')) {
    throw new EtlSafeError('ETL cột fields_opened: phải là mảng chuỗi JSON ⇒ DỪNG');
  }

  const afterRaw = optStr(r, 'data_after');
  let dataAfter: string | null;
  if (state === 'returned') {
    // §9.2: '' ⇒ NULL; returned mang data_after vòng trước (A3) ⇒ ĐẶT NULL (mặc định; Q7 chờ ký).
    if (afterRaw !== null && afterRaw !== '') notes.push('A3 data_after của vòng trước đặt NULL');
    dataAfter = null;
  } else {
    dataAfter = jsonTextOrNull('data_after', afterRaw);
  }

  const resub = reqInt32(r, 'resubmitted_at');
  return ok(
    {
      id: reqInt32(r, 'id'),
      objectType,
      objectId,
      checkpointType: enumVal(r, 'checkpoint_type', CHECKPOINT_TYPES),
      checkpointRef: reqStr(r, 'checkpoint_ref'),
      state,
      reason: reqStr(r, 'reason'),
      round: reqInt32(r, 'round'),
      fieldsOpened: foRaw as string,
      dataBefore: jsonTextOrNull('data_before', optStr(r, 'data_before')),
      dataAfter,
      returnedBy: reqStr(r, 'returned_by'),
      returnedAt: reqInt32(r, 'returned_at'),
      resubmittedAt: resub === 0 ? null : resub, // 0 ⇒ NULL
    },
    notes,
  );
}

export const RETURN_SPECS: TableSpec[] = [
  { model: 'ReturnConfig', doc: '04b §9.2', sourceTable: 'tbl_return_config', columns: RETURN_CONFIG_COLUMNS, targetTable: 'tbl_return_config', map: mapReturnConfig, trackIds: true },
  { model: 'ReturnConfigField', doc: '04b §9.2', sourceTable: 'tbl_return_fields', columns: RETURN_CONFIG_FIELD_COLUMNS, targetTable: 'tbl_return_fields', map: mapReturnConfigField },
  { model: 'ReturnState', doc: '04b §9.2 + 09a §5.5', sourceTable: 'tbl_return_state', columns: RETURN_STATE_COLUMNS, targetTable: 'tbl_return_state', map: mapReturnState, rawJsonInsert: true },
];
