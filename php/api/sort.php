<?php
/**
 * 菜品排序：交换两个菜品的 sort_order（需登录）
 *   PUT api/sort.php  { "id1": 1, "id2": 2 }
 */

require_once __DIR__ . '/../includes/bootstrap.php';
handle_options();

if (request_method() !== 'PUT') {
    json_error('不支持的请求方法：' . request_method(), 405);
}

require_login();

$data = json_body();
$id1  = int_param($data, 'id1');
$id2  = int_param($data, 'id2');

if ($id1 <= 0 || $id2 <= 0) {
    json_error('需要两个菜品ID', 400);
}

$dish1 = db_first('SELECT sort_order FROM dishes WHERE id = ? LIMIT 1', array($id1));
$dish2 = db_first('SELECT sort_order FROM dishes WHERE id = ? LIMIT 1', array($id2));

if (!$dish1 || !$dish2) {
    json_error('菜品不存在', 404);
}

db_execute('UPDATE dishes SET sort_order = ? WHERE id = ?', array((int) $dish2['sort_order'], $id1));
db_execute('UPDATE dishes SET sort_order = ? WHERE id = ?', array((int) $dish1['sort_order'], $id2));

json_success(array('message' => '排序更新成功'));
