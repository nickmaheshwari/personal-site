// Companies whose public job-board APIs we query. Each slug was checked against
// the live API. Add a company by finding its board URL
// (boards.greenhouse.io/<slug>, jobs.lever.co/<slug>, jobs.ashbyhq.com/<slug>,
// jobs.smartrecruiters.com/<CompanyId>) and confirming the API returns postings.

export type JobSource = "greenhouse" | "lever" | "ashby" | "smartrecruiters";

export const INDUSTRIES = [
  "Technology",
  "Finance",
  "Healthcare & Biotech",
  "Retail & Consumer",
  "Media & Entertainment",
  "Hospitality, Food & Travel",
  "Aerospace, Automotive & Industrial",
  "Logistics & Transportation",
  "Education & Nonprofit",
] as const;

export type Industry = (typeof INDUSTRIES)[number];

export interface Company {
  name: string;
  source: JobSource;
  slug: string;
  industry: Industry;
}

const c = (name: string, source: JobSource, slug: string, industry: Industry): Company => ({
  name,
  source,
  slug,
  industry,
});

export const COMPANIES: readonly Company[] = [
  // Technology
  c("Airtable", "greenhouse", "airtable", "Technology"),
  c("Anthropic", "greenhouse", "anthropic", "Technology"),
  c("Asana", "greenhouse", "asana", "Technology"),
  c("Attentive", "greenhouse", "attentive", "Technology"),
  c("Calendly", "greenhouse", "calendly", "Technology"),
  c("Canva", "smartrecruiters", "Canva", "Technology"),
  c("Cloudflare", "greenhouse", "cloudflare", "Technology"),
  c("Cursor", "ashby", "cursor", "Technology"),
  c("Databricks", "greenhouse", "databricks", "Technology"),
  c("Datadog", "greenhouse", "datadog", "Technology"),
  c("Discord", "greenhouse", "discord", "Technology"),
  c("Dropbox", "greenhouse", "dropbox", "Technology"),
  c("Elastic", "greenhouse", "elastic", "Technology"),
  c("Figma", "greenhouse", "figma", "Technology"),
  c("GitLab", "greenhouse", "gitlab", "Technology"),
  c("Gusto", "greenhouse", "gusto", "Technology"),
  c("Harvey", "ashby", "harvey", "Technology"),
  c("Klaviyo", "greenhouse", "klaviyo", "Technology"),
  c("Linear", "ashby", "linear", "Technology"),
  c("MongoDB", "greenhouse", "mongodb", "Technology"),
  c("Notion", "ashby", "notion", "Technology"),
  c("Okta", "greenhouse", "okta", "Technology"),
  c("OpenAI", "ashby", "openai", "Technology"),
  c("Palantir", "lever", "palantir", "Technology"),
  c("Perplexity", "ashby", "perplexity", "Technology"),
  c("Pinterest", "greenhouse", "pinterest", "Technology"),
  c("Reddit", "greenhouse", "reddit", "Technology"),
  c("Replit", "ashby", "replit", "Technology"),
  c("Samsara", "greenhouse", "samsara", "Technology"),
  c("Scale AI", "greenhouse", "scaleai", "Technology"),
  c("ServiceNow", "smartrecruiters", "ServiceNow", "Technology"),
  c("Squarespace", "greenhouse", "squarespace", "Technology"),
  c("Supabase", "ashby", "supabase", "Technology"),
  c("Toast", "greenhouse", "toast", "Technology"),
  c("Twilio", "greenhouse", "twilio", "Technology"),
  c("Vanta", "ashby", "vanta", "Technology"),
  c("Vercel", "greenhouse", "vercel", "Technology"),
  c("Webflow", "greenhouse", "webflow", "Technology"),
  c("Western Digital", "smartrecruiters", "WesternDigital", "Technology"),
  c("Wix", "smartrecruiters", "Wix2", "Technology"),
  c("Yext", "greenhouse", "yext", "Technology"),
  c("Zscaler", "greenhouse", "zscaler", "Technology"),

  // Finance
  c("Affirm", "greenhouse", "affirm", "Finance"),
  c("Betterment", "greenhouse", "betterment", "Finance"),
  c("Brex", "greenhouse", "brex", "Finance"),
  c("Chime", "greenhouse", "chime", "Finance"),
  c("Coinbase", "greenhouse", "coinbase", "Finance"),
  c("Experian", "smartrecruiters", "Experian", "Finance"),
  c("Mercury", "greenhouse", "mercury", "Finance"),
  c("Oportun", "greenhouse", "oportun", "Finance"),
  c("Plaid", "ashby", "plaid", "Finance"),
  c("Ramp", "ashby", "ramp", "Finance"),
  c("Robinhood", "greenhouse", "robinhood", "Finance"),
  c("SoFi", "greenhouse", "sofi", "Finance"),
  c("Stripe", "greenhouse", "stripe", "Finance"),
  c("Wealthfront", "lever", "wealthfront", "Finance"),

  // Healthcare & Biotech
  c("AbbVie", "smartrecruiters", "AbbVie", "Healthcare & Biotech"),
  c("Abridge", "ashby", "abridge", "Healthcare & Biotech"),
  c("Clover Health", "greenhouse", "cloverhealth", "Healthcare & Biotech"),
  c("Commure", "ashby", "commure", "Healthcare & Biotech"),
  c("Flatiron Health", "greenhouse", "flatironhealth", "Healthcare & Biotech"),
  c("Ginkgo Bioworks", "greenhouse", "ginkgobioworks", "Healthcare & Biotech"),
  c("Headway", "ashby", "headway", "Healthcare & Biotech"),
  c("Hinge Health", "ashby", "hinge-health", "Healthcare & Biotech"),
  c("Modern Health", "greenhouse", "modernhealth", "Healthcare & Biotech"),
  c("Natera", "greenhouse", "natera", "Healthcare & Biotech"),
  c("One Medical", "greenhouse", "onemedical", "Healthcare & Biotech"),
  c("Oscar Health", "greenhouse", "oscar", "Healthcare & Biotech"),
  c("Recursion", "greenhouse", "recursionpharmaceuticals", "Healthcare & Biotech"),
  c("Ro", "lever", "ro", "Healthcare & Biotech"),
  c("Rula", "ashby", "rula", "Healthcare & Biotech"),
  c("Tennr", "ashby", "tennr", "Healthcare & Biotech"),
  c("WHOOP", "ashby", "whoop", "Healthcare & Biotech"),
  c("Zocdoc", "greenhouse", "zocdoc", "Healthcare & Biotech"),

  // Retail & Consumer
  c("Bombas", "greenhouse", "bombas", "Retail & Consumer"),
  c("Eight Sleep", "ashby", "eightsleep", "Retail & Consumer"),
  c("Everlane", "greenhouse", "everlane", "Retail & Consumer"),
  c("Faire", "greenhouse", "faire", "Retail & Consumer"),
  c("Glossier", "greenhouse", "glossier", "Retail & Consumer"),
  c("goop", "greenhouse", "goop", "Retail & Consumer"),
  c("Harry's", "greenhouse", "harrys", "Retail & Consumer"),
  c("Instacart", "greenhouse", "instacart", "Retail & Consumer"),
  c("LVMH", "smartrecruiters", "LVMH", "Retail & Consumer"),
  c("Match Group", "lever", "matchgroup", "Retail & Consumer"),
  c("Mejuri", "greenhouse", "mejuri", "Retail & Consumer"),
  c("Peloton", "greenhouse", "peloton", "Retail & Consumer"),
  c("Primark", "smartrecruiters", "Primark", "Retail & Consumer"),
  c("Rent the Runway", "greenhouse", "renttherunway", "Retail & Consumer"),
  c("Ritual", "greenhouse", "ritual", "Retail & Consumer"),
  c("Rover", "lever", "rover", "Retail & Consumer"),
  c("Stitch Fix", "greenhouse", "stitchfix", "Retail & Consumer"),
  c("ThirdLove", "greenhouse", "thirdlove", "Retail & Consumer"),

  // Media & Entertainment
  c("Axios", "greenhouse", "axios", "Media & Entertainment"),
  c("Hearst", "greenhouse", "hearst", "Media & Entertainment"),
  c("Roblox", "greenhouse", "roblox", "Media & Entertainment"),
  c("Roku", "greenhouse", "roku", "Media & Entertainment"),
  c("SeatGeek", "greenhouse", "seatgeek", "Media & Entertainment"),
  c("Spotify", "lever", "spotify", "Media & Entertainment"),
  c("The New York Times", "greenhouse", "thenewyorktimes", "Media & Entertainment"),
  c("Ubisoft", "smartrecruiters", "Ubisoft2", "Media & Entertainment"),
  c("Vox Media", "greenhouse", "voxmedia", "Media & Entertainment"),

  // Hospitality, Food & Travel
  c("Accor", "smartrecruiters", "Accor", "Hospitality, Food & Travel"),
  c("Airbnb", "greenhouse", "airbnb", "Hospitality, Food & Travel"),
  c("ClassPass", "greenhouse", "classpass", "Hospitality, Food & Travel"),
  c("Equinox", "smartrecruiters", "Equinox", "Hospitality, Food & Travel"),
  c("HelloFresh", "greenhouse", "hellofresh", "Hospitality, Food & Travel"),
  c("McDonald's", "smartrecruiters", "McDonaldsCorporation", "Hospitality, Food & Travel"),
  c("Sodexo", "smartrecruiters", "Sodexo", "Hospitality, Food & Travel"),
  c("sweetgreen", "greenhouse", "sweetgreen", "Hospitality, Food & Travel"),

  // Aerospace, Automotive & Industrial
  c("Anduril", "greenhouse", "andurilindustries", "Aerospace, Automotive & Industrial"),
  c("Astranis", "greenhouse", "astranis", "Aerospace, Automotive & Industrial"),
  c("Avery Dennison", "smartrecruiters", "AveryDennison", "Aerospace, Automotive & Industrial"),
  c("Bosch", "smartrecruiters", "BoschGroup", "Aerospace, Automotive & Industrial"),
  c("Continental", "smartrecruiters", "Continental", "Aerospace, Automotive & Industrial"),
  c("Kodiak", "greenhouse", "kodiak", "Aerospace, Automotive & Industrial"),
  c("Lucid Motors", "greenhouse", "lucidmotors", "Aerospace, Automotive & Industrial"),
  c("Nuro", "greenhouse", "nuro", "Aerospace, Automotive & Industrial"),
  c("Relativity Space", "greenhouse", "relativity", "Aerospace, Automotive & Industrial"),
  c("Saronic", "ashby", "saronic", "Aerospace, Automotive & Industrial"),
  c("Shield AI", "lever", "shieldai", "Aerospace, Automotive & Industrial"),
  c("SpaceX", "greenhouse", "spacex", "Aerospace, Automotive & Industrial"),
  c("Waymo", "greenhouse", "waymo", "Aerospace, Automotive & Industrial"),
  c("Zoox", "lever", "zoox", "Aerospace, Automotive & Industrial"),

  // Logistics & Transportation
  c("Bird", "greenhouse", "bird", "Logistics & Transportation"),
  c("Flexport", "greenhouse", "flexport", "Logistics & Transportation"),
  c("Lyft", "greenhouse", "lyft", "Logistics & Transportation"),
  c("project44", "greenhouse", "project44", "Logistics & Transportation"),
  c("Via", "greenhouse", "via", "Logistics & Transportation"),

  // Education & Nonprofit
  c("Code for America", "greenhouse", "codeforamerica", "Education & Nonprofit"),
  c("Coursera", "greenhouse", "coursera", "Education & Nonprofit"),
  c("Duolingo", "greenhouse", "duolingo", "Education & Nonprofit"),
  c("Guild", "greenhouse", "guild", "Education & Nonprofit"),
  c("Khan Academy", "greenhouse", "khanacademy", "Education & Nonprofit"),
  c("MasterClass", "greenhouse", "masterclass", "Education & Nonprofit"),
  c("Wikimedia Foundation", "greenhouse", "wikimedia", "Education & Nonprofit"),
];

export function findCompany(source: string, slug: string): Company | undefined {
  return COMPANIES.find((co) => co.source === source && co.slug === slug);
}

const BY_NAME = new Map(COMPANIES.map((co) => [co.name, co]));

export function industryOf(companyName: string): Industry | undefined {
  return BY_NAME.get(companyName)?.industry;
}
