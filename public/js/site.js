// Load shared header into any page that contains #site-header
fetch("/partials/header.html")
  .then((res) => res.text())
  .then((html) => {
    const el = document.getElementById("site-header");
    if (el) {
      el.innerHTML = html;

      // ATTIVA DROPDOWN DOPO CHE L'HEADER È STATO INSERITO
      setupDropdown();
    }
  })
  .catch(() => {});


// Load footer
fetch("/partials/footer.html")
  .then((res) => res.text())
  .then((html) => {
    const el = document.getElementById("site-footer");
    if (el) {
      el.innerHTML = html;

      // set current year
      const yearEl = document.getElementById("footer-year");
      if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
      }
    }
  })
  .catch(() => {});


// Load shared projects nav into any page that contains #projects-nav
fetch("/partials/projects-nav.html")
  .then((res) => res.text())
  .then((html) => {
    const mount = document.getElementById("projects-nav");
    if (!mount) return;

    mount.innerHTML = html;

    // set current project link automatically
    const currentPath = normalizePath(window.location.pathname);
    const links = mount.querySelectorAll('a[href]');
    links.forEach((a) => {
      const hrefPath = normalizePath(new URL(a.getAttribute("href"), window.location.origin).pathname);
      if (hrefPath === currentPath) {
        a.setAttribute("aria-current", "page");
      } else {
        a.removeAttribute("aria-current");
      }
    });
  })
  .catch(() => {});

// Disable context menu only on homepage background video (if present)
const video = document.getElementById("bgVideo");
if (video) {
  video.addEventListener("contextmenu", (e) => e.preventDefault());
  video.addEventListener("dragstart", (e) => e.preventDefault());
}

function normalizePath(path) {
  // normalize trailing slash
  if (!path.endsWith("/")) return path + "/";
  return path;
}

// Dropdown Gray Garden (click + outside click + ESC)
function setupDropdown() {
  const dd = document.getElementById("gg-dropdown");
  if (!dd) return;

  const trigger = dd.querySelector(".dropdown__trigger");
  const panel = dd.querySelector(".dropdown__panel");
  if (!trigger || !panel) return;

  const open = () => {
    dd.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
  };

  const close = () => {
    dd.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
  };

  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    dd.classList.contains("is-open") ? close() : open();
  });

  document.addEventListener("click", (e) => {
    if (!dd.contains(e.target)) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}
