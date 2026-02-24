#!/usr/bin/env node
/**
 * Seed script: migrates existing JSON content + asset files to D1 + R2.
 *
 * Usage:
 *   node seed.js          # production
 *   node seed.js --local  # local dev (miniflare)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const CONTENT = path.join(ROOT, 'content');
const ASSETS = path.join(ROOT, 'assets');
const DB_NAME = 'alessandro-lanfrancotti-db';
const BUCKET = 'alessandro-lanfrancotti-media';
const isLocal = process.argv.includes('--local');
const localFlag = isLocal ? ' --local' : '';

function run(cmd) {
  console.log('> ' + cmd);
  try {
    return execSync(cmd, { cwd: ROOT, stdio: 'pipe', encoding: 'utf-8' });
  } catch (e) {
    console.error('Command failed:', e.stderr || e.message);
    throw e;
  }
}

function d1(sql, params = []) {
  // Escape single quotes in SQL for shell
  const escaped = sql.replace(/'/g, "'\\''");
  const cmd = `wrangler d1 execute ${DB_NAME} --command='${escaped}'${localFlag}`;
  return run(cmd);
}

function r2put(key, filePath, contentType) {
  const ct = contentType || guessContentType(path.extname(filePath).slice(1).toLowerCase());
  const cmd = `wrangler r2 object put ${BUCKET}/${key} --file="${filePath}" --content-type="${ct}"${localFlag}`;
  return run(cmd);
}

function guessContentType(ext) {
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', ogg: 'video/ogg',
    woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
    zip: 'application/zip', pdf: 'application/pdf',
  };
  return map[ext] || 'application/octet-stream';
}

function id() {
  return crypto.randomBytes(8).toString('hex');
}

async function main() {
  console.log(`\nSeeding ${isLocal ? 'LOCAL' : 'PRODUCTION'} environment...\n`);

  // ── 1. About ──────────────────────────────────────────────────
  const aboutPath = path.join(CONTENT, 'about.json');
  if (fs.existsSync(aboutPath)) {
    const about = JSON.parse(fs.readFileSync(aboutPath, 'utf-8'));
    const statement = (about.statement || '').replace(/'/g, "''");
    const lines = JSON.stringify(about.lines || []).replace(/'/g, "''");
    const contacts = JSON.stringify(about.contacts || []).replace(/'/g, "''");

    d1(`INSERT OR REPLACE INTO about (id, statement, lines, contacts) VALUES ('main', '${statement}', '${lines}', '${contacts}')`);
    console.log('  About data inserted.');

    // Upload about media
    if (about.media && about.media.length > 0) {
      for (let i = 0; i < about.media.length; i++) {
        const m = about.media[i];
        const localFile = m.file ? path.join(ROOT, m.file.replace(/^\//, '')) : null;
        if (localFile && fs.existsSync(localFile)) {
          const ext = path.extname(localFile).slice(1);
          const r2Key = `${id()}.${ext}`;
          const mediaId = id();
          r2put(r2Key, localFile);
          d1(`INSERT INTO media (id, r2_key, filename, content_type, size_bytes) VALUES ('${mediaId}', '${r2Key}', '${path.basename(localFile)}', 'image/${ext}', ${fs.statSync(localFile).size})`);
          d1(`INSERT INTO about_media (id, r2_key, position) VALUES ('${mediaId}', '${r2Key}', ${i})`);
          console.log(`  About media uploaded: ${r2Key}`);
        } else {
          console.log(`  About media file not found: ${m.file || 'unknown'} (skipping)`);
        }
      }
    }
  }

  // ── 2. Projects ───────────────────────────────────────────────
  const projIndexPath = path.join(CONTENT, 'projects', 'index.json');
  if (fs.existsSync(projIndexPath)) {
    const manifest = JSON.parse(fs.readFileSync(projIndexPath, 'utf-8'));

    for (let pos = 0; pos < manifest.length; pos++) {
      const relPath = manifest[pos].replace(/^\//, '');
      const projPath = path.join(ROOT, relPath);
      if (!fs.existsSync(projPath)) {
        console.log(`  Project file not found: ${relPath} (skipping)`);
        continue;
      }

      const proj = JSON.parse(fs.readFileSync(projPath, 'utf-8'));
      const projId = id();
      const title = (proj.title || '').replace(/'/g, "''");
      const slug = (proj.slug || '').replace(/'/g, "''");
      const workType = (proj.workType || '').replace(/'/g, "''");
      const abstract = (proj.abstract || '').replace(/'/g, "''");

      d1(`INSERT INTO projects (id, title, slug, work_type, abstract, position) VALUES ('${projId}', '${title}', '${slug}', '${workType}', '${abstract}', ${pos})`);
      console.log(`  Project "${proj.title}" inserted.`);

      // Upload project media
      if (proj.media && proj.media.length > 0) {
        for (let mi = 0; mi < proj.media.length; mi++) {
          const m = proj.media[mi];
          const filePath = (typeof m === 'string' ? m : m.file || '').replace(/^\//, '');
          const localFile = path.join(ROOT, filePath);

          if (fs.existsSync(localFile)) {
            const ext = path.extname(localFile).slice(1).toLowerCase();
            const r2Key = `${id()}.${ext}`;
            const mediaId = id();

            const contentTypes = {
              jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
              mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', ogg: 'video/ogg'
            };
            const ct = contentTypes[ext] || 'application/octet-stream';

            r2put(r2Key, localFile);
            d1(`INSERT INTO media (id, r2_key, filename, content_type, size_bytes) VALUES ('${mediaId}', '${r2Key}', '${path.basename(localFile)}', '${ct}', ${fs.statSync(localFile).size})`);
            d1(`INSERT INTO project_media (id, project_id, r2_key, position) VALUES ('${mediaId}', '${projId}', '${r2Key}', ${mi})`);
            console.log(`    Media uploaded: ${r2Key}`);
          } else {
            console.log(`    Media file not found: ${filePath} (skipping)`);
          }
        }
      }
    }
  }

  // ── 3. Foundry ────────────────────────────────────────────────
  const foundryIndexPath = path.join(CONTENT, 'foundry', 'index.json');
  if (fs.existsSync(foundryIndexPath)) {
    const manifest = JSON.parse(fs.readFileSync(foundryIndexPath, 'utf-8'));

    for (let pos = 0; pos < manifest.length; pos++) {
      const relPath = manifest[pos].replace(/^\//, '');
      const fPath = path.join(ROOT, relPath);
      if (!fs.existsSync(fPath)) {
        console.log(`  Foundry file not found: ${relPath} (skipping)`);
        continue;
      }

      const f = JSON.parse(fs.readFileSync(fPath, 'utf-8'));
      const fId = id();
      const name = (f.name || '').replace(/'/g, "''");
      const slug = (f.slug || '').replace(/'/g, "''");
      const tagline = (f.tagline || '').replace(/'/g, "''");
      const description = (f.description || '').replace(/'/g, "''");
      const styles = JSON.stringify(f.styles || []).replace(/'/g, "''");
      const pricing = JSON.stringify(f.pricing || {}).replace(/'/g, "''");

      d1(`INSERT INTO foundry (id, name, slug, tagline, description, styles, pricing, position) VALUES ('${fId}', '${name}', '${slug}', '${tagline}', '${description}', '${styles}', '${pricing}', ${pos})`);
      console.log(`  Foundry "${f.name}" inserted.`);

      // Upload foundry files (preview font, trial zip, trial license)
      const filesToUpload = [
        { key: 'preview_font_key', src: f.previewFontUrl, role: 'preview' },
        { key: 'trial_zip_key', src: f.trialZipUrl || f.trialDownloadUrl, role: 'trial' },
        { key: 'trial_license_key', src: f.trialLicenseUrl, role: 'license' },
      ];

      for (const fu of filesToUpload) {
        if (fu.src) {
          const localFile = path.join(ROOT, fu.src.replace(/^\//, ''));
          if (fs.existsSync(localFile)) {
            const ext = path.extname(localFile).slice(1).toLowerCase();
            const r2Key = `${id()}.${ext}`;
            r2put(r2Key, localFile);
            d1(`UPDATE foundry SET ${fu.key} = '${r2Key}' WHERE id = '${fId}'`);
            console.log(`    Foundry file uploaded: ${r2Key}`);
          }
        }
      }
    }
  } else {
    console.log('  No foundry index found (skipping).');
  }

  // ── 4. Homepage video ─────────────────────────────────────────
  const homepageVideo = path.join(ASSETS, 'video-homepage.mp4');
  if (fs.existsSync(homepageVideo)) {
    r2put('video-homepage.mp4', homepageVideo);
    d1("INSERT OR REPLACE INTO settings (key, value) VALUES ('homepage_video', 'video-homepage.mp4')");
    console.log('  Homepage video uploaded.');
  } else {
    console.log('  Homepage video not found (skipping).');
  }

  console.log('\nSeed complete!\n');
}

main().catch(e => {
  console.error('Seed failed:', e);
  process.exit(1);
});
