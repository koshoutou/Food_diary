<?php
/**
 * 修改管理员密码工具（命令行）
 *
 * 用法：
 *   php tools/hash_password.php 新密码              # 修改默认账号 koshoutou 的密码
 *   php tools/hash_password.php 新密码 用户名        # 修改指定账号的密码
 *   php tools/hash_password.php 新密码 --print-only  # 只打印哈希，不写数据库
 *
 * 说明：密码以 SHA-256 存储，与 Cloudflare Pages 版完全一致，
 *      因此同一份哈希值在两套部署中通用。
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('本脚本仅限命令行执行');
}

$args       = array_slice($argv, 1);
$printOnly  = false;
$positional = array();

foreach ($args as $arg) {
    if ($arg === '--print-only') {
        $printOnly = true;
    } else {
        $positional[] = $arg;
    }
}

if (count($positional) < 1) {
    echo "用法：php tools/hash_password.php 新密码 [用户名] [--print-only]\n";
    exit(1);
}

$password = $positional[0];
$username = isset($positional[1]) ? $positional[1] : 'koshoutou';
$hash     = hash('sha256', $password);

echo "用户名：{$username}\n";
echo "SHA-256 哈希：{$hash}\n";

if ($printOnly) {
    echo "\n（--print-only：未写入数据库。可手动执行下面的 SQL）\n";
    echo "UPDATE admin SET password = '{$hash}' WHERE username = '" . str_replace("'", "''", $username) . "';\n";
    exit(0);
}

try {
    $affected = db_execute('UPDATE admin SET password = ? WHERE username = ?', array($hash, $username));
} catch (Exception $e) {
    echo "\n写入数据库失败：" . $e->getMessage() . "\n";
    echo "请确认 php/includes/config.php 中的数据库配置正确，或改用 --print-only 手动执行 SQL。\n";
    exit(1);
}

if ($affected === 0) {
    echo "\n未更新任何记录：账号「{$username}」不存在。\n";
    exit(1);
}

echo "\n密码修改成功，请使用新密码登录管理页。\n";
