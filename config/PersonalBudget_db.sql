DROP DATABASE IF EXISTS PersonalBudget_db;

CREATE DATABASE IF NOT EXISTS PersonalBudget_db;
USE PersonalBudget_db;

CREATE TABLE Users(
	user_id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    email_verified TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL

); 

CREATE TABLE Activity_Types(
	activity_type_id INT PRIMARY KEY AUTO_INCREMENT,
    activity_name VARCHAR(100) NOT NULL
);

CREATE TABLE Activity_Logs(
	activity_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    activity_type_id INT NOT NULL,
    activity_description VARCHAR(100) NOT NULL,
    activity_date DATE NOT NULL,
    
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (activity_type_id) REFERENCES Activity_Types(activity_type_id)
);

CREATE TABLE TransactionTypes(
	transaction_type_id INT PRIMARY KEY AUTO_INCREMENT,
    type_name VARCHAR(100) NOT NULL
);

CREATE TABLE Categories(
	category_id INT PRIMARY KEY AUTO_INCREMENT,
    category_name VARCHAR(100) NOT NULL,
    transaction_type_id INT NOT NULL,
    
    FOREIGN KEY (transaction_type_id) REFERENCES TransactionTypes(transaction_type_id)
);

CREATE TABLE Budgets(
    budget_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    category_id INT NOT NULL,
    budget_amount DECIMAL(10, 2) NOT NULL,
    budget_period ENUM('daily', 'weekly', 'monthly') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at DATETIME NOT NULL,

    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (category_id) REFERENCES Categories(category_id)
);

CREATE TABLE Payment_Methods(
	payment_method_id INT PRIMARY KEY AUTO_INCREMENT,
    payment_method_name VARCHAR(50) NOT NULL
);


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


CREATE TABLE Goal_Statuses(
	status_id INT PRIMARY KEY AUTO_INCREMENT,
    status_name VARCHAR(100) NOT NULL
);

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

CREATE TABLE Goal_Contribution(
	contribution_id INT PRIMARY KEY AUTO_INCREMENT,
    goal_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    contribution_date DATE NOT NULL,
    description VARCHAR(100) NOT NULL,
    
    FOREIGN KEY (goal_id) REFERENCES Financial_Goals(goal_id)
);


CREATE TABLE Otp_Codes(
    otp_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    code VARCHAR(6) NOT NULL,
    purpose VARCHAR(50) NOT NULL,
    expires_at DATETIME NOT NULL,
    used TINYINT(1) NOT NULL DEFAULT 0,

    FOREIGN KEY(user_id) REFERENCES Users(user_id)
);


CREATE TABLE Tokens (
    token_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);