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
