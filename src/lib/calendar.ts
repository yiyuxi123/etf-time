// 📅 交易日历：市场休市判定、假日顺延、工作日计算。
//
// 设计要点：
// - 中国法定节假日每年日期不同（春节/端午/中秋按农历浮动），必须按年份维护。
// - 美股节假日多数按"某月第N个周一"浮动（MLK/总统日/阵亡将士/劳动节/感恩节），
//   也需要按年份维护。
// - 对未覆盖的年份，返回明确"数据未覆盖"而非误判休市——宁可漏判也不误休。

type HolidayMap = Record<string, string>; // MM-DD -> 原因

// 按年份组织的中国 A 股休市表（2025-2030）。来源：国务院办公厅年度通知。
const CN_HOLIDAYS_BY_YEAR: Record<number, HolidayMap> = {
  2025: {
    '01-01': '元旦休市',
    '01-28': '春节除夕休市',
    '01-29': '春节初一休市',
    '01-30': '春节初二休市',
    '01-31': '春节初三休市',
    '02-03': '春节假期休市',
    '04-04': '清明节休市',
    '05-01': '劳动节休市',
    '05-02': '劳动节假期休市',
    '05-05': '劳动节假期休市',
    '05-31': '端午节休市',
    '10-01': '国庆长假休市',
    '10-02': '国庆长假休市',
    '10-03': '国庆长假休市',
    '10-06': '国庆长假休市',
    '10-07': '国庆长假休市',
    '10-08': '国庆中秋补休',
  },
  2026: {
    '01-01': '元旦休市',
    '02-17': '春节除夕休市',
    '02-18': '春节初一休市',
    '02-19': '春节初二休市',
    '02-20': '春节初三休市',
    '02-21': '春节假期休市',
    '02-22': '春节假期休市',
    '02-23': '春节假期休市',
    '04-05': '清明节休市',
    '04-06': '清明节补休',
    '05-01': '劳动节休市',
    '06-19': '端午节休市(2026)',
    '10-01': '国庆长假首日休市',
    '10-02': '国庆长假休市',
    '10-03': '国庆长假休市',
    '10-04': '国庆长假休市',
    '10-05': '国庆长假休市',
    '10-06': '国庆长假休市',
    '10-07': '国庆长假休市',
  },
  2027: {
    '01-01': '元旦休市',
    '02-06': '春节除夕休市',
    '02-07': '春节初一休市',
    '02-08': '春节初二休市',
    '02-09': '春节初三休市',
    '02-10': '春节假期休市',
    '02-11': '春节假期休市',
    '02-12': '春节假期休市',
    '04-05': '清明节休市',
    '05-01': '劳动节休市',
    '06-10': '端午节休市',
    '09-22': '中秋节休市',
    '10-01': '国庆长假休市',
    '10-02': '国庆长假休市',
    '10-03': '国庆长假休市',
    '10-04': '国庆长假休市',
    '10-05': '国庆长假休市',
    '10-06': '国庆长假休市',
    '10-07': '国庆长假休市',
  },
  2028: {
    '01-01': '元旦休市',
    '01-26': '春节除夕休市',
    '01-27': '春节初一休市',
    '01-28': '春节初二休市',
    '01-29': '春节初三休市',
    '01-30': '春节假期休市',
    '01-31': '春节假期休市',
    '02-01': '春节假期休市',
    '02-02': '春节假期休市',
    '04-04': '清明节休市',
    '05-01': '劳动节休市',
    '06-22': '端午节休市',
    '10-01': '国庆长假休市',
    '10-02': '国庆长假休市',
    '10-03': '国庆长假休市',
    '10-04': '国庆长假休市',
    '10-05': '国庆长假休市',
    '10-06': '国庆长假休市',
    '10-07': '国庆长假休市',
  },
  2029: {
    '01-01': '元旦休市',
    '02-13': '春节除夕休市',
    '02-14': '春节初一休市',
    '02-15': '春节初二休市',
    '02-16': '春节初三休市',
    '02-17': '春节假期休市',
    '02-18': '春节假期休市',
    '02-19': '春节假期休市',
    '04-04': '清明节休市',
    '05-01': '劳动节休市',
    '06-29': '端午节休市',
    '10-01': '国庆长假休市',
    '10-02': '国庆长假休市',
    '10-03': '国庆长假休市',
    '10-04': '国庆长假休市',
    '10-05': '国庆长假休市',
    '10-06': '国庆长假休市',
    '10-07': '国庆长假休市',
  },
  2030: {
    '01-01': '元旦休市',
    '02-02': '春节除夕休市',
    '02-03': '春节初一休市',
    '02-04': '春节初二休市',
    '02-05': '春节初三休市',
    '02-06': '春节假期休市',
    '02-07': '春节假期休市',
    '02-08': '春节假期休市',
    '04-05': '清明节休市',
    '05-01': '劳动节休市',
    '06-18': '端午节休市',
    '10-01': '国庆长假休市',
    '10-02': '国庆长假休市',
    '10-03': '国庆长假休市',
    '10-04': '国庆长假休市',
    '10-05': '国庆长假休市',
    '10-06': '国庆长假休市',
    '10-07': '国庆长假休市',
  },
};

// 美股休市表（2025-2030）。浮动节日按实际日期列出。
const US_HOLIDAYS_BY_YEAR: Record<number, HolidayMap> = {
  2025: {
    '01-01': "New Year's Day 美股休市",
    '01-20': 'Martin Luther King Day 美股休市',
    '02-17': "Washington's Birthday 美股总统日休市",
    '04-18': 'Good Friday 耶稣受难日美股休市',
    '05-26': 'Memorial Day 美股阵亡将士纪念日休市',
    '06-19': 'Juneteenth 六月节美股休市',
    '07-04': 'Independence Day 美独立日休市',
    '09-01': 'Labor Day 美国劳动节美股休市',
    '11-27': 'Thanksgiving 感恩节美股休市',
    '12-25': 'Christmas 圣诞节美股休市',
  },
  2026: {
    '01-01': "New Year's Day 美股休市",
    '01-19': 'Martin Luther King Day 美股休市',
    '02-16': "Washington's Birthday 美股总统日休市",
    '04-03': 'Good Friday 耶稣受难日美股休市',
    '05-25': 'Memorial Day 美股阵亡将士纪念日休市',
    '06-19': 'Juneteenth 六月节美股休市',
    '07-03': 'Independence Day 美独立日休市(观察日)',
    '09-07': 'Labor Day 美国劳动节美股休市',
    '11-26': 'Thanksgiving 感恩节美股休市',
    '12-25': 'Christmas 圣诞节美股休市',
  },
  2027: {
    '01-01': "New Year's Day 美股休市",
    '01-18': 'Martin Luther King Day 美股休市',
    '02-15': "Washington's Birthday 美股总统日休市",
    '03-26': 'Good Friday 耶稣受难日美股休市',
    '05-31': 'Memorial Day 美股阵亡将士纪念日休市',
    '06-18': 'Juneteenth(观察日) 美股休市',
    '07-05': 'Independence Day(观察日) 美股休市',
    '09-06': 'Labor Day 美国劳动节美股休市',
    '11-25': 'Thanksgiving 感恩节美股休市',
    '12-24': 'Christmas(观察日) 美股休市',
  },
  2028: {
    '01-01': "New Year's Day 美股休市",
    '01-17': 'Martin Luther King Day 美股休市',
    '02-21': "Washington's Birthday 美股总统日休市",
    '04-14': 'Good Friday 耶稣受难日美股休市',
    '05-29': 'Memorial Day 美股阵亡将士纪念日休市',
    '06-19': 'Juneteenth 六月节美股休市',
    '07-04': 'Independence Day 美独立日休市',
    '09-04': 'Labor Day 美国劳动节美股休市',
    '11-23': 'Thanksgiving 感恩节美股休市',
    '12-25': 'Christmas 圣诞节美股休市',
  },
  2029: {
    '01-01': "New Year's Day 美股休市",
    '01-15': 'Martin Luther King Day 美股休市',
    '02-19': "Washington's Birthday 美股总统日休市",
    '03-30': 'Good Friday 耶稣受难日美股休市',
    '05-28': 'Memorial Day 美股阵亡将士纪念日休市',
    '06-19': 'Juneteenth 六月节美股休市',
    '07-04': 'Independence Day 美独立日休市',
    '09-03': 'Labor Day 美国劳动节美股休市',
    '11-22': 'Thanksgiving 感恩节美股休市',
    '12-25': 'Christmas 圣诞节美股休市',
  },
  2030: {
    '01-01': "New Year's Day 美股休市",
    '01-21': 'Martin Luther King Day 美股休市',
    '02-18': "Washington's Birthday 美股总统日休市",
    '04-19': 'Good Friday 耶稣受难日美股休市',
    '05-27': 'Memorial Day 美股阵亡将士纪念日休市',
    '06-19': 'Juneteenth 六月节美股休市',
    '07-04': 'Independence Day 美独立日休市',
    '09-02': 'Labor Day 美国劳动节美股休市',
    '11-28': 'Thanksgiving 感恩节美股休市',
    '12-25': 'Christmas 圣诞节美股休市',
  },
};

