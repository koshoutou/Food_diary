<?php
/**
 * 图片上传（需登录）
 *   POST api/upload.php  multipart/form-data
 *     - file    图片文件
 *     - dishId  可选；传入时表示向已有菜品追加图片，并直接写入 dish_images
 *
 * 不传 dishId 时只保存文件并返回 url / storage_key，由后续创建菜品时统一关联。
 */

require_once __DIR__ . '/../includes/bootstrap.php';
handle_options();

if (request_method() !== 'POST') {
    json_error('不支持的请求方法：' . request_method(), 405);
}

require_login();

if (!isset($_FILES['file'])) {
    json_error('没有上传文件', 400);
}

$dishId = isset($_POST['dishId']) ? (int) $_POST['dishId'] : 0;
if ($dishId <= 0 && isset($_POST['dish_id'])) {
    $dishId = (int) $_POST['dish_id'];
}

// 追加图片模式：先确认菜品存在
if ($dishId > 0) {
    $dish = db_first('SELECT id FROM dishes WHERE id = ? LIMIT 1', array($dishId));
    if (!$dish) {
        json_error('菜品不存在，ID：' . $dishId, 404);
    }
}

// 兼容单文件与多文件（多文件时使用与 CF 版一致的逐个上传方式）
$files = array();
if (is_array($_FILES['file']['name'])) {
    foreach ($_FILES['file']['name'] as $i => $name) {
        $files[] = array(
            'name'     => $name,
            'type'     => $_FILES['file']['type'][$i],
            'tmp_name' => $_FILES['file']['tmp_name'][$i],
            'error'    => $_FILES['file']['error'][$i],
            'size'     => $_FILES['file']['size'][$i],
        );
    }
} else {
    $files[] = $_FILES['file'];
}

$uploaded = array();

foreach ($files as $file) {
    $saved = storage_save($file);
    $imageId = null;

    if ($dishId > 0) {
        $maxRow    = db_first('SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM dish_images WHERE dish_id = ?', array($dishId));
        $sortOrder = ((int) ($maxRow ? $maxRow['max_sort'] : -1)) + 1;

        db_execute(
            'INSERT INTO dish_images (dish_id, storage_key, image_url, sort_order) VALUES (?, ?, ?, ?)',
            array($dishId, $saved['storage_key'], $saved['url'], $sortOrder)
        );
        $imageId = (int) db()->lastInsertId();

        if (!$imageId) {
            // 数据库写入失败，回滚已保存的文件
            storage_delete($saved['storage_key']);
            json_error('图片保存到数据库失败', 500);
        }
    }

    $uploaded[] = array(
        'image_url'   => $saved['url'],
        'storage_key' => $saved['storage_key'],
        'filename'    => $file['name'],
        'size'        => $saved['size'],
        'image_id'    => $imageId,
    );
}

if (count($uploaded) === 0) {
    json_error('没有有效的上传文件', 400);
}

json_success(array(
    'message' => $dishId > 0
        ? '成功追加 ' . count($uploaded) . ' 张图片到菜品 ' . $dishId
        : '成功上传 ' . count($uploaded) . ' 张图片',
    'images'  => $uploaded,
    'count'   => count($uploaded),
));
