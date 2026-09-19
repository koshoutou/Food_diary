import { validateSession, successResponse, errorResponse, corsHeaders } from '../_utils.js';

// 删除单张图片（需登录）
export async function onRequestDelete(context) {
  const { request, env } = context;
  const { DB, IMAGES } = env;

  try {
    if (!await validateSession(request, env)) return errorResponse('未登录', 401);

    const body = await request.json();
    const { id } = body;
    if (!id) return errorResponse('图片ID不能为空', 400);

    const image = await DB.prepare(
      'SELECT storage_key, dish_id, sort_order FROM dish_images WHERE id = ?'
    ).bind(id).first();
    if (!image) return errorResponse('图片不存在', 404);

    // 删除对象存储中的文件
    if (image.storage_key) {
      try { await IMAGES.delete(image.storage_key); } catch (e) { /* 忽略 */ }
    }

    // 删除数据库记录
    await DB.prepare('DELETE FROM dish_images WHERE id = ?').bind(id).run();

    // 同菜品内后续图片排序号整体前移
    await DB.prepare(
      'UPDATE dish_images SET sort_order = sort_order - 1 WHERE dish_id = ? AND sort_order > ?'
    ).bind(image.dish_id, image.sort_order).run();

    return successResponse({ message: '图片删除成功' });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
