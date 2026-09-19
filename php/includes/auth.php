<?php
/**
 * 管理员鉴权：基于 PHP 原生 Session
 * 密码校验使用 SHA-256，与 Cloudflare Pages 版保持一致，便于两套部署共用同一份账号数据
 */

function session_boot()
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
           || (isset($_SERVER['SERVER_PORT']) && (int) $_SERVER['SERVER_PORT'] === 443);

    ini_set('session.cookie_httponly', '1');   // 禁止 JS 读取 Cookie，缓解 XSS 窃取会话
    ini_set('session.cookie_samesite', 'Lax'); // 缓解 CSRF
    ini_set('session.use_strict_mode', '1');   // 拒绝客户端伪造的会话 ID
    if ($secure) {
        ini_set('session.cookie_secure', '1'); // 全站 HTTPS 时仅通过 HTTPS 传输
    }

    session_name('fd_session');
    session_start();
}

/**
 * 校验用户名 + 密码，成功后写入会话
 * @return string|false 成功返回用户名，失败返回 false
 */
function admin_login($username, $password)
{
    $admin = db_first('SELECT id, username, password FROM admin WHERE username = ? LIMIT 1', array($username));

    // 用户名不存在与密码错误返回同样的结果，避免暴露账号是否存在
    if (!$admin) {
        return false;
    }
    if (!hash_equals($admin['password'], hash('sha256', $password))) {
        return false;
    }

    session_boot();
    session_regenerate_id(true);               // 登录后更换会话 ID，防止会话固定攻击
    $_SESSION['admin_id']   = (int) $admin['id'];
    $_SESSION['admin_name'] = $admin['username'];

    return $admin['username'];
}

function admin_logout()
{
    session_boot();
    $_SESSION = array();
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
}

function is_logged_in()
{
    session_boot();
    return !empty($_SESSION['admin_id']);
}

function current_admin()
{
    session_boot();
    return isset($_SESSION['admin_name']) ? $_SESSION['admin_name'] : null;
}

// 未登录时直接返回 401 并终止
function require_login()
{
    if (!is_logged_in()) {
        json_error('未登录', 401);
    }
}
