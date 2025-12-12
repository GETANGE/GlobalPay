-- ============================
-- USERS TABLE
-- ============================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(30) NOT NULL,
    first_name VARCHAR(30),
    last_name VARCHAR(30),
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    phone_number VARCHAR(15),
    is_email_verified BOOLEAN DEFAULT false,
    is_phone_verified BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    kyc_status VARCHAR(50),
    national_id VARCHAR(200),
    date_of_birth DATE,
    wallet_balance NUMERIC(12, 2) DEFAULT 0.00,
    currency VARCHAR(10),
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    login_ip VARCHAR(45),
    device_ip VARCHAR(45),
    notification_preference VARCHAR(50),
    webauthn_user_id VARCHAR(255) UNIQUE,
    current_challange VARCHAR(255),
    login_challange VARCHAR(255),
    active BOOLEAN DEFAULT true,
    deleted_at TIMESTAMPTZ,
    deleted_by VARCHAR(255),
    github_id VARCHAR(255),
    google_id VARCHAR(255),
    facebook_id VARCHAR(255),
    instagram_id VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);


-- Ensure wallet_balance type & default
ALTER TABLE users
ALTER COLUMN wallet_balance TYPE NUMERIC(12, 2),
ALTER COLUMN wallet_balance SET DEFAULT 0;


-- ============================
-- REFRESH TOKENS
-- ============================
CREATE TABLE IF NOT EXISTS refreshToken (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    access_token TEXT DEFAULT NULL,
    expires_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_refresh_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


-- ============================
-- EMAIL VERIFICATION
-- ============================
CREATE TABLE IF NOT EXISTS email_verification (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    email_token TEXT,
    email_expires_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_email_verification_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


-- ============================
-- SMS VERIFICATION
-- ============================
CREATE TABLE IF NOT EXISTS sms_verification (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    phone_token TEXT,
    phone_expires_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sms_verification_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


-- ============================
-- PASSWORD RESETS
-- ============================
CREATE TABLE IF NOT EXISTS password_resets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    reset_token TEXT,
    expires_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_password_resets_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


-- ============================
-- PASSKEYS (WebAuthn Credentials)
-- ============================
CREATE TABLE IF NOT EXISTS passkeys (
    id VARCHAR(255) PRIMARY KEY,      -- credential ID (Base64URL)
    public_key BYTEA NOT NULL,        -- raw public key
    user_id INTEGER NOT NULL,
    webauthn_user_id VARCHAR(255) NOT NULL,
    counter BIGINT DEFAULT 0,
    device_type VARCHAR(32) CHECK (device_type IN ('singleDevice', 'multiDevice')),
    backed_up BOOLEAN DEFAULT false,
    transports VARCHAR(255),          -- CSV string: "usb,nfc,internal"
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_passkeys_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);
