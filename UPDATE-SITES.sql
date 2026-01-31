-- =====================================================
-- NADI Leave Management - UPDATE SITES
-- Run this to replace old sites with Pulau Pinang sites
-- =====================================================

-- 1. DELETE OLD SITES AND USERS
DELETE FROM leave_requests;
DELETE FROM leave_users;
DELETE FROM sites;

-- 2. RESET SITE CODES AND INSERT NEW SITES
INSERT INTO sites (site_name, site_code) VALUES
    ('Air Putih', 'AP01'),
    ('Kebun Bunga', 'KB01'),
    ('Pulau Tikus', 'PT01'),
    ('Tanjong Bunga', 'TB01'),
    ('Komtar', 'KM01'),
    ('Padang Kota', 'PK01'),
    ('Pengkalan Kota', 'PKK01'),
    ('Batu Lancang', 'BL01'),
    ('Datok Keramat', 'DK01'),
    ('Sungai Pinang', 'SP01'),
    ('Air Itam', 'AI01'),
    ('Paya Terubong', 'PY01'),
    ('Seri Delima', 'SD01'),
    ('Batu Uban', 'BU01'),
    ('Batu Maung', 'BM01'),
    ('Pantai Jerejak', 'PJ01'),
    ('Bayan Lepas', 'BYL01'),
    ('Pulau Betong', 'PB01');

-- 3. INSERT SUPERVISORS
INSERT INTO leave_users (full_name, username, password_hash, role, is_active) VALUES
    ('Supervisor 1', 'supervisor1', 'password123', 'Supervisor', TRUE),
    ('Supervisor 2', 'supervisor2', 'password123', 'Supervisor', TRUE);

-- 4. INSERT STAFF FOR EACH SITE (NO PASSWORD NEEDED)
DO $$
DECLARE
    site_record RECORD;
BEGIN
    FOR site_record IN SELECT site_id, site_code, site_name FROM sites ORDER BY site_name LOOP
        INSERT INTO leave_users (full_name, username, password_hash, role, site_id, is_active)
        VALUES (
            'Manager - ' || site_record.site_name,
            'manager.' || LOWER(site_record.site_code),
            NULL,  -- No password for staff
            'Manager',
            site_record.site_id,
            TRUE
        );
        
        INSERT INTO leave_users (full_name, username, password_hash, role, site_id, is_active)
        VALUES (
            'Assistant Manager - ' || site_record.site_name,
            'am.' || LOWER(site_record.site_code),
            NULL,  -- No password for staff
            'Assistant Manager',
            site_record.site_id,
            TRUE
        );
    END LOOP;
END $$;

-- 5. ADD DELETION_LOGS COLUMN TO SITE_SETTINGS (if not exists)
-- This stores the deletion history log for supervisors
ALTER TABLE site_settings 
ADD COLUMN IF NOT EXISTS deletion_logs JSONB DEFAULT '[]'::jsonb;

-- Add comment to explain the column
COMMENT ON COLUMN site_settings.deletion_logs IS 'Stores deletion history logs when supervisors delete leave requests. JSON array of {request_id, deleted_by, staff_name, leave_date, request_type, deleted_at, timestamp}';

-- ✅ DONE! Sites updated, staff accounts ready (no password), supervisors have passwords, deletion logging ready.
