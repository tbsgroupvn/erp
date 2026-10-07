/**
 * L0 Task 3 — hàm dựng cổng từ khai báo SQL. Mỗi cổng giữ `spec` (câu nguồn/đích + cột) để test chạy
 * được TỪNG cổng với dữ liệu tự dựng và chứng minh nó không mù.
 */
import { compareCount, compareCrossRef, compareKeyed, compareScalars, firstCell } from './compare';
import { Gate, GateKind } from './types';

interface Base {
  id: string;
  doc: string;
  title: string;
  kind?: GateKind;
}

/** Cổng NGUỒN §7: một câu COUNT(*) trên MariaDB phải = kỳ vọng (sai là DỪNG). */
export function countGate(b: Base & { sql: string; expected?: number }): Gate {
  const expected = b.expected ?? 0;
  return {
    id: b.id,
    doc: b.doc,
    title: b.title,
    kind: b.kind ?? 'source',
    spec: { type: 'count', sql: b.sql, expected },
    run: async (ctx) => compareCount(firstCell(await ctx.source.query(b.sql)), expected),
  };
}

/** Cổng G-DOC chạy CẢ hai phía: đếm nguồn = kỳ vọng VÀ đếm đích = kỳ vọng. */
export function countBothGate(b: Base & { sourceSql: string; targetSql: string; expected?: number }): Gate {
  const expected = b.expected ?? 0;
  return {
    id: b.id,
    doc: b.doc,
    title: b.title,
    kind: b.kind ?? 'gdoc',
    spec: { type: 'crossref', sourceSql: b.sourceSql, targetSql: b.targetSql, expected },
    run: async (ctx) =>
      compareCrossRef(
        firstCell(await ctx.source.query(b.sourceSql)),
        firstCell(await ctx.target.query(b.targetSql)),
        expected,
      ),
  };
}

/**
 * Tham chiếu chéo trên ĐÍCH: đích = cùng câu trên nguồn (nếu có `sourceSql`) và = bất biến tài liệu
 * (nếu có `expected`).
 */
export function crossRefGate(b: Base & { sourceSql: string | null; targetSql: string; expected?: number }): Gate {
  return {
    id: b.id,
    doc: b.doc,
    title: b.title,
    kind: b.kind ?? 'target',
    spec: { type: 'crossref', sourceSql: b.sourceSql, targetSql: b.targetSql, expected: b.expected },
    run: async (ctx) => {
      const s = b.sourceSql === null ? undefined : firstCell(await ctx.source.query(b.sourceSql));
      const t = firstCell(await ctx.target.query(b.targetSql));
      return compareCrossRef(s, t, b.expected);
    },
  };
}

/** Theo nhóm: nguồn và đích ra CÙNG bảng (khoá `key`, so từng ô của `values`). */
export function keyedGate(
  b: Base & { sourceSql: string; targetSql: string; key: string[]; values: string[]; keysAreLabels?: boolean },
): Gate {
  return {
    id: b.id,
    doc: b.doc,
    title: b.title,
    kind: b.kind ?? 'target',
    spec: { type: 'keyed', sourceSql: b.sourceSql, targetSql: b.targetSql, key: b.key, values: b.values, keysAreLabels: b.keysAreLabels },
    run: async (ctx) =>
      compareKeyed(await ctx.source.query(b.sourceSql), await ctx.target.query(b.targetSql), {
        key: b.key,
        values: b.values,
        keysAreLabels: b.keysAreLabels,
      }),
  };
}

/** Một dòng tổng (sentinel): so từng cột `values`. */
export function scalarGate(b: Base & { sourceSql: string; targetSql: string; values: string[] }): Gate {
  return {
    id: b.id,
    doc: b.doc,
    title: b.title,
    kind: b.kind ?? 'target',
    spec: { type: 'scalar', sourceSql: b.sourceSql, targetSql: b.targetSql, key: [], values: b.values },
    run: async (ctx) => {
      const [s] = await ctx.source.query(b.sourceSql);
      const [t] = await ctx.target.query(b.targetSql);
      return compareScalars(s ?? {}, t ?? {}, b.values);
    },
  };
}

/** Cổng không chạy được ở lô này — luôn SKIPPED với lý do tĩnh. */
export function skippedGate(b: Base & { reason: string }): Gate {
  return {
    id: b.id,
    doc: b.doc,
    title: b.title,
    kind: b.kind ?? 'target',
    skipReason: b.reason,
    run: async () => ({ status: 'SKIPPED', reason: b.reason }),
  };
}
