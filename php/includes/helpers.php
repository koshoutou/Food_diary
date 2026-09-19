<?php
/**
 * 通用辅助函数：统一 JSON 响应、请求参数读取
 */

function json_response($data, $status = 200)
{
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('X-Content-Type-Options: nosniff');
    }
    // 204 No Content 不允许携带响应体
    if ($status !== 204) {
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    exit;
}

function json_success($extra = array(), $status = 200)
{
    json_response(array_merge(array('success' => true), $extra), $status);
}

function json_error($message, $status = 400)
{
    json_response(array('success' => false, 'error' => $message), $status);
}

function request_method()
{
    return isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : 'GET';
}

// 处理跨域预检请求
function handle_options()
{
    if (request_method() === 'OPTIONS') {
        json_response(array(), 204);
    }
}

// 读取 JSON 请求体（PUT / DELETE 也能正常读取）
function json_body()
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return array();
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : array();
}

function str_param($data, $key, $default = '')
{
    return isset($data[$key]) ? trim((string) $data[$key]) : $default;
}

function int_param($data, $key, $default = 0)
{
    return isset($data[$key]) ? (int) $data[$key] : $default;
}

function format_bytes($bytes)
{
    $units = array('B', 'KB', 'MB', 'GB');
    $i = 0;
    $bytes = (float) $bytes;
    while ($bytes >= 1024 && $i < count($units) - 1) {
        $bytes /= 1024;
        $i++;
    }
    return ($i === 0 ? (int) $bytes : round($bytes, 1)) . ' ' . $units[$i];
}
