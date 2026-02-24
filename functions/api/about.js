// GET /api/about — public about data + media
export async function onRequestGet(context) {
  const { env } = context;
  const DB = env.DB;

  const about = await DB.prepare('SELECT * FROM about WHERE id = ?').bind('main').first();
  if (!about) {
    return Response.json({ statement: '', lines: [], contacts: [], media: [] });
  }

  const mediaRows = await DB.prepare(
    'SELECT id, r2_key, position FROM about_media ORDER BY position'
  ).all();

  return Response.json({
    statement: about.statement,
    lines: JSON.parse(about.lines),
    contacts: JSON.parse(about.contacts),
    media: mediaRows.results.map(m => ({
      id: m.id,
      src: `/media/${m.r2_key}`,
    })),
  });
}
