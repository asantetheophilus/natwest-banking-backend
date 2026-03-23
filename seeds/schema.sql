-- ============================================================
-- NatWest Banking App — Full MySQL Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS natwest_bank
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE natwest_bank;

-- ─── Users ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          VARCHAR(36)   PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  email       VARCHAR(255)  NOT NULL UNIQUE,
  password    VARCHAR(255)  NOT NULL,          -- bcrypt hash
  phone       VARCHAR(20)   DEFAULT '+44 7700 900123',
  role        ENUM('user','admin') NOT NULL DEFAULT 'user',
  status      ENUM('active','suspended') NOT NULL DEFAULT 'active',
  joined_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─── Accounts ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id              VARCHAR(36)   PRIMARY KEY,
  user_id         VARCHAR(36)   NOT NULL,
  account_number  VARCHAR(20)   NOT NULL UNIQUE,
  sort_code       VARCHAR(10)   NOT NULL,
  type            VARCHAR(50)   NOT NULL DEFAULT 'Current Account',
  balance         DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  currency        VARCHAR(3)    NOT NULL DEFAULT 'GBP',
  status          ENUM('active','frozen') NOT NULL DEFAULT 'active',
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── Transactions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id          VARCHAR(36)   PRIMARY KEY,
  user_id     VARCHAR(36)   NOT NULL,
  account_id  VARCHAR(36)   NOT NULL,
  type        ENUM('debit','credit') NOT NULL,
  category    VARCHAR(50)   NOT NULL DEFAULT 'General',
  merchant    VARCHAR(100)  NOT NULL,
  amount      DECIMAL(15,2) NOT NULL,
  reference   VARCHAR(255)  DEFAULT NULL,
  date        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status      ENUM('completed','pending','failed','flagged') NOT NULL DEFAULT 'completed',
  FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── Payees ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payees (
  id              VARCHAR(36)   PRIMARY KEY,
  user_id         VARCHAR(36)   NOT NULL,
  name            VARCHAR(100)  NOT NULL,
  account_number  VARCHAR(20)   NOT NULL,
  sort_code       VARCHAR(10)   NOT NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── Notifications ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id        VARCHAR(36)   PRIMARY KEY,
  user_id   VARCHAR(36)   NOT NULL,
  title     VARCHAR(200)  NOT NULL,
  message   TEXT          NOT NULL,
  date      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `read`    BOOLEAN       NOT NULL DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── Support Tickets ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
  id        VARCHAR(36)   PRIMARY KEY,
  user_id   VARCHAR(36)   NOT NULL,
  subject   VARCHAR(200)  NOT NULL,
  message   TEXT          NOT NULL,
  status    ENUM('open','resolved') NOT NULL DEFAULT 'open',
  date      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── Ticket Responses ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_responses (
  id          VARCHAR(36)   PRIMARY KEY,
  ticket_id   VARCHAR(36)   NOT NULL,
  admin_name  VARCHAR(100)  NOT NULL,
  message     TEXT          NOT NULL,
  date        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── Admin Activity Logs ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id          VARCHAR(36)   PRIMARY KEY,
  admin_id    VARCHAR(36)   DEFAULT NULL,
  actor       VARCHAR(50)   NOT NULL DEFAULT 'System',
  action      VARCHAR(255)  NOT NULL,
  icon        VARCHAR(50)   DEFAULT 'Activity',
  color       VARCHAR(50)   DEFAULT 'text-blue-400',
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─── Transfer Approvals ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS transfer_approvals (
  id                      VARCHAR(36)   PRIMARY KEY,
  transaction_id          VARCHAR(36)   NOT NULL,         -- debit transaction
  credit_transaction_id   VARCHAR(36)   DEFAULT NULL,     -- credit transaction (FIX: reliable lookup)
  user_id                 VARCHAR(36)   NOT NULL,         -- sender
  payee_id                VARCHAR(36)   DEFAULT NULL,     -- receiver user id (FIX: for notification)
  amount                  DECIMAL(15,2) NOT NULL,
  payee_name              VARCHAR(100)  NOT NULL,
  status                  ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by             VARCHAR(36)   DEFAULT NULL,
  reviewed_at             DATETIME      DEFAULT NULL,
  created_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (credit_transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (payee_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─── System Settings ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
  `key`   VARCHAR(100)  PRIMARY KEY,
  value   TEXT          NOT NULL,
  updated_at DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Insert default system settings
INSERT INTO system_settings (`key`, value) VALUES
  ('bank_name', 'NatWest'),
  ('support_email', 'support@natwest.com'),
  ('maintenance_mode', 'false'),
  ('enforce_2fa', 'true'),
  ('session_timeout', '15'),
  ('daily_transfer_limit', '20000')
ON DUPLICATE KEY UPDATE value = VALUES(value);