/**
 * 向后兼容导出：2026 年的扁平假日表。新代码请用 getCnHolidays(year)/getUsHolidays(year)。
 */
export const cnHolidayMap: HolidayMap = CN_HOLIDAYS_BY_YEAR[2026];
export const usHolidayMap: HolidayMap = US_HOLIDAYS_BY_YEAR[2026];

/** 获取指定年份的中国休市表；未覆盖年份返回空表（不误判）。 */
export function getCnHolidays(year: number): HolidayMap {
  return CN_HOLIDAYS_BY_YEAR[year] || {};
}

/** 获取指定年份的美股休市表；未覆盖年份返回空表（不误判）。 */
export function getUsHolidays(year: number): HolidayMap {
  return US_HOLIDAYS_BY_YEAR[year] || {};
}

/**
 * 判断标的是否跟随美股节假日（纳指/S&P/QDII 跨境标的）。
 */
function isUsAsset(symbol: string): boolean {
  const s = symbol.toLowerCase();
  if (s.includes('ndx') || s.includes('qqq') || s.includes('spy') || s.includes('qdii')) return true;
  // 已知的纳指/标普相关代码
  const usLinked = ['016452', '000834', '270042', '513100', '513984', '159941', '006075'];
  return usLinked.includes(s.replace(/^f_/, ''));
}

/**
 * 判断某标的在某日期是否休市。
 * 周末一律休市；工作日按年份查对应市场假日表。
 */
export function checkIsMarketClosed(dateStr: string, symbol: string): { closed: boolean; reason: string } {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return { closed: false, reason: '' };
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const dateObj = new Date(year, month, day);
  const dayOfWeek = dateObj.getDay();

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { closed: true, reason: `周${dayOfWeek === 0 ? '日' : '六'}常规休市` };
  }

  const mmdd = `${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const us = isUsAsset(symbol);

  if (us) {
    const usMap = getUsHolidays(year);
    if (usMap[mmdd]) return { closed: true, reason: usMap[mmdd] };
  }
  const cnMap = getCnHolidays(year);
  if (cnMap[mmdd]) return { closed: true, reason: cnMap[mmdd] };

  return { closed: false, reason: '' };
}

/**
 * 获取某标的的下一个交易日。
 */
export function getNextTradingDay(dateStr: string, symbol: string): string {
  let current = dateStr;
  let safety = 0;
  while (safety < 30) {
    const { closed } = checkIsMarketClosed(current, symbol);
    if (!closed) return current;
    const parts = current.split('-');
    const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    dateObj.setDate(dateObj.getDate() + 1);
    const yStr = dateObj.getFullYear();
    const mStr = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dStr = String(dateObj.getDate()).padStart(2, '0');
    current = `${yStr}-${mStr}-${dStr}`;
    safety++;
  }
  return current;
}

/**
 * 计算两个日期之间的交易日数（不含起止端点的非交易日）。
 */
export function getTradingDaysElapsed(startStr: string, endStr: string, symbol: string): number {
  if (startStr > endStr) return 0;

  let current = startStr;
  let workdays = 0;
  let safety = 0;

  while (current < endStr && safety < 1000) {
    const { closed } = checkIsMarketClosed(current, symbol);
    if (!closed) workdays++;

    const parts = current.split('-');
    const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    dateObj.setDate(dateObj.getDate() + 1);
    const yStr = dateObj.getFullYear();
    const mStr = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dStr = String(dateObj.getDate()).padStart(2, '0');
    current = `${yStr}-${mStr}-${dStr}`;
    safety++;
  }

  return workdays;
}
