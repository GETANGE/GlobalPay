CREATE TABLE IF NOT EXISTS wallets (
    wallet_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    balance DECIMAL NOT NULL,
    frozen_balance DECIMAL NOT NULL,
    currency VARCHAR(30) NOT NULL DEFAULT 'KES',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Nairobi'),
    updated_at TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Nairobi')
);