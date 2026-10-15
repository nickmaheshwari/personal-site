# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## Purpose

This is Nicholas Maheshwari's personal website, live at https://www.nicholasmaheshwari.com/.

- **Today:** a static, single-page resume/portfolio site (About, Resume, Portfolio, Testimonials, Contact).
- **Going forward:** the site will also host additional functionality, such as **hidden webapps**: standalone tools served under unlisted paths that aren't linked from the main page. The resume site must keep working unchanged as these are added.

## Browser and device support

**Everything on this site, including every app, must work on all browsers and device types going back at least 10 years.** That means phones, tablets and desktops running browser versions from 2016 onward: Safari and iOS 10+, Chrome and Android WebView 54+, Firefox 50+, Edge 14+ and Samsung Internet 5+. Internet Explorer is out of scope, because React 19 doesn't run on it.

Real visitors hit this. Friends on older iPhones couldn't upload resumes because pdf.js used `for await` over a `ReadableStream` and the global `Iterator`, which older Safari doesn't have.

- **Before using a newer JavaScript or Web API, check it** on caniuse.com or MDN's compatibility tables against the versions above. Typical problems are iterator helpers (`.values().map()`, `Iterator`), `Array.prototype.at`/`findLast`/`toSorted`, `Object.groupBy`, `structuredClone`, `Promise.withResolvers`, async iteration of streams, regex lookbehind `(?<!…)` (a syntax error before Safari 16.4, which breaks the whole script), `:has()`, container queries and CSS nesting. Use an older equivalent or a polyfill.
- **Dependencies count.** A library that only ships modern syntax breaks old browsers even when our own code is fine. Prefer a library's legacy or ES5 build if it has one (we use `pdfjs-dist/legacy/...`), and check a new dependency's browser support before adding it.
- **Layouts must work from 320px phones up to desktop,** with touch and mouse alike. Don't rely on hover to reveal anything essential.
- **Check behavior in an old browser** (for example, an old iOS Simulator or a BrowserStack session) for anything touching file uploads, parsing or new APIs. When that isn't possible, simulate it in Node by deleting the missing global first.
- **Known gap:** the apps' Vite builds still use Vite's default target, which only covers browsers from roughly 2023 onward. Closing that gap means adding `@vitejs/plugin-legacy` (with `targets` matching the list above) to each app and checking the result in a deploy preview.

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
    Feedback.tsx      #   Feedback / bug report form (Netlify Forms) and "Report this problem" buttons
    ErrorBoundary.tsx #   Shows a prefilled bug report instead of a blank page if rendering crashes
  shared/             # Code used by both the UI and the functions (+ tests)
    taxonomy.ts       #   Job families: titles, aliases, skill keywords, adjacent families
    resume.ts         #   Resume text → suggested titles + years of experience
    companies.ts      #   Allowlist of ~880 employers (job board, slug, industry) and the request BATCHES
    normalize.ts      #   Each job board / career site → Job; salary and years-of-experience extraction
    usajobs.ts        #   USAJOBS (federal) title search → Job
    aggregators.ts    #   Himalayas and Jobicy (remote job sites) title search → Job, credited with `via`
    posting.ts        #   One posting's full description (for the keyword check)
    keywords.ts       #   Resume vs. posting: which taxonomy keywords match or are missing
    match.ts          #   Title matching, filters, and per-filter stats (runs in the browser)
    locations.ts      #   Location dropdown options and aliases
netlify/functions/    # Serverless API (TypeScript, modern Netlify Functions API)
  i-need-a-job-jobs.mts     # GET /api/i-need-a-job/jobs?batch&title=…: one batch of employers' postings matching the titles, CDN-cached 1h
  i-need-a-job-search.mts   # GET /api/i-need-a-job/search?source=usajobs|himalayas|jobicy&title=: one title on a title-searched source
  i-need-a-job-posting.mts  # GET /api/i-need-a-job/posting?source&slug&id: one posting's text, CDN-cached 1h
