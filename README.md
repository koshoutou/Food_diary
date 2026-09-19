# 家·肴 · Food Diary

> 记录家里的味道，留住那些复刻不出来的味道。

- **在线示例**：[cuisine.ixiaocang.cn](https://cuisine.ixiaocang.cn)
- **源码仓库**：[github.com/koshoutou/Food_diary](https://github.com/koshoutou/Food_diary)

---

## 项目动机

倘若有一天离开家乡，父母不在了，没有胃口、不知道吃什么的时候——还能记起家里的饭菜吗？

那些散落在手机相册里的菜品照片，那些藏在聊天记录里的做法片段，如果没有一个地方好好整理，终究会被时间冲淡。

**家·肴**就是为这件事而生的：趁还在家的时候，把每一道爸妈拿手菜记录下来——菜名、做法、照片，一道一道地存好。等到将来独自生活的那一天，打开这个页面，至少还能照着复刻出家的味道。

这不是一个面向所有人的美食社区，只是一个人为自己和家人准备的厨房备忘录。

---

## 关于作者

| 项目 | 信息 |
|------|------|
| 作者 | koshoutou（Inkcoo） |
| 院校 | 湖南农业大学 |
| 方向 | 自学 AI 全栈开发，关注 AI 应用工程与 Web 产品设计 |
| 联系方式 | GitHub：[@koshoutou](https://github.com/koshoutou) |

---

## 功能介绍

### 浏览端

| 功能 | 说明 |
|------|------|
| 菜品瀑布流 | 卡片式布局，多图预览，点击进入灯箱大图浏览 |
| 灯箱查看 | 支持左右切换、缩略图跳转、键盘方向键操作、ESC 关闭 |
| 名称搜索 | 服务端模糊匹配，快速找到想复刻的那道菜 |
| 分页浏览 | 首页每页 12 条，流畅加载 |
| 暗色/亮色主题 | 跟随系统偏好，也可手动切换并自动记忆 |

### 管理端

| 功能 | 说明 |
|------|------|
| 账号登录 | 用户名 + 密码校验，服务端会话，7 天有效期 |
| 新增菜品 | 填写菜名与备注，批量上传图片，支持拖拽 |
| 编辑/删除菜品 | 修改信息或删除菜品及其全部关联图片 |
| 追加/删除图片 | 向已有菜品补充照片，或删除不满意的单张 |
| 菜品排序 | 上移/下移手动调整展示顺序 |
| 图片排序 | 拖拽调整每道菜的照片排列 |
| 排序策略切换 | 一键切换"按时间"或"按手动顺序"展示 |

### 工程特性

| 特性 | 说明 |
|------|------|
| 上传安全 | 服务端 MIME 类型检测，体积上限 10 MB，随机文件名 |
| 环境自检 | 一条命令检查 PHP 版本、扩展、数据库连通性、目录权限 |
| 两套部署 | PHP + MySQL（通用虚拟主机）与 Cloudflare Pages（零成本边缘部署），数据模型完全一致，可平滑迁移 |

---

## 快速开始

**PHP 版（推荐，10 分钟跑起来）**

```bash
# 1. 建库并导入表结构
mysql -u root -p -e "CREATE DATABASE food_diary DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p food_diary < php/database/install.sql

# 2. 修改数据库配置
vim php/includes/config.php      # 填写 host / name / user / pass

# 3. 启动
php -S localhost:8000 -t php     # PHP 内置服务器
# 或将 php/ 目录内容上传虚拟主机，绑定域名后直接访问
```

打开 `http://localhost:8000` 看到首页，访问 `/admin.php` 登录管理后台。

**Cloudflare Pages 版**

```bash
cd cf_pages
npm install
npx wrangler d1 create cuisines-db          # 把返回的 database_id 填入 wrangler.toml
npx wrangler r2 bucket create cuisines-images
npx wrangler d1 execute cuisines-db --file=./migrations/0001_init.sql
npm run build && npx wrangler pages deploy dist
```

> 两套部署的账号密码、数据表结构完全一致，可平滑迁移。

---

## 技术栈

| 层级 | PHP + MySQL 版 | Cloudflare Pages 版 |
|------|----------------|---------------------|
| 运行时 | PHP 7.2+ | Cloudflare Workers（V8） |
| 数据库 | MySQL 5.7+ / MariaDB 10.2+ | Cloudflare D1 |
| 对象存储 | 本地文件系统 | Cloudflare R2 |
| 后端 | 原生 PHP + PDO | Pages Functions（ES Module） |
| 前端 | 原生 HTML / CSS / JavaScript，无框架 | 同左（共用同一份脚本） |
| 会话 | PHP Session（HttpOnly + SameSite） | D1 sessions 表 + HttpOnly Cookie |
| 构建 | 无构建步骤，上传即用 | Vite（多入口打包）+ Wrangler CLI |

---

## 目录结构

```
Food_diary/
├── README.md                  # 本文档
├── LICENSE                    # MIT 许可证
├── .gitignore
│
├── php/                       # ★ 主项目：PHP + MySQL
│   ├── index.php              # 首页
│   ├── admin.php              # 管理页
│   ├── .htaccess              # Apache 安全与缓存配置
│   ├── api/                   # 接口（真实 .php 文件，无需 URL 重写）
│   │   ├── login.php          #   登录 / 状态 / 登出
│   │   ├── dishes.php         #   菜品增删改查
│   │   ├── upload.php         #   图片上传
│   │   ├── images.php         #   删除单张图片
│   │   ├── sort.php           #   菜品排序
│   │   ├── image-sort.php     #   图片排序
│   │   └── settings.php       #   首页排序策略
│   ├── includes/              # 内部库（Web 禁止访问）
│   ├── assets/                # 前端静态资源
│   ├── uploads/               # 运行时图片目录
│   ├── database/install.sql   # MySQL 建表 + 默认数据
│   └── tools/                 # 命令行工具
│
└── cf_pages/                  # Cloudflare Pages 版
    ├── functions/             # Pages Functions（后端）
    ├── src/                   # 前端源码（Vite 入口）
    ├── migrations/0001_init.sql
    ├── wrangler.toml
    ├── vite.config.js
    └── package.json
```

---

## 部署流程

### 方案 A：PHP + MySQL（主项目）

**环境要求**

| 项目 | 要求 |
|------|------|
| PHP | 7.2 及以上 |
| 数据库 | MySQL 5.7+ 或 MariaDB 10.2+ |
| PHP 扩展 | `pdo_mysql`（必需）、`fileinfo`（图片类型检测） |
| 目录权限 | `php/uploads/` 需可写（0755 或 0775） |

**步骤**

1. 把 `php/` 目录内容上传到站点根目录，或将站点根目录指向 `php/`。
2. 创建数据库并导入表结构：`mysql -u root -p food_diary < php/database/install.sql`
3. 编辑 `php/includes/config.php` 填写数据库连接信息（也支持环境变量 `DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASS`）。
4. 确认 `php/uploads/` 存在且可写。
5. 运行 `php tools/check.php` 自检，全部通过即部署完成。
6. **立即修改默认密码**。

### 方案 B：Cloudflare Pages（免费边缘部署）

1. 注册 [Cloudflare](https://dash.cloudflare.com/sign-up) 并安装 Wrangler（需 Node.js 18+）。
2. 创建 D1 数据库，将返回的 `database_id` 填入 `wrangler.toml`。
3. 创建 R2 存储桶：`npx wrangler r2 bucket create cuisines-images`
4. 初始化表结构：`npx wrangler d1 execute cuisines-db --file=./migrations/0001_init.sql`
5. 构建并部署：`npm run build && npx wrangler pages deploy dist`

---

## 管理员账号

| 项目 | 默认值 |
|------|--------|
| 用户名 | `koshoutou` |
| 密码 | `koshoutou` |

> **部署完成后请第一时间修改密码。** PHP 版可使用命令行工具：`php tools/hash_password.php 新密码`

---

## 安全设计

| 风险 | 防护措施 |
|------|----------|
| SQL 注入 | 全部查询使用 PDO 预处理 / D1 参数绑定 |
| XSS | 前端渲染时统一 `escapeHtml` |
| 上传 Getshell | `finfo` 检测真实 MIME；随机文件名；`uploads/` 禁止执行 PHP |
| 目录穿越 | 存储键过滤 `..`，`realpath` 校验路径 |
| 会话劫持 | Cookie 设 HttpOnly + SameSite=Lax，HTTPS 下自动加 Secure |
| 口令爆破 | 用户名不存在与密码错误返回相同提示 |

---

## 开源许可

本项目基于 **MIT License** 开源，可自由使用、修改与二次分发，使用时请保留原作者署名。详见 [LICENSE](./LICENSE)。
