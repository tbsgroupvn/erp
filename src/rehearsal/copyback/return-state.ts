/**
 * 04b §9 NGƯỢC: tbl_return_config, tbl_return_fields, tbl_return_state.
 * Nghịch đảo của src/rehearsal/etl/return-state.ts. Thuần.
 */
import { RETURN_SPECS } from '../etl/return-state';
import { PgRow, ReverseResult, Rev } from './convert';
import { c } from './pg-image';
import { CopybackSpec } from './spec';

// ------------------------------------------------------------ tbl_return_config
export const RETURN_CONFIG_PG = [
  c('id', 'id', 'int'), c('checkpointType', 'checkpoint_type', 'str'), c('checkpointRef', 'checkpoint_ref', 'str'),
  c('editMode', 'edit_mode', 'str'), c('requireReason', 'require_reason', 'bool'), c('updatedBy', 'updated_by', 'str'),
  c('updatedAt', 'updated_at', 'int'),
] as const;

export function reverseReturnConfig(r: PgRow): ReverseResult {
  const x = new Rev(r);
  return x.result({
    id: x.int('id'),
    checkpoint_type: x.str('checkpoint_type'), // enum PG → varchar(10) prod
    checkpoint_ref: x.str('checkpoint_ref'),
    edit_mode: x.str('edit_mode'),
    require_reason: x.bool('require_reason'), // Boolean → tinyint 1/0
    updated_by: x.optStr('updated_by'),
    updated_at: x.optInt('updated_at'),
  });
}

// ------------------------------------------------------------ tbl_return_fields
export const RETURN_CONFIG_FIELD_PG = [
  c('id', 'id', 'int'), c('configId', 'config_id', 'int'), c('fieldKey', 'field_key', 'str'),
] as const;

export function reverseReturnConfigField(r: PgRow): ReverseResult {
  const x = new Rev(r);
  return x.result({ id: x.int('id'), config_id: x.int('config_id'), field_key: x.str('field_key') });
}

// ------------------------------------------------------------ tbl_return_state
export const RETURN_STATE_PG = [
  c('id', 'id', 'int'), c('objectType', 'object_type', 'str'), c('objectId', 'object_id', 'int'),
  c('checkpointType', 'checkpoint_type', 'str'), c('checkpointRef', 'checkpoint_ref', 'str'), c('state', 'state', 'str'),
  c('reason', 'reason', 'str'), c('round', 'round', 'int'), c('fieldsOpened', 'fields_opened', 'json'),
  c('dataBefore', 'data_before', 'json'), c('dataAfter', 'data_after', 'json'), c('returnedBy', 'returned_by', 'str'),
  c('returnedAt', 'returned_at', 'int'), c('resubmittedAt', 'resubmitted_at', 'int'),
] as const;

export function reverseReturnState(r: PgRow): ReverseResult {
  const x = new Rev(r);
  const resub = x.optInt('resubmitted_at');
  return x.result({
    id: x.int('id'),
    object_type: x.str('object_type'),
    object_id: x.int('object_id'), // PG Int → prod bigint: nới
    checkpoint_type: x.str('checkpoint_type'),
    checkpoint_ref: x.str('checkpoint_ref'),
    state: x.str('state'),
    reason: x.str('reason'),
    round: x.tinyint('round'), // PG SmallInt → prod tinyint(4)
    fields_opened: x.json('fields_opened'), // jsonb → text
    // NULL giữ NULL: dump 25/09 đo 0 dòng '' ở cả hai cột (25 dòng returned có data_after NULL);
    // chiều xuôi ''→NULL là mất có chủ đích (không phân biệt được '' với NULL).
    data_before: x.optJson('data_before'),
    data_after: x.optJson('data_after'),
    returned_by: x.str('returned_by'),
    returned_at: x.int('returned_at'),
    resubmitted_at: resub === null ? '0' : resub, // NULL ⇒ 0 (sentinel prod, 04b §9.2)
  });
}

export const COPYBACK_RETURN: CopybackSpec[] = [
  {
    model: 'ReturnConfig', doc: '04b §9.2', table: 'tbl_return_config', pgColumns: RETURN_CONFIG_PG,
    reverse: reverseReturnConfig, forward: RETURN_SPECS[0],
    lossy: ['require_reason: chiều xuôi <>0 → Boolean — giá trị tinyint khác 0/1 (vd 2) trở về thành 1.'],
  },
  { model: 'ReturnConfigField', doc: '04b §9.2', table: 'tbl_return_fields', pgColumns: RETURN_CONFIG_FIELD_PG, reverse: reverseReturnConfigField, forward: RETURN_SPECS[1], lossy: [] },
  {
    model: 'ReturnState', doc: '04b §9.2 + 09a §5.5', table: 'tbl_return_state', pgColumns: RETURN_STATE_PG,
    reverse: reverseReturnState, forward: RETURN_SPECS[2],
    jsonColumns: ['fields_opened', 'data_before', 'data_after'],
    lossy: [
      'fields_opened/data_before/data_after: jsonb chuẩn hoá văn bản (thứ tự khoá, trùng khoá, escape \\uXXXX/\\/) — chép ngược ra JSON GỌN, bằng NGỮ NGHĨA với bản gốc nhưng có thể khác từng byte.',
      "data_before/data_after '' ⇒ NULL (chiều xuôi) — trở về NULL, không phải ''.",
      'data_after của dòng returned (A3) bị chiều xuôi đặt NULL — không khôi phục.',
      'resubmitted_at NULL ⇒ 0 (sentinel prod) — khứ hồi CHÍNH XÁC.',
    ],
  },
];
