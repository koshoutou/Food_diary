import { validateSession, successResponse, errorResponse, corsHeaders } from '../_utils.js';

// 获取首页排序设置（公开接口）
export async function onRequestGet(context) {
  const { env } = context;
  const { DB } = env;

  try {
    const setting = await DB.prepare(
      "SELECT value FROM settings WHERE key = 'sort_by_time'"
    ).first();

    // 默认按时间排序
    const sortByTime = setting ? (setting.value === '1') : true;

    return successResponse({ sort_by_time: sortByTime });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 更新首页排序设置（需登录）
export async function onRequestPut(context) {
  const { request, env } = context;
  const { DB } = env;

  try {
    if (!await validateSession(request, env)) return errorResponse('未登录', 401);

    const body = await request.json();
    const { sort_by_time } = body;

    if (sort_by_time === undefined || sort_by_time === null) {
      return errorResponse('缺少 sort_by_time 参数', 400);
    }

    const value = sort_by_time ? '1' : '0';

    // UPSERT：存在则更新，不存在则插入
    await DB.prepare(
      `INSERT INTO settings (key, value) VALUES ('sort_by_time', ?)
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`
    ).bind(value, value).run();

    return successResponse({ message: '排序设置已更新', sort_by_time });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
