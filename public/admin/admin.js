/* ── Admin Panel ─────────────────────────────────────────────────
 *  Connects to Cloudflare Pages Functions API.
 *  No localStorage, no ZIP export — data lives in D1 + R2.
 * ────────────────────────────────────────────────────────────── */

// ── State ───────────────────────────────────────────────────────
let aboutData  = { statement: '', lines: [], contacts: [], media: [] };
let projects   = [];
let foundryList = [];
let selectedProject = -1;
let selectedFoundry = -1;

// ── Helpers ─────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const status = (msg) => { const el = $('status-msg'); if (el) el.textContent = msg; };

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, cache: 'no-store' });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || res.statusText);
  }
  return res.json();
}

async function apiUpload(path, file, extra = {}) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('filename', file.name);
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  return api(path, { method: 'POST', body: fd });
}

function getExt(name) {
  return (name || '').split('?')[0].split('#')[0].split('.').pop().toLowerCase();
}

function isVideo(name) {
  return ['mp4', 'webm', 'ogg', 'mov'].includes(getExt(name));
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadAll();
  bind();
});

async function loadAll() {
  status('Loading…');
  try {
    const [aboutRes, projRes, foundryRes] = await Promise.all([
      api('/api/about'),
      api('/api/projects'),
      api('/api/foundry'),
    ]);
    aboutData = aboutRes;
    projects = projRes.projects || [];
    foundryList = foundryRes.foundry || [];
    renderAll();
    status('');
  } catch (e) {
    status('Error loading: ' + e.message);
  }
}

// ── Render ──────────────────────────────────────────────────────
function renderAll() {
  renderAbout();
  renderProjectList();
  renderFoundryList();
}

// ── ABOUT ───────────────────────────────────────────────────────
function renderAbout() {
  $('about-statement').value = aboutData.statement || '';
  $('about-lines').value = (aboutData.lines || []).join('\n');
  $('about-contacts').value = (aboutData.contacts || []).map(c =>
    [c.label, c.value, c.href].filter(Boolean).join(' | ')
  ).join('\n');
  renderAboutMedia();
}

function renderAboutMedia() {
  const grid = $('about-media-grid');
  grid.innerHTML = '';
  (aboutData.media || []).forEach((m, i) => {
    const card = document.createElement('div');
    card.className = 'media-card';
    if (isVideo(m.src)) {
      card.innerHTML = `<video src="${m.src}" muted loop playsinline style="width:100%;height:auto;"></video>`;
    } else {
      card.innerHTML = `<img src="${m.src}" loading="lazy" style="width:100%;height:auto;">`;
    }
    const del = document.createElement('button');
    del.className = 'media-card__del';
    del.textContent = '\u00d7';
    del.onclick = () => { aboutData.media.splice(i, 1); renderAboutMedia(); };
    card.appendChild(del);
    grid.appendChild(card);
  });
}

// ── PROJECTS ────────────────────────────────────────────────────
function renderProjectList() {
  const sel = $('proj-list');
  sel.innerHTML = '';
  projects.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = p.title || p.slug || '(untitled)';
    sel.appendChild(opt);
  });
  if (selectedProject >= 0 && selectedProject < projects.length) {
    sel.value = selectedProject;
    fillProject(projects[selectedProject]);
  } else {
    clearProjectForm();
  }
}

function fillProject(p) {
  $('proj-title').value = p.title || '';
  $('proj-slug').value = p.slug || '';
  $('proj-type').value = p.workType || '';
  $('proj-abstract').value = p.abstract || '';
  renderProjectMedia(p);
}

function clearProjectForm() {
  $('proj-title').value = '';
  $('proj-slug').value = '';
  $('proj-type').value = '';
  $('proj-abstract').value = '';
  $('proj-media-grid').innerHTML = '';
}

function renderProjectMedia(p) {
  const grid = $('proj-media-grid');
  grid.innerHTML = '';
  (p.media || []).forEach((m, i) => {
    const card = document.createElement('div');
    card.className = 'media-card';
    if (isVideo(m.src)) {
      card.innerHTML = `<video src="${m.src}" muted loop playsinline style="width:100%;height:auto;"></video>`;
    } else {
      card.innerHTML = `<img src="${m.src}" loading="lazy" style="width:100%;height:auto;">`;
    }
    const del = document.createElement('button');
    del.className = 'media-card__del';
    del.textContent = '\u00d7';
    del.onclick = () => {
      p.media.splice(i, 1);
      renderProjectMedia(p);
    };
    card.appendChild(del);
    grid.appendChild(card);
  });
}

