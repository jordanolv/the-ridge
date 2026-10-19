import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const TOKEN_TTL = '7d';

export function getSecret(): string {
  const s = process.env.WEB_JWT_SECRET;
  if (!s) throw new Error('WEB_JWT_SECRET manquant');
  return s;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  if (!token) { res.status(401).json({ error: 'Token manquant' }); return; }
  try {
    const payload = jwt.verify(token, getSecret()) as { admin?: boolean };
    if (!payload.admin) throw new Error();
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}
