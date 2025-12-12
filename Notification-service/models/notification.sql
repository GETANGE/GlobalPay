-- ============================
-- ENUMS
-- ============================
CREATE TYPE notification_status AS ENUM ('PENDING', 'SENT', 'DELETED', 'READ');
CREATE TYPE recipient_status AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ');
CREATE TYPE device_type AS ENUM ('android', 'ios', 'web');

-- ============================
-- NOTIFICATIONS TABLE
-- ============================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    device_type device_type,
    status notification_status DEFAULT 'PENDING',
    type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id 
    ON notifications(user_id);

-- ============================
-- NOTIFICATION LOGS
-- ============================
CREATE TABLE notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    status notification_status NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_logs_notification_id
    ON notification_logs(notification_id);

-- ============================
-- NOTIFICATION TEMPLATES
-- ============================
CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================
-- NOTIFICATION RECIPIENTS
-- ============================
CREATE TABLE notification_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    status recipient_status DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_recipients_notification_id
    ON notification_recipients(notification_id);

CREATE INDEX idx_notification_recipients_user_id
    ON notification_recipients(user_id);

-- ============================
-- DEVICE TOKENS
-- ============================
CREATE TABLE device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token TEXT NOT NULL UNIQUE,
    device_type device_type,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_device_tokens_user_id
    ON device_tokens(user_id);

-- ============================
-- NOTIFICATION BROADCASTS
-- ============================
CREATE TABLE notification_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL,
    topic TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_broadcasts_topic
    ON notification_broadcasts(topic);
