/**
 * Yahoo Finance Service
 *
 * Browser / Capacitor WebView compatible replacement for the 'yahoo-finance2'
 * Node.js package.  All data comes from direct fetch() calls to Yahoo Finance's
 * public REST APIs (v8 chart endpoint) – no native Node dependencies.
 *
 * Usage mirrors the subset of yahoo-finance2 that the dashboard relies on:
 *   - getQuote(symbol)         replaces yahooFinance.quote()
 *   - getChart(symbol, period1) replaces yahooFinance.chart()
 *   - getHistorical(s, p1, p2) replaces yahooFinance.historical()
 */

import { httpGetJson } from './http-client';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const YAHOO_CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

// ---------------------------------------------------------------------------
// Internal types – mirror the shape of the Yahoo Finance v8 chart response
// ---------------------------------------------------------------------------

interface YahooMeta {
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  trailingPE?: number;
  [key: string]: any;
}

interface YahooQuoteIndicators {
  open: (number | null)[];
  high: (number | null)[];
  low: (number | null)[];
  close: (number | null)[];
}

interface YahooResult {
  meta: YahooMeta;
  timestamp: number[];
  indicators: {
    quote: YahooQuoteIndicators[];
  };
}

interface YahooChartEnvelope {
  chart: {
    result: YahooResult[];
    error: any;
  };
}

// ---------------------------------------------------------------------------
// Public return types
// ---------------------------------------------------------------------------

export interface QuoteResult {
  regularMarketPrice: number;
  regularMarketChangePercent: number;
  twoHundredDayAverage: number;
  fiftyDayAverage: number;
  fiftyTwoWeekHigh: number;
  trailingPE: number;
  regularMarketPreviousClose: number;
}

export interface ChartQuote {
  date: Date;
  close: number;
  open?: number;
  high?: number;
  low?: number;
}

export interface ChartResult {
  quotes: ChartQuote[];
}

