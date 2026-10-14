// Options for the Location dropdown. A posting matches when its location string
// contains any of the option's aliases (case-insensitive, whole-word).

export interface LocationOption {
  label: string;
  aliases: readonly string[];
}

export const LOCATIONS: readonly LocationOption[] = [
  {
    label: "United States (anywhere)",
    aliases: [
      "United States",
      "USA",
      "US",
      "U.S.",
      ", AL",
      ", AZ",
      ", CA",
      ", CO",
      ", CT",
      ", DC",
      ", FL",
      ", GA",
      ", IL",
      ", MA",
      ", MD",
      ", MI",
      ", MN",
      ", NC",
      ", NJ",
      ", NY",
      ", OR",
      ", PA",
      ", TN",
      ", TX",
      ", UT",
      ", VA",
      ", WA",
      ", WI",
    ],
  },
  { label: "Atlanta", aliases: ["Atlanta"] },
  { label: "Austin", aliases: ["Austin"] },
  { label: "Boston", aliases: ["Boston", "Cambridge, MA"] },
  { label: "Chicago", aliases: ["Chicago"] },
  { label: "Denver / Boulder", aliases: ["Denver", "Boulder", "Colorado"] },
  { label: "Los Angeles", aliases: ["Los Angeles", "Santa Monica", "Culver City", "Irvine"] },
  { label: "Miami", aliases: ["Miami"] },
  { label: "New York City", aliases: ["New York", "NYC", "Brooklyn"] },
  { label: "Phoenix", aliases: ["Phoenix", "Tempe", "Scottsdale", "Arizona"] },
  { label: "Salt Lake City", aliases: ["Salt Lake", "Utah", "Lehi"] },
  { label: "San Diego", aliases: ["San Diego"] },
  {
    label: "San Francisco Bay Area",
    aliases: [
      "San Francisco",
      "SF",
      "Bay Area",
      "Palo Alto",
      "Mountain View",
      "Menlo Park",
      "San Jose",
      "Sunnyvale",
      "Oakland",
      "Redwood City",
      "San Mateo",
      "Santa Clara",
      "Foster City",
    ],
  },
  { label: "Seattle", aliases: ["Seattle", "Bellevue", "Redmond", "Kirkland"] },
  { label: "Washington, DC", aliases: ["Washington, DC", "Washington DC", "Arlington", "Reston", "McLean"] },
  { label: "Canada", aliases: ["Canada", "Toronto", "Vancouver", "Montreal"] },
  { label: "London", aliases: ["London"] },
  {
    label: "Europe",
    aliases: [
      "Europe",
      "EMEA",
      "London",
      "Dublin",
      "Berlin",
      "Amsterdam",
      "Paris",
      "Madrid",
      "Stockholm",
      "Zurich",
      "Munich",
      "Lisbon",
      "Barcelona",
    ],
  },
];

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Word boundaries only where the alias itself starts/ends with a word character,
// so ", TX" still matches "Austin, TX".
const wholeWord = (alias: string) =>
  `${/^\w/.test(alias) ? "(?<!\\w)" : ""}${escapeRegExp(alias)}${/\w$/.test(alias) ? "(?!\\w)" : ""}`;

const matchers = new Map(LOCATIONS.map((loc) => [loc.label, new RegExp(loc.aliases.map(wholeWord).join("|"), "i")]));

export function locationMatches(label: string, jobLocation: string): boolean {
  const re = matchers.get(label);
  return re ? re.test(jobLocation) : true;
}
