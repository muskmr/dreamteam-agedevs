CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed demo users. Passwords are scrypt hashes in the form "salt:hash".
-- demo@example.com  -> password123
-- admin@example.com -> admin123
INSERT INTO users (email, password_hash, role) VALUES
    ('demo@example.com', 'd422ef759f062e98f54b6bb88cb104b2:90ae7508b8e8e063a06222806eb43ddfbf94861c2da3add90008feb6343465bf7cc217da49a36b00dc13574e1a9b49ecd554e5ae1e130d044518f1de0bc9296c', 'user'),
    ('admin@example.com', 'cca376731b0d691589e04050ebaa3c9c:65a40fef3a3a953378af83f63e4a579472738c888c15d0752272d4241acd9ce20cd0286da566b5248bfeb41f34588ec46b5c8f246f63b2a3c1a43dcff23a9800', 'admin');
