(async function () {
  const res = await fetch("/api/projects", { cache: "no-store" });
  if (!res.ok) return;

  const { projects } = await res.json();

  const navMount = document.getElementById("projects-nav");
  if (navMount) {
    navMount.innerHTML = `
      <nav class="project__nav" aria-label="Selected Projects list">
        <ul>
          ${projects.map(p => `
            <li><a class="link" href="#${encodeURIComponent(p.slug)}">${escapeHtml(p.title || p.slug)}</a></li>
          `).join("")}
        </ul>
      </nav>
    `;
  }

  function slugFromHash(){
    return decodeURIComponent((window.location.hash || "").replace("#","").trim());
  }

  function setCurrent(slug){
    document.querySelectorAll('#projects-nav a[href^="#"]').forEach(a => {
      const s = decodeURIComponent(a.getAttribute("href").slice(1));
      if (s === slug) a.setAttribute("aria-current","page");
      else a.removeAttribute("aria-current");
    });
  }

  function render(p){
    const typeEl = document.getElementById("project-type");
    const absEl = document.getElementById("project-abstract");
    const mediaEl = document.getElementById("project-media");

    if (typeEl) typeEl.textContent = p.workType || "";
    if (absEl) absEl.textContent = p.abstract || "";
    if (!mediaEl) return;

    mediaEl.innerHTML = "";

    (p.media || []).forEach(item => {
      const src = item.src || (typeof item === "string" ? item : item.file);
      if (!src) return;

      const ext = src.split(".").pop().toLowerCase();

      if (ext === "mp4" || ext === "webm" || ext === "mov") {
        const v = document.createElement("video");
        v.autoplay = true;
        v.muted = true;
        v.loop = true;
        v.playsInline = true;

        const s = document.createElement("source");
        s.src = src;
        if (ext === "mp4") s.type = "video/mp4";
        else if (ext === "webm") s.type = "video/webm";
        v.appendChild(s);

        mediaEl.appendChild(v);
      } else {
        const img = document.createElement("img");
        img.src = src;
        img.alt = "";
        img.loading = "lazy";
        mediaEl.appendChild(img);
      }
    });

    setCurrent(p.slug);
  }

  function pick(){
    const slug = slugFromHash();
    return projects.find(p => p.slug === slug) || projects[0];
  }

  const first = pick();
  if (first) {
    if (!slugFromHash()) window.location.hash = first.slug;
    render(first);
  }

  window.addEventListener("hashchange", () => {
    const p = pick();
    if (p) render(p);
  });

  function escapeHtml(str){
    return String(str)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }
})();
