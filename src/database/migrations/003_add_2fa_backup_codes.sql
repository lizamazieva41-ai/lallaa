-- Add backup_codes column to users table for 2FA
-- This migration adds support for storing TOTP backup codes

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS backup_codes JSONB;

-- Create index for faster queries on backup_codes
CREATE INDEX IF NOT EXISTS idx_users_backup_codes ON users USING GIN(backup_codes);

-- Add comment for documentation
COMMENT ON COLUMN users.backup_codes IS 'Array of hashed backup codes for 2FA authentication';