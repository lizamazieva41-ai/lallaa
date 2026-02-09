-- Migration: Create workflow tables for card verification integration
-- Created: 2024-01-XX
-- Description: Creates tables for tracking workflow execution and logs

-- Create workflows table
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bin VARCHAR(8) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    process_id VARCHAR(255),
    excel_file_path VARCHAR(500),
    result_file_path VARCHAR(500),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Create workflow_logs table
CREATE TABLE IF NOT EXISTS workflow_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    log_level VARCHAR(20) NOT NULL CHECK (log_level IN ('DEBUG', 'INFO', 'WARN', 'ERROR')),
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_process_id ON workflows(process_id);
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_workflow_id ON workflow_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_created_at ON workflow_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_log_level ON workflow_logs(log_level);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_workflows_updated_at
    BEFORE UPDATE ON workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_workflows_updated_at();

-- Add comments for documentation
COMMENT ON TABLE workflows IS 'Tracks card verification workflow execution';
COMMENT ON TABLE workflow_logs IS 'Stores log entries for workflow execution';
COMMENT ON COLUMN workflows.status IS 'Workflow status: pending, running, completed, failed';
COMMENT ON COLUMN workflows.progress IS 'Progress percentage (0-100)';
COMMENT ON COLUMN workflows.process_id IS 'Process ID from doremon-ai system';
