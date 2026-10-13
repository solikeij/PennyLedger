-- Extend account states and mark existing soft-deleted accounts in the archive.
ALTER TABLE Users
    MODIFY COLUMN status ENUM('active', 'inactive', 'suspended', 'deleted') NOT NULL DEFAULT 'active';

UPDATE Users
SET status = 'deleted'
WHERE deleted_at IS NOT NULL;
