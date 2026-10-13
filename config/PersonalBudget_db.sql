-- FRESH INSTALL ONLY: this file creates the original tables, applies the
-- integration changes, and inserts lookup data in one run. The DROP below
-- permanently removes every existing account and transaction in this DB.
-- Never run this file to update an existing database. For an old database,
-- use the one-time files under config/migrations/ instead.
DROP DATABASE IF EXISTS PersonalBudget_db;

CREATE DATABASE IF NOT EXISTS PersonalBudget_db;
USE PersonalBudget_db;


-- =========================================
-- USERS
-- =========================================

CREATE TABLE Users(
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    email_verified TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL
);


-- =========================================
-- ACTIVITY TYPES
-- =========================================

CREATE TABLE Activity_Types(
    activity_type_id INT PRIMARY KEY AUTO_INCREMENT,
    activity_name VARCHAR(100) NOT NULL
);


-- =========================================
-- ACTIVITY LOGS
-- =========================================

CREATE TABLE Activity_Logs(
    activity_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    activity_type_id INT NOT NULL,
    activity_description VARCHAR(100) NOT NULL,
    activity_date DATE NOT NULL,

    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (activity_type_id) REFERENCES Activity_Types(activity_type_id)
);


-- =========================================
-- TRANSACTION TYPES
-- =========================================

CREATE TABLE TransactionTypes(
    transaction_type_id INT PRIMARY KEY AUTO_INCREMENT,
    type_name VARCHAR(100) NOT NULL
);


-- =========================================
-- CATEGORIES
-- =========================================

CREATE TABLE Categories(
    category_id INT PRIMARY KEY AUTO_INCREMENT,
    category_name VARCHAR(100) NOT NULL,
    transaction_type_id INT NOT NULL,

    FOREIGN KEY (transaction_type_id) REFERENCES TransactionTypes(transaction_type_id)
);


-- =========================================
-- BUDGETS
-- =========================================

CREATE TABLE Budgets(
    budget_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    category_id INT NOT NULL,
    budget_amount DECIMAL(10, 2) NOT NULL,

    -- Supports daily, weekly, and monthly budgets
    budget_period ENUM('daily', 'weekly', 'monthly') NOT NULL,

    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at DATETIME NOT NULL,

    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (category_id) REFERENCES Categories(category_id)
);


-- =========================================
-- PAYMENT METHODS
-- =========================================

CREATE TABLE Payment_Methods(
    payment_method_id INT PRIMARY KEY AUTO_INCREMENT,
    payment_method_name VARCHAR(50) NOT NULL
);


-- =========================================
-- TRANSACTIONS
-- =========================================

CREATE TABLE Transactions(
    transaction_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    category_id INT NOT NULL,
    transaction_type_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    description VARCHAR(150) NOT NULL,
    transaction_date DATE NOT NULL,
    payment_method_id INT NOT NULL,
    created_at DATETIME NOT NULL,

    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (category_id) REFERENCES Categories(category_id),
    FOREIGN KEY (transaction_type_id) REFERENCES TransactionTypes(transaction_type_id),
    FOREIGN KEY (payment_method_id) REFERENCES Payment_Methods(payment_method_id)
);


-- =========================================
-- GOAL STATUSES
-- =========================================

CREATE TABLE Goal_Statuses(
    status_id INT PRIMARY KEY AUTO_INCREMENT,
    status_name VARCHAR(100) NOT NULL
);


-- =========================================
-- FINANCIAL GOALS
-- =========================================

CREATE TABLE Financial_Goals(
    goal_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    goal_name VARCHAR(100) NOT NULL,
    target_amount DECIMAL(10, 2) NOT NULL,
    target_date DATE NOT NULL,
    status_id INT NOT NULL,
    created_at DATETIME NOT NULL,

    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (status_id) REFERENCES Goal_Statuses(status_id)
);


-- =========================================
-- GOAL CONTRIBUTIONS
-- =========================================

CREATE TABLE Goal_Contribution(
    contribution_id INT PRIMARY KEY AUTO_INCREMENT,
    goal_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    contribution_date DATE NOT NULL,
    description VARCHAR(100) NOT NULL,

    FOREIGN KEY (goal_id) REFERENCES Financial_Goals(goal_id)
);


-- =========================================
-- OTP CODES
-- =========================================

CREATE TABLE Otp_Codes(
    otp_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    code VARCHAR(6) NOT NULL,

    -- Used for email verification
    purpose VARCHAR(50) NOT NULL,

    expires_at DATETIME NOT NULL,
    used TINYINT(1) NOT NULL DEFAULT 0,

    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);


-- =========================================
-- LOGIN TOKENS
-- =========================================

CREATE TABLE Tokens(
    token_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);


-- Run this once against the schema from config/PersonalBudget_db.sql.
-- NEW file: adds the fields required by sessions, roles, archives and profile.

