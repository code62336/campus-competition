-- =====================================================================
--  升级脚本（旧库 → 当前版本）
--  适用：使用早期版本 init.sql 建库、缺少 verification_code.attempts 列的旧库。
--  执行：mysql -uroot -p tzb < sql/upgrade-2026-10-22.sql
--  说明：本脚本幂等（用存储过程判列后再加列），可安全重复执行。
-- =====================================================================

SET NAMES utf8mb4;

-- verification_code.attempts：验证码连续失败次数（>5 作废）
DELIMITER $$
DROP PROCEDURE IF EXISTS `tzb_add_attempts_col` $$
CREATE PROCEDURE `tzb_add_attempts_col`()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'verification_code' AND COLUMN_NAME = 'attempts'
  ) THEN
    ALTER TABLE `verification_code`
      ADD COLUMN `attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '连续失败次数(>5 作废)' AFTER `used_at`;
  END IF;
END $$
DELIMITER ;

CALL `tzb_add_attempts_col`();
DROP PROCEDURE IF EXISTS `tzb_add_attempts_col`;
