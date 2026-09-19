<?php
/**
 * 数据库与上传配置
 *
 * 两种配置方式，任选其一：
 *   1. 直接修改本文件的默认值（适合虚拟主机 / 共享主机）
 *   2. 设置环境变量 DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASS（适合容器与云部署）
 * 环境变量优先级高于本文件的默认值。
 */

return array(
    'db' => array(
        'host'    => getenv('DB_HOST') ? getenv('DB_HOST') : '127.0.0.1',
        'port'    => getenv('DB_PORT') ? getenv('DB_PORT') : '3306',
        'name'    => getenv('DB_NAME') ? getenv('DB_NAME') : 'food_diary',
        'user'    => getenv('DB_USER') ? getenv('DB_USER') : 'root',
        'pass'    => getenv('DB_PASS') !== false ? getenv('DB_PASS') : '',
        'charset' => 'utf8mb4',
    ),

    'upload' => array(
        // 单张图片体积上限（字节），默认 10 MB
        'max_size'     => 10 * 1024 * 1024,
        // 允许的图片真实 MIME 类型（由服务端 finfo 检测，不信任浏览器提交的类型）
        'allowed_mime' => array(
            'image/jpeg' => 'jpg',
            'image/png'  => 'png',
            'image/gif'  => 'gif',
            'image/webp' => 'webp',
            'image/bmp'  => 'bmp',
        ),
    ),
);
