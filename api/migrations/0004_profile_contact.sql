ALTER TABLE profiles ADD COLUMN contact_phone TEXT;
ALTER TABLE profiles ADD COLUMN share_phone INTEGER NOT NULL DEFAULT 0 CHECK(share_phone IN (0,1));
ALTER TABLE profiles ADD COLUMN address TEXT;
-- Handles are restricted to lowercase ASCII by the API; also enforce case-insensitive uniqueness in D1.
CREATE UNIQUE INDEX idx_profile_handle_casefold ON profiles(lower(handle));
