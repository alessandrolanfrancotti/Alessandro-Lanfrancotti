# Alessandro Lanfrancotti — Portfolio

Sito portfolio di Alessandro Lanfrancotti, graphic designer freelance.
Deployato su **Cloudflare Pages** con **R2** (media) e **D1** (database SQLite).

## Architettura

Il sito e' statico (HTML/CSS/JS puro, nessun framework). I contenuti (testi, media) vengono serviti da API serverless (Cloudflare Pages Functions) che leggono da D1 e R2. Non c'e' build step: i file in `public/` vengono serviti direttamente.

```
public/              → File statici serviti da Cloudflare Pages
functions/           → Cloudflare Pages Functions (API serverless)
  admin/_middleware.js   → Auth middleware (login page + cookie HMAC)
  api/admin/_middleware.js → Auth middleware per API admin (verifica cookie)
  api/                → API pubbliche (GET only)
  api/admin/          → API admin (CRUD, protette da auth)
  media/[key].js      → Serve file da R2 con cache immutable
schema.sql           → Schema D1 (7 tabelle)
seed.js              → Script di migrazione da JSON/file locali a D1/R2
wrangler.toml        → Configurazione Cloudflare (bindings D1, R2)
```

## Cloudflare Resources

Tutto vive sull'account Cloudflare di Alessandro (`alessandrolanfrancotti@gmail.com`, Account ID: `ba6f9b27cc2dadc585edc87950f34a03`):

- **Pages project**: `alessandro-lanfrancotti` → `alessandro-lanfrancotti.pages.dev`
- **D1 database**: `alessandro-lanfrancotti-db` (ID: `3cd0cbdf-6cf7-494e-b26e-5de2c82b0800`)
- **R2 bucket**: `alessandro-lanfrancotti-media`
- **Branch di produzione**: `cloudflare-migration` (NON main — main ha ancora il vecchio sito GitHub Pages)

### Environment Variables (Secrets)

Impostate nella dashboard Cloudflare Pages → Settings → Environment variables:

| Variable | Descrizione |
|----------|-------------|
| `ADMIN_USER` | Username per login admin |
| `ADMIN_PASSWORD` | Password per login admin |
| `AUTH_SECRET` | Chiave HMAC per firmare i cookie di sessione (stringa random lunga) |

### Autenticazione wrangler

Per deployare o gestire D1/R2 dal terminale, servono le credenziali dell'account Alessandro nel file `.env` (gia' presente in `.gitignore`, non va committato):

```
CLOUDFLARE_API_TOKEN=<API token con permessi D1+R2+Pages+Workers>
CLOUDFLARE_ACCOUNT_ID=ba6f9b27cc2dadc585edc87950f34a03
```

Per creare il token: Cloudflare Dashboard → My Profile → API Tokens → Create Token → Custom token con permessi:
- Account / D1 / Edit
- Account / Workers R2 Storage / Edit
- Account / Cloudflare Pages / Edit
- Account / Workers Scripts / Edit

Prima di ogni comando wrangler, caricare le variabili:
```bash
export $(cat .env | xargs)
```

## Database (D1)

Schema in `schema.sql`. 7 tabelle:

| Tabella | Descrizione |
|---------|-------------|
| `about` | Singleton (id='main'): statement, lines (JSON), contacts (JSON) |
| `about_media` | Media della pagina about (id, r2_key, position) |
| `projects` | Progetti: title, slug (unique), work_type, abstract, position |
| `project_media` | Media per progetto (project_id FK, r2_key, position) |
| `foundry` | Typeface Gray Garden: name, slug, tagline, description, styles/pricing (JSON), file keys |
| `media` | Registro globale file R2 (r2_key unique, filename, content_type, size) |
| `settings` | Key-value generico. Usato per `homepage_video` → r2_key del video homepage |

## Storage R2

I file media (immagini, video, font, zip) sono su R2 con chiavi piatte: `<uuid>.<ext>` (es. `a1b2c3d4.jpg`).
Eccezione: il video homepage usa la chiave fissa `video-homepage.mp4`.

