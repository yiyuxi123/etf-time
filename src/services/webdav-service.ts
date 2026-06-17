/**
 * WebDAV Service - Ported from server.ts WebDAV endpoints.
 * Uses fetch() directly (Capacitor WebView doesn't enforce CORS for native scheme URLs).
 */

/**
 * Format and sanitize a WebDAV URL, appending the standard backup filename
 * and encoding non-ASCII characters.
 */
export function getWebdavUrl(inputUrl: string): string {
  let cleanUrl = (inputUrl || '').trim();
  if (!cleanUrl) {
    cleanUrl = 'https://dav.jianguoyun.com/dav/我的坚果云/';
  }

  // If it's a plain root URL for Jianguoyun, automatically direct it to the standard sync folder
  const stripped = cleanUrl.replace(/\/+$/, '');
  if (stripped === 'https://dav.jianguoyun.com/dav') {
    cleanUrl = 'https://dav.jianguoyun.com/dav/我的坚果云/';
  }

  if (!cleanUrl.endsWith('.json')) {
    if (!cleanUrl.endsWith('/')) {
      cleanUrl += '/';
    }
    cleanUrl += 'us_market_strategy_backup.json';
  }

  // Handled plain file directly in root if it still slips through
  if (cleanUrl === 'https://dav.jianguoyun.com/dav/us_market_strategy_backup.json') {
    cleanUrl = 'https://dav.jianguoyun.com/dav/我的坚果云/us_market_strategy_backup.json';
  }

  // Safely encode non-ASCII characters such as "我的坚果云" for Request URL
  return encodeURI(cleanUrl);
}

/**
 * Generate a Basic Authentication header value.
 */
export function getWebdavAuthHeader(username: string, password: string): string {
  const credentials = `${username.trim()}:${password.trim()}`;
  return `Basic ${btoa(credentials)}`;
}

/**
 * Test a WebDAV connection by sending a GET request to probe the backup file.
 */
export async function testWebdavConnection(
  url: string,
  username: string,
  password: string
): Promise<{ success: boolean; fileExists: boolean; message: string }> {
  if (!username || !password) {
    return { success: false, fileExists: false, message: '请输入账户和密码' };
  }

  try {
    const cleanUrl = getWebdavUrl(url);
    console.log(`[WebDAV Test] Connecting to: ${cleanUrl} as user: ${username}`);

    const response = await fetch(cleanUrl, {
      method: 'GET',
      headers: {
        Authorization: getWebdavAuthHeader(username, password),
      },
    });

    if (response.status === 401) {
      return {
        success: false,
        fileExists: false,
        message: '账户密码验证失败，请检查是否启用了第三方应用授权密码',
      };
    }

    if (response.status === 404) {
      return {
        success: true,
        fileExists: false,
        message: '连接成功！尚未创建云端备份文件，可以直接执行首次备份。',
      };
    }

    if (!response.ok) {
      return {
        success: false,
        fileExists: false,
        message: `连接服务器异常 码:${response.status}`,
      };
    }

    return {
      success: true,
      fileExists: true,
      message: '连接成功，云端已存在备份文件，可恢复数据。',
    };
  } catch (err: any) {
    console.error('[WebDAV Test Error]', err);
    return {
      success: false,
      fileExists: false,
      message: `无法连接到 WebDAV 服务器: ${err.message}`,
    };
  }
}

/**
 * Backup data to WebDAV server via PUT request.
 */
export async function backupToWebdav(
  url: string,
  username: string,
  password: string,
  data: any
): Promise<{ success: boolean; message: string }> {
  if (!username || !password) {
    return { success: false, message: '需要账户和密码' };
  }

  try {
    const cleanUrl = getWebdavUrl(url);
    console.log(`[WebDAV Backup] Uploading backup to: ${cleanUrl}`);

    const backupPayload = {
      updatedAt: new Date().toISOString(),
      client: 'US Market Strategy Applet',
      store: data,
    };

    const response = await fetch(cleanUrl, {
      method: 'PUT',
      headers: {
        Authorization: getWebdavAuthHeader(username, password),
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(backupPayload, null, 2),
    });

    if (response.status === 401) {
      return { success: false, message: '账户密码验证失败，备份未保存' };
    }

    if (response.status !== 200 && response.status !== 201 && response.status !== 204) {
      let textErr = '';
      try {
        textErr = await response.text();
      } catch (e) {
        // ignore
      }
      return {
        success: false,
        message: `备份上传失败，状态码: ${response.status}. ${textErr.slice(0, 100)}`,
      };
    }

    return { success: true, message: '数据成功保存至云端！' };
  } catch (err: any) {
    console.error('[WebDAV Backup Error]', err);
    return { success: false, message: `备份请求发送失败: ${err.message}` };
  }
}

/**
 * Restore data from WebDAV server via GET request.
 */
export async function restoreFromWebdav(
  url: string,
  username: string,
  password: string
): Promise<{ success: boolean; data?: any; message?: string }> {
  if (!username || !password) {
    return { success: false, message: '需要账户和密码' };
  }

  try {
    const cleanUrl = getWebdavUrl(url);
    console.log(`[WebDAV Restore] Downloading backup from: ${cleanUrl}`);

    const response = await fetch(cleanUrl, {
      method: 'GET',
      headers: {
        Authorization: getWebdavAuthHeader(username, password),
      },
    });

    if (response.status === 401) {
      return { success: false, message: '账户密码验证失败，无法恢复' };
    }

    if (response.status === 404) {
      return { success: false, message: '云端未找到备份文件，请先点击备份数据！' };
    }

    if (!response.ok) {
      return { success: false, message: `拉取备份失败，状态码: ${response.status}` };
    }

    const jsonText = await response.text();
    let payload: any;
    try {
      payload = JSON.parse(jsonText);
    } catch (e) {
      return { success: false, message: '云端备份文件内容不合法，不是有效的 JSON' };
    }

    return { success: true, data: payload };
  } catch (err: any) {
    console.error('[WebDAV Restore Error]', err);
    return { success: false, message: `获取备份请求发送失败: ${err.message}` };
  }
}
