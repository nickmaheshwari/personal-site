# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## Purpose

This is Nicholas Maheshwari's personal website, live at https://www.nicholasmaheshwari.com/.

- **Today:** a static, single-page resume/portfolio site (About, Resume, Portfolio, Testimonials, Contact).
- **Going forward:** the site will also host additional functionality, such as **hidden webapps**: standalone tools served under unlisted paths that aren't linked from the main page. The resume site must keep working unchanged as these are added.

## Hosting and deployment

- **Netlify** hosts the site and deploys automatically from pushes to `master`. `netlify.toml` is the source of truth for build settings: `npm run build` copies the static resume files into `dist/` (`scripts/build-site.mjs`), then builds each app under `apps/` into `dist/<app>/`. Netlify publishes `dist/`. Keep config in `netlify.toml` rather than the Netlify UI.
- **AWS Route 53** holds DNS for `nicholasmaheshwari.com` and points the apex/`www` records at Netlify. DNS changes are made in AWS, not in this repo.
- **Environment variables** are set in the Netlify UI and listed in `.env.example`. Currently only the optional `USAJOBS_API_KEY` and `USAJOBS_EMAIL`. For local dev, put them in a repo-root `.env`.
- Every push to `master` goes to production. Use feature branches and Netlify deploy previews (PRs) for anything non-trivial.

## Commands

```sh
npm install          # root + all app workspaces
npm run build        # dist/ = static site + built apps
npm test             # vitest (unit tests live next to the code: *.test.ts)
npm run typecheck    # functions + every app
npm run lint         # biome; `npm run format` to auto-fix
npm run dev -w apps/i-need-a-job   # http://localhost:5173/i-need-a-job/ (the dev server also runs the app's functions, with .env loaded)
netlify dev          # optional: whole site + all functions as Netlify runs them, on :8888 (needs netlify-cli; run `npm run build` first)
```

## Current structure

```
index.html            # The entire resume site (single page, section anchors)
css/                  # Ceevee theme styles: default, layout, media-queries, magnific-popup
  font-awesome/, fontello/, fonts/   # Vendored icon fonts and webfonts (don't edit)
js/
  init.js             # Site behavior: smooth scroll, nav highlighting, modals, contact form
  jquery*.js, modernizr.js, waypoints.js, magnific-popup.js, ...  # Vendored libs (don't edit)
images/
  resume.pdf          # Downloadable resume, linked from the Resume section
  portfolio/          # Portfolio thumbnails; portfolio/modals/ holds the popup images
inc/sendEmail.php     # Legacy contact handler from the template (see note below; not published)
favicon_n.png
readme.txt            # Credits for the template, fonts, icons, and libraries

apps/i-need-a-job/    # Hidden webapp at /i-need-a-job (React + Vite + TS)
  src/                # UI: resume → title chips + filters → progressive results
    extract.ts        #   PDF (pdf.js) / DOCX (fflate) / TXT → plain text, in the browser
    tracker.ts        #   Application tracker (status, notes, CSV export) in localStorage
    FitCheck.tsx      #   Per-job resume keyword check
  shared/             # Code used by both the UI and the functions (+ tests)
    taxonomy.ts       #   Job families: titles, aliases, skill keywords, adjacent families
    resume.ts         #   Resume text → suggested titles + years of experience
    companies.ts      #   Allowlist of ~160 employers: job board, slug, industry
    normalize.ts      #   Greenhouse/Lever/Ashby/SmartRecruiters → Job; salary and years-of-experience extraction
    usajobs.ts        #   USAJOBS (federal) title search → Job
    posting.ts        #   One posting's full description (for the keyword check)
    keywords.ts       #   Resume vs. posting: which taxonomy keywords match or are missing
    match.ts          #   Title matching, filters, and per-filter stats (runs in the browser)
    locations.ts      #   Location dropdown options and aliases
netlify/functions/    # Serverless API (TypeScript, modern Netlify Functions API)
  i-need-a-job-jobs.mts     # GET /api/i-need-a-job/jobs: one company's postings, CDN-cached 1h
  i-need-a-job-usajobs.mts  # GET /api/i-need-a-job/usajobs?title=: federal postings; { disabled: true } without a key
  i-need-a-job-posting.mts  # GET /api/i-need-a-job/posting?source&slug&id: one posting's text, CDN-cached 1h
scripts/build-site.mjs      # Copies the static site into dist/
netlify.toml                # Build, headers (noindex + CSP for hidden apps)
```

### i-need-a-job

