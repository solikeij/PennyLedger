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
