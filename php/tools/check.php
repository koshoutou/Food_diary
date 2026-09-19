<?php
/**
 * 部署环境自检工具（命令行）
 * 依次检查：PHP 版本、PDO 扩展、数据库连接、数据表、上传目录权限
 * 用法：php tools/check.php
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('本脚本仅限命令行执行');
}

$pass = 0;
$fail = 0;

function check_line($label, $ok, $detail = '')
{
    global $pass, $fail;
    $ok ? $pass++ : $fail++;
    $flag = $ok ? '[通过]' : '[失败]';
    echo sprintf("%s %-28s %s\n", $flag, $label, $detail);
}

echo "===== 家·肴 PHP 版 部署环境自检 =====\n\n";

// 1. PHP 版本
$phpOk = version_compare(PHP_VERSION, '7.2.0', '>=');
check_line('PHP 版本 >= 7.2', $phpOk, PHP_VERSION);

// 2. 必需扩展
check_line('PDO 扩展', extension_loaded('pdo'), '');
check_line('pdo_mysql 扩展', extension_loaded('pdo_mysql'), '');
check_line('fileinfo 扩展', extension_loaded('fileinfo'), '用于检测上传图片真实类型');
check_line('GD / mbstring（可选）', extension_loaded('gd') || extension_loaded('mbstring'), '');

// 3. 数据库连接与数据表
try {
    $pdo = db();
    check_line('数据库连接', true, '已连接');
} catch (Exception $e) {
    check_line('数据库连接', false, $e->getMessage());
    echo "\n数据库连接失败，请检查 php/includes/config.php\n";
    exit(1);
}

$tables = array('admin', 'settings', 'dishes', 'dish_images');
foreach ($tables as $table) {
    try {
        $row = db_first('SELECT COUNT(*) AS c FROM ' . $table);
        check_line("数据表 {$table}", true, '记录数 ' . (int) $row['c']);
    } catch (Exception $e) {
        check_line("数据表 {$table}", false, '不存在，请执行 php tools/init_db.php');
    }
}

// 4. 管理员账号
try {
    $admin = db_first('SELECT username FROM admin LIMIT 1');
    check_line('管理员账号', (bool) $admin, $admin ? $admin['username'] : 'admin 表为空');
} catch (Exception $e) {
    check_line('管理员账号', false, '查询失败');
}

// 5. 上传目录
$uploadOk = is_dir(UPLOAD_DIR) && is_writable(UPLOAD_DIR);
check_line('uploads 目录可写', $uploadOk, UPLOAD_DIR);

echo "\n===== 汇总：通过 {$pass} 项，失败 {$fail} 项 =====\n";
exit($fail > 0 ? 1 : 0);
