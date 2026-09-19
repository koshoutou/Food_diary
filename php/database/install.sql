-- ============================================================
-- 家·肴（Food Diary）· PHP 版 MySQL 初始化脚本
-- 适用：MySQL 5.7+ / MariaDB 10.2+
-- 说明：使用 CREATE TABLE IF NOT EXISTS + INSERT IGNORE，可安全重复执行，不会清空已有数据
-- 用法：
--   方式一（命令行）  mysql -u root -p food_diary < database/install.sql
--   方式二（本项目脚本） php tools/init_db.php
--   方式三（phpMyAdmin） 导入本文件
-- ============================================================

-- 如尚未建库，先取消下面两行注释并改成自己的库名（需管理员权限）
-- CREATE DATABASE IF NOT EXISTS food_diary DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE food_diary;

-- ---------- 1. 管理员表 ----------
CREATE TABLE IF NOT EXISTS admin (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username   VARCHAR(64)  NOT NULL DEFAULT 'koshoutou' COMMENT '登录用户名',
  password   CHAR(64)     NOT NULL COMMENT 'SHA-256(明文密码)',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_admin_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员账号';

-- ---------- 2. 系统设置表（key-value 形态） ----------
CREATE TABLE IF NOT EXISTS settings (
  `key`       VARCHAR(64) NOT NULL COMMENT '设置项名称',
  `value`     TEXT        NOT NULL COMMENT '设置项取值',
  updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统设置';

-- ---------- 3. 菜品表 ----------
CREATE TABLE IF NOT EXISTS dishes (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(255) NOT NULL COMMENT '菜品名称',
  notes      TEXT         NULL     COMMENT '备注 / 做法',
  sort_order INT          NOT NULL DEFAULT 0 COMMENT '手动排序序号，越小越靠前',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_dishes_created_at (created_at),
  KEY idx_dishes_sort_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜品';

-- ---------- 4. 菜品图片关联表 ----------
CREATE TABLE IF NOT EXISTS dish_images (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  dish_id     INT UNSIGNED NOT NULL COMMENT '所属菜品 ID',
  storage_key VARCHAR(512) NOT NULL COMMENT '存储键：本地相对路径（R2 版为对象键）',
  image_url   VARCHAR(1024) NOT NULL COMMENT '对外访问地址',
  sort_order  INT          NOT NULL DEFAULT 0 COMMENT '图片排序序号',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_dish_images_dish_id (dish_id),
  KEY idx_dish_images_sort    (dish_id, sort_order),
  CONSTRAINT fk_dish_images_dish FOREIGN KEY (dish_id) REFERENCES dishes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜品图片';

-- ---------- 5. 默认管理员 ----------
-- 默认账号：koshoutou   默认密码：koshoutou
-- 部署后请立即修改，方法见 README「修改管理员密码」章节
INSERT IGNORE INTO admin (username, password) VALUES (
  'koshoutou',
  'aa0427ccf0071d8ea22a9697fabd95653d2c957065c723450af04bd17720e8dd'
);

-- ---------- 6. 默认设置 ----------
-- sort_by_time = 1：首页按创建时间倒序（最新菜品在最前）
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('sort_by_time', '1');
