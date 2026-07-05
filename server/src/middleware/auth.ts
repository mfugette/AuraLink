import { Request, Response, NextFunction } from 'express';
import { getUserIdFromToken } from '../data/supabase';

// Augment Express' Request so handlers can read req.userId (set by requireAuth).
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Gate a route behind Supabase Auth. Expects `Authorization: Bearer <jwt>`,
 * verifies the token with Supabase, and attaches the resolved user id as
 * req.userId. Responds 401 if the header is missing or the token is invalid.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ error: 'Missing or malformed Authorization header.' });
    return;
  }

  const userId = await getUserIdFromToken(token);
  if (!userId) {
    res.status(401).json({ error: 'Invalid or expired session.' });
    return;
  }

  req.userId = userId;
  next();
}
