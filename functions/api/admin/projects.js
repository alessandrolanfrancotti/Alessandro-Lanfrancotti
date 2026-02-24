// POST /api/admin/projects — create a new project
export async function onRequestPost(context) {
  const { DB } = context.env;
  const body = await context.request.json();

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const slug = body.slug || slugify(body.title || 'untitled');

  // Get next position
  const last = await DB.prepare('SELECT MAX(position) as maxPos FROM projects').first();
  const position = (last?.maxPos ?? -1) + 1;

  await DB.prepare(
    'INSERT INTO projects (id, title, slug, work_type, abstract, position) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, body.title || '', slug, body.workType || '', body.abstract || '', position).run();

  return Response.json({ id, slug, position }, { status: 201 });
}

// PUT /api/admin/projects — reorder projects
export async function onRequestPut(context) {
  const { DB } = context.env;
  const { order } = await context.request.json();

  if (!Array.isArray(order)) {
    return Response.json({ error: 'order array required' }, { status: 400 });
  }

  const stmts = order.map((id, i) =>
    DB.prepare('UPDATE projects SET position = ? WHERE id = ?').bind(i, id)
  );
  if (stmts.length) await DB.batch(stmts);

  return Response.json({ success: true });
}

function slugify(str) {
  return str.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
}