I file vengono serviti da `functions/media/[key].js` all'URL `/media/<key>` con cache immutable (1 anno).

**Ogni eliminazione da admin cancella anche il file da R2.** Non restano file orfani.

## API

### Pubbliche (GET, no auth)

| Endpoint | Descrizione |
|----------|-------------|
| `GET /api/about` | Dati about + media |
| `GET /api/projects` | Lista progetti con media, ordinati per position |
| `GET /api/projects/:slug` | Singolo progetto |
| `GET /api/foundry` | Lista typeface |
| `GET /api/foundry/:slug` | Singolo typeface |
| `GET /api/homepage` | Info video homepage (`{ src }` o `{ src: null }`) |
| `GET /media/:key` | Serve file da R2 |

### Admin (protette da cookie `al_auth`)

| Endpoint | Descrizione |
|----------|-------------|
| `PUT /api/admin/about` | Aggiorna about (statement, lines, contacts, media). Elimina media rimossi da R2 |
| `POST /api/admin/about` | Upload media about |
| `POST /api/admin/projects` | Crea progetto |
| `PUT /api/admin/projects` | Riordina progetti (`{ order: [id, id, ...] }`) |
| `PUT /api/admin/projects/:slug` | Aggiorna progetto. Elimina media rimossi da R2 |
| `DELETE /api/admin/projects/:slug` | Elimina progetto + tutti i media da R2 |
| `POST /api/admin/projects/:slug` | Upload media progetto |
| `POST /api/admin/foundry` | Crea typeface |
| `PUT /api/admin/foundry` | Riordina typeface |
| `PUT /api/admin/foundry/:slug` | Aggiorna typeface |
| `DELETE /api/admin/foundry/:slug` | Elimina typeface + file da R2 |
| `POST /api/admin/foundry/:slug` | Upload file foundry (preview_font, trial_zip, trial_license) |
| `PUT /api/admin/homepage` | Upload/sostituisci video homepage |
| `DELETE /api/admin/homepage` | Rimuovi video homepage da R2 |
| `GET /api/admin/homepage` | Info video homepage |

## Autenticazione Admin

- Login via form POST a `/admin/__auth` (username + password)
- Credenziali verificate contro env vars `ADMIN_USER` e `ADMIN_PASSWORD`
- Se ok, setta cookie `al_auth` con token HMAC (timestamp + firma SHA-256)
- Cookie: HttpOnly, Secure, SameSite=Lax, Max-Age 4h (14400s)
- Middleware `functions/admin/_middleware.js` protegge le pagine admin
- Middleware `functions/api/admin/_middleware.js` protegge le API admin
- In localhost (dev), auth e' bypassata automaticamente

## Pagine del sito

| URL | File | Descrizione |
|-----|------|-------------|
| `/` | `public/index.html` | Homepage con video di sfondo (caricato da `/api/homepage`) |
| `/about/` | `public/about/index.html` | Pagina about (carica da `/api/about`) |
| `/works/` | `public/works/index.html` | Lista progetti (carica da `/api/projects`) |
| `/works/project/` | `public/works/project/index.html` | Singolo progetto (slug da query string) |
| `/graygarden/` | `public/graygarden/index.html` | Lista typeface foundry (carica da `/api/foundry`) |
| `/graygarden/font.html` | `public/graygarden/font.html` | Singolo typeface |
| `/admin/` | `public/admin/index.html` | Pannello admin (protetto da auth) |

Il sito usa un sistema di partials: `header.html`, `footer.html`, `projects-nav.html` vengono caricati via JS (`site.js`) con `fetch()` e iniettati nel DOM.

## Comandi

```bash
npm run dev            # Dev locale (wrangler pages dev)
npm run deploy         # Deploy su Cloudflare Pages
npm run db:init        # Crea tabelle D1 (aggiungere --remote per produzione)
npm run db:init:local  # Crea tabelle D1 locale
npm run seed           # Migra dati JSON + file locali a D1/R2 remoti
npm run seed:local     # Migra dati in ambiente locale
```

