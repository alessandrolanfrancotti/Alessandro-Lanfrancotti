(async function () {
  const res = await fetch("/api/about", { cache: "no-store" });
  if (!res.ok) return;

  const data = await res.json();

  // Statement
  const statementEl = document.getElementById("about-statement");
  if (statementEl) statementEl.textContent = data.statement || "";

  // Visual media (image/gif/video) — from media array
  const visualMount = document.getElementById("about-visual");
  if (visualMount) {
    visualMount.innerHTML = "";

    const mediaList = data.media || [];
    for (const m of mediaList) {
      const src = m.src;
      if (!src) continue;

      const ext = src.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase() || "";
      const isVideo = ["mp4", "webm", "ogg", "mov"].includes(ext);

      if (isVideo) {
        const v = document.createElement("video");
        v.className = "about__visual";
        v.autoplay = true;
        v.muted = true;
        v.loop = true;
        v.playsInline = true;

        const s = document.createElement("source");
        s.src = src;
        if (ext === "mp4") s.type = "video/mp4";
        if (ext === "webm") s.type = "video/webm";
        if (ext === "ogg") s.type = "video/ogg";
        v.appendChild(s);

        v.addEventListener("contextmenu", (e) => e.preventDefault());
        v.addEventListener("dragstart", (e) => e.preventDefault());

        visualMount.appendChild(v);
      } else {
        const img = document.createElement("img");
        img.className = "about__visual";
        img.src = src;
        img.alt = "";
        img.loading = "lazy";
        img.draggable = false;
        img.addEventListener("contextmenu", (e) => e.preventDefault());

        visualMount.appendChild(img);
      }
    }
  }

  // Right column info (lines + contacts)
  const infoEl = document.getElementById("about-info");
  if (!infoEl) return;

  infoEl.innerHTML = "";

  (data.lines || []).forEach((line) => {
    const p = document.createElement("p");
    p.className = "span2";
    p.textContent = line;
    infoEl.appendChild(p);
  });

  (data.contacts || []).forEach((row) => {
    const label = document.createElement("p");
    label.textContent = row.label || "";
    infoEl.appendChild(label);

    const valueP = document.createElement("p");
    if (row.href) {
      const a = document.createElement("a");
      a.className = "link";
      a.href = row.href;
      a.textContent = row.value || "";
      valueP.appendChild(a);
    } else {
      valueP.textContent = row.value || "";
    }
    infoEl.appendChild(valueP);
  });
})();
