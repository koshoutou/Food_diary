import { validateSession, successResponse, errorResponse, corsHeaders } from '../_utils.js';

// 图片排序：按传入的 imageIds 顺序重新编号 sort_order（需登录）
export async function onRequestPut(context) {
  const { request, env } = context;
  const { DB } = env;

  try {
    if (!await validateSession(request, env)) return errorResponse('未登录', 401);

    const body = await request.json();
    const { imageIds } = body;

    if (!imageIds || !Array.isArray(imageIds)) {
      return errorResponse('需要 imageIds 数组', 400);
    }

    for (let i = 0; i < imageIds.length; i++) {
      await DB.prepare(
        'UPDATE dish_images SET sort_order = ? WHERE id = ?'
      ).bind(i, imageIds[i]).run();
    }

    return successResponse({ message: '图片排序更新成功' });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
