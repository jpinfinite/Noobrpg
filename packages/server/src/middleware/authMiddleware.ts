import { Request, Response, NextFunction } from 'express';
import { AuthService, PublicAccount } from '../services/authService.js';

export interface AuthenticatedRequest extends Request {
  account?: PublicAccount;
  sessionToken?: string;
}

export function createAuthMiddleware(authService: AuthService) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Tenta pegar do cookie HttpOnly
      let token = req.cookies?.session_token;

      // 2. Fallback para header Authorization: Bearer <token>
      if (!token && req.headers.authorization) {
        const parts = req.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
          token = parts[1];
        }
      }

      if (!token) {
        res.status(401).json({ error: 'Não autenticado. Sessão não fornecida.' });
        return;
      }

      const account = await authService.validateSession(token);
      if (!account) {
        // Remove cookie inválido
        res.clearCookie('session_token');
        res.status(401).json({ error: 'Sessão expirada ou inválida.' });
        return;
      }

      req.account = account;
      req.sessionToken = token;
      next();
    } catch (err: any) {
      res.status(500).json({ error: 'Erro interno ao validar autenticação.' });
    }
  };
}