- **Job data comes from public job-board APIs** (Greenhouse, Lever, Ashby, SmartRecruiters), not from scraping HTML. They're stable and intended for public use. Together they cover tech companies plus employers in finance, healthcare, retail, media, hospitality, aerospace and more. Workday has no public API, so Workday employers are out of scope.
- **Adding a company:** find its board slug, confirm the API returns postings, and add it to `shared/companies.ts` with an industry. The jobs function only fetches allowlisted companies, so it can't be used as an open proxy.
- **SmartRecruiters limits:** its list endpoint has no descriptions, so those postings never have salary or experience data. Each board is capped at 2,000 postings.
- **Federal jobs (USAJOBS)** come from the official API, searched by title (one request per selected title), and are tagged with the "Nonprofit & Government" industry. The key is free, from developer.usajobs.gov. Without one, the function returns `{ disabled: true }` and the page says federal jobs aren't included.
- **Considered and skipped:** Adzuna (free tier is 250 calls a day, requires logo attribution, and commercial use needs a license). Idealist and governmentjobs.com (no public APIs). Workday (no public API).
- **Search flow:** the browser fetches every company through the jobs function, plus USAJOBS for each selected title, eight requests at a time (about 35k postings). It keeps all postings in memory and filters them on the client. Changing filters after a search doesn't make new requests. When nothing matches, the page says which filter removed the postings (`filterJobsWithStats`).
- **Title matching:** strict mode requires every word of a selected title to appear in the posting title. Broad mode (on by default) applies to titles of 3+ words and requires the role word (the last word) plus at least half of the other words, including one that isn't generic (see `GENERIC_WORDS`). Seniority words are dropped from selected titles unless they're the last word ("Development Associate"), and are never dropped from posting titles.
- **Ambiguous titles** match the wrong industry. "Program Director" matches tech program-management directors, and "Development Associate" matches business development roles. Pick posting-facing titles that are distinctive ("Director of Programs", "Philanthropy Manager") and keep the ambiguous wording as an alias, so it's still detected in resumes.
- **Applying is always done by the user.** There's no auto-apply, by design: the job boards' apply APIs need the employer's key, and form-filling bots break their terms and hurt applications. The app speeds things up instead:
  - **Apply links:** Lever, Ashby and USAJOBS provide a direct link to the application form (`Job.applyUrl`). Greenhouse and SmartRecruiters link to the posting.
  - **Tracker:** Saved → Applied → Interviewing → Offer → Rejected, with notes and CSV export. It lives only in the visitor's browser (`localStorage`, key `i-need-a-job:tracker:v1`), so a change to `TrackedJob`'s shape needs a new key or a migration.
  - **Resume fit:** compares the posting's description with the resume text, which stays in memory, using the taxonomy keywords. It's unavailable for USAJOBS postings.
- **No AI or LLM calls, by design.** Title suggestions are plain text processing in `shared/resume.ts`, and the resume never leaves the browser. Each family is scored as 4 × (its titles mentioned in the resume) + (distinct keyword hits). Mentioned titles are "close". Families scoring at least 35% of the best family are "related". Up to 10 titles from their adjacent families are "stretch". To improve suggestions, edit `shared/taxonomy.ts` and add a case to `shared/resume.test.ts`.
- **Writing taxonomy entries:** some titles are too generic to detect in a resume (Server, Editor, Scientist), so they're marked `aliasesOnly` and only their aliases count as mentions. Avoid aliases and keywords with common other meanings, such as "Driver", "Producer" (Kafka), "Picker" (date picker) and "production".
- **Years of experience** is the total of date ranges in work sections, with overlaps merged and education/projects/skills sections skipped.
- **Known limits:** salary and years-of-experience values are parsed from posting text with regexes, so some postings have neither. Coverage of nonprofits, local government and healthcare systems is thin, because most of them use Workday, NEOGOV or their own sites, which have no public APIs.

The resume site is based on the **Ceevee** template by Styleshout and uses jQuery 1.10 with plugins. It has no build step of its own: its files are copied into `dist/` unchanged.

### Common edits

- **Resume content:** edit the `#resume` section in `index.html` and replace `images/resume.pdf`.
- **Portfolio project:** each project needs two pieces in `index.html`: a `.portfolio-item` tile inside `#portfolio-wrapper` linking to `#modal-NN`, and a matching `<div id="modal-NN" class="popup-modal mfp-hide">`. Put the thumbnail in `images/portfolio/` and the modal image in `images/portfolio/modals/`.
- **Styling:** prefer `css/layout.css` and `css/media-queries.css`. Check mobile breakpoints after changes.

### Known quirks

- **Contact form handlers conflict.** The form in `index.html` has `data-netlify="true"` (Netlify Forms), but `js/init.js` intercepts the submit and POSTs via AJAX to `inc/sendEmail.php`. Netlify doesn't execute PHP, so treat `sendEmail.php` as dead code. Fixing this means switching the AJAX submit to Netlify Forms (POST url-encoded data to `/` with `form-name`) or to a Netlify Function.
- `.gitignore` still starts with a leftover Java/Maven template. The Node entries are at the bottom. Add Python entries (`.venv/`, `__pycache__/`) with the first Python app.

## Adding webapps

### Layout

Keep the resume site at the root and isolate each app so it can be built, tested, and removed independently:

