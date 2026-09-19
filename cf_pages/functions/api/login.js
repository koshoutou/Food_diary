import {
  verifyPassword, validateSession, createSession, destroySession,
  buildSessionCookie, buildClearCookie,
  successResponse, errorResponse, corsHeaders
} from '../_utils.js';

// 查询登录状态（前端用于自动恢复登录）
export async function onRequestGet(context) {
  const { request, env } = context;
  const authenticated = await validateSession(request, env);
  return successResponse({ authenticated });
}

// 登录：校验「用户名 + 密码」，成功后下发服务端会话 Cookie
export async function onRequestPost(context) {
  const { request, env } = context;
  const { DB } = env;

  try {
    const body = await request.json();
    const username = (body.username || '').trim();
    const password = body.password || '';

    if (!username) return errorResponse('请输入用户名', 400);
    if (!password) return errorResponse('请输入密码', 400);

    const admin = await DB.prepare(
      'SELECT id, username, password FROM admin WHERE username = ?'
    ).bind(username).first();

    // 用户名不存在与密码错误返回同样的提示，避免暴露账号是否存在
    if (!admin) return errorResponse('用户名或密码错误', 401);

    const isValid = await verifyPassword(password, admin.password);
    if (!isValid) return errorResponse('用户名或密码错误', 401);

    const { token } = await createSession(env);

    return successResponse(
      { message: '登录成功', username: admin.username },
      200,
      { 'Set-Cookie': buildSessionCookie(token, request) }
    );
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 退出登录：删除服务端会话并清除 Cookie
export async function onRequestDelete(context) {
  const { request, env } = context;
  await destroySession(request, env);
  return successResponse({ message: '已退出登录' }, 200, { 'Set-Cookie': buildClearCookie(request) });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
