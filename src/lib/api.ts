/**
 * API utility — standalone APK operation.
 * Intercepts /api/* fetch calls and routes them to local service implementations.
 * No server dependency required.
 */

export function getApiBaseUrl(): string {
  return ''; // Always local — deprecated, kept for compatibility
}

export function setApiBaseUrl(_url: string): void {
  // No-op — standalone mode doesn't use remote server
}

/**
 * Install a global fetch interceptor that routes /api/* calls to local services.
 * Call once at app startup in main.tsx.
 */
export function installApiInterceptor(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);

    // Intercept relative /api/* calls
    if (url.startsWith('/api/')) {
      try {
        // Dynamic import to avoid circular deps and enable code splitting
        const { handleApiRequest } = await import('../services/api-router');
        const response = await handleApiRequest(url, init);
        if (response) {
          return response;
        }
      } catch (err) {
        console.warn('[API Interceptor] Local handler failed, falling back to fetch:', err);
      }
    }

    // Fall through to original fetch (for dev mode with actual server, or external URLs)
    return originalFetch(input, init);
  };
}
