import { Router } from 'express';
import { CharacterService } from '../services/characterService.js';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';

export function createCharacterRoutes(characterService: CharacterService, authMiddleware: any): Router {
  const router = Router();

  // Todas as rotas de personagens exigem autenticação
  router.use(authMiddleware);

  // GET /api/characters - Lista personagens pertencentes à conta autenticada
  router.get('/', async (req: AuthenticatedRequest, res) => {
    try {
      const accountId = req.account!.id;
      const characters = await characterService.listCharacters(accountId);
      res.json({ characters });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Erro ao listar personagens.' });
    }
  });

  // POST /api/characters - Cria um novo personagem para a conta
  router.post('/', async (req: AuthenticatedRequest, res) => {
    try {
      const accountId = req.account!.id;
      const { name, characterClass } = req.body;

      const player = await characterService.createCharacter(accountId, name, characterClass);
      res.status(201).json({
        message: 'Personagem criado com sucesso.',
        player
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Falha ao criar personagem.' });
    }
  });

  // GET /api/characters/:id - Carrega personagem com verificação estrita de conta
  router.get('/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const accountId = req.account!.id;
      const characterId = req.params.id;

      const player = await characterService.getCharacter(accountId, characterId);
      res.json({ player });
    } catch (err: any) {
      res.status(403).json({ error: err.message || 'Acesso negado ao personagem.' });
    }
  });

  // POST /api/characters/:id/save - Salva o progresso e estado do personagem
  router.post('/:id/save', async (req: AuthenticatedRequest, res) => {
    try {
      const accountId = req.account!.id;
      const characterId = req.params.id;
      const payload = req.body;

      const updatedPlayer = await characterService.saveCharacter(accountId, characterId, payload);
      res.json({
        message: 'Progresso salvo com sucesso.',
        player: updatedPlayer
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Falha ao salvar progresso do personagem.' });
    }
  });

  return router;
}