ALTER TABLE Users
    MODIFY password VARCHAR(255) NOT NULL,
    ADD COLUMN role ENUM('user', 'admin') NOT NULL DEFAULT 'user' AFTER email_verified,
    ADD COLUMN status ENUM('active', 'inactive', 'suspended', 'deleted') NOT NULL DEFAULT 'active' AFTER role,
    ADD COLUMN phone VARCHAR(30) NULL AFTER status,
    ADD COLUMN photo_path VARCHAR(255) NULL AFTER phone,
    ADD COLUMN monthly_income_estimate DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER photo_path,
    ADD COLUMN last_login_at DATETIME NULL AFTER created_at,
    ADD COLUMN deleted_at DATETIME NULL AFTER last_login_at;

ALTER TABLE Tokens
    ADD COLUMN expires_at DATETIME NULL AFTER created_at;

-- Existing tokens were stored in plain text by the old API. Revoke them so
-- every new row follows the hashed-token format used by the revised PHP.
DELETE FROM Tokens;

ALTER TABLE Tokens
    MODIFY expires_at DATETIME NOT NULL,
    ADD INDEX idx_tokens_expiry (expires_at);

ALTER TABLE TransactionTypes
    ADD COLUMN code VARCHAR(30) NULL AFTER type_name,
    ADD UNIQUE KEY uq_transaction_type_code (code);

ALTER TABLE Goal_Statuses
    ADD COLUMN code VARCHAR(30) NULL AFTER status_name,
    ADD UNIQUE KEY uq_goal_status_code (code);

ALTER TABLE Activity_Types
    ADD COLUMN code VARCHAR(50) NULL AFTER activity_name,
    ADD UNIQUE KEY uq_activity_type_code (code);

ALTER TABLE Transactions
    ADD COLUMN archived TINYINT(1) NOT NULL DEFAULT 0 AFTER created_at,
    ADD COLUMN archived_at DATETIME NULL AFTER archived,
    ADD INDEX idx_transactions_user_date (user_id, transaction_date),
    ADD INDEX idx_transactions_user_archived (user_id, archived);

-- Activity rows need a time as well as a date for the admin activity screen.
ALTER TABLE Activity_Logs
    MODIFY activity_date DATETIME NOT NULL;

CREATE TABLE App_Settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NOT NULL
);

-- NEW: React's generated report logs and archived snapshots need persistence.
CREATE TABLE Report_Logs (
    report_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    report_name VARCHAR(200) NOT NULL,
    report_type VARCHAR(30) NOT NULL,
    report_range VARCHAR(30) NOT NULL,
    report_period VARCHAR(100) NOT NULL,
    snapshot_json JSON NOT NULL,
    generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    INDEX idx_report_logs_user (user_id, generated_at)
);

INSERT INTO App_Settings (setting_key, setting_value)
VALUES ('registration_open', '1');


-- NEW file: IDs can differ between databases, so the API uses stable codes
-- such as income/expense instead of assuming type 1 and type 2.

-- Label existing lookup rows before inserting missing defaults. This avoids
-- creating duplicate Income/Expense rows in a database with real data.
UPDATE TransactionTypes SET code = 'income' WHERE type_name = 'Income' AND code IS NULL;
UPDATE TransactionTypes SET code = 'expense' WHERE type_name = 'Expense' AND code IS NULL;

INSERT INTO TransactionTypes (type_name, code)
VALUES ('Income', 'income'), ('Expense', 'expense')
ON DUPLICATE KEY UPDATE type_name = VALUES(type_name);

UPDATE Goal_Statuses SET code = 'active' WHERE status_name = 'Active' AND code IS NULL;
UPDATE Goal_Statuses SET code = 'completed' WHERE status_name = 'Completed' AND code IS NULL;
UPDATE Goal_Statuses SET code = 'paused' WHERE status_name = 'Paused' AND code IS NULL;

INSERT INTO Goal_Statuses (status_name, code)
VALUES ('Active', 'active'), ('Completed', 'completed'), ('Paused', 'paused')
ON DUPLICATE KEY UPDATE status_name = VALUES(status_name);

UPDATE Activity_Types SET code = 'login' WHERE activity_name = 'Login' AND code IS NULL;
UPDATE Activity_Types SET code = 'registered' WHERE activity_name = 'Registration' AND code IS NULL;
UPDATE Activity_Types SET code = 'logout' WHERE activity_name = 'Logout' AND code IS NULL;
UPDATE Activity_Types SET code = 'transaction_created' WHERE activity_name = 'Transaction Created' AND code IS NULL;
UPDATE Activity_Types SET code = 'user_created' WHERE activity_name = 'User Created' AND code IS NULL;
UPDATE Activity_Types SET code = 'user_updated' WHERE activity_name = 'User Updated' AND code IS NULL;
UPDATE Activity_Types SET code = 'user_status_changed' WHERE activity_name = 'User Status Changed' AND code IS NULL;

INSERT INTO Activity_Types (activity_name, code)
VALUES
    ('Registration', 'registered'),
    ('Login', 'login'),
    ('Logout', 'logout'),
    ('Transaction Created', 'transaction_created'),
    ('User Created', 'user_created'),
    ('User Updated', 'user_updated'),
    ('User Status Changed', 'user_status_changed')
ON DUPLICATE KEY UPDATE activity_name = VALUES(activity_name);

INSERT INTO Payment_Methods (payment_method_name)
SELECT 'Cash' WHERE NOT EXISTS (
    SELECT 1 FROM Payment_Methods WHERE payment_method_name = 'Cash'
);

INSERT INTO Payment_Methods (payment_method_name)
SELECT 'Debit Card' WHERE NOT EXISTS (
    SELECT 1 FROM Payment_Methods WHERE payment_method_name = 'Debit Card'
);

INSERT INTO Payment_Methods (payment_method_name)
SELECT 'Credit Card' WHERE NOT EXISTS (
    SELECT 1 FROM Payment_Methods WHERE payment_method_name = 'Credit Card'
);

INSERT INTO Categories (category_name, transaction_type_id)
SELECT 'Income', transaction_type_id FROM TransactionTypes WHERE code = 'income'
  AND NOT EXISTS (SELECT 1 FROM Categories WHERE category_name = 'Income');

INSERT INTO Categories (category_name, transaction_type_id)
SELECT category_name, transaction_type_id
FROM (
    SELECT 'Groceries' AS category_name, transaction_type_id FROM TransactionTypes WHERE code = 'expense'
    UNION ALL SELECT 'Entertainment', transaction_type_id FROM TransactionTypes WHERE code = 'expense'
    UNION ALL SELECT 'Transportation', transaction_type_id FROM TransactionTypes WHERE code = 'expense'
    UNION ALL SELECT 'Housing', transaction_type_id FROM TransactionTypes WHERE code = 'expense'
    UNION ALL SELECT 'Utilities', transaction_type_id FROM TransactionTypes WHERE code = 'expense'
    UNION ALL SELECT 'Dining Out', transaction_type_id FROM TransactionTypes WHERE code = 'expense'
) AS defaults
WHERE NOT EXISTS (
    SELECT 1 FROM Categories c WHERE c.category_name = defaults.category_name
);
CREATE TABLE IF NOT EXISTS Wallets (
    wallet_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    payment_method_id INT NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    kind ENUM('bank', 'digital', 'cash', 'other') NOT NULL,
    expense_type VARCHAR(100) NOT NULL DEFAULT 'Other',
    balance DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    deleted_at DATETIME NULL,
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (payment_method_id) REFERENCES Payment_Methods(payment_method_id)
);
CREATE TABLE IF NOT EXISTS Wallet_Transfers (
 transfer_id INT PRIMARY KEY AUTO_INCREMENT,
 user_id INT NOT NULL,
 from_wallet_id INT NOT NULL,
 to_wallet_id INT NOT NULL,
 amount DECIMAL(10,2) NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (user_id) REFERENCES Users(user_id),
 FOREIGN KEY (from_wallet_id) REFERENCES Wallets(wallet_id),
 FOREIGN KEY (to_wallet_id) REFERENCES Wallets(wallet_id)
);
CREATE TABLE IF NOT EXISTS Wallet_Adjustments (
 adjustment_id INT PRIMARY KEY AUTO_INCREMENT,
 user_id INT NOT NULL,
 wallet_id INT NOT NULL,
 previous_balance DECIMAL(14,2) NOT NULL,
 new_balance DECIMAL(14,2) NOT NULL,
 amount DECIMAL(14,2) NOT NULL,
 reason VARCHAR(200) NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (user_id) REFERENCES Users(user_id),
 FOREIGN KEY (wallet_id) REFERENCES Wallets(wallet_id)
);

-- Request replay and reliable account cleanup for fresh installations.
CREATE TABLE IF NOT EXISTS Write_Requests (
 user_id INT NOT NULL,
 request_key VARCHAR(80) NOT NULL,
 fingerprint CHAR(64) NOT NULL,
 status_code INT NULL,
 response_json MEDIUMTEXT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id, request_key),
 FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

CREATE TABLE IF NOT EXISTS File_Cleanup (
 path VARCHAR(255) PRIMARY KEY,
 queued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS User_Activity (
 activity_id BIGINT PRIMARY KEY AUTO_INCREMENT,
 user_id INT NOT NULL,
 description VARCHAR(255) NOT NULL,
 action VARCHAR(40) NOT NULL DEFAULT 'UPDATE',
 related_item VARCHAR(180) NULL,
 amount DECIMAL(14,2) NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_user_activity (user_id, activity_id),
 FOREIGN KEY (user_id) REFERENCES Users(user_id)
);
CREATE TABLE IF NOT EXISTS Auth_Events (
 event_id BIGINT PRIMARY KEY AUTO_INCREMENT,
 user_id INT NOT NULL,
 event_type ENUM('LOGIN', 'SIGNUP') NOT NULL,
 occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 legacy_activity_id INT NULL UNIQUE,
 INDEX idx_auth_event_time (occurred_at, event_id),
 FOREIGN KEY (user_id) REFERENCES Users(user_id)
);
