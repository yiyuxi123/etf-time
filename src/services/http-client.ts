/**
 * Unified HTTP Client for standalone APK operation.
 * Uses fetch() as primary (Capacitor WebView allows cross-origin from capacitor:// scheme).
 * Falls back to CapacitorHttp native requests if needed.
 */
import { CapacitorHttp, HttpResponse } from '@capacitor/core';

const isNative = (): boolean => {
  return typeof (window as any).Capacitor !== 'undefined';
};

export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

export async function httpGet(url: string, opts: FetchOptions = {}): Promise<string> {
  if (isNative()) {
    try {
      const response: HttpResponse = await CapacitorHttp.get({
        url,
        headers: opts.headers || {},
        connectTimeout: opts.timeout || 15000,
        readTimeout: opts.timeout || 15000,
      });
      if (response.status >= 200 && response.status < 300) {
        return response.data as string;
      }
      throw new Error(`HTTP ${response.status}: ${response.data}`);
    } catch (e: any) {
      // Fallback to fetch
      console.warn('[HTTP Client] CapacitorHttp GET failed, trying fetch:', e.message);
    }
  }

  const res = await fetch(url, {
    method: 'GET',
    headers: opts.headers,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function httpPost(url: string, opts: FetchOptions = {}): Promise<string> {
  if (isNative()) {
    try {
      const response: HttpResponse = await CapacitorHttp.post({
        url,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...(opts.headers || {}),
        },
        data: opts.body || '',
        connectTimeout: opts.timeout || 15000,
        readTimeout: opts.timeout || 15000,
      });
      if (response.status >= 200 && response.status < 300) {
        return response.data as string;
      }
      throw new Error(`HTTP ${response.status}: ${response.data}`);
    } catch (e: any) {
      console.warn('[HTTP Client] CapacitorHttp POST failed, trying fetch:', e.message);
    }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(opts.headers || {}),
    },
    body: opts.body,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function httpGetJson<T = any>(url: string, opts: FetchOptions = {}): Promise<T> {
  const text = await httpGet(url, opts);
  return JSON.parse(text);
}

export async function httpPostJson<T = any>(url: string, opts: FetchOptions = {}): Promise<T> {
  const text = await httpPost(url, opts);
  return JSON.parse(text);
}
