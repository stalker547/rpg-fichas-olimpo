const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

class SqliteStorage {
  constructor(databaseFile, legacyJsonFile, initialDataFile) {
    this.databaseFile = databaseFile;
    this.legacyJsonFile = legacyJsonFile;
    this.initialDataFile = initialDataFile;
    this.db = null;
  }

  init() {
    if (this.db) return;
    fs.mkdirSync(path.dirname(this.databaseFile), { recursive: true });
    this.db = new Database(this.databaseFile);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('synchronous = NORMAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_info (
        version INTEGER NOT NULL,
        migrated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL DEFAULT 'player' CHECK(entity_type IN ('player','npc')),
        name TEXT NOT NULL,
        document_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_entities_type_name ON entities(entity_type, name COLLATE NOCASE);
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        happened_at TEXT NOT NULL,
        note TEXT NOT NULL,
        changes_json TEXT NOT NULL,
        FOREIGN KEY(entity_id) REFERENCES entities(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_audit_entity_date ON audit_log(entity_id, happened_at DESC);
    `);
    const version = this.db.prepare('SELECT version FROM schema_info ORDER BY version DESC LIMIT 1').get();
    if (!version) this.db.prepare('INSERT INTO schema_info(version,migrated_at) VALUES(?,?)').run(1, new Date().toISOString());
    this.migrateInitialData();
  }

  migrateInitialData() {
    const count = this.db.prepare('SELECT COUNT(*) AS total FROM entities').get().total;
    if (count) return;
    let source;
    if (fs.existsSync(this.legacyJsonFile)) {
      source = JSON.parse(fs.readFileSync(this.legacyJsonFile, 'utf8'));
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      fs.copyFileSync(this.legacyJsonFile, `${this.legacyJsonFile}.backup-${stamp}`);
    } else {
      source = JSON.parse(fs.readFileSync(this.initialDataFile, 'utf8'));
      source.settings ||= {};
      source.settings.sourceFolder ||= 'E:\\Users\\sergio\\Desktop\\rpg\\Olimpos';
    }
    this.writeAll(source);
  }

  readAll() {
    this.init();
    const characters = this.db.prepare("SELECT document_json FROM entities WHERE entity_type='player' ORDER BY created_at").all().map(row => JSON.parse(row.document_json));
    const npcs = this.db.prepare("SELECT document_json FROM entities WHERE entity_type='npc' ORDER BY name COLLATE NOCASE").all().map(row => JSON.parse(row.document_json));
    const settings = {};
    for (const row of this.db.prepare('SELECT key,value_json FROM settings').all()) settings[row.key] = JSON.parse(row.value_json);
    return { settings, characters, npcs };
  }

  writeAll(data) {
    this.init();
    const now = new Date().toISOString();
    const upsertEntity = this.db.prepare(`INSERT INTO entities(id,entity_type,name,document_json,created_at,updated_at)
      VALUES(@id,@entityType,@name,@document,@createdAt,@updatedAt)
      ON CONFLICT(id) DO UPDATE SET entity_type=excluded.entity_type,name=excluded.name,document_json=excluded.document_json,updated_at=excluded.updated_at`);
    const upsertSetting = this.db.prepare(`INSERT INTO settings(key,value_json,updated_at) VALUES(?,?,?)
      ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at`);
    const insertAudit = this.db.prepare(`INSERT OR IGNORE INTO audit_log(id,entity_id,happened_at,note,changes_json) VALUES(?,?,?,?,?)`);
    const transaction = this.db.transaction(() => {
      const keep = new Set();
      for (const character of [...(data.characters || []), ...(data.npcs || [])]) {
        keep.add(character.id);
        upsertEntity.run({ id:character.id, entityType:character.entityType || 'player', name:character.name || 'Sem nome', document:JSON.stringify(character), createdAt:character.createdAt || character.updatedAt || now, updatedAt:character.updatedAt || now });
        for (const history of character.history || []) insertAudit.run(history.id, character.id, history.at, history.note || '', JSON.stringify(history.changes || []));
      }
      for (const row of this.db.prepare('SELECT id FROM entities').all()) if (!keep.has(row.id)) this.db.prepare('DELETE FROM entities WHERE id=?').run(row.id);
      for (const [key,value] of Object.entries(data.settings || {})) upsertSetting.run(key, JSON.stringify(value), now);
    });
    transaction();
  }

  close() {
    if (this.db) { this.db.close(); this.db = null; }
  }
}

module.exports = { SqliteStorage };