// ── FOUNDRY ─────────────────────────────────────────────────────
function renderFoundryList() {
  const sel = $('gg-list');
  sel.innerHTML = '';
  foundryList.forEach((f, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = f.name || f.slug || '(untitled)';
    sel.appendChild(opt);
  });
  if (selectedFoundry >= 0 && selectedFoundry < foundryList.length) {
    sel.value = selectedFoundry;
    fillFoundry(foundryList[selectedFoundry]);
  } else {
    clearFoundryForm();
  }
}

function fillFoundry(f) {
  $('gg-name').value = f.name || '';
  $('gg-slug').value = f.slug || '';
  $('gg-tagline').value = f.tagline || '';
  $('gg-desc').value = f.description || '';
  $('gg-preview-font-hint').textContent = f.previewFontUrl ? 'Current: ' + f.previewFontUrl : '';
  $('gg-trial-zip-hint').textContent = f.trialZipUrl ? 'Current: ' + f.trialZipUrl : '';
  $('gg-trial-license-hint').textContent = f.trialLicenseUrl ? 'Current: ' + f.trialLicenseUrl : '';

  const styles = f.styles || [];
  $('gg-styles').value = styles.map(s =>
    [s.label, s.weight, s.italic ? 1 : 0].join(' | ')
  ).join('\n');

  const pricing = f.pricing || {};
  const bands = Object.keys(pricing);
  $('gg-pricing').value = bands.map(b =>
    [b, pricing[b]?.single ?? '', pricing[b]?.full ?? ''].join(' | ')
  ).join('\n');
}

function clearFoundryForm() {
  $('gg-name').value = '';
  $('gg-slug').value = '';
  $('gg-tagline').value = '';
  $('gg-desc').value = '';
  $('gg-styles').value = '';
  $('gg-pricing').value = '';
  $('gg-preview-font-hint').textContent = '';
  $('gg-trial-zip-hint').textContent = '';
  $('gg-trial-license-hint').textContent = '';
}

// ── Parse helpers ───────────────────────────────────────────────
function parseLines(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean);
}

function parseContacts(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const parts = line.split('|').map(s => s.trim());
    return { label: parts[0] || '', value: parts[1] || '', href: parts[2] || '' };
  });
}

function parseStyles(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const parts = line.split('|').map(s => s.trim());
    return { label: parts[0] || '', weight: Number(parts[1]) || 400, italic: parts[2] === '1' };
  });
}

function parsePricing(text) {
  const pricing = {};
  text.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
    const parts = line.split('|').map(s => s.trim());
    if (parts[0]) pricing[parts[0]] = { single: Number(parts[1]) || 0, full: Number(parts[2]) || 0 };
  });
  return pricing;
}

