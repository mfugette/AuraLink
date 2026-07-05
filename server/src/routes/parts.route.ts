import { Router, Request, Response } from 'express';

const EBAY_TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const EBAY_SEARCH_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const EBAY_SCOPE = 'https://api.ebay.com/oauth/api_scope';

interface EbayItem {
  itemId: string;
  title: string;
  price?: { value: string; currency: string };
  seller?: { username: string; feedbackPercentage?: string; feedbackScore?: number };
  itemWebUrl?: string;
  condition?: string;
  image?: { imageUrl: string };
  additionalImages?: { imageUrl: string }[];
  buyingOptions?: string[];
  shippingOptions?: { shippingCost?: { value: string } }[];
}

type PartCondition = 'New' | 'Refurbished' | 'Used';

function normalizeCondition(raw: string | undefined): PartCondition {
  const c = (raw ?? '').toLowerCase();
  if (c.includes('refurbished')) return 'Refurbished';
  if (c.includes('new')) return 'New';
  return 'Used';
}

// In-memory token cache — survives across requests, resets on process restart
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getEbayToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const clientId = process.env['EBAY_CLIENT_ID'];
  const clientSecret = process.env['EBAY_CLIENT_SECRET'];
  if (!clientId || !clientSecret) throw new Error('EBAY_CLIENT_ID and EBAY_CLIENT_SECRET must be set in .env');

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const resp = await fetch(EBAY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=client_credentials&scope=${encodeURIComponent(EBAY_SCOPE)}`,
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`eBay token request failed (${resp.status}): ${body}`);
  }

  const data = await resp.json() as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // renew 60s before expiry
  return cachedToken;
}

function mapItem(partName: string, item: EbayItem) {
  const images = [
    item.image?.imageUrl,
    ...(item.additionalImages ?? []).map(i => i.imageUrl),
  ].filter((url): url is string => !!url);

  const freeShipping = (item.shippingOptions ?? []).some(s => parseFloat(s.shippingCost?.value ?? '-1') === 0);

  return {
    id: item.itemId,
    name: partName,
    partNumber: item.itemId.split('|')[1] ?? item.itemId,
    price: parseFloat(item.price?.value ?? '0'),
    inStock: true,
    url: item.itemWebUrl ?? '',
    images,
    source: 'ebay',
    listingTitle: item.title,
    condition: normalizeCondition(item.condition),
    sellerRating: item.seller?.feedbackPercentage ? parseFloat(item.seller.feedbackPercentage) : null,
    freeShipping,
    bestOffer: (item.buyingOptions ?? []).includes('BEST_OFFER'),
    store: {
      id: item.seller?.username ?? 'ebay',
      name: item.seller?.username ?? 'eBay',
      address: 'Online — eBay',
      phone: '',
      distance: 0,
      latitude: 0,
      longitude: 0,
    },
  };
}

export const partsRouter = Router();

partsRouter.get('/search', async (req: Request, res: Response) => {
  const { part, year, make, model } = req.query as Record<string, string>;

  if (!part) {
    res.status(400).json({ error: 'part is required.', results: [] });
    return;
  }

  try {
    const token = await getEbayToken();

    const q = [part, year, make, model].filter(Boolean).join(' ');
    const params = new URLSearchParams({
      q,
      limit: '12',
      filter: 'buyingOptions:{FIXED_PRICE}',
    });

    const resp = await fetch(`${EBAY_SEARCH_URL}?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Content-Type': 'application/json',
      },
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error(`[eBay] Search failed (${resp.status}):`, body);
      res.status(502).json({ error: 'eBay search failed.', results: [] });
      return;
    }

    const data = await resp.json() as { itemSummaries?: EbayItem[] };
    const results = (data.itemSummaries ?? []).map(item => mapItem(part, item));
    res.json({ results });

  } catch (err: unknown) {
    // Log the detail server-side; return a generic message so internal errors
    // (stack details, upstream responses) never leak to the client.
    console.error('[eBay]', err instanceof Error ? err.message : String(err));
    res.status(500).json({ error: 'Parts search failed.', results: [] });
  }
});
