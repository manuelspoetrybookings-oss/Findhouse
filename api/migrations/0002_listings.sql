CREATE TABLE listings (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL, description TEXT NOT NULL, area TEXT NOT NULL,
 type TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('Rent','Buy')),
 price INTEGER NOT NULL CHECK(price > 0), beds INTEGER NOT NULL, baths INTEGER NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX idx_listings_owner ON listings(owner_id, created_at DESC);
CREATE TABLE saved_listings (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
 PRIMARY KEY(user_id,listing_id)
);
