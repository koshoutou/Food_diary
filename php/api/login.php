<?php
/**
 * 登录 / 登录状态 / 退出登录
 *   GET    api/login.php  查询当前登录状态
 *   POST   api/login.php  提交 username + password 登录
 *   DELETE api/login.php  退出登录
 */

require_once __DIR__ . '/../includes/bootstrap.php';
handle_options();

$method = request_method();

if ($method === 'GET') {
    json_success(array(
        'authenticated' => is_logged_in(),
        'username'      => current_admin(),
    ));
}

if ($method === 'POST') {
    $data     = json_body();
    $username = str_param($data, 'username');
    $password = isset($data['password']) ? (string) $data['password'] : '';

    if ($username === '') {
        json_error('请输入用户名', 400);
    }
    if ($password === '') {
        json_error('请输入密码', 400);
    }

    $name = admin_login($username, $password);
    if ($name === false) {
        json_error('用户名或密码错误', 401);
    }

    json_success(array('message' => '登录成功', 'username' => $name));
}

if ($method === 'DELETE') {
    admin_logout();
    json_success(array('message' => '已退出登录'));
}

json_error('不支持的请求方法：' . $method, 405);
