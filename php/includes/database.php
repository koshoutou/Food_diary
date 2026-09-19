<?php
/**
 * 数据库层：基于 PDO 的单例连接
 * 全部查询均使用预处理语句，杜绝 SQL 注入
 */

function db()
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $config = require __DIR__ . '/config.php';
    $db = $config['db'];

    $dsn = 'mysql:host=' . $db['host'] . ';port=' . $db['port']
         . ';dbname=' . $db['name'] . ';charset=' . $db['charset'];

    try {
        $pdo = new PDO($dsn, $db['user'], $db['pass'], array(
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ));
    } catch (PDOException $e) {
        json_error('数据库连接失败，请检查 php/includes/config.php 配置。原始错误：' . $e->getMessage(), 500);
    }

    return $pdo;
}

// 读取单条记录
function db_first($sql, $params = array())
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

// 读取多条记录
function db_all($sql, $params = array())
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

// 写入 / 更新 / 删除
function db_execute($sql, $params = array())
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->rowCount();
}
