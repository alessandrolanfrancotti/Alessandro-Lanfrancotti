// PUT /api/admin/foundry/:slug — update typeface
export async function onRequestPut(context) {
  const { DB, R2_BUCKET } = context.env;
  const slug = context.params.slug;
  const body = await context.request.json();

  const row = await DB.prepare('SELECT id FROM foundry WHERE slug = ?').bind(slug).first();
  if (!row) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const newSlug = body.slug || slug;

  await DB.prepare(`
    UPDATE foundry SET
      name = ?, slug = ?, tagline = ?, description = ?,
      preview_font_key = ?, trial_zip_key = ?, trial_license_key = ?,
      styles = ?, pricing = ?
    WHERE id = ?
  `).bind(
    body.name || '',
    newSlug,
    body.tagline || '',
    body.description || '',
    body.previewFontKey || '',
    body.trialZipKey || '',
    body.trialLicenseKey || '',
    JSON.stringify(body.styles || []),
    JSON.stringify(body.pricing || {}),
    row.id
  ).run();

  return Response.json({ success: true, slug: newSlug });
}

// DELETE /api/admin/foundry/:slug — delete typeface + files
export async function onRequestDelete(context) {
  const { DB, R2_BUCKET } = context.env;
  const slug = context.params.slug;

  const row = await DB.prepare(
    'SELECT id, preview_font_key, trial_zip_key, trial_license_key FROM foundry WHERE slug = ?'
  ).bind(slug).first();

  if (!row) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // Delete R2 files
  const keys = [row.preview_font_key, row.trial_zip_key, row.trial_license_key].filter(Boolean);
  for (const key of keys) {
    await R2_BUCKET.delete(key);
    await DB.prepare('DELETE FROM media WHERE r2_key = ?').bind(key).run();
  }

  await DB.prepare('DELETE FROM foundry WHERE id = ?').bind(row.id).run();

  // Renumber
  const remaining = await DB.prepare('SELECT id FROM foundry ORDER BY position').all();
  const stmts = remaining.results.map((f, i) =>
    DB.prepare('UPDATE foundry SET position = ? WHERE id = ?').bind(i, f.id)
  );
  if (stmts.length) await DB.batch(stmts);

  return Response.json({ success: true });
}

// POST /api/admin/foundry/:slug — upload file for typeface (font, trial zip, license)
export async function onRequestPost(context) {
  const { DB, R2_BUCKET } = context.env;
  const slug = context.params.slug;

  const row = await DB.prepare('SELECT id FROM foundry WHERE slug = ?').bind(slug).first();
  if (!row) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const formData = await context.request.formData();
  const file = formData.get('file');
  const role = formData.get('role'); // 'preview_font', 'trial_zip', 'trial_license'
  const filename = formData.get('filename') || file?.name || 'file';

  if (!file || !role) {
    return Response.json({ error: 'File and role required' }, { status: 400 });
  }

  const ext = filename.split('.').pop().toLowerCase();
  const contentType = file.type || 'application/octet-stream';
  const r2Key = crypto.randomUUID() + '.' + ext;
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

  // Delete old file if exists
  const colName = role + '_key'; // preview_font_key, trial_zip_key, trial_license_key
  const current = await DB.prepare(`SELECT ${colName} FROM foundry WHERE id = ?`).bind(row.id).first();
  if (current && current[colName]) {
    await R2_BUCKET.delete(current[colName]);
    await DB.prepare('DELETE FROM media WHERE r2_key = ?').bind(current[colName]).run();
  }

  await R2_BUCKET.put(r2Key, file.stream(), {
    httpMetadata: { contentType },
  });

  await DB.batch([
    DB.prepare(
      'INSERT INTO media (id, r2_key, filename, content_type, size_bytes) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, r2Key, filename, contentType, file.size),
    DB.prepare(`UPDATE foundry SET ${colName} = ? WHERE id = ?`).bind(r2Key, row.id),
  ]);

  return Response.json({
    id,
    r2_key: r2Key,
    src: `/media/${r2Key}`,
    filename,
  }, { status: 201 });
}
