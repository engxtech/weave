CREATE TABLE IF NOT EXISTS visual_remix_sessions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  session_name VARCHAR NOT NULL,
  session_data JSONB NOT NULL DEFAULT '{}',
  thumbnail VARCHAR,
  last_accessed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visual_remix_gallery (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  session_id INTEGER,
  type VARCHAR NOT NULL,
  title VARCHAR NOT NULL,
  description TEXT,
  file_url VARCHAR NOT NULL,
  thumbnail_url VARCHAR,
  prompt TEXT,
  metadata JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
