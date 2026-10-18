ALTER TABLE inspection_requests ADD COLUMN deleted_at INTEGER;
CREATE TABLE inspection_likes (
 request_id TEXT NOT NULL REFERENCES inspection_requests(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at INTEGER NOT NULL, PRIMARY KEY(request_id,user_id)
);
CREATE TABLE inspection_comments (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES inspection_requests(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 1000),
 created_at INTEGER NOT NULL
);
CREATE INDEX idx_inspection_comments ON inspection_comments(request_id,id);