scripts/build-site.mjs      # Copies the static site into dist/
netlify.toml                # Build, headers (noindex + CSP for hidden apps)
```

### i-need-a-job

- **Job data comes from JSON APIs, never from scraping HTML.** There are three kinds:
  - **Public job-board APIs:** Greenhouse, Lever, Ashby, SmartRecruiters, BambooHR, Breezy, Rippling and Gem. They're intended for public use and return every posting.
  - **Career-site endpoints:** Workday and Oracle Recruiting Cloud, which most big banks, insurers, hospitals and Fortune 500 companies use. These are the undocumented JSON endpoints behind each employer's own careers page, so they can change without notice. They return 20–25 postings per request, so they're searched by title (`searchCompanyJobs`): two titles at a time per company, a second page only when the first was at least a quarter real matches (`worthNextPage`), and retries on 429. Fetching more than that sets off Workday's rate limiting. A company that runs out of time (35s) returns what it found so far, and partial results are cached for only 5 minutes.
  - **Job sites:** USAJOBS (federal, official API), plus Himalayas and Jobicy (remote jobs). They're searched by title. Himalayas and Jobicy require crediting them with a link to their listing, so their jobs set `via` and the page shows "via Himalayas".
- **Adding a company:** find its board slug, confirm the API returns postings *and that they're this company's* (many slugs like "root" or "figure" belong to someone else), and add it to `shared/companies.ts` with an industry. The header comment lists each source's URL pattern. Workday slugs are `<tenant>/wd<N>/<site>`, found on the employer's careers page. The jobs function only fetches allowlisted companies, so it can't be used as an open proxy.
- **Descriptions:** SmartRecruiters, BambooHR, Breezy, Rippling, Workday and Oracle list postings without descriptions, so those postings have no salary or experience data. SmartRecruiters boards are capped at 2,000 postings.
- **Federal jobs (USAJOBS)** come from the official API and are tagged with the "Nonprofit & Government" industry. The key is free, from developer.usajobs.gov. Without one, the search function returns `{ disabled: true }` and the page says federal jobs aren't included.
- **Considered and skipped:** Adzuna (free tier is 250 calls a day, requires logo attribution, and commercial use needs a license). Idealist and governmentjobs.com (no public APIs). Remotive (its free API returns ~15 jobs). Arbeitnow (almost all German-language postings). The Muse (no title search; needs a registered app). Eightfold (unreliable and rate-limited). Workable, Recruitee and Personio (work, but almost no matching employers).
- **Search flow:** the browser requests employers in fixed batches (`BATCHES`, ~56 requests) plus each title-searched source once per selected title. Job-board batches and job sites run six requests at a time, and Workday/Oracle batches run two at a time in a separate pool (`runSearchTasks`). Running them six at a time left about half the big employers with partial results in a 12-title test, compared with one employer at two at a time. Job boards finish in about 15 seconds, and big employers keep arriving for a couple of minutes. The jobs function fetches a batch's boards in parallel, keeps each board in memory for an hour, and returns only postings whose titles match the selected titles in broad mode (a superset of strict mode, so the strict/broad toggle still works in the browser). Responses are CDN-cached per batch and title list. Matching on the server keeps responses small: there are well over 100k postings, too many to load into the browser, especially on old phones.
- **Changing titles needs a new search** (the page offers a button). Other filters apply in the browser to what was fetched, without new requests. When nothing matches, the page says which filter removed the postings (`filterJobsWithStats`). The search box above the results narrows them further: every word must appear in the employer, title, location, industry or matched title, ignoring case and accents (`searchJobs`). Duplicates are dropped first (`dedupeJobs`), preferring the employer's own listing over a job site's copy.
- **Cost:** a search with no cached responses takes about 50 seconds for the visitor and about 5 minutes of function time across ~56 calls (measured October 2026: roughly 1 credit at 1 GB). Repeating a search within the hour is served from the CDN cache and costs almost nothing. Netlify bills function time against the account's monthly credits, and **when credits run out Netlify pauses the whole site, including the resume.** Keep batches large and responses cached, and watch usage on the Netlify billing page.
- **Title matching:** strict mode requires every word of a selected title to appear in the posting title. Broad mode (on by default) applies to titles of 3+ words and requires the role word (the last word) plus at least half of the other words, including one that isn't generic (see `GENERIC_WORDS`). Seniority words are dropped from selected titles unless they're the last word ("Development Associate"), and are never dropped from posting titles.
- **Ambiguous titles** match the wrong industry. "Program Director" matches tech program-management directors, and "Development Associate" matches business development roles. Pick posting-facing titles that are distinctive ("Director of Programs", "Philanthropy Manager") and keep the ambiguous wording as an alias, so it's still detected in resumes.
- **Applying is always done by the user.** There's no auto-apply, by design: the job boards' apply APIs need the employer's key, and form-filling bots break their terms and hurt applications. The app speeds things up instead:
  - **Apply links:** Lever, Ashby and USAJOBS provide a direct link to the application form (`Job.applyUrl`). Other sources link to the posting.
  - **Tracker:** Saved → Applied → Interviewing → Offer → Rejected, with notes and CSV export. It lives only in the visitor's browser (`localStorage`, key `i-need-a-job:tracker:v1`), so a change to `TrackedJob`'s shape needs a new key or a migration.
  - **Resume fit:** compares the posting's description with the resume text, which stays in memory, using the taxonomy keywords. It's unavailable for USAJOBS, Breezy, Himalayas and Jobicy postings.
- **No AI or LLM calls, by design.** Title suggestions are plain text processing in `shared/resume.ts`, and the resume never leaves the browser. Each family is scored as 4 × (its titles mentioned in the resume) + (distinct keyword hits). Mentioned titles are "close". Families scoring at least 35% of the best family are "related". Up to 10 titles from their adjacent families are "stretch". To improve suggestions, edit `shared/taxonomy.ts` and add a case to `shared/resume.test.ts`.
- **Writing taxonomy entries:** some titles are too generic to detect in a resume (Server, Editor, Scientist), so they're marked `aliasesOnly` and only their aliases count as mentions. Avoid aliases and keywords with common other meanings, such as "Driver", "Producer" (Kafka), "Picker" (date picker) and "production".
- **Years of experience** is the total of date ranges in work sections, with overlaps merged and education/projects/skills sections skipped.
- **Feedback and bug reports** use Netlify Forms (form `i-need-a-job-feedback`). Netlify only accepts forms it finds in the deployed HTML, so `apps/i-need-a-job/index.html` has a hidden copy of the form, and `src/feedback.ts` POSTs the same fields to `/`. Keep the two in sync. Error messages (resume upload, resume fit, sources that couldn't load, uncaught errors and render crashes) have a "Report this problem" button. It fills in the form with the error, page, browser and screen size, and the visitor can see and untick these before sending. Resume text is never included. The form has a `bot-field` honeypot. Two settings live in the Netlify UI, not the repo: form detection must be enabled (Forms), and the email alert is under Site configuration → Notifications → Emails and webhooks → Form submission notifications. Submissions only work on Netlify (deploy previews included), not under `npm run dev`. The free plan allows 100 form submissions a month.
- **Known limits:** salary and years-of-experience values are parsed from posting text with regexes, so some postings have neither. Workday locations often say "3 Locations", which the location filter can't match. Coverage of local government is thin, because most of it uses NEOGOV or its own sites, which have no public APIs.

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
