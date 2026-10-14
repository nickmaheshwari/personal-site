// Companies whose public job-board APIs we query. Each slug was checked against
// the live API. Add a company by finding its board URL
// (boards.greenhouse.io/<slug>, jobs.lever.co/<slug>, jobs.ashbyhq.com/<slug>).

export type JobSource = "greenhouse" | "lever" | "ashby";

export interface Company {
  name: string;
  source: JobSource;
  slug: string;
}

export const COMPANIES: readonly Company[] = [
  { name: "Affirm", source: "greenhouse", slug: "affirm" },
  { name: "Airbnb", source: "greenhouse", slug: "airbnb" },
  { name: "Airtable", source: "greenhouse", slug: "airtable" },
  { name: "Anthropic", source: "greenhouse", slug: "anthropic" },
  { name: "Asana", source: "greenhouse", slug: "asana" },
  { name: "Brex", source: "greenhouse", slug: "brex" },
  { name: "Chime", source: "greenhouse", slug: "chime" },
  { name: "Cloudflare", source: "greenhouse", slug: "cloudflare" },
  { name: "Coinbase", source: "greenhouse", slug: "coinbase" },
  { name: "Databricks", source: "greenhouse", slug: "databricks" },
  { name: "Datadog", source: "greenhouse", slug: "datadog" },
  { name: "Discord", source: "greenhouse", slug: "discord" },
  { name: "Dropbox", source: "greenhouse", slug: "dropbox" },
  { name: "Duolingo", source: "greenhouse", slug: "duolingo" },
  { name: "Elastic", source: "greenhouse", slug: "elastic" },
  { name: "Figma", source: "greenhouse", slug: "figma" },
  { name: "GitLab", source: "greenhouse", slug: "gitlab" },
  { name: "Gusto", source: "greenhouse", slug: "gusto" },
  { name: "Instacart", source: "greenhouse", slug: "instacart" },
  { name: "Lyft", source: "greenhouse", slug: "lyft" },
  { name: "MongoDB", source: "greenhouse", slug: "mongodb" },
  { name: "Nuro", source: "greenhouse", slug: "nuro" },
  { name: "Okta", source: "greenhouse", slug: "okta" },
  { name: "Pinterest", source: "greenhouse", slug: "pinterest" },
  { name: "Reddit", source: "greenhouse", slug: "reddit" },
  { name: "Robinhood", source: "greenhouse", slug: "robinhood" },
  { name: "Roblox", source: "greenhouse", slug: "roblox" },
  { name: "Samsara", source: "greenhouse", slug: "samsara" },
  { name: "Scale AI", source: "greenhouse", slug: "scaleai" },
  { name: "Squarespace", source: "greenhouse", slug: "squarespace" },
  { name: "Stripe", source: "greenhouse", slug: "stripe" },
  { name: "Toast", source: "greenhouse", slug: "toast" },
  { name: "Twilio", source: "greenhouse", slug: "twilio" },
  { name: "Vercel", source: "greenhouse", slug: "vercel" },
  { name: "Waymo", source: "greenhouse", slug: "waymo" },
  { name: "Webflow", source: "greenhouse", slug: "webflow" },
  { name: "Zscaler", source: "greenhouse", slug: "zscaler" },
  { name: "Palantir", source: "lever", slug: "palantir" },
  { name: "Spotify", source: "lever", slug: "spotify" },
  { name: "Zoox", source: "lever", slug: "zoox" },
  { name: "Cursor", source: "ashby", slug: "cursor" },
  { name: "Linear", source: "ashby", slug: "linear" },
  { name: "Notion", source: "ashby", slug: "notion" },
  { name: "OpenAI", source: "ashby", slug: "openai" },
  { name: "Perplexity", source: "ashby", slug: "perplexity" },
  { name: "Ramp", source: "ashby", slug: "ramp" },
  { name: "Replit", source: "ashby", slug: "replit" },
  { name: "Supabase", source: "ashby", slug: "supabase" },
];

export function findCompany(source: string, slug: string): Company | undefined {
  return COMPANIES.find((c) => c.source === source && c.slug === slug);
}