// ── Bind Events ─────────────────────────────────────────────────
function bind() {
  // ── Homepage video ──
  // Load current state
  api('/api/admin/homepage').then(data => {
    $('homepage-video-hint').textContent = data.src ? 'Current: ' + data.src : 'No video set';
  }).catch(() => {});

  $('homepage-video').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    status('Uploading homepage video…');
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api('/api/admin/homepage', { method: 'PUT', body: fd });
      $('homepage-video-hint').textContent = 'Current: /media/video-homepage.mp4';
      status('Homepage video updated.');
    } catch (err) {
      status('Error: ' + err.message);
    }
  });

  $('homepage-video-remove').addEventListener('click', async () => {
    if (!confirm('Remove the homepage video?')) return;
    status('Removing homepage video…');
    try {
      await api('/api/admin/homepage', { method: 'DELETE' });
      $('homepage-video-hint').textContent = '';
      status('Homepage video removed.');
    } catch (err) {
      status('Error: ' + err.message);
    }
  });

  // ── About ──
  $('about-media').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    status('Uploading about media…');
    try {
      const result = await apiUpload('/api/admin/about', file);
      aboutData.media.push({ id: result.id, src: result.src });
      renderAboutMedia();
      status('About media uploaded.');
    } catch (err) {
      status('Error: ' + err.message);
    }
    e.target.value = '';
  });

  $('about-media-clear').addEventListener('click', () => {
    aboutData.media = [];
    renderAboutMedia();
  });

  $('about-save').addEventListener('click', async () => {
    status('Saving about…');
    try {
      await api('/api/admin/about', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statement: $('about-statement').value,
          lines: parseLines($('about-lines').value),
          contacts: parseContacts($('about-contacts').value),
          media: aboutData.media,
        }),
      });
      status('About saved.');
    } catch (err) {
      status('Error: ' + err.message);
    }
  });

  // ── Projects ──
  $('proj-list').addEventListener('change', (e) => {
    selectedProject = parseInt(e.target.value);
    if (projects[selectedProject]) fillProject(projects[selectedProject]);
  });

  $('proj-add').addEventListener('click', async () => {
    status('Creating project…');
    try {
      await api('/api/admin/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Project', slug: 'new-project-' + Date.now() }),
      });
      await loadAll();
      selectedProject = projects.length - 1;
      renderProjectList();
      status('Project created.');
    } catch (err) {
      status('Error: ' + err.message);
    }
  });

  $('proj-del').addEventListener('click', async () => {
    if (selectedProject < 0 || !projects[selectedProject]) return;
    const p = projects[selectedProject];
    if (!confirm('Delete "' + (p.title || p.slug) + '"?')) return;
    status('Deleting project…');
    try {
      await api('/api/admin/projects/' + encodeURIComponent(p.slug), { method: 'DELETE' });
      selectedProject = -1;
      await loadAll();
      status('Project deleted.');
    } catch (err) {
      status('Error: ' + err.message);
    }
  });

  $('proj-media').addEventListener('change', async (e) => {
    if (selectedProject < 0 || !projects[selectedProject]) return;
    const p = projects[selectedProject];
    const files = Array.from(e.target.files);
    for (let i = 0; i < files.length; i++) {
      status('Uploading ' + (i + 1) + '/' + files.length + '…');
      try {
        const result = await apiUpload(
          '/api/admin/projects/' + encodeURIComponent(p.slug),
          files[i]
        );
        p.media.push({ id: result.id, src: result.src });
      } catch (err) {
        status('Error uploading: ' + err.message);
      }
    }
    renderProjectMedia(p);
    status('Media uploaded.');
    e.target.value = '';
  });

  $('proj-save').addEventListener('click', async () => {
    if (selectedProject < 0 || !projects[selectedProject]) return;
    const p = projects[selectedProject];
    status('Saving project…');
    try {
      await api('/api/admin/projects/' + encodeURIComponent(p.slug), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: $('proj-title').value,
          slug: $('proj-slug').value,
          workType: $('proj-type').value,
          abstract: $('proj-abstract').value,
          media: p.media,
        }),
      });
      p.title = $('proj-title').value;
      p.slug = $('proj-slug').value;
      p.workType = $('proj-type').value;
      p.abstract = $('proj-abstract').value;
      renderProjectList();
      status('Project saved.');
    } catch (err) {
      status('Error: ' + err.message);
    }
  });

  // ── Project reorder modal ──
  $('proj-order-open').addEventListener('click', () => openOrderModal('proj', projects));
  $('proj-order-close').addEventListener('click', () => closeModal('proj-order-modal'));
  $('proj-order-save').addEventListener('click', async () => {
    const ids = getOrderFromModal('proj-order-list');
    status('Saving project order…');
    try {
      await api('/api/admin/projects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: ids }),
      });
      closeModal('proj-order-modal');
      await loadAll();
      status('Order saved.');
    } catch (err) {
      status('Error: ' + err.message);
    }
  });

  // ── Foundry ──
  $('gg-list').addEventListener('change', (e) => {
    selectedFoundry = parseInt(e.target.value);
    if (foundryList[selectedFoundry]) fillFoundry(foundryList[selectedFoundry]);
  });

  $('gg-add').addEventListener('click', async () => {
    status('Creating typeface…');
    try {
      await api('/api/admin/foundry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Typeface', slug: 'new-typeface-' + Date.now() }),
      });
      await loadAll();
      selectedFoundry = foundryList.length - 1;
      renderFoundryList();
      status('Typeface created.');
    } catch (err) {
      status('Error: ' + err.message);
    }
  });

  $('gg-del').addEventListener('click', async () => {
    if (selectedFoundry < 0 || !foundryList[selectedFoundry]) return;
    const f = foundryList[selectedFoundry];
    if (!confirm('Delete "' + (f.name || f.slug) + '"?')) return;
    status('Deleting typeface…');
    try {
      await api('/api/admin/foundry/' + encodeURIComponent(f.slug), { method: 'DELETE' });
      selectedFoundry = -1;
      await loadAll();
      status('Typeface deleted.');
    } catch (err) {
      status('Error: ' + err.message);
    }
  });

  // Foundry file uploads
  ['preview-font', 'trial-zip', 'trial-license'].forEach(function(role) {
    var inputId = 'gg-' + role;
    var hintId = inputId + '-hint';
    var apiRole = role.replace(/-/g, '_');

    $(inputId).addEventListener('change', async function(e) {
      var file = e.target.files[0];
      if (!file || selectedFoundry < 0) return;
      var f = foundryList[selectedFoundry];
      status('Uploading ' + role + '…');
      try {
        await apiUpload(
          '/api/admin/foundry/' + encodeURIComponent(f.slug),
          file,
          { role: apiRole }
        );
        $(hintId).textContent = 'Uploaded: ' + file.name;
        status(role + ' uploaded.');
      } catch (err) {
        status('Error: ' + err.message);
      }
    });
  });

  $('gg-save').addEventListener('click', async () => {
    if (selectedFoundry < 0 || !foundryList[selectedFoundry]) return;
    const f = foundryList[selectedFoundry];
    status('Saving typeface…');
    try {
      await api('/api/admin/foundry/' + encodeURIComponent(f.slug), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: $('gg-name').value,
          slug: $('gg-slug').value,
          tagline: $('gg-tagline').value,
          description: $('gg-desc').value,
          styles: parseStyles($('gg-styles').value),
          pricing: parsePricing($('gg-pricing').value),
          previewFontKey: f.previewFontUrl ? f.previewFontUrl.replace('/media/', '') : '',
          trialZipKey: f.trialZipUrl ? f.trialZipUrl.replace('/media/', '') : '',
          trialLicenseKey: f.trialLicenseUrl ? f.trialLicenseUrl.replace('/media/', '') : '',
        }),
      });
      f.name = $('gg-name').value;
      f.slug = $('gg-slug').value;
      f.tagline = $('gg-tagline').value;
      f.description = $('gg-desc').value;
      renderFoundryList();
      status('Typeface saved.');
    } catch (err) {
      status('Error: ' + err.message);
    }
  });

  // ── Foundry reorder modal ──
  $('gg-order-open').addEventListener('click', () => openOrderModal('gg', foundryList));
  $('gg-order-close').addEventListener('click', () => closeModal('gg-order-modal'));
  $('gg-order-save').addEventListener('click', async () => {
    const ids = getOrderFromModal('gg-order-list');
    status('Saving foundry order…');
    try {
      await api('/api/admin/foundry', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: ids }),
      });
      closeModal('gg-order-modal');
      await loadAll();
      status('Order saved.');
    } catch (err) {
      status('Error: ' + err.message);
    }
  });
}

// ── Order Modal ─────────────────────────────────────────────────
function openOrderModal(prefix, items) {
  const modal = $(prefix + '-order-modal');
  const list = $(prefix + '-order-list');
  list.innerHTML = '';

  items.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'order-row';
    row.draggable = true;
    row.dataset.id = item.id || item.slug;
    row.innerHTML = '<span class="order-row__handle">\u2630</span>' +
      '<span class="order-row__label">' + escapeHtml(item.title || item.name || item.slug) + '</span>';

    row.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', i.toString());
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => row.classList.remove('dragging'));
    row.addEventListener('dragover', (e) => e.preventDefault());
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
      const toIdx = [...list.children].indexOf(row);
      if (fromIdx === toIdx) return;
      const el = list.children[fromIdx];
      if (fromIdx < toIdx) row.after(el);
      else row.before(el);
    });

    list.appendChild(row);
  });

  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');

  modal.onclick = (e) => { if (e.target === modal) closeModal(modal.id); };
}

function closeModal(id) {
  const modal = $(id);
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
}

function getOrderFromModal(listId) {
  return [...$(listId).children].map(row => row.dataset.id);
}