**Nota**: `npm run deploy` e `npm run db:init` usano il flag locale di default. Per produzione:
```bash
export $(cat .env | xargs)
wrangler d1 execute alessandro-lanfrancotti-db --remote --file=schema.sql
wrangler pages deploy public --project-name=alessandro-lanfrancotti
```

## Git

- **Repo**: `github.com/alessandrolanfrancotti/Alessandro-Lanfrancotti`
- **Branch attiva**: `cloudflare-migration` (contiene il nuovo sito Cloudflare)
- **Branch main**: contiene il vecchio sito GitHub Pages (da non toccare finche' non si disattiva GitHub Pages)
- Il deploy Cloudflare Pages e' collegato a GitHub (branch `cloudflare-migration`)

## Prossimi passi

### 1. Collegare la repo locale all'account GitHub di Alessandro

La repo e' attualmente configurata con remote SSH verso `alessandrolanfrancotti/Alessandro-Lanfrancotti`. Per fare commit e push direttamente:

```bash
# Verifica che il remote punti alla repo giusta
git remote -v

# Se usi SSH, assicurati di avere la chiave SSH di Alessandro configurata:
ssh -T git@github.com
# Deve rispondere "Hi alessandrolanfrancotti!"

# Alternativa: usa HTTPS con token
git remote set-url origin https://github.com/alessandrolanfrancotti/Alessandro-Lanfrancotti.git
# Quando fai push, usa un Personal Access Token come password
```

### 2. Disattivare GitHub Pages

GitHub Pages sta ancora pubblicando la branch `main` (il vecchio sito). Va disattivato:

1. Vai su `github.com/alessandrolanfrancotti/Alessandro-Lanfrancotti/settings/pages`
2. Sotto "Source", seleziona **"GitHub Actions"** oppure seleziona **None** per disattivare
3. Questo smette di pubblicare il vecchio sito da main

### 3. Collegare il dominio `alessandrolanfrancotti.com` a Cloudflare Pages

Il dominio e' comprato su Squarespace. Ci sono due opzioni:

**Opzione A — Trasferire i nameserver a Cloudflare (consigliata)**:
1. Vai su Cloudflare Dashboard → Add a site → `alessandrolanfrancotti.com`
2. Scegli il piano Free
3. Cloudflare ti da 2 nameserver (es. `ada.ns.cloudflare.com`, `bo.ns.cloudflare.com`)
4. Vai su Squarespace → Domains → alessandrolanfrancotti.com → DNS Settings → Nameservers
5. Cambia i nameserver con quelli di Cloudflare
6. Torna su Cloudflare, verifica che il dominio sia attivo
7. Vai su Cloudflare Pages → alessandro-lanfrancotti → Custom domains → Add domain → `alessandrolanfrancotti.com`
8. Cloudflare crea automaticamente il record CNAME e il certificato SSL

**Opzione B — Solo CNAME (senza trasferire nameserver)**:
1. Vai su Cloudflare Pages → alessandro-lanfrancotti → Custom domains → Add domain → `alessandrolanfrancotti.com`
2. Cloudflare ti dice di creare un record CNAME
3. Vai su Squarespace → Domains → DNS → aggiungi record CNAME:
   - Host: `@` (o vuoto)
   - Value: `alessandro-lanfrancotti.pages.dev`
4. Nota: Squarespace potrebbe non supportare CNAME su root domain. In quel caso usa `www` e aggiungi un redirect da root a www

**Dopo il collegamento del dominio**, rimuovi il file `public/CNAME` (era per GitHub Pages):
```bash
rm public/CNAME
```

### 4. Merge finale (dopo che tutto funziona col dominio)

Una volta che il dominio punta a Cloudflare Pages e tutto funziona:
```bash
git checkout main
git merge cloudflare-migration
git push origin main
```
Poi in Cloudflare Pages → Settings → cambia la production branch da `cloudflare-migration` a `main`.
