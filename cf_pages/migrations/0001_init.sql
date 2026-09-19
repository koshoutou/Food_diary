-- ============================================================
-- 家·肴（Food Diary）· Cloudflare D1 / SQLite 初始化脚本
-- 版本：v1.1
-- 说明：会先删除同名旧表再重建，仅用于首次部署或重置数据
-- 执行：npx wrangler d1 execute cuisines-db --file=./migrations/0001_init.sql
-- ============================================================

-- ---------- 1. 清理旧表 ----------
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS dish_images;
DROP TABLE IF EXISTS dishes;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS admin;

-- ---------- 2. 管理员表 ----------
CREATE TABLE admin (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT UNIQUE NOT NULL DEFAULT 'koshoutou',
  password   TEXT NOT NULL,                       -- SHA-256(明文密码)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- 3. 会话表（Cloudflare 版的服务端会话） ----------
-- PHP 版使用 PHP 原生 Session，不需要这张表
CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

-- ---------- 4. 系统设置表（key-value 形态） ----------
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- 5. 菜品表 ----------
CREATE TABLE dishes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  notes      TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- 6. 菜品图片关联表 ----------
CREATE TABLE dish_images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  dish_id    INTEGER NOT NULL,
  storage_key     TEXT NOT NULL,                       -- 存储键：R2 对象键 / 本地相对路径
  image_url  TEXT NOT NULL,                       -- 对外可访问 URL
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE
);

-- ---------- 7. 默认管理员 ----------
-- 默认账号：koshoutou   默认密码：koshoutou
-- 部署后请立即修改，方法见 README「修改管理员密码」章节
INSERT INTO admin (username, password) VALUES (
  'koshoutou',
  'aa0427ccf0071d8ea22a9697fabd95653d2c957065c723450af04bd17720e8dd'
);

-- ---------- 8. 默认设置 ----------
-- sort_by_time = 1：首页按创建时间倒序（最新菜品在最前）
INSERT INTO settings (key, value) VALUES ('sort_by_time', '1');

-- ---------- 9. 索引 ----------
CREATE INDEX idx_dishes_created_at       ON dishes(created_at DESC);
CREATE INDEX idx_dishes_sort_order       ON dishes(sort_order ASC);
CREATE INDEX idx_dish_images_dish_id     ON dish_images(dish_id);
CREATE INDEX idx_dish_images_sort_order  ON dish_images(dish_id, sort_order ASC);
CREATE INDEX idx_dish_images_storage_key      ON dish_images(storage_key);
CREATE INDEX idx_sessions_expires_at     ON sessions(expires_at);
