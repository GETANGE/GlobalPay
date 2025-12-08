-- ============================
-- ENUMS
-- ============================
CREATE TYPE notification_status AS ENUM ('PENDING', 'SENT', 'DELETED', 'READ');
CREATE TYPE recipient_status AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'READ');
CREATE TYPE device_type AS ENUM ('android', 'ios', 'web');

-- ============================
-- NOTIFICATIONS TABLE
-- ============================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    device_type TEXT,
    status notification_status DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for filtering notifications per user
CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
    ON notifications(user_id);


-- ============================
-- NOTIFICATION LOGS
-- ============================
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY,
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    status notification_status NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster joins
CREATE INDEX IF NOT EXISTS idx_notification_logs_notification_id
    ON notification_logs(notification_id);


-- ============================
-- TEMPLATES
-- ============================
CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);


-- ============================
-- RECIPIENTS (For multi-user notifications)
-- ============================
CREATE TABLE IF NOT EXISTS notification_recipients (
    id UUID PRIMARY KEY,
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    status recipient_status DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notification_recipients_notification_id
    ON notification_recipients(notification_id);

CREATE INDEX IF NOT EXISTS idx_notification_recipients_user_id
    ON notification_recipients(user_id);


-- ============================
-- DEVICE TOKENS (For Firebase/Web Push)
-- ============================
CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    token TEXT NOT NULL UNIQUE,
    device_type device_type,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Useful when sending push notifications
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id
    ON device_tokens(user_id);
