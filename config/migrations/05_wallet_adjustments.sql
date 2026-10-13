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
