<?php
/**
 * 应用引导：定义路径常量并加载公共库
 * 所有入口（api/*.php、index.php、admin.php、tools/*.php）都先引入本文件
 */

define('APP_ROOT', dirname(__DIR__));                 // php/ 目录
define('UPLOAD_DIR', APP_ROOT . DIRECTORY_SEPARATOR . 'uploads');   // 图片存储目录（服务器绝对路径）
define('UPLOAD_URL_PREFIX', 'uploads/');              // 图片访问前缀（相对站点根，便于部署在子目录）

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/storage.php';
