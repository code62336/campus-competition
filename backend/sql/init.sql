-- =====================================================================
--  高校赛事管理系统 · 数据库初始化脚本
--  数据库: MySQL 8.0 / InnoDB / utf8mb4
--  说明: 将设计文档中的多 schema(6~7) 合理合并为单库 `tzb`，保留核心字段与状态机。
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `tzb` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE `tzb`;

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1. 账号 account
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `account` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `username`        VARCHAR(64)  NOT NULL COMMENT '登录名（学号/工号）',
  `password_hash`   VARCHAR(100) NOT NULL COMMENT '密码哈希(bcrypt)',
  `user_type`       VARCHAR(16)  NOT NULL COMMENT '用户类型：STUDENT/TEACHER/MANAGER/ADMIN',
  `display_name`    VARCHAR(64)  NOT NULL COMMENT '显示名',
  `email`           VARCHAR(128) DEFAULT NULL COMMENT '邮箱',
  `email_verified`  TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '邮箱是否已验证',
  `phone`           VARCHAR(32)  DEFAULT NULL COMMENT '手机号(脱敏存储建议，demo 直接存)',
  `phone_verified`  TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '手机是否已验证',
  `status`          VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE/LOCKED/DISABLED/DELETED',
  `verify_status`   VARCHAR(16)  NOT NULL DEFAULT 'UNVERIFIED' COMMENT 'UNVERIFIED/PENDING_REVIEW/VERIFIED/REJECTED',
  `failed_count`    SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '连续登录失败次数',
  `locked_until`    DATETIME(3)  DEFAULT NULL COMMENT '锁定到期时间',
  `last_login_at`   DATETIME(3)  DEFAULT NULL,
  `last_login_ip`   VARCHAR(45)  DEFAULT NULL,
  `password_updated_at` DATETIME(3) DEFAULT NULL,
  `created_at`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  UNIQUE KEY `uk_email` (`email`),
  KEY `idx_type_status` (`user_type`, `status`),
  KEY `idx_verify_status` (`verify_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='账号';

-- ---------------------------------------------------------------------
-- 2. 字典 dict_item（学院/专业/技能标签/职称/赛事类别）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `dict_item` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `type`       VARCHAR(32)  NOT NULL COMMENT 'COLLEGE/MAJOR/SKILL_TAG/TITLE/CATEGORY',
  `code`       VARCHAR(64)  NOT NULL COMMENT '编码(类型内唯一)',
  `label`      VARCHAR(128) NOT NULL COMMENT '显示名',
  `sort`       INT NOT NULL DEFAULT 0,
  `parent_code` VARCHAR(64) DEFAULT NULL COMMENT '父编码(专业归属学院)',
  `enabled`    TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_type_code` (`type`, `code`),
  KEY `idx_type_sort` (`type`, `sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='字典';

-- ---------------------------------------------------------------------
-- 3. 用户档案 user_profile（学生 + 教师）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_profile` (
  `account_id`           BIGINT UNSIGNED NOT NULL COMMENT '=account.id',
  `user_type`            VARCHAR(16) NOT NULL COMMENT 'STUDENT/TEACHER',
  `real_name`            VARCHAR(64) NOT NULL,
  `student_no`           VARCHAR(32) DEFAULT NULL COMMENT '学号(学生)',
  `teacher_no`           VARCHAR(32) DEFAULT NULL COMMENT '工号(教师)',
  `gender`               VARCHAR(8)  DEFAULT NULL COMMENT 'M/F/U',
  `college_code`         VARCHAR(64) DEFAULT NULL COMMENT '学院 code(dict)',
  `major_code`           VARCHAR(64) DEFAULT NULL COMMENT '专业 code(dict)',
  `class_name`           VARCHAR(64) DEFAULT NULL,
  `enrollment_year`      SMALLINT UNSIGNED DEFAULT NULL,
  `graduation_year`      SMALLINT UNSIGNED DEFAULT NULL,
  `degree_level`         VARCHAR(16) DEFAULT NULL COMMENT 'BACHELOR/MASTER/DOCTOR',
  `title`                VARCHAR(32) DEFAULT NULL COMMENT '职称(教师)',
  `research_fields`      VARCHAR(255) DEFAULT NULL COMMENT '研究方向(教师)',
  `bio`                  TEXT DEFAULT NULL COMMENT '个人简介',
  `email_public`         VARCHAR(128) DEFAULT NULL COMMENT '可公开邮箱',
  `homepage_url`         VARCHAR(255) DEFAULT NULL,
  `skills`               JSON DEFAULT NULL COMMENT '技能标签数组(学生)',
  `allow_teacher_invite` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否允许老师邀请(学生)',
  `looking_for_team`     TINYINT(1) NOT NULL DEFAULT 0 COMMENT '公开找队伍(学生)',
  `accept_students`      TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否接受学生邀请(教师)',
  `max_teams`            SMALLINT UNSIGNED NOT NULL DEFAULT 3 COMMENT '带队上限(教师)',
  `avatar_file_id`       BIGINT UNSIGNED DEFAULT NULL,
  `avatar_url`           VARCHAR(255) DEFAULT NULL COMMENT '头像URL',
  `profile_completed`    TINYINT(1) NOT NULL DEFAULT 0,
  `created_at`           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`account_id`),
  UNIQUE KEY `uk_student_no` (`student_no`),
  UNIQUE KEY `uk_teacher_no` (`teacher_no`),
  KEY `idx_type` (`user_type`),
  KEY `idx_college` (`college_code`),
  KEY `idx_allow_invite` (`allow_teacher_invite`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户档案';

-- ---------------------------------------------------------------------
-- 4. 身份认证 user_verification
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_verification` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `account_id`   BIGINT UNSIGNED NOT NULL,
  `user_type`    VARCHAR(16) NOT NULL COMMENT 'STUDENT/TEACHER',
  `status`       VARCHAR(16) NOT NULL DEFAULT 'PENDING_REVIEW' COMMENT 'UNVERIFIED/PENDING_REVIEW/VERIFIED/REJECTED',
  `auto_matched` TINYINT(1) NOT NULL DEFAULT 0,
  `materials`    JSON DEFAULT NULL COMMENT '证明材料',
  `reason`       VARCHAR(255) DEFAULT NULL COMMENT '驳回原因',
  `reviewer_id`  BIGINT UNSIGNED DEFAULT NULL,
  `reviewed_at`  DATETIME(3) DEFAULT NULL,
  `created_at`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_account` (`account_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='身份认证';

-- ---------------------------------------------------------------------
-- 5. 赛事 competition
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `competition` (
  `id`                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code`                   VARCHAR(64) NOT NULL COMMENT '赛事编码',
  `title`                  VARCHAR(200) NOT NULL,
  `subtitle`               VARCHAR(200) DEFAULT NULL,
  `level`                  VARCHAR(16) NOT NULL COMMENT 'SCHOOL/COLLEGE',
  `college_code`           VARCHAR(64) DEFAULT NULL COMMENT '院赛所属学院',
  `year`                   SMALLINT UNSIGNED NOT NULL,
  `category`               VARCHAR(32) DEFAULT NULL,
  `organizer`              VARCHAR(128) DEFAULT NULL,
  `official_url`           VARCHAR(255) DEFAULT NULL,
  `description_md`         MEDIUMTEXT DEFAULT NULL,
  `cover_file_id`          BIGINT UNSIGNED DEFAULT NULL,
  `cover_url`              VARCHAR(255) DEFAULT NULL COMMENT '封面URL',
  `tracks_json`            JSON DEFAULT NULL COMMENT '赛道清单 [{id,name,quota,enabled}]',
  `register_start_at`      DATETIME(3) NOT NULL,
  `register_end_at`        DATETIME(3) NOT NULL,
  `status`                 VARCHAR(16) NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT/PUBLISHED/OFFLINE/ARCHIVED',
  `min_team_size`          TINYINT UNSIGNED NOT NULL DEFAULT 3,
  `max_team_size`          TINYINT UNSIGNED NOT NULL DEFAULT 8,
  `teacher_required`       TINYINT(1) NOT NULL DEFAULT 1,
  `max_teacher_count`      TINYINT UNSIGNED NOT NULL DEFAULT 2,
  `max_teams_per_teacher`  TINYINT UNSIGNED NOT NULL DEFAULT 3,
  `allow_cross_college`    TINYINT(1) NOT NULL DEFAULT 1,
  `published_at`           DATETIME(3) DEFAULT NULL,
  `archived_at`            DATETIME(3) DEFAULT NULL,
  `created_by`             BIGINT UNSIGNED NOT NULL,
  `created_at`             DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`             DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_status_end` (`status`, `register_end_at`),
  KEY `idx_level_year` (`level`, `year`),
  KEY `idx_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='赛事';

-- ---------------------------------------------------------------------
-- 6. 队伍 team
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `team` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `competition_id` BIGINT UNSIGNED NOT NULL,
  `track_id`       INT DEFAULT NULL COMMENT '赛道 id(对应 tracks_json 内 id)',
  `name`           VARCHAR(64) NOT NULL,
  `slogan`         VARCHAR(200) DEFAULT NULL,
  `college_code`   VARCHAR(64) DEFAULT NULL COMMENT '归属学院(队长学院)',
  `leader_id`      BIGINT UNSIGNED NOT NULL,
  `advisor_id`     BIGINT UNSIGNED DEFAULT NULL COMMENT '主指导老师',
  `status`         VARCHAR(16) NOT NULL DEFAULT 'RECRUITING' COMMENT 'RECRUITING/LOCKED/DISBANDED',
  `member_count`   TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `max_members`    TINYINT UNSIGNED NOT NULL DEFAULT 8,
  `recruiting`     TINYINT(1) NOT NULL DEFAULT 1,
  `locked_at`      DATETIME(3) DEFAULT NULL,
  `created_by`     BIGINT UNSIGNED NOT NULL,
  `created_at`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`competition_id`, `name`),
  KEY `idx_comp_status` (`competition_id`, `status`),
  KEY `idx_leader` (`leader_id`),
  KEY `idx_advisor` (`advisor_id`),
  KEY `idx_recruiting` (`competition_id`, `recruiting`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='队伍';

-- ---------------------------------------------------------------------
-- 7. 队伍成员 team_member（队员 + 指导老师）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `team_member` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `team_id`         BIGINT UNSIGNED NOT NULL,
  `account_id`      BIGINT UNSIGNED NOT NULL,
  `role`            VARCHAR(16) NOT NULL DEFAULT 'MEMBER' COMMENT 'LEADER/MEMBER/ADVISOR',
  `status`          VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE/LEFT/PENDING/REJECTED/RELEASED',
  `source`          VARCHAR(16) NOT NULL DEFAULT 'SELF' COMMENT 'SELF/INVITE/ASSIGN',
  `invited_by`      BIGINT UNSIGNED DEFAULT NULL,
  `real_name_snapshot` VARCHAR(64) DEFAULT NULL,
  `joined_at`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `left_at`         DATETIME(3) DEFAULT NULL,
  `created_at`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_team_account` (`team_id`, `account_id`),
  KEY `idx_account_status` (`account_id`, `status`),
  KEY `idx_team_role` (`team_id`, `role`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='队伍成员';

-- ---------------------------------------------------------------------
-- 8. 邀请/申请 invitation
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `invitation` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `type`           VARCHAR(32) NOT NULL COMMENT 'TEAM_INVITE_MEMBER/STUDENT_INVITE_TEACHER/TEACHER_INVITE_STUDENT/STUDENT_APPLY_JOIN',
  `competition_id` BIGINT UNSIGNED NOT NULL,
  `team_id`        BIGINT UNSIGNED DEFAULT NULL,
  `inviter_id`     BIGINT UNSIGNED NOT NULL,
  `invitee_id`     BIGINT UNSIGNED NOT NULL,
  `message`        VARCHAR(500) DEFAULT NULL,
  `status`         VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/ACCEPTED/REJECTED/EXPIRED/CANCELLED',
  `expires_at`     DATETIME(3) NOT NULL,
  `responded_at`   DATETIME(3) DEFAULT NULL,
  `reject_reason`  VARCHAR(255) DEFAULT NULL,
  `created_at`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_invitee` (`invitee_id`, `status`),
  KEY `idx_inviter` (`inviter_id`, `status`),
  KEY `idx_team` (`team_id`, `status`),
  KEY `idx_expire` (`status`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='邀请与入队申请';

-- ---------------------------------------------------------------------
-- 9. 通知 notification
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notification` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `recipient_id` BIGINT UNSIGNED NOT NULL,
  `type`         VARCHAR(32) NOT NULL COMMENT 'INVITATION/TEAM/SYSTEM',
  `title`        VARCHAR(200) NOT NULL,
  `content`      VARCHAR(1000) NOT NULL,
  `link_url`     VARCHAR(255) DEFAULT NULL,
  `read_at`      DATETIME(3) DEFAULT NULL,
  `created_at`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_recipient_read` (`recipient_id`, `read_at`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='站内通知';

-- ---------------------------------------------------------------------
-- 10. 审计日志 audit_log
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_log` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `operator_id`   BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `operator_name` VARCHAR(64) DEFAULT NULL,
  `action`        VARCHAR(64) NOT NULL,
  `module`        VARCHAR(32) NOT NULL,
  `resource_type` VARCHAR(32) DEFAULT NULL,
  `resource_id`   BIGINT UNSIGNED DEFAULT NULL,
  `detail_json`   JSON DEFAULT NULL,
  `ip`            VARCHAR(45) DEFAULT NULL,
  `result`        VARCHAR(16) NOT NULL DEFAULT 'SUCCESS',
  `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_operator` (`operator_id`, `created_at`),
  KEY `idx_action` (`action`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='审计日志';

-- ---------------------------------------------------------------------
-- 11. 刷新令牌 refresh_token
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `refresh_token` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `account_id` BIGINT UNSIGNED NOT NULL,
  `token_hash` CHAR(64) NOT NULL COMMENT 'sha256(token)',
  `family_id`  CHAR(32) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `revoked_at` DATETIME(3) DEFAULT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_token_hash` (`token_hash`),
  KEY `idx_account` (`account_id`),
  KEY `idx_family` (`family_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='刷新令牌';

-- ---------------------------------------------------------------------
-- 12. 验证码 verification_code
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `verification_code` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `contact`    VARCHAR(128) NOT NULL,
  `purpose`    VARCHAR(32) NOT NULL COMMENT 'REGISTER/RESET_PASSWORD/BIND_EMAIL',
  `code_hash`  CHAR(64) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `used_at`    DATETIME(3) DEFAULT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_contact_purpose` (`contact`, `purpose`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='验证码';

-- =====================================================================
--  字典种子数据
-- =====================================================================
INSERT INTO `dict_item` (`type`,`code`,`label`,`sort`,`parent_code`) VALUES
-- 学院
('COLLEGE','CS','计算机科学与技术学院',1,NULL),
('COLLEGE','SE','软件学院',2,NULL),
('COLLEGE','EE','电子信息工程学院',3,NULL),
('COLLEGE','AI','人工智能学院',4,NULL),
('COLLEGE','ME','机械工程学院',5,NULL),
('COLLEGE','EC','经济管理学院',6,NULL),
('COLLEGE','MA','数学与统计学院',7,NULL),
('COLLEGE','FA','外国语学院',8,NULL),
-- 专业
('MAJOR','CS_SE','软件工程',1,'CS'),
('MAJOR','CS_CS','计算机科学与技术',2,'CS'),
('MAJOR','CS_AI','人工智能',3,'CS'),
('MAJOR','SE_SE','软件工程',1,'SE'),
('MAJOR','SE_DM','数据科学与大数据技术',2,'SE'),
('MAJOR','EE_EE','电子信息工程',1,'EE'),
('MAJOR','EE_IOT','物联网工程',2,'EE'),
('MAJOR','AI_AI','人工智能',1,'AI'),
('MAJOR','ME_ME','机械设计制造及其自动化',1,'ME'),
('MAJOR','EC_EC','经济学',1,'EC'),
('MAJOR','MA_MA','数学与应用数学',1,'MA'),
('MAJOR','FA_EN','英语',1,'FA'),
-- 技能标签
('SKILL_TAG','FE','前端开发',1,NULL),
('SKILL_TAG','BE','后端开发',2,NULL),
('SKILL_TAG','ALGO','算法',3,NULL),
('SKILL_TAG','DATA','数据分析',4,NULL),
('SKILL_TAG','UI','UI/UX 设计',5,NULL),
('SKILL_TAG','PM','产品策划',6,NULL),
('SKILL_TAG','ML','机器学习',7,NULL),
('SKILL_TAG','EMBED','嵌入式',8,NULL),
('SKILL_TAG','HW','硬件设计',9,NULL),
('SKILL_TAG','DOC','文案/答辩',10,NULL),
-- 职称
('TITLE','PROF','教授',1,NULL),
('TITLE','APROF','副教授',2,NULL),
('TITLE','LECT','讲师',3,NULL),
('TITLE','ASST','助教',4,NULL),
-- 赛事类别
('CATEGORY','INNOV','创新创业类',1,NULL),
('CATEGORY','CS','计算机/软件/算法类',2,NULL),
('CATEGORY','EE','电子信息/物联网/信息安全类',3,NULL),
('CATEGORY','AI_ROBOT','机器人与人工智能类',4,NULL),
('CATEGORY','SCI','数学/理学/生命科学类',5,NULL),
('CATEGORY','ENG','工程/机械/智能制造类',6,NULL),
('CATEGORY','FIN','经管/金融/财会类',7,NULL),
('CATEGORY','LANG','语言/文化/跨文化类',8,NULL),
('CATEGORY','ART','艺术/设计/数字媒体类',9,NULL),
('CATEGORY','VOC','职业技能类',10,NULL);
