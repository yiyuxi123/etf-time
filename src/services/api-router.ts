/**
 * API Router — Standalone replacement for the Express backend.
 * Intercepts all /api/* fetch calls and routes them to local service implementations.
 * All data persists via localStorage. No server dependency.
 */
import { getDashboard } from './dashboard-service';

// Lazy imports for services that may not be created yet
async function getAiService() {
  const mod = await import('./ai-service');
  return mod;
}
async function getNavService() {
  const mod = await import('./nav-service');
  return mod;
}
async function getWebdavService() {
  const mod = await import('./webdav-service');
  return mod;
}
async function getTradeService() {
  const mod = await import('./trade-service');
  return mod;
}
async function getSipService() {
  const mod = await import('./sip-service');
  return mod;
}

/**
 * Handle a request to /api/* and return a Response object.
 */
export async function handleApiRequest(url: string, init?: RequestInit): Promise<Response | null> {
  const apiPath = url.startsWith('/api/') ? url.substring(5).split('?')[0] : '';

  // Determine method
  const method = (init?.method || 'GET').toUpperCase();

  // Parse body if present
  let body: any = null;
  if (init?.body) {
    try {
      body = JSON.parse(init.body as string);
    } catch { /* not JSON */ }
  }

  console.log(`[API Router] ${method} /api/${apiPath}`);

  try {
    // ========================================================
    // DASHBOARD
    // ========================================================
    if (apiPath === 'dashboard') {
      const data = await getDashboard(body?.markets || undefined);
      return jsonResponse(data);
    }

    // ========================================================
    // NEWS (cached search)
    // ========================================================
    if (apiPath === 'news') {
      // Simple cached news - return empty for standalone mode
      return jsonResponse([]);
    }

    // ========================================================
    // AI PARSE
    // ========================================================
    if (apiPath === 'ai-parse') {
      const { aiParseTransaction } = await getAiService();
      const result = await aiParseTransaction({
        text: body?.text,
        image: body?.image,
        provider: body?.provider || localStorage.getItem('ai_default_provider') || 'gemini',
        portfolioContext: body?.portfolioContext,
        deepseekKey: body?.deepseekKey || localStorage.getItem('deepseek_api_key'),
        qwenKey: body?.qwenKey || localStorage.getItem('qwen_api_key'),
      });
      return jsonResponse(result);
    }

    // ========================================================
    // NAV & SYMBOL SERVICES
    // ========================================================
    if (apiPath === 'query-fund-nav') {
      const { queryFundNav } = await getNavService();
      const result = await queryFundNav(body?.symbol, body?.date);
      return jsonResponse(result);
    }

    if (apiPath === 'verify-symbol') {
      const { verifySymbol } = await getNavService();
      const result = await verifySymbol(body?.symbol);
      return jsonResponse(result);
    }

    if (apiPath === 'report-correction') {
      const { reportCorrection } = await getNavService();
      const result = await reportCorrection(
        body?.symbol, body?.date, body?.originalNav, body?.userCorrectedNav
      );
      return jsonResponse(result);
    }

    // ========================================================
    // WEBDAV
    // ========================================================
    if (apiPath === 'webdav/test') {
      const { testWebdavConnection } = await getWebdavService();
      const result = await testWebdavConnection(body?.url, body?.username, body?.password);
      return jsonResponse(result);
    }

    if (apiPath === 'webdav/backup') {
      const { backupToWebdav } = await getWebdavService();
      const result = await backupToWebdav(body?.url, body?.username, body?.password, body?.data);
      return jsonResponse(result);
    }

    if (apiPath === 'webdav/restore') {
      const { restoreFromWebdav } = await getWebdavService();
      const result = await restoreFromWebdav(body?.url, body?.username, body?.password);
      return jsonResponse(result);
    }

    if (apiPath === 'webdav/process-corrections') {
      const { processCorrections } = await getNavService();
      const result = await processCorrections(body?.url, body?.username, body?.password);
      return jsonResponse(result);
    }

    // ========================================================
    // TRADE ANALYSIS
    // ========================================================
    if (apiPath === 'analyze-trade-points') {
      const { analyzeTradePoints } = await getTradeService();
      const result = await analyzeTradePoints(body?.records || []);
      return jsonResponse(result);
    }

    // ========================================================
    // SIP PLANNER RESEARCH
    // ========================================================
    if (apiPath === 'sipplanner/research') {
      const { researchSipInfo } = await getSipService();
      const result = await researchSipInfo({
        symbol: body?.symbol || '',
        name: body?.name || '',
        dateStr: body?.dateStr || '',
        marketId: body?.marketId || '',
      });
      return jsonResponse(result);
    }

    console.warn(`[API Router] Unknown endpoint: /api/${apiPath}`);
    return null; // Let the original fetch handle unknown routes
  } catch (err: any) {
    console.error(`[API Router] Error handling /api/${apiPath}:`, err);
    return jsonErrorResponse(err.message || 'Internal error');
  }
}

function jsonResponse(data: any): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonErrorResponse(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
