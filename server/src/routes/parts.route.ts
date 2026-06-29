import { Router, Request, Response } from 'express';

// TODO: Wire up a real auto parts API (AutoZone, O'Reilly, NAPA, RockAuto, etc.)
// and a store locator (Google Places API or similar).

export const partsRouter = Router();

partsRouter.get('/search', async (req: Request, res: Response) => {
  const { part, zip, year, make, model } = req.query as Record<string, string>;

  if (!part || !zip) {
    res.status(400).json({ error: 'part and zip are required.' });
    return;
  }

  // STUB — return empty results until a real API is wired
  console.log(`[PARTS STUB] Searching for "${part}" near ${zip} for ${year} ${make} ${model}`);
  res.json({ results: [], stub: true });
});

partsRouter.get('/stores', async (req: Request, res: Response) => {
  const { zip } = req.query as Record<string, string>;
  if (!zip) { res.status(400).json({ error: 'zip is required.' }); return; }

  // STUB — return empty store list
  console.log(`[STORES STUB] Finding stores near ${zip}`);
  res.json({ stores: [], stub: true });
});
