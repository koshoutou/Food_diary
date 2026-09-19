import { validateSession, successResponse, errorResponse, corsHeaders } from '../_utils.js';

// 菜品排序：交换两个菜品的 sort_order（需登录）
export async function onRequestPut(context) {
  const { request, env } = context;
  const { DB } = env;

  try {
    if (!await validateSession(request, env)) return errorResponse('未登录', 401);

    const body = await request.json();
    const { id1, id2 } = body;

    if (!id1 || !id2) return errorResponse('需要两个菜品ID', 400);

    const dish1 = await DB.prepare('SELECT sort_order FROM dishes WHERE id = ?').bind(id1).first();
    const dish2 = await DB.prepare('SELECT sort_order FROM dishes WHERE id = ?').bind(id2).first();

    if (!dish1 || !dish2) return errorResponse('菜品不存在', 404);

    await DB.prepare('UPDATE dishes SET sort_order = ? WHERE id = ?').bind(dish2.sort_order, id1).run();
    await DB.prepare('UPDATE dishes SET sort_order = ? WHERE id = ?').bind(dish1.sort_order, id2).run();

    return successResponse({ message: '排序更新成功' });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
