-- Custom Package Support
-- Stores which premium features a custom-tier user has purchased.
-- Value is a JSON array of feature keys, e.g. '["drafting","research","clarify"]'
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_features TEXT DEFAULT NULL;

-- Comment for clarity
COMMENT ON COLUMN users.custom_features IS 'JSON array of PremiumFeature keys for custom-tier users';
