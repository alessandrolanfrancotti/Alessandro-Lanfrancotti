async function loadFoundryHome(){
  const list = document.getElementById("gg-list");
  if(!list) return;

  try{
    const res = await fetch("/api/foundry",{cache:"no-store"});
    const { foundry } = await res.json();

    for(const f of foundry){
      const a = document.createElement("a");
      a.href = "/graygarden/font.html?font=" + f.slug;
      a.className = "gg-item";
      a.innerHTML = `
        <strong>${f.name}</strong><br>
        <span class="gg-muted">${f.tagline || ""}</span>
      `;
      list.appendChild(a);
    }

  }catch(e){
    list.innerHTML = "<p>No fonts found.</p>";
  }
}

async function loadFontPage(){
  const params = new URLSearchParams(location.search);
  const slug = params.get("font");
  if(!slug) return;

  try{
    const res = await fetch("/api/foundry/" + encodeURIComponent(slug),{cache:"no-store"});
    const data = await res.json();

    document.getElementById("font-name").textContent = data.name;
    document.getElementById("font-tagline").textContent = data.tagline || "";

    const trialDl = document.getElementById("trial-download");
    if(trialDl) trialDl.href = data.trialZipUrl || "#";

    const trialLic = document.getElementById("trial-license");
    if(trialLic) trialLic.href = data.trialLicenseUrl || "#";

    const mail = document.getElementById("buy-email");
    if(mail){
      mail.href = "mailto:" + (data.emailToBuy || "");
      mail.textContent = data.emailToBuy || "";
    }

    if(data.previewFontUrl) injectFont(data.previewFontUrl, data.name);

    setupTester(data.name);
    setupPricing(data.pricing);

  }catch(e){
    console.log(e);
  }
}

function injectFont(url, name){
  const style = document.createElement("style");
  style.innerHTML = `
    @font-face{
      font-family:"previewFont";
      src:url("${url}") format("woff2");
      font-weight:1 1000;
    }
  `;
  document.head.appendChild(style);
}

function setupTester(fontName){
  const tester = document.getElementById("tester");
  if(!tester) return;
  tester.style.fontFamily = "previewFont";

  const w = document.getElementById("wght");
  const s = document.getElementById("size");

  function update(){
    tester.style.fontVariationSettings = `"wght" ${w.value}`;
    tester.style.fontSize = s.value + "px";
  }

  if(w) w.oninput = update;
  if(s) s.oninput = update;
  update();
}

function setupPricing(p){
  if(!p || !p.tiers) return;

  const emp = document.getElementById("employees");
  if(!emp) return;
  emp.innerHTML = "";

  p.tiers.forEach((t,i)=>{
    const opt = document.createElement("option");
    opt.textContent = t;
    opt.value = i;
    emp.appendChild(opt);
  });

  const lic = document.getElementById("license");
  const out = document.getElementById("price");

  function calc(){
    const i = emp.value;
    const type = lic.value;
    const arr = type === "family" ? p.family : p.single;
    if(out && arr) out.textContent = "€ " + arr[i];
  }

  if(emp) emp.onchange = calc;
  if(lic) lic.onchange = calc;
  calc();
}
