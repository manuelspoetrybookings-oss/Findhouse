CREATE TABLE follows (
 follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 followed_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(follower_id,followed_id), CHECK(follower_id<>followed_id)
);
CREATE INDEX idx_follows_target ON follows(followed_id);
CREATE TRIGGER follow_added AFTER INSERT ON follows BEGIN
 UPDATE profiles SET following_count=following_count+1 WHERE user_id=NEW.follower_id;
 UPDATE profiles SET followers_count=followers_count+1 WHERE user_id=NEW.followed_id;
END;
CREATE TRIGGER follow_removed AFTER DELETE ON follows BEGIN
 UPDATE profiles SET following_count=MAX(0,following_count-1) WHERE user_id=OLD.follower_id;
 UPDATE profiles SET followers_count=MAX(0,followers_count-1) WHERE user_id=OLD.followed_id;
END;
CREATE TABLE conversations (
 id TEXT PRIMARY KEY, user_a TEXT NOT NULL REFERENCES users(id), user_b TEXT NOT NULL REFERENCES users(id),
 created_at INTEGER NOT NULL, UNIQUE(user_a,user_b), CHECK(user_a<user_b)
);
CREATE TABLE messages (
 id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 sender_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
 created_at INTEGER NOT NULL
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id,id);
CREATE TABLE inspection_requests (
 id TEXT PRIMARY KEY, requester_id TEXT NOT NULL REFERENCES users(id), listing_id TEXT REFERENCES listings(id) ON DELETE SET NULL,
 title TEXT NOT NULL, area TEXT NOT NULL, details TEXT NOT NULL, budget INTEGER NOT NULL,
 preferred_at TEXT, provider_id TEXT REFERENCES users(id), report TEXT,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','assigned','submitted','completed','cancelled')),
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX idx_inspections_status ON inspection_requests(status,created_at);
CREATE TABLE inspection_offers (
 request_id TEXT NOT NULL REFERENCES inspection_requests(id) ON DELETE CASCADE,
 provider_id TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL,
 PRIMARY KEY(request_id,provider_id)
);
