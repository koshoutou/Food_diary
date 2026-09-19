<?php
/**
 * 首页排序设置
 *   GET api/settings.php            读取（公开）
 *   PUT api/settings.php            修改（需登录）{ "sort_by_time": true }
 */

require_once __DIR__ . '/../includes/bootstrap.php';
handle_options();

$method = request_method();

if ($method === 'GET') {
    $row        = db_first("SELECT `value` FROM settings WHERE `key` = 'sort_by_time' LIMIT 1");
    $sortByTime = $row ? ($row['value'] === '1') : true;

    json_success(array('sort_by_time' => $sortByTime));
}

if ($method === 'PUT') {
    require_login();

    $data = json_body();
    if (!array_key_exists('sort_by_time', $data)) {
        json_error('缺少 sort_by_time 参数', 400);
    }

    $value = $data['sort_by_time'] ? '1' : '0';

    // UPSERT：存在则更新，不存在则插入
    db_execute(
        "INSERT INTO settings (`key`, `value`) VALUES ('sort_by_time', ?)
         ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), updated_at = NOW()",
        array($value)
    );

    json_success(array(
        'message'      => '排序设置已更新',
        'sort_by_time' => $data['sort_by_time'] ? true : false,
    ));
}

json_error('不支持的请求方法：' . $method, 405);
