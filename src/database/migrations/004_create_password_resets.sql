-- Create password_resets table for secure password reset functionality
-- This table stores secure tokens for password reset requests

CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at ON password_resets(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_resets_is_used ON password_resets(is_used);

-- Add composite index for active tokens lookup
CREATE INDEX IF NOT EXISTS idx_password_resets_active_tokens 
ON password_resets(user_id, is_used, expires_at);

-- Add comments for documentation
COMMENT ON TABLE password_resets IS 'Stores secure password reset tokens';
COMMENT ON COLUMN password_resets.token IS 'Plaintext token (temporary for email)';
COMMENT ON COLUMN password_resets.token_hash IS 'SHA-256 hash of the token for verification';
COMMENT ON COLUMN password_resets.expires_at IS 'Token expiration time (typically 1 hour)';
COMMENT ON COLUMN password_resets.is_used IS 'Flag to mark if token has been used';

-- Create trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_password_resets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER password_resets_updated_at
    BEFORE UPDATE ON password_resets
    FOR EACH ROW
    EXECUTE FUNCTION update_password_resets_updated_at();