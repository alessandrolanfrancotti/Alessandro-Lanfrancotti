// GET /api/foundry/:slug — single typeface
export async function onRequestGet(context) {
  const DB = context.env.DB;
  const slug = context.params.slug;

  const f = await DB.prepare(
    'SELECT * FROM foundry WHERE slug = ?'
  ).bind(slug).first();

  if (!f) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  return Response.json({
    name: f.name,
    slug: f.slug,
    tagline: f.tagline,
    description: f.description,
    previewFontUrl: f.preview_font_key ? `/media/${f.preview_font_key}` : '',
    trialZipUrl: f.trial_zip_key ? `/media/${f.trial_zip_key}` : '',
    trialLicenseUrl: f.trial_license_key ? `/media/${f.trial_license_key}` : '',
    styles: JSON.parse(f.styles),
    pricing: JSON.parse(f.pricing),
  });
}
