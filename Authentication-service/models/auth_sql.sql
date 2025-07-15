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
    national_id VARCHAR(200),
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

CREATE INDEX idx_users_email ON users(email);


-- Change the column types to TIMESTAMPTZ (aka TIMESTAMP WITH TIME ZONE)
ALTER TABLE users
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
  ALTER COLUMN last_login TYPE TIMESTAMPTZ USING last_login AT TIME ZONE 'UTC';

ALTER TABLE users ADD COLUMN webauthn_user_id VARCHAR(255) UNIQUE;

ALTER TABLE users ADD COLUMN current_challange VARCHAR(255)

ALTER TABLE users ADD COLUMN login_challange VARCHAR(255)

ALTER TABLE users ADD COLUMN github_id VARCHAR(255)

ALTER TABLE users ADD COLUMN google_id VARCHAR(255)

ALTER TABLE users ADD COLUMN facebook_id VARCHAR(255)

ALTER TABLE users ADD COLUMN instagram_id VARCHAR(255)

ALTER TABLE users
ALTER COLUMN first_name DROP NOT NULL,
ALTER COLUMN last_name DROP NOT NULL;

ALTER TABLE users
ALTER COLUMN national_id TYPE VARCHAR(200)

ALTER TABLE users
DROP COLUMN IF EXISTS access_token;

ALTER TABLE users
ALTER COLUMN wallet_balance TYPE NUMERIC(12, 2),
ALTER COLUMN wallet_balance SET DEFAULT 0;

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

DROP TABLE IF EXISTS user_verification;

CREATE TABLE email_verification (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    email_token TEXT,
    email_expires_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE sms_verification (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    phone_token TEXT,
    phone_expires_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE password_resets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    reset_token TEXT,
    expires_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- Alter `email_verification` table
ALTER TABLE email_verification
ALTER COLUMN email_expires_at TYPE TIMESTAMPTZ;

-- Alter `sms_verification` table
ALTER TABLE sms_verification
ALTER COLUMN phone_expires_at TYPE TIMESTAMPTZ;

ALTER TABLE refreshToken
--   ADD COLUMN refresh_token TEXT DEFAULT NULL,
  ALTER COLUMN expires_at TYPE TIMESTAMPTZ;


CREATE TABLE IF NOT EXISTS passkeys (
    id VARCHAR(255) PRIMARY KEY,  -- credential ID (Base64URL)
    public_key BYTEA NOT NULL,    -- raw public key
    user_id INTEGER NOT NULL,     -- foreign key to users
    webauthn_user_id VARCHAR(255) NOT NULL,  -- same as in `users`, if you want per-user isolation
    counter BIGINT DEFAULT 0,
    device_type VARCHAR(32) CHECK (device_type IN ('singleDevice', 'multiDevice')),
    backed_up BOOLEAN DEFAULT false,
    transports VARCHAR(255), -- CSV string like 'usb,nfc,internal'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE
);
