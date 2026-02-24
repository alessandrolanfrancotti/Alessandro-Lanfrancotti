// POST /api/admin/foundry — create a new typeface
export async function onRequestPost(context) {
  const { DB } = context.env;
  const body = await context.request.json();

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const slug = body.slug || slugify(body.name || 'untitled');

  const last = await DB.prepare('SELECT MAX(position) as maxPos FROM foundry').first();
  const position = (last?.maxPos ?? -1) + 1;

  await DB.prepare(`
    INSERT INTO foundry (id, name, slug, tagline, description, styles, pricing, position)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.name || '',
    slug,
    body.tagline || '',
    body.description || '',
    JSON.stringify(body.styles || []),
    JSON.stringify(body.pricing || {}),
    position
  ).run();

  return Response.json({ id, slug, position }, { status: 201 });
}

// PUT /api/admin/foundry — reorder typefaces
export async function onRequestPut(context) {
  const { DB } = context.env;
  const { order } = await context.request.json();

  if (!Array.isArray(order)) {
    return Response.json({ error: 'order array required' }, { status: 400 });
  }

  const stmts = order.map((id, i) =>
    DB.prepare('UPDATE foundry SET position = ? WHERE id = ?').bind(i, id)
  );
  if (stmts.length) await DB.batch(stmts);

  return Response.json({ success: true });
}

function slugify(str) {
  return str.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
}
