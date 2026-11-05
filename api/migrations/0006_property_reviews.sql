CREATE TABLE property_reviews (
 id TEXT PRIMARY KEY, author_id TEXT NOT NULL REFERENCES users(id),
 property_name TEXT NOT NULL, area TEXT NOT NULL, notes TEXT NOT NULL,
 ratings TEXT NOT NULL CHECK(json_valid(ratings)), category_notes TEXT NOT NULL CHECK(json_valid(category_notes)),
 photo_key TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
);
CREATE INDEX property_reviews_feed ON property_reviews(deleted_at,id DESC);
