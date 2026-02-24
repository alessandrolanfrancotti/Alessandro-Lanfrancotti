-- About (singleton row)
CREATE TABLE IF NOT EXISTS about (
    id        TEXT PRIMARY KEY DEFAULT 'main',
    statement TEXT NOT NULL DEFAULT '',
    lines     TEXT NOT NULL DEFAULT '[]',
    contacts  TEXT NOT NULL DEFAULT '[]'
);

-- About media
CREATE TABLE IF NOT EXISTS about_media (
    id       TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    r2_key   TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id        TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    title     TEXT NOT NULL DEFAULT '',
    slug      TEXT NOT NULL UNIQUE,
    work_type TEXT NOT NULL DEFAULT '',
    abstract  TEXT NOT NULL DEFAULT '',
    position  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_projects_position ON projects(position);

-- Project media
CREATE TABLE IF NOT EXISTS project_media (
    id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    r2_key     TEXT NOT NULL,
    position   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_project_media_project ON project_media(project_id);

-- Gray Garden foundry
CREATE TABLE IF NOT EXISTS foundry (
    id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    name              TEXT NOT NULL DEFAULT '',
    slug              TEXT NOT NULL UNIQUE,
    tagline           TEXT NOT NULL DEFAULT '',
    description       TEXT NOT NULL DEFAULT '',
    preview_font_key  TEXT DEFAULT '',
    trial_zip_key     TEXT DEFAULT '',
    trial_license_key TEXT DEFAULT '',
    styles            TEXT NOT NULL DEFAULT '[]',
    pricing           TEXT NOT NULL DEFAULT '{}',
    position          INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_foundry_position ON foundry(position);

-- Media library
CREATE TABLE IF NOT EXISTS media (
    id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    r2_key       TEXT NOT NULL UNIQUE,
    filename     TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT '',
    size_bytes   INTEGER NOT NULL DEFAULT 0,
    uploaded_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Settings (key-value)
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
);
