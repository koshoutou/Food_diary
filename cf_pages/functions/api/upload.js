import { parseMultipart, validateSession, successResponse, errorResponse, corsHeaders } from '../_utils.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 单张图片上限 10 MB

// 图片上传（需登录）
// - 不带 dishId：仅上传对象存储，返回 url / storage_key，由后续创建菜品时关联
// - 带 dishId：上传后直接写入 dish_images（追加图片模式）
export async function onRequestPost(context) {
  const { request, env } = context;
  const { IMAGES, DB } = env;

  try {
    if (!await validateSession(request, env)) return errorResponse('未登录', 401);

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return errorResponse('Content-Type 必须是 multipart/form-data', 400);
    }

    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
    if (!boundaryMatch) return errorResponse('无效的 multipart boundary', 400);
    const boundary = boundaryMatch[1] || boundaryMatch[2];

    const buffer = await request.arrayBuffer();
    const result = parseMultipart(new Uint8Array(buffer), boundary);

    if (result.files.length === 0) return errorResponse('没有上传文件', 400);

    // dishId 可选：创建菜品时无 dishId，追加图片时有 dishId
    const rawDishId = (result.fields.dishId || result.fields.dish_id || '').trim();
    const dishId = rawDishId ? parseInt(rawDishId, 10) : null;

    if (dishId && !isNaN(dishId) && dishId > 0) {
      const dish = await DB.prepare('SELECT id FROM dishes WHERE id = ?').bind(dishId).first();
      if (!dish) return errorResponse('菜品不存在，ID: ' + dishId, 404);
    }

    const baseUrl = new URL(request.url).origin;
    const uploadedImages = [];
    const uploadedKeys = [];

    for (const file of result.files) {
      if (file.data.length === 0) continue;

      // 只接受图片，且限制体积，避免存储桶被滥用
      if (!file.type.startsWith('image/')) {
        return errorResponse('只允许上传图片文件', 400);
      }
      if (file.data.length > MAX_FILE_SIZE) {
        return errorResponse('单张图片不能超过 10 MB', 400);
      }

      const hasExt = file.name.includes('.');
      const ext = (hasExt ? file.name.split('.').pop() : 'jpg').toLowerCase();
      const baseName = hasExt ? file.name.substring(0, file.name.lastIndexOf('.')) : file.name;
      // 用随机后缀避免同名覆盖，同时保留原文件名便于排查
      const uniqueSuffix = crypto.randomUUID().substring(0, 8);
      const safeBase = baseName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_').substring(0, 40);
      const storageKey = `dish/${safeBase}_${uniqueSuffix}.${ext}`;

      await IMAGES.put(storageKey, file.data, {
        httpMetadata: { contentType: file.type || 'image/jpeg' }
      });
      uploadedKeys.push(storageKey);

      const imageUrl = `${baseUrl}/dish/${encodeURIComponent(storageKey.replace('dish/', ''))}`;
      let imageId = null;

      if (dishId && !isNaN(dishId) && dishId > 0) {
        const maxSort = await DB.prepare(
          'SELECT COALESCE(MAX(sort_order), -1) as max_sort FROM dish_images WHERE dish_id = ?'
        ).bind(dishId).first();
        const sortOrder = (maxSort?.max_sort ?? -1) + 1;

        const dbResult = await DB.prepare(
          'INSERT INTO dish_images (dish_id, storage_key, image_url, sort_order) VALUES (?, ?, ?) RETURNING id'
        ).bind(dishId, storageKey, imageUrl, sortOrder).first();
        imageId = dbResult?.id || null;

        if (!imageId) {
          // 数据库写入失败，回滚已上传的对象
          try { await IMAGES.delete(storageKey); } catch (e) { /* 忽略 */ }
          return errorResponse('图片保存到数据库失败', 500);
        }
      }

      uploadedImages.push({
        image_url: imageUrl,
        storage_key: storageKey,
        filename: file.name,
        size: file.data.length,
        image_id: imageId
      });
    }

    if (uploadedImages.length === 0) return errorResponse('没有有效的上传文件', 400);

    return successResponse({
      message: dishId
        ? `成功追加 ${uploadedImages.length} 张图片到菜品 ${dishId}`
        : `成功上传 ${uploadedImages.length} 张图片`,
      images: uploadedImages,
      count: uploadedImages.length
    });
  } catch (error) {
    console.error('Upload error:', error);
    return errorResponse(error.message, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
