/**
 * Chuyển đổi số sang chữ tiếng Việt.
 * Áp dụng quy tắc đọc số tiếng Việt:
 *   - "lẻ/linh" cho chữ số 0 ở hàng chục (nhóm 3 chữ số)
 *   - "mươi lăm" thay cho "mươi năm"
 *   - "mốt" thay cho "một" ở hàng đơn vị khi hàng chục >= 2
 *   - "mười" thay cho "một mươi"
 * Kết quả thêm hậu tố "đồng".
 */

const UNITS = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

const MILLIONS = ['', 'nghìn', 'triệu', 'tỷ'];

/**
 * Đọc một nhóm 3 chữ số (0–999).
 * @param num   Số nguyên từ 0 đến 999
 * @param isLeading  true nếu đây là nhóm đầu tiên (không cần thêm "không trăm")
 */
function readThreeDigits(num: number, isLeading: boolean): string {
  if (num === 0) return '';

  const hundreds = Math.floor(num / 100);
  const remainder = num % 100;
  const tens = Math.floor(remainder / 10);
  const units = remainder % 10;

  let result = '';

  // Hàng trăm
  if (hundreds > 0) {
    result += `${UNITS[hundreds]} trăm`;
  } else if (!isLeading && remainder > 0) {
    result += 'không trăm';
  }

  // Hàng chục
  if (tens === 0) {
    if (units > 0) {
      result += result ? ' lẻ ' : '';
      result += UNITS[units];
    }
  } else if (tens === 1) {
    result += result ? ' mười' : 'mười';
    if (units === 5) {
      result += ' lăm';
    } else if (units > 0) {
      result += ` ${UNITS[units]}`;
    }
  } else {
    result += `${result ? ' ' : ''}${UNITS[tens]} mươi`;
    if (units === 1) {
      result += ' mốt';
    } else if (units === 5) {
      result += ' lăm';
    } else if (units > 0) {
      result += ` ${UNITS[units]}`;
    }
  }

  return result.trim();
}

/**
 * Chuyển đổi số nguyên không âm sang chữ tiếng Việt và thêm hậu tố "đồng".
 *
 * Ví dụ:
 *   numberToVietnameseWords(0)          → "Không đồng"
 *   numberToVietnameseWords(15)         → "Mười lăm đồng"
 *   numberToVietnameseWords(1000000)    → "Một triệu đồng"
 *   numberToVietnameseWords(300000000)  → "Ba trăm triệu đồng"
 *   numberToVietnameseWords(1500000000) → "Một tỷ năm trăm triệu đồng"
 */
export function numberToVietnameseWords(num: number): string {
  if (!Number.isFinite(num) || num < 0) {
    return 'Không đồng';
  }

  // Làm tròn về số nguyên
  const intNum = Math.round(num);

  if (intNum === 0) {
    return 'Không đồng';
  }

  // Tách thành các nhóm 3 chữ số từ nhỏ đến lớn
  // Tối đa hỗ trợ đến hàng nghìn tỷ (999,999,999,999,999)
  const groups: number[] = [];
  let remaining = intNum;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  // groups[0] = hàng đơn vị/trăm/nghìn
  // groups[1] = hàng nghìn
  // groups[2] = hàng triệu
  // groups[3] = hàng tỷ
  // groups[4] = hàng nghìn tỷ

  const parts: string[] = [];

  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i];
    if (group === 0) continue;

    const isLeading = parts.length === 0;
    const groupText = readThreeDigits(group, isLeading);

    if (i < MILLIONS.length && MILLIONS[i]) {
      parts.push(`${groupText} ${MILLIONS[i]}`);
    } else if (i >= MILLIONS.length) {
      // Xử lý hàng nghìn tỷ trở lên: ghép "nghìn tỷ"
      const extraLevel = i - 3; // số lần nhân thêm với nghìn sau "tỷ"
      const suffix = 'tỷ' + ' nghìn'.repeat(extraLevel);
      parts.push(`${groupText} ${suffix}`);
    } else {
      parts.push(groupText);
    }
  }

  if (parts.length === 0) {
    return 'Không đồng';
  }

  const words = parts.join(' ');
  // Viết hoa chữ cái đầu
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
  return `${capitalized} đồng`;
}
