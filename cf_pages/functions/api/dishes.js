import { validateSession, successResponse, errorResponse, corsHeaders } from '../_utils.js';

// 获取菜品列表（公开接口，支持分页 / 搜索 / 排序）
export async function onRequestGet(context) {
  const { request, env } = context;
  const { DB } = env;
  const url = new URL(request.url);

  try {
    const page = parseInt(url.searchParams.get('page')) || 1;
    const limit = parseInt(url.searchParams.get('limit')) || 12;
    const search = url.searchParams.get('search') || '';
    const clientSortParam = url.searchParams.get('sortByTime');

    // 排序策略：
    //  - 客户端显式传了 sortByTime → 使用客户端值（管理页固定按手动排序）
    //  - 客户端未传          → 读取 settings 表中管理员的设置
    let sortByTime;
    if (clientSortParam !== null && clientSortParam !== undefined) {
      sortByTime = clientSortParam !== '0';
    } else {
      const setting = await DB.prepare(
        "SELECT value FROM settings WHERE key = 'sort_by_time'"
      ).first();
      sortByTime = setting ? (setting.value === '1') : true;
    }

    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [];
    if (search) {
      whereClause = 'WHERE d.name LIKE ?';
      params.push(`%${search}%`);
    }

    const orderBy = sortByTime ? 'd.created_at DESC' : 'd.sort_order ASC, d.created_at DESC';

    const countResult = await DB.prepare(
      `SELECT COUNT(*) as total FROM dishes d ${whereClause}`
    ).bind(...params).first();
    const total = countResult?.total || 0;

    const dishesResult = await DB.prepare(
      `SELECT d.id, d.name, d.notes, d.created_at, d.updated_at, d.sort_order
       FROM dishes d ${whereClause}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    // 一次性取出当前页所有菜品图片，避免 N+1 查询
    const dishes = dishesResult.results || [];
    const dishIds = dishes.map(d => d.id);
    let imagesMap = {};
    if (dishIds.length > 0) {
      const placeholders = dishIds.map(() => '?').join(',');
      const imagesResult = await DB.prepare(
        `SELECT id, dish_id, image_url, storage_key, sort_order
         FROM dish_images WHERE dish_id IN (${placeholders})
         ORDER BY sort_order ASC, id ASC`
      ).bind(...dishIds).all();
      (imagesResult.results || []).forEach(img => {
        if (!imagesMap[img.dish_id]) imagesMap[img.dish_id] = [];
        imagesMap[img.dish_id].push({
          id: img.id, url: img.image_url, storage_key: img.storage_key, sort_order: img.sort_order
        });
      });
    }

    const data = dishes.map(dish => ({ ...dish, images: imagesMap[dish.id] || [] }));

    return successResponse({
      data,
      sort_by_time: sortByTime,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 创建菜品（需登录）
export async function onRequestPost(context) {
  const { request, env } = context;
  const { DB } = env;

  try {
    if (!await validateSession(request, env)) return errorResponse('未登录', 401);

    const body = await request.json();
    const { name, notes, images } = body;
    if (!name) return errorResponse('菜品名称不能为空', 400);

    const maxSort = await DB.prepare('SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM dishes').first();
    const sortOrder = (maxSort?.max_sort ?? 0) + 1;

    const dishResult = await DB.prepare(
      'INSERT INTO dishes (name, notes, sort_order) VALUES (?, ?, ?) RETURNING id'
    ).bind(name, notes || '', sortOrder).first();

    const dishId = dishResult?.id;
    if (!dishId) return errorResponse('创建菜品失败', 500);

    if (Array.isArray(images)) {
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        await DB.prepare(
          'INSERT INTO dish_images (dish_id, storage_key, image_url, sort_order) VALUES (?, ?, ?, ?)'
        ).bind(dishId, img.storage_key || '', img.url || '', i).run();
      }
    }

    return successResponse({ message: '菜品创建成功', id: dishId });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 更新菜品（需登录）
export async function onRequestPut(context) {
  const { request, env } = context;
  const { DB } = env;

  try {
    if (!await validateSession(request, env)) return errorResponse('未登录', 401);

    const body = await request.json();
    const { id, name, notes } = body;
    if (!id) return errorResponse('菜品ID不能为空', 400);
    if (!name) return errorResponse('菜品名称不能为空', 400);

    await DB.prepare(
      'UPDATE dishes SET name = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(name, notes || '', id).run();

    return successResponse({ message: '菜品更新成功' });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 删除菜品及其图片（需登录）
export async function onRequestDelete(context) {
  const { request, env } = context;
  const { DB, IMAGES } = env;

  try {
    if (!await validateSession(request, env)) return errorResponse('未登录', 401);

    const body = await request.json();
    const { id } = body;
    if (!id) return errorResponse('菜品ID不能为空', 400);

    const dish = await DB.prepare('SELECT sort_order FROM dishes WHERE id = ?').bind(id).first();

    // 先清理对象存储中的文件，再删数据库记录
    const images = await DB.prepare('SELECT storage_key FROM dish_images WHERE dish_id = ?').bind(id).all();
    for (const img of (images.results || [])) {
      if (img.storage_key) {
        try { await IMAGES.delete(img.storage_key); } catch (e) { /* 忽略单个文件删除失败 */ }
      }
    }

    await DB.prepare('DELETE FROM dish_images WHERE dish_id = ?').bind(id).run();
    await DB.prepare('DELETE FROM dishes WHERE id = ?').bind(id).run();

    // 删除后把后续菜品的排序号整体前移，保持 sort_order 连续
    if (dish) {
      await DB.prepare(
        'UPDATE dishes SET sort_order = sort_order - 1 WHERE sort_order > ?'
      ).bind(dish.sort_order).run();
    }

    return successResponse({ message: '菜品删除成功' });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
