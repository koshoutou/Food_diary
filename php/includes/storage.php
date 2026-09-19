<?php
/**
 * 图片存储层（本地文件系统）
 *
 * Cloudflare 版对应的是 R2 对象存储；PHP 版改用本地 uploads/ 目录，
 * 由 Web 服务器直接以静态文件方式提供访问，性能更好且不占用 PHP 进程。
 */

/**
 * 保存一个上传文件
 * @param array $file $_FILES 中的单个元素
 * @return array storage_key / url / size / mime
 */
function storage_save($file)
{
    $config  = require __DIR__ . '/config.php';
    $maxSize = $config['upload']['max_size'];
    $extMap  = $config['upload']['allowed_mime'];

    if (!isset($file['error']) || is_array($file['error'])) {
        json_error('上传参数错误', 400);
    }

    switch ($file['error']) {
        case UPLOAD_ERR_OK:
            break;
        case UPLOAD_ERR_INI_SIZE:
        case UPLOAD_ERR_FORM_SIZE:
            json_error('文件超过服务器允许的大小（php.ini upload_max_filesize）', 400);
        case UPLOAD_ERR_NO_FILE:
            json_error('没有收到文件', 400);
        default:
            json_error('文件上传失败，错误码：' . $file['error'], 400);
    }

    if ($file['size'] > $maxSize) {
        json_error('单张图片不能超过 ' . format_bytes($maxSize), 400);
    }

    // 用 finfo 检测真实 MIME，不信任浏览器提交的 Content-Type
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime  = $finfo->file($file['tmp_name']);
    if (!isset($extMap[$mime])) {
        json_error('只允许上传 JPG / PNG / GIF / WebP / BMP 图片', 400);
    }

    $subDir    = date('Y') . '/' . date('m');
    $targetDir = UPLOAD_DIR . '/' . $subDir;
    if (!is_dir($targetDir) && !mkdir($targetDir, 0755, true)) {
        json_error('无法创建上传目录，请确认 uploads/ 目录可写', 500);
    }

    // 随机文件名，避免覆盖与路径穿越
    $fileName = bin2hex(random_bytes(16)) . '.' . $extMap[$mime];

    if (!move_uploaded_file($file['tmp_name'], $targetDir . '/' . $fileName)) {
        json_error('保存文件失败，请确认 uploads/ 目录可写', 500);
    }

    $key = $subDir . '/' . $fileName;

    return array(
        'storage_key' => $key,
        'url'         => UPLOAD_URL_PREFIX . $key,
        'size'        => (int) $file['size'],
        'mime'        => $mime,
    );
}

/**
 * 删除已存储的图片
 * @param string $key 存储键（如 2026/09/xxxx.jpg）
 */
function storage_delete($key)
{
    if ($key === '' || $key === null) {
        return false;
    }
    // 阻断目录穿越
    if (strpos($key, '..') !== false || strpos($key, "\0") !== false) {
        return false;
    }

    $path = UPLOAD_DIR . '/' . ltrim($key, '/');
    $real = realpath($path);
    $root = realpath(UPLOAD_DIR);

    if ($real === false || $root === false || strpos($real, $root) !== 0) {
        return false;
    }
    if (is_file($real)) {
        @unlink($real);
        return true;
    }
    return false;
}
