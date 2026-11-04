import 'server-only';
import type { DatabaseSync } from 'node:sqlite';
import { defaultWebsite, websiteSchema, type Website } from './website';

export type WebsiteState = { draft: Website; published: Website; revision: number; publishedRevision: number };
export function getWebsiteState(db: DatabaseSync): WebsiteState {
  let row = db.prepare('SELECT * FROM website_state WHERE id = 1').get();
  if (!row) {
    const seed = structuredClone(defaultWebsite);
    const old = db.prepare("SELECT value FROM content WHERE id = 'announcement'").get();
    if (typeof old?.value === 'string') seed.settings.announcement = old.value;
    const value = JSON.stringify(seed);
    db.prepare('INSERT OR IGNORE INTO website_state (id,draft,published,revision,published_revision) VALUES (1,?,?,0,0)').run(value,value);
    row = db.prepare('SELECT * FROM website_state WHERE id = 1').get()!;
  }
  return { draft: websiteSchema.parse(JSON.parse(String(row.draft))), published: websiteSchema.parse(JSON.parse(String(row.published))), revision: Number(row.revision), publishedRevision: Number(row.published_revision) };
}
export function syncAnnouncement(db: DatabaseSync, announcement: string) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const state = getWebsiteState(db);
    const old = state.published.settings.announcement;
    state.published.settings.announcement = announcement;
    if (state.draft.settings.announcement === old) state.draft.settings.announcement = announcement;
    db.prepare("UPDATE content SET value = ? WHERE id = 'announcement'").run(announcement);
    db.prepare('UPDATE website_state SET draft=?,published=?,revision=revision+1,published_revision=published_revision+1 WHERE id=1').run(JSON.stringify(state.draft),JSON.stringify(state.published));
    db.exec('COMMIT');
  } catch(error) { db.exec('ROLLBACK'); throw error; }
}
