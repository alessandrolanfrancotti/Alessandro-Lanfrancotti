// GET /api/projects/:slug — single project with media
export async function onRequestGet(context) {
  const DB = context.env.DB;
  const slug = context.params.slug;

  const project = await DB.prepare(
    'SELECT id, title, slug, work_type, abstract FROM projects WHERE slug = ?'
  ).bind(slug).first();

  if (!project) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const media = await DB.prepare(
    'SELECT id, r2_key, position FROM project_media WHERE project_id = ? ORDER BY position'
  ).bind(project.id).all();

  return Response.json({
    title: project.title,
    slug: project.slug,
    workType: project.work_type,
    abstract: project.abstract,
    media: media.results.map(m => ({
      id: m.id,
      src: `/media/${m.r2_key}`,
    })),
  });
}