```
index.html, css/, js/, images/   # Resume site (unchanged)
apps/
  <app-name>/                    # One directory per webapp
    package.json / pyproject.toml
    src/
    tests/
    README.md                    # What it does, how to run it, where it's served
netlify/
  functions/                     # Serverless backends (TypeScript preferred)
netlify.toml                     # Build, redirects, headers, function config
```

- Each app builds into `dist/<app-name>/` and is served at `/<app-name>/`. Set Vite `base` and `build.outDir` to match (see `apps/i-need-a-job/vite.config.ts`), and give the app its own `build` and `typecheck` scripts so the root `npm run build` and `npm run typecheck` pick it up.
- Only paths listed in `scripts/build-site.mjs` and the built apps are published. Never publish source, tests, or config files.

### "Hidden" apps are not secure apps

An unlinked URL is security through obscurity. It stays hidden only until someone shares it, crawls it, or guesses it.

- Add `<meta name="robots" content="noindex, nofollow">` and/or an `X-Robots-Tag: noindex` header (in `netlify.toml`) for hidden paths. Never list them in a sitemap. Remember that `robots.txt` entries publicly advertise the paths they block.
- If an app touches personal data, costs money (paid APIs, LLM calls), or performs actions, put **real auth** in front of it: Netlify password protection, Netlify Identity, or a token or session check enforced in the function. Client-side checks don't count.
- Rate-limit any function that calls a paid API.

### Language preferences

**TypeScript** is the default for frontend code and Netlify Functions. **Python** is preferred for data processing, scripts, and backends that need Python libraries.

#### TypeScript

- Use `strict: true` in `tsconfig.json`. Avoid `any`; prefer `unknown` plus narrowing.
- Use **Vite** for frontend apps. React is fine when an app needs it; plain TS is fine for small tools.
- Format and lint with **Prettier** and **ESLint** (typescript-eslint), or **Biome**. Pick one per app and keep it consistent.
- Test with **Vitest**; use **Playwright** for end-to-end tests when an app has meaningful UI flows.
- Validate all external input (request bodies, query params, third-party API responses) at the boundary with **Zod**.
- Use **npm**, commit the lockfile, and pin the Node version (`.nvmrc` plus `NODE_VERSION` in `netlify.toml`).

#### Python

- Manage dependencies and virtualenvs with **uv**, configured in `pyproject.toml`. Commit `uv.lock` and pin the Python version (`.python-version`).
- Add type hints everywhere and check with **mypy** (strict) or **pyright**.
- Lint and format with **Ruff**. Test with **pytest**.
- Use **FastAPI** plus **Pydantic** for HTTP APIs.
- **Hosting caveat:** Netlify Functions don't run Python. A Python backend needs a separate host (AWS Lambda behind API Gateway, Fly.io, Render, etc.), with Netlify proxying to it via a `netlify.toml` redirect (`/api/<app>/* -> https://backend/:splat 200`) or the frontend calling it directly with CORS configured. Python build-time scripts that generate static output work fine on Netlify.

### General practices

- **Secrets:** never commit them. Use Netlify environment variables (or AWS Secrets Manager / SSM for AWS-hosted backends), commit a `.env.example` listing required variables, and keep real `.env` files gitignored. Secrets must never be shipped in frontend bundles; anything prefixed `VITE_` is public.
- **Isolation:** apps shouldn't import from each other or from the resume site's jQuery code. Share code only through an explicit `packages/` or `shared/` directory if it's actually needed.
- **Security headers:** set a Content-Security-Policy, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `X-Frame-Options`/`frame-ancestors` in `netlify.toml`. Scope them per path when the legacy site needs looser rules (for example, it loads jQuery from `ajax.googleapis.com`).
- **Local development:** make `npm run dev` work on its own where possible (see the `localJobsApi` plugin in `apps/i-need-a-job/vite.config.ts`). Use `netlify dev` when you need redirects, headers, or several functions together.
- **Before pushing,** run the app's type check, lint, and tests. Once there's more than one app, add a GitHub Actions workflow that runs them for changed apps. Netlify's build should also fail on type or test errors.
- **Dependencies:** keep them minimal, prefer well-maintained packages, and run `npm audit` / `uv` updates periodically.
- **Commits:** keep them small and focused, with imperative messages (`add <app> skeleton`, `fix contact form submission`).
- **Infrastructure:** if AWS resources grow beyond DNS (Lambda, API Gateway, S3), manage them as code (Terraform or AWS CDK in TypeScript) under `infra/` rather than through console clicks.

## Things to avoid

- Don't modify vendored files under `css/font-awesome/`, `css/fontello/`, `css/fonts/`, or the third-party `js/` libraries.
- Don't introduce a build step that changes how the resume site is served without verifying it in a Netlify deploy preview first.
- Don't touch Route 53 records or the Netlify domain settings as a side effect of app work.
