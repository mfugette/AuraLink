import { Router, Request, Response } from 'express';

const CARAPI_LOGIN_URL = 'https://carapi.app/api/auth/login';
const CARAPI_TRIMS_URL = 'https://carapi.app/api/trims/v2';

interface CarApiTrim {
  submodel: string | null;
  trim: string | null;
  description: string | null;
}

// In-memory JWT cache — CarAPI JWTs are valid for 7 days.
let cachedJwt: string | null = null;
let jwtExpiry = 0;

async function getCarApiJwt(): Promise<string> {
  if (cachedJwt && Date.now() < jwtExpiry) return cachedJwt;

  const apiToken = process.env['CARAPI_TOKEN'];
  const apiSecret = process.env['CARAPI_SECRET'];
  if (!apiToken || !apiSecret) throw new Error('CARAPI_TOKEN and CARAPI_SECRET must be set in .env');

  const resp = await fetch(CARAPI_LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'text/plain' },
    body: JSON.stringify({ api_token: apiToken, api_secret: apiSecret }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`CarAPI login failed (${resp.status}): ${body}`);
  }

  cachedJwt = (await resp.text()).trim();
  jwtExpiry = Date.now() + 6.5 * 24 * 60 * 60 * 1000; // renew a bit before the 7-day expiry
  return cachedJwt;
}

// Description looks like "EX 2dr Coupe (1.8L 4cyl 5M)" — pull the displacement + cylinder count.
function parseEngine(description: string | null): string | null {
  if (!description) return null;
  const match = description.match(/\(([\d.]+)L\s+(\d+)cyl/i);
  return match ? `${match[1]}L ${match[2]}cyl` : null;
}

export const vehicleRouter = Router();

vehicleRouter.get('/trims', async (req: Request, res: Response) => {
  const { year, make, model } = req.query as Record<string, string>;

  if (!year || !make || !model) {
    res.status(400).json({ error: 'year, make, and model are required.', trims: [] });
    return;
  }

  try {
    const jwt = await getCarApiJwt();

    const params = new URLSearchParams({ year, make, model, limit: '100' });
    const resp = await fetch(`${CARAPI_TRIMS_URL}?${params}`, {
      headers: { 'Authorization': `Bearer ${jwt}`, 'Accept': 'application/json' },
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error(`[CarAPI] Trims lookup failed (${resp.status}):`, body);
      res.status(502).json({ error: 'CarAPI trims lookup failed.', trims: [] });
      return;
    }

    const data = await resp.json() as { data?: CarApiTrim[] };
    const seen = new Set<string>();
    const trims: { subModel: string; engine: string | null; label: string }[] = [];

    for (const item of data.data ?? []) {
      const subModel = item.submodel ?? item.trim;
      if (!subModel) continue;

      const engine = parseEngine(item.description);
      const label = engine ? `${subModel} — ${engine}` : subModel;

      if (seen.has(label)) continue;
      seen.add(label);
      trims.push({ subModel, engine, label });
    }

    res.json({ trims });

  } catch (err: unknown) {
    // Log detail server-side; return a generic message (don't leak internals).
    console.error('[CarAPI]', err instanceof Error ? err.message : String(err));
    res.status(500).json({ error: 'Vehicle trims lookup failed.', trims: [] });
  }
});