export interface HistoricalRow {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reqHeaders(): Record<string, string> {
  return {
    'User-Agent': USER_AGENT,
    Accept: '*/*',
  };
}

function chartUrl(symbol: string, params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return `${YAHOO_CHART_BASE}/${encodeURIComponent(symbol)}?${qs}`;
}

/**
 * Low-level fetch of the v8 chart endpoint.
 * Returns the first result object or null on any failure.
 */
async function fetchChartData(
  symbol: string,
  params: Record<string, string>,
): Promise<YahooResult | null> {
  try {
    const url = chartUrl(symbol, params);
    const envelope = await httpGetJson<YahooChartEnvelope>(url, {
      headers: reqHeaders(),
    });
    return envelope?.chart?.result?.[0] ?? null;
  } catch (err: any) {
    console.warn(
      `[YahooFinance] chart fetch failed for "${symbol}":`,
      err.message,
    );
    return null;
  }
}

/** Extract valid (non-null, non-NaN) close values from the indicators array. */
function cleanCloses(quote: YahooQuoteIndicators | undefined): number[] {
  const raw = quote?.close ?? [];
  const out: number[] = [];
  for (const v of raw) {
    if (v !== null && v !== undefined && !isNaN(v)) out.push(v);
  }
  return out;
}

/** Simple moving average over the trailing `window` elements. */
function movingAverage(values: number[], window: number): number {
  const slice = values.slice(-Math.min(window, values.length));
  if (slice.length === 0) return 0;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/** Maximum value in the trailing `window` elements. */
function maxInWindow(values: number[], window: number): number {
  const slice = values.slice(-Math.min(window, values.length));
  if (slice.length === 0) return 0;
  return Math.max(...slice);
}

function isNil(v: any): v is null | undefined {
  return v === null || v === undefined || (typeof v === 'number' && isNaN(v));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch a current quote for a symbol.
 *
 * Makes two chart requests:
 *   1. `range=1d`   – latest price, previous close, 52-week high, and
 *                     trailingPE (if the meta section includes it).
 *   2. `range=2y`   – historical daily closes to compute MA200 and MA50.
 *
 * Domain-specific PE defaults are applied when trailingPE is unavailable:
 *   - Nasdaq / QQQ → 28
 *   - CSI300       → 11.8
 */
export async function getQuote(symbol: string): Promise<QuoteResult> {
  const defaults: QuoteResult = {
    regularMarketPrice: 1,
    regularMarketChangePercent: 0,
    twoHundredDayAverage: 1,
    fiftyDayAverage: 1,
    fiftyTwoWeekHigh: 1,
    trailingPE: 0,
    regularMarketPreviousClose: 1,
  };

  try {
    // ---- 1-day chart – snapshot quote --------------------------------------
    const day = await fetchChartData(symbol, { range: '1d', interval: '1d' });

    let price = defaults.regularMarketPrice;
    let prevClose = defaults.regularMarketPreviousClose;
    let changePct = defaults.regularMarketChangePercent;
    let high52 = defaults.fiftyTwoWeekHigh;
    let pe = defaults.trailingPE;

    if (day) {
      const m = day.meta ?? {};
      price = m.regularMarketPrice ?? price;
      prevClose = m.chartPreviousClose ?? m.previousClose ?? prevClose;
      high52 = m.fiftyTwoWeekHigh ?? high52;
      pe = m.trailingPE ?? pe;

      // Fallback: extract from raw OHLC when meta is sparse
      const q = day.indicators?.quote?.[0];
      const closes = cleanCloses(q);
      if (closes.length > 0 && price === defaults.regularMarketPrice) {
        price = closes[closes.length - 1];
      }
      if (closes.length > 1 && prevClose === defaults.regularMarketPreviousClose) {
        prevClose = closes[closes.length - 2];
      }
      if (prevClose !== 0) {
        changePct = ((price - prevClose) / prevClose) * 100;
      }
    }

    // ---- 2-year chart – moving averages & 52-week high ---------------------
    const twoYr = await fetchChartData(symbol, { range: '2y', interval: '1d' });

    let ma200 = defaults.twoHundredDayAverage;
    let ma50 = defaults.fiftyDayAverage;

    if (twoYr) {
      const q = twoYr.indicators?.quote?.[0];
      const closes = cleanCloses(q);
      if (closes.length > 0) {
        ma200 = movingAverage(closes, 200) || price;
        ma50 = movingAverage(closes, 50) || price;
        if (high52 === defaults.fiftyTwoWeekHigh || high52 === 0) {
          high52 = maxInWindow(closes, 252) || price;
        }
      }
    }

    // ---- Domain-specific PE defaults ---------------------------------------
    if (isNil(pe) || pe === 0) {
      const s = symbol.toLowerCase();
      if (s.includes('ndx') || s === 'qqq') pe = 28;
      else if (s.includes('csi300') || s === '000300.ss') pe = 11.8;
    }

    return {
      regularMarketPrice: isNil(price) ? defaults.regularMarketPrice : price,
      regularMarketChangePercent: isNil(changePct) ? 0 : changePct,
      twoHundredDayAverage: isNil(ma200) ? price : ma200,
      fiftyDayAverage: isNil(ma50) ? price : ma50,
      fiftyTwoWeekHigh: isNil(high52) ? price : high52,
      trailingPE: isNil(pe) ? 0 : pe,
      regularMarketPreviousClose: isNil(prevClose) ? price : prevClose,
    };
  } catch (err: any) {
    console.error(
      `[YahooFinance] getQuote failed for "${symbol}":`,
      err.message,
    );
    return defaults;
  }
}

/**
 * Fetch daily OHLC history from `period1` to now.
 *
 * Returns the same `{ quotes }` shape that yahoo-finance2's `chart()` method
 * provides, so existing code that destructures `.quotes` continues to work.
 */
export async function getChart(
  symbol: string,
  period1: Date,
): Promise<ChartResult> {
  const nowUnix = Math.floor(Date.now() / 1000);
  const p1Unix = Math.floor(period1.getTime() / 1000);

  try {
    const data = await fetchChartData(symbol, {
      period1: String(p1Unix),
      period2: String(nowUnix),
      interval: '1d',
    });

    if (!data) return { quotes: [] };

    const timestamps = data.timestamp ?? [];
    const q = data.indicators?.quote?.[0];
    const opens = q?.open ?? [];
    const highs = q?.high ?? [];
    const lows = q?.low ?? [];
    const closes = q?.close ?? [];

    const quotes: ChartQuote[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (isNil(close)) continue;
      quotes.push({
        date: new Date(timestamps[i] * 1000),
        close,
        open: opens[i] ?? undefined,
        high: highs[i] ?? undefined,
        low: lows[i] ?? undefined,
      });
    }

    return { quotes };
  } catch (err: any) {
    console.error(
      `[YahooFinance] getChart failed for "${symbol}":`,
      err.message,
    );
    return { quotes: [] };
  }
}

/**
 * Fetch daily OHLC history between two string dates.
 *
 * Returns a plain array of `{ date, open, high, low, close }` matching the
 * return type of yahoo-finance2's `historical()` method.
 */
export async function getHistorical(
  symbol: string,
  period1: string,
  period2: string,
): Promise<HistoricalRow[]> {
  const p1Unix = Math.floor(new Date(period1).getTime() / 1000);
  const p2Unix = Math.floor(new Date(period2).getTime() / 1000);

  try {
    const data = await fetchChartData(symbol, {
      period1: String(p1Unix),
      period2: String(p2Unix),
      interval: '1d',
    });

    if (!data) return [];

    const timestamps = data.timestamp ?? [];
    const q = data.indicators?.quote?.[0];
    const opens = q?.open ?? [];
    const highs = q?.high ?? [];
    const lows = q?.low ?? [];
    const closes = q?.close ?? [];

    const rows: HistoricalRow[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (isNil(close)) continue;
      rows.push({
        date: new Date(timestamps[i] * 1000),
        open: opens[i] ?? close,
        high: highs[i] ?? close,
        low: lows[i] ?? close,
        close,
      });
    }

    return rows;
  } catch (err: any) {
    console.error(
      `[YahooFinance] getHistorical failed for "${symbol}":`,
      err.message,
    );
    return [];
  }
}
