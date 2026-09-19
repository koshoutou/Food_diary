// ============================================================
// 公共工具库（Cloudflare Pages Functions）
// 职责：密码哈希、服务端会话、multipart 解析、统一响应封装
// ============================================================

const SESSION_COOKIE = 'session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 会话有效期 7 天

// ---------- 密码哈希 ----------

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password) {
  return await sha256(password);
}

export async function verifyPassword(password, storedHash) {
  if (!password || !storedHash) return false;
  const hash = await sha256(password);
  // 定长逐字符比较，避免通过响应耗时侧信道推测哈希前缀
  if (hash.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  return diff === 0;
}

// ---------- 服务端会话 ----------
// 登录成功后生成随机 token 写入 sessions 表，Cookie 仅保存 token。
// 相比「Cookie 里直接写 session=authenticated」，本方案无法被客户端伪造。

export function getCookie(request, name) {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return null;
  for (const part of cookie.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export async function createSession(env) {
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await env.DB.prepare(
    'INSERT INTO sessions (token, expires_at) VALUES (?, ?)'
  ).bind(token, expiresAt).run();
  return { token, expiresAt };
}

export async function validateSession(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return false;

  const row = await env.DB.prepare(
    'SELECT expires_at FROM sessions WHERE token = ?'
  ).bind(token).first();
  if (!row) return false;

  // ISO-8601 字符串的字典序等价于时间序，可直接比较
  if (row.expires_at <= new Date().toISOString()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return false;
  }
  return true;
}

export async function destroySession(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (token) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }
}

export function buildSessionCookie(token, request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}

export function buildClearCookie(request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

// ---------- multipart 解析 ----------
// 兼容浏览器 FormData 与二进制文件（PNG / WebP 等）

export function parseContentDisposition(header) {
  const result = {};
  const parts = header.split(';');
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    const idx = part.indexOf('=');
    if (idx > 0) {
      const key = part.substring(0, idx).trim();
      let value = part.substring(idx + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      result[key] = value;
    }
  }
  return result;
}

export function findBytes(haystack, needle, start = 0) {
  for (let i = start; i <= haystack.length - needle.length; i++) {
    let found = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) { found = false; break; }
    }
    if (found) return i;
  }
  return -1;
}

export function parseMultipart(buffer, boundary) {
  // 清理 boundary：去除可能的引号和前后空白
  const cleanBoundary = boundary.replace(/^["']|["']$/g, '').trim();
  const boundaryBytes = new TextEncoder().encode('--' + cleanBoundary);
  // 真正的 boundary 前一定有 \r\n（multipart 规范），
  // 搜索 \r\n--boundary 而非裸的 --boundary，避免二进制文件数据误匹配
  const crlfBoundary = new Uint8Array([13, 10, ...boundaryBytes]);
  const results = { files: [], fields: {} };

  const firstBoundary = findBytes(buffer, boundaryBytes, 0);
  if (firstBoundary === -1) return results;

  let searchStart = firstBoundary + boundaryBytes.length;

  while (searchStart < buffer.length) {
    let nextBoundaryIdx = findBytes(buffer, crlfBoundary, searchStart);
    if (nextBoundaryIdx === -1) {
      // 最后一个 boundary 前可能没有 \r\n（直接 --boundary--）
      nextBoundaryIdx = findBytes(buffer, boundaryBytes, searchStart);
      if (nextBoundaryIdx === -1) break;
    } else {
      nextBoundaryIdx += 2;
    }

    const section = buffer.slice(searchStart, nextBoundaryIdx);

    let sectionStart = 0;
    if (section.length >= 2 && section[0] === 13 && section[1] === 10) sectionStart = 2;

    const headerSep = new Uint8Array([13, 10, 13, 10]);
    const headerEnd = findBytes(section, headerSep, sectionStart);

    if (headerEnd > 0) {
      const headersStr = new TextDecoder().decode(section.slice(sectionStart, headerEnd));
      const bodyStart = headerEnd + 4;
      // 去除 body 末尾的 \r\n（boundary 前的 CRLF）
      let bodyEnd = section.length;
      if (bodyEnd > bodyStart && section[bodyEnd - 1] === 10) bodyEnd--;
      if (bodyEnd > bodyStart && section[bodyEnd - 1] === 13) bodyEnd--;
      const body = section.slice(bodyStart, bodyEnd);

      const contentDisposition = headersStr.match(/Content-Disposition:[^\r\n]+/i);
      if (contentDisposition) {
        const params = parseContentDisposition(contentDisposition[0]);
        const filename = params.filename;
        const name = params.name || '';

        const contentTypeMatch = headersStr.match(/Content-Type:[^\r\n]+/i);
        const contentType = contentTypeMatch ? contentTypeMatch[0].split(':')[1].trim() : 'application/octet-stream';

        // 判断是否为文件：有 filename 且不为空字符串
        const isFile = filename !== undefined && filename !== null && filename !== '';

        if (isFile) {
          results.files.push({ name: filename, type: contentType, data: body });
        } else if (name !== undefined && name !== null && name !== '') {
          results.fields[name] = new TextDecoder().decode(body).trim();
        }
      }
    }

    searchStart = nextBoundaryIdx + boundaryBytes.length;
  }

  return results;
}

// ---------- 统一响应 ----------

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
}

export function errorResponse(message, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), { status, headers: corsHeaders() });
}

export function successResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status,
    headers: { ...corsHeaders(), ...extraHeaders }
  });
}
