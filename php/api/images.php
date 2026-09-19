<?php
/**
 * 删除单张图片（需登录）
 *   DELETE api/images.php  { "id": 图片ID }
 */

require_once __DIR__ . '/../includes/bootstrap.php';
handle_options();

if (request_method() !== 'DELETE') {
    json_error('不支持的请求方法：' . request_method(), 405);
}

require_login();

$data = json_body();
$id   = int_param($data, 'id');

if ($id <= 0) {
    json_error('图片ID不能为空', 400);
}

$image = db_first('SELECT storage_key, dish_id, sort_order FROM dish_images WHERE id = ? LIMIT 1', array($id));
if (!$image) {
    json_error('图片不存在', 404);
}

// 删除磁盘文件
storage_delete($image['storage_key']);

// 删除数据库记录
db_execute('DELETE FROM dish_images WHERE id = ?', array($id));

// 同菜品内后续图片排序号整体前移
db_execute(
    'UPDATE dish_images SET sort_order = sort_order - 1 WHERE dish_id = ? AND sort_order > ?',
    array((int) $image['dish_id'], (int) $image['sort_order'])
);

json_success(array('message' => '图片删除成功'));
