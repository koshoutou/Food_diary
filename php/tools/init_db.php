<?php
/**
 * 数据库初始化工具（命令行）
 *
 * 直接读取 php/includes/config.php 的连接信息，导入 database/install.sql
 * 用法：php tools/init_db.php
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('本脚本仅限命令行执行');
}

$sqlFile = __DIR__ . '/../database/install.sql';
if (!is_file($sqlFile)) {
    exit("找不到数据库脚本：{$sqlFile}\n");
}

$sql = file_get_contents($sqlFile);
if ($sql === false) {
    exit("读取数据库脚本失败\n");
}

try {
    $pdo = db();
} catch (Exception $e) {
    exit("数据库连接失败：" . $e->getMessage() . "\n");
}

// 按分号切分执行；脚本中不含存储过程，简单切分即可
$statements = array_filter(array_map('trim', explode(';', $sql)));
$okCount    = 0;

foreach ($statements as $statement) {
    // 跳过纯注释块
    $stripped = preg_replace('/^\s*--.*$/m', '', $statement);
    if (trim($stripped) === '') {
        continue;
    }
    try {
        $pdo->exec($statement);
        $okCount++;
    } catch (PDOException $e) {
        echo "[跳过] " . substr($statement, 0, 60) . " ... 原因：" . $e->getMessage() . "\n";
    }
}

echo "执行完成，成功 {$okCount} 条语句。\n";
echo "默认账号：koshoutou   默认密码：koshoutou（请尽快修改）\n";
