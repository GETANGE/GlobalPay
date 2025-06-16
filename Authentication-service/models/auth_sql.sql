CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(30) NOT NULL,
    first_name VARCHAR(30) NOT NULL,
    last_name VARCHAR(30) NOT NULL,
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    phone_number VARCHAR(15),
    is_email_verified BOOLEAN DEFAULT false,
    is_phone_verified BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    kyc_status VARCHAR(50),
    national_id VARCHAR(20),
    date_of_birth DATE,
    wallet_balance NUMERIC(12, 2) DEFAULT 0.00,
    currency VARCHAR(10),
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    login_ip VARCHAR(45),
    device_ip VARCHAR(45),
    notification_preference VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS refreshToken (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    access_token TEXT DEFAULT NULL,
    expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);
