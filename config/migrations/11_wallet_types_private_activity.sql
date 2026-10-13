-- Legacy balance columns/tables remain for data preservation only; no runtime reads/writes.
ALTER TABLE Wallets ADD COLUMN IF NOT EXISTS expense_type VARCHAR(100) NOT NULL DEFAULT 'Other';
ALTER TABLE User_Activity
 ADD COLUMN IF NOT EXISTS action VARCHAR(40) NOT NULL DEFAULT 'UPDATE',
 ADD COLUMN IF NOT EXISTS related_item VARCHAR(180) NULL;
CREATE TABLE IF NOT EXISTS Auth_Events (
 event_id BIGINT PRIMARY KEY AUTO_INCREMENT,
 user_id INT NOT NULL,
 event_type ENUM('LOGIN', 'SIGNUP') NOT NULL,
 occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 legacy_activity_id INT NULL UNIQUE,
 INDEX idx_auth_event_time (occurred_at, event_id),
 FOREIGN KEY (user_id) REFERENCES Users(user_id)
);
INSERT IGNORE INTO Auth_Events (user_id, event_type, occurred_at, legacy_activity_id)
 SELECT al.user_id, CASE WHEN t.code = 'login' THEN 'LOGIN' ELSE 'SIGNUP' END, al.activity_date, al.activity_id
 FROM Activity_Logs al JOIN Activity_Types t ON t.activity_type_id = al.activity_type_id
 WHERE t.code IN ('login', 'registered', 'signup');
-- Preserve old audit details privately before removing the global activity feed.
INSERT INTO User_Activity (user_id, description, action, created_at)
 SELECT al.user_id, COALESCE(al.activity_description, ''),
 CASE WHEN t.code = 'login' THEN 'LOGIN' WHEN t.code IN ('registered', 'signup') THEN 'SIGNUP' WHEN t.code = 'logout' THEN 'LOGOUT' ELSE 'UPDATE' END,
 al.activity_date FROM Activity_Logs al JOIN Activity_Types t ON t.activity_type_id = al.activity_type_id
 WHERE t.code <> 'account_change';
DELETE FROM Activity_Logs;
