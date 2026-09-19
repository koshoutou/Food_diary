<?php
/**
 * 图片排序：按传入顺序重新编号 sort_order（需登录）
 *   PUT api/image-sort.php  { "imageIds": [3, 1, 2] }
 */

require_once __DIR__ . '/../includes/bootstrap.php';
handle_options();

if (request_method() !== 'PUT') {
    json_error('不支持的请求方法：' . request_method(), 405);
}

require_login();

$data     = json_body();
$imageIds = isset($data['imageIds']) ? $data['imageIds'] : null;

if (!is_array($imageIds)) {
    json_error('需要 imageIds 数组', 400);
}

$i = 0;
foreach ($imageIds as $imageId) {
    db_execute('UPDATE dish_images SET sort_order = ? WHERE id = ?', array($i++, (int) $imageId));
}

json_success(array('message' => '图片排序更新成功'));
