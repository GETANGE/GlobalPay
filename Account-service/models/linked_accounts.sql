CREATE TABLE IF NOT EXISTS linked_accounts (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    token_id VARCHAR(255) NOT NULL,
    type VARCHAR(10) CHECK (type IN ('CARD', 'BANK')),
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'DELETED')),
    provider VARCHAR(50) DEFAULT 'mastercard', -- vault provider
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vault_tokens (
    id SERIAL PRIMARY KEY,
    token_id VARCHAR(64) UNIQUE NOT NULL,
    encrypted_data TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
