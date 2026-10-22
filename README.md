# 赛事通 · 高校赛事管理平台

一个前后端分离的高校赛事管理系统，覆盖**学生、教师、赛事负责人、超级管理员**四类角色的组队报名全流程。

## 技术栈

| 端 | 技术 |
| --- | --- |
| 前端 | Vue 3 + Vite + Element Plus + Pinia + Vue Router + Axios |
| 后端 | Node.js + Express + MySQL 8（mysql2 连接池，参数化 SQL 防注入） |
| 鉴权 | JWT（access + refresh 双令牌）+ bcrypt 密码哈希 + RBAC 角色权限 |

## 目录结构

```
campus-competition/
├── backend/
│   ├── sql/init.sql            # 建库建表 + 字典种子
│   ├── src/
│   │   ├── config/             # 配置、MySQL 连接池
│   │   ├── middleware/         # 鉴权、错误处理
│   │   ├── services/           # 业务逻辑（账号/档案/赛事/组队/邀请/通知/管理）
│   │   ├── routes/             # REST 路由
│   │   ├── utils/              # 响应、JWT、密码、工具
│   │   ├── app.js / server.js  # 入口
│   │   └── seed.js             # 演示数据
│   └── .env                    # 环境配置
└── frontend/
    └── src/
        ├── views/              # 页面
        ├── layouts/            # 布局
        ├── store/  api/  router/  utils/
```

## 快速启动

### 1. 初始化数据库（需本机 MySQL 8）

```bash
```bash
cd backend
# 先建库（init.sql 不硬编码 USE，需由调用方指定库）
mysql -uroot -p -e "CREATE DATABASE IF NOT EXISTS tzb DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
mysql -uroot -p tzb < sql/init.sql
```

> 旧库升级：若此前用早期版本 `init.sql` 建过库（缺少 `verification_code.attempts` 列），执行 `mysql -uroot -p tzb < sql/upgrade-2026-10-22.sql` 即可（幂等）。

### 2. 配置后端

编辑 `backend/.env`，填对数据库账号密码：

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的密码
DB_NAME=tzb
```

### 3. 启动后端（默认 8080）

```bash
cd backend
npm install
npm run seed    # 首次运行，初始化演示数据
npm run dev     # 或 npm start
```

### 4. 启动前端（默认 5173）

```bash
cd frontend
npm install
npm run dev
```

浏览器访问 http://localhost:5173

## 演示账号

| 角色 | 账号 | 密码 |
| --- | --- | --- |
| 超级管理员 | admin | admin123 |
| 赛事负责人 | manager | manager123 |
| 教师 | teacher1 / teacher2 | 123456 |
| 学生 | student1 ~ student6 | 123456 |

## 核心功能

- **账号**：注册、登录、JWT 刷新（轮换 + 重放吊销）、修改/找回密码、失败锁定（5 次锁 15 分钟，到期自动解锁）
- **档案**：学生/教师/负责人档案维护、头像上传、身份认证提交与审核
- **赛事**：负责人发布/编辑/下架/归档（状态机校验）、赛道配置、组队时间窗、公开广场、统计
- **组队**：建队、邀请队友、入队申请、邀请老师、老师挑学生、转让队长、退出/移出、锁定、负责人分配老师
- **找队友/找老师**：招募广场、教师公开主页、学生检索（按技能/学院/学历）
- **通知**：站内信（邀请/队伍/系统）、未读计数、已读
- **管理**：用户管理、认证审核、字典管理、审计日志、运营统计

## 测试

```bash
cd backend
npm test                 # 冒烟测试（自包含，可重复运行，需后端已启动）
npm run verify           # 修复回归验证（自包含，需后端已启动）
```

## 安全与已知限制（如实说明）

- 密码 bcrypt 哈希、SQL 全参数化、RBAC 四角色权限、入队并发用 `SELECT ... FOR UPDATE`。
- 找回密码验证码**默认不回传**（仅打服务端日志）；本地自测需在 `.env` 设 `DEV_EXPOSE_CODE=1` 才会在响应里返回 `devCode`。生产环境应接入邮件服务。
- 文件上传仅允许图片（png/jpg/jpeg/gif/webp），静态目录带 `X-Content-Type-Options: nosniff`。
- 令牌目前存于 `localStorage`（便于演示），存在 XSS 窃取风险；生产建议改为 httpOnly Cookie。
- 表结构未加外键约束、无软删除（`account.status='DELETED'` 仅为状态位），统计口径需注意。

## 设计说明

原需求文档描述了 4 业务微服务 + gRPC + 网关 + Redis + MQ + MinIO 的架构。为保证比赛演示**可稳定运行、便于评审**，本实现采用**模块化单体后端**（services 目录按「账号、档案、赛事、组队、邀请、通知、管理」清晰分层，与微服务边界一一对应，后续可平滑拆分）。
