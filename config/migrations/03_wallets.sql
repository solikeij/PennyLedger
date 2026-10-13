CREATE TABLE IF NOT EXISTS Wallets (
    wallet_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    payment_method_id INT NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    kind ENUM('bank', 'digital', 'cash', 'other') NOT NULL,
    balance DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    deleted_at DATETIME NULL,
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (payment_method_id) REFERENCES Payment_Methods(payment_method_id)
);
