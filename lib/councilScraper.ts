import * as cheerio from 'cheerio';

const BASE = 'https://waste.services.midsussex.gov.uk';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const BROWSER_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
};
const REQUEST_TIMEOUT_MS = 15_000;

export class ScraperError extends Error {}

export interface AddressOption {
  pIndex: string;
  label: string;
}

export interface CollectionEvent {
  date: string; // ISO yyyy-mm-dd
  service: string;
}

interface CookieJar {
  jar: Map<string, string>;
}

function newJar(): CookieJar {
  return { jar: new Map() };
}

function storeCookies(jar: CookieJar, res: Response) {
  const setCookies =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : res.headers.get('set-cookie')
        ? [res.headers.get('set-cookie') as string]
        : [];
  for (const raw of setCookies) {
    const pair = raw.split(';')[0];
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    jar.jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function cookieHeader(jar: CookieJar): string {
  return Array.from(jar.jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/**
 * Builds a diagnostic string from a failed response so we can tell a real page-layout
 * change apart from a WAF/bot-protection block (e.g. Akamai/Cloudflare/Imperva), which
 * typically shows up as a 403 with a distinctive header set or block-page body.
 */
async function describeFailure(res: Response): Promise<string> {
  const headersOfInterest = [
    'server',
    'via',
    'cf-ray',
    'cf-mitigated',
    'x-akamai-transformed',
    'x-iinfo',
    'x-cdn',
    'x-cache',
  ];
  const headerParts: string[] = [];
  for (const h of headersOfInterest) {
    const v = res.headers.get(h);
    if (v) headerParts.push(`${h}=${v}`);
  }
  let bodySnippet = '';
  try {
    const text = await res.text();
    bodySnippet = text.replace(/\s+/g, ' ').trim().slice(0, 200);
  } catch {
    // best-effort only
  }
  const parts = [`status=${res.status}`];
  if (headerParts.length) parts.push(headerParts.join(' '));
  if (bodySnippet) parts.push(`body="${bodySnippet}"`);
  return parts.join(' | ');
}

async function fetchWithJar(jar: CookieJar, url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': UA,
        ...BROWSER_HEADERS,
        Cookie: cookieHeader(jar),
        ...(init.headers || {}),
      },
    });
    storeCookies(jar, res);
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

/** GET the landing page and return the "View my collections" menu link. */
async function establishSession(jar: CookieJar): Promise<string> {
  const res = await fetchWithJar(jar, `${BASE}/`);
  if (!res.ok) throw new ScraperError(`Council site landing page request failed (${await describeFailure(res)})`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const link = $('a')
    .filter((_, el) => $(el).text().trim().toLowerCase().startsWith('view my collections'))
    .first();
  const href = link.attr('href');
  if (!href) {
    throw new ScraperError(
      'Could not find the "View my collections" link on the council site — its page layout may have changed.',
    );
  }
  return href;
}

/** Follow the menu link and return the Property Lookup Form's submit URL. */
async function getPropertyLookupAction(jar: CookieJar, menuHref: string): Promise<string> {
  const res = await fetchWithJar(jar, menuHref);
  if (!res.ok) throw new ScraperError(`Council site menu navigation failed (${await describeFailure(res)})`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const action = $('form[data-form-title="Property Lookup Form"]').attr('action');
  if (!action) {
    throw new ScraperError(
      'Could not find the postcode lookup form on the council site — its page layout may have changed.',
    );
  }
  return action;
}

interface RawAddress {
  pIndex: string;
  label: string;
  href: string;
}

/** Submit a postcode and return the list of matching addresses (with raw hrefs, tied to this session). */
async function submitPostcode(
  jar: CookieJar,
  lookupAction: string,
  postcode: string,
): Promise<RawAddress[]> {
  const body = new URLSearchParams({
    address_postcode: postcode,
    address_name_number: '',
    address_street: '',
  });
  const res = await fetchWithJar(jar, lookupAction, { method: 'POST', body });
  if (!res.ok) throw new ScraperError(`Postcode lookup failed (${await describeFailure(res)})`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const addresses: RawAddress[] = [];
  $('#property_list a').each((_, el) => {
    const href = $(el).attr('href');
    const label = $(el).text().trim();
    if (!href || !label) return;
    const url = new URL(href, BASE);
    const pIndex = url.searchParams.get('pIndex');
    if (pIndex) addresses.push({ pIndex, label, href });
  });
  return addresses;
}

/** Look up every address registered at a postcode. */
export async function findAddresses(postcode: string): Promise<AddressOption[]> {
  const jar = newJar();
  const menuHref = await establishSession(jar);
  const lookupAction = await getPropertyLookupAction(jar, menuHref);
  const addresses = await submitPostcode(jar, lookupAction, postcode);
  if (addresses.length === 0) {
    throw new ScraperError('No addresses found for that postcode. Double-check it is a valid Mid Sussex postcode.');
  }
  return addresses.map(({ pIndex, label }) => ({ pIndex, label }));
}

// General waste, recycling, and food collection days are the same for every address
// sharing a postcode (a fixed area-wide round) — verified by comparing multiple real
// addresses at the same postcode. Garden waste is excluded: it's an opt-in paid
// subscription, so it varies by household even within one postcode, and a single
// "representative" address can't reliably speak for everyone else's subscription.
const EXCLUDED_SERVICES = ['Domestic Garden Waste Service'];

/**
 * Fetch the collection schedule for a postcode, using any one address registered
 * there as a representative (collection days don't vary by address within a postcode
 * for the services this returns).
 */
export async function fetchScheduleForPostcode(postcode: string): Promise<{ events: CollectionEvent[] }> {
  const jar = newJar();
  const menuHref = await establishSession(jar);
  const lookupAction = await getPropertyLookupAction(jar, menuHref);
  const addresses = await submitPostcode(jar, lookupAction, postcode);

  if (addresses.length === 0) {
    throw new ScraperError('No addresses found for that postcode. Double-check it is a valid Mid Sussex postcode.');
  }
  const representative = addresses[0];

  const scheduleUrl = new URL(representative.href, BASE).toString();
  const res = await fetchWithJar(jar, scheduleUrl);
  if (!res.ok) throw new ScraperError(`Schedule request failed (${await describeFailure(res)})`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const events: CollectionEvent[] = [];
  $('#scheduled-collections ul.displayinlineblock').each((_, el) => {
    const texts = $(el)
      .find('li p')
      .map((_, p) => $(p).text().trim())
      .get()
      .filter(Boolean);
    if (texts.length < 2) return;
    const [dateStr, service] = texts;
    if (EXCLUDED_SERVICES.includes(service)) return;
    const m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return;
    const [, dd, mm, yyyy] = m;
    events.push({ date: `${yyyy}-${mm}-${dd}`, service });
  });

  if (events.length === 0) {
    throw new ScraperError(
      'No collection dates were found for this postcode — the council page layout may have changed.',
    );
  }

  events.sort((a, b) => a.date.localeCompare(b.date));
  return { events };
}
