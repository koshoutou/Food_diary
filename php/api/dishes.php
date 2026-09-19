<?php
/**
 * 菜品接口
 *   GET    api/dishes.php            列表（公开，支持 page / limit / search / sortByTime）
 *   POST   api/dishes.php            创建（需登录）
 *   PUT    api/dishes.php            更新（需登录）
 *   DELETE api/dishes.php            删除（需登录）
 */

require_once __DIR__ . '/../includes/bootstrap.php';
handle_options();

$method = request_method();

// ---------- 列表（公开） ----------
if ($method === 'GET') {
    $page   = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
    $limit  = isset($_GET['limit']) ? (int) $_GET['limit'] : 12;
    $limit  = min(100, max(1, $limit));
    $search = isset($_GET['search']) ? trim((string) $_GET['search']) : '';

    // 排序策略：客户端显式传 sortByTime 则以客户端为准（管理页固定手动排序），
    // 否则读取 settings 表中管理员保存的设置
    if (isset($_GET['sortByTime'])) {
        $sortByTime = ((string) $_GET['sortByTime']) !== '0';
    } else {
        $row        = db_first("SELECT `value` FROM settings WHERE `key` = 'sort_by_time' LIMIT 1");
        $sortByTime = $row ? ($row['value'] === '1') : true;
    }

    $where  = '';
    $params = array();
    if ($search !== '') {
        $where    = 'WHERE d.name LIKE ?';
        $params[] = '%' . $search . '%';
    }

    $orderBy = $sortByTime ? 'd.created_at DESC' : 'd.sort_order ASC, d.created_at DESC';
    $offset  = ($page - 1) * $limit;

    $countRow = db_first('SELECT COUNT(*) AS total FROM dishes d ' . $where, $params);
    $total    = $countRow ? (int) $countRow['total'] : 0;

    // LIMIT / OFFSET 必须整型内联，部分驱动下占位符会被当作字符串导致语法错误
    $rows = db_all(
        'SELECT d.id, d.name, d.notes, d.created_at, d.updated_at, d.sort_order
         FROM dishes d ' . $where . '
         ORDER BY ' . $orderBy . '
         LIMIT ' . $limit . ' OFFSET ' . $offset,
        $params
    );

    // 一次性取出本页所有图片，避免 N+1 查询
    $imagesMap = array();
    if (count($rows) > 0) {
        $ids          = array();
        foreach ($rows as $r) {
            $ids[] = (int) $r['id'];
        }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $images       = db_all(
            'SELECT id, dish_id, image_url, storage_key, sort_order
             FROM dish_images
             WHERE dish_id IN (' . $placeholders . ')
             ORDER BY sort_order ASC, id ASC',
            $ids
        );
        foreach ($images as $img) {
            $imagesMap[$img['dish_id']][] = array(
                'id'          => (int) $img['id'],
                'url'         => $img['image_url'],
                'storage_key' => $img['storage_key'],
                'sort_order'  => (int) $img['sort_order'],
            );
        }
    }

    $data = array();
    foreach ($rows as $r) {
        $r['id']         = (int) $r['id'];
        $r['sort_order'] = (int) $r['sort_order'];
        $r['notes']      = $r['notes'] === null ? '' : $r['notes'];
        $r['images']     = isset($imagesMap[$r['id']]) ? $imagesMap[$r['id']] : array();
        $data[]          = $r;
    }

    json_success(array(
        'data'        => $data,
        'sort_by_time' => $sortByTime,
        'pagination'  => array(
            'page'  => $page,
            'limit' => $limit,
            'total' => $total,
            'pages' => (int) ceil($total / $limit),
        ),
    ));
}

// ---------- 创建（需登录） ----------
if ($method === 'POST') {
    require_login();

    $data     = json_body();
    $name     = str_param($data, 'name');
    $notes    = str_param($data, 'notes');
    $images   = isset($data['images']) && is_array($data['images']) ? $data['images'] : array();

    if ($name === '') {
        json_error('菜品名称不能为空', 400);
    }

    $maxRow    = db_first('SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM dishes');
    $sortOrder = ((int) ($maxRow ? $maxRow['max_sort'] : 0)) + 1;

    db_execute('INSERT INTO dishes (name, notes, sort_order) VALUES (?, ?, ?)', array($name, $notes, $sortOrder));
    $dishId = (int) db()->lastInsertId();

    $i = 0;
    foreach ($images as $img) {
        db_execute(
            'INSERT INTO dish_images (dish_id, storage_key, image_url, sort_order) VALUES (?, ?, ?, ?)',
            array(
                $dishId,
                isset($img['storage_key']) ? $img['storage_key'] : '',
                isset($img['url']) ? $img['url'] : '',
                $i++
            )
        );
    }

    json_success(array('message' => '菜品创建成功', 'id' => $dishId));
}

// ---------- 更新（需登录） ----------
if ($method === 'PUT') {
    require_login();

    $data  = json_body();
    $id    = int_param($data, 'id');
    $name  = str_param($data, 'name');
    $notes = str_param($data, 'notes');

    if ($id <= 0) {
        json_error('菜品ID不能为空', 400);
    }
    if ($name === '') {
        json_error('菜品名称不能为空', 400);
    }

    db_execute('UPDATE dishes SET name = ?, notes = ?, updated_at = NOW() WHERE id = ?', array($name, $notes, $id));

    json_success(array('message' => '菜品更新成功'));
}

// ---------- 删除（需登录） ----------
if ($method === 'DELETE') {
    require_login();

    $data = json_body();
    $id   = int_param($data, 'id');

    if ($id <= 0) {
        json_error('菜品ID不能为空', 400);
    }

    $dish = db_first('SELECT sort_order FROM dishes WHERE id = ? LIMIT 1', array($id));

    // 先清理磁盘文件，再删数据库记录
    $images = db_all('SELECT storage_key FROM dish_images WHERE dish_id = ?', array($id));
    foreach ($images as $img) {
        storage_delete($img['storage_key']);
    }

    db_execute('DELETE FROM dish_images WHERE dish_id = ?', array($id));
    db_execute('DELETE FROM dishes WHERE id = ?', array($id));

    // 后续菜品排序号整体前移，保持 sort_order 连续
    if ($dish) {
        db_execute('UPDATE dishes SET sort_order = sort_order - 1 WHERE sort_order > ?', array((int) $dish['sort_order']));
    }

    json_success(array('message' => '菜品删除成功'));
}

json_error('不支持的请求方法：' . $method, 405);
