import { Router, Response } from 'express';
import { AuthService } from '../services/authService.js';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';

export function createAuthRoutes(authService: AuthService, authMiddleware: any): Router {
  const router = Router();

  const setSessionCookie = (res: Response, token: string) => {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('session_token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
    });
  };

  // POST /api/auth/register
  router.post('/register', async (req, res) => {
    try {
      const { username, password } = req.body;
      const { account, sessionToken } = await authService.register(username, password);

      setSessionCookie(res, sessionToken);
      res.status(201).json({
        message: 'Conta registrada com sucesso.',
        account,
        token: sessionToken // Fornece token para compatibilidade com clientes de API / testes
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Falha ao registrar conta.' });
    }
  });

  // POST /api/auth/login
  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
      const { account, sessionToken } = await authService.login(username, password, clientIp);

      setSessionCookie(res, sessionToken);
      res.json({
        message: 'Login realizado com sucesso.',
        account,
        token: sessionToken
      });
    } catch (err: any) {
      // 401 para credenciais inválidas ou rate limit
      res.status(401).json({ error: err.message || 'Credenciais inválidas.' });
    }
  });

  // POST /api/auth/logout
  router.post('/logout', async (req: AuthenticatedRequest, res) => {
    try {
      const token = req.cookies?.session_token || req.headers.authorization?.split(' ')[1];
      if (token) {
        await authService.logout(token);
      }
      res.clearCookie('session_token');
      res.json({ message: 'Logout realizado com sucesso.' });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao deslogar.' });
    }
  });

  // GET /api/auth/me
  router.get('/me', authMiddleware, (req: AuthenticatedRequest, res) => {
    res.json({ account: req.account });
  });

  return router;
}
