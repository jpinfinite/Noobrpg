import { Router } from 'express';
import { GameSimulation } from '../simulation/GameSimulation.js';
import { CharacterService } from '../services/characterService.js';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';

export function createSimulationRoutes(
  simulation: GameSimulation,
  characterService: CharacterService,
  authMiddleware: any
): Router {
  const router = Router();
  router.use(authMiddleware);

  // POST /api/simulation/join - Entra no mundo autoritativo
  router.post('/join', async (req: AuthenticatedRequest, res) => {
    try {
      const accountId = req.account!.id;
      const { characterId } = req.body;

      if (!characterId) {
        res.status(400).json({ error: 'characterId é obrigatório.' });
        return;
      }

      // Valida propriedade estrita e obtém dados
      const playerData = await characterService.getCharacter(accountId, characterId);
      const charRecord = await characterService.getCharacterRecord(characterId);
      const version = charRecord?.version || 1;

      // Junta o jogador na simulação autoritativa
      const serverPlayer = simulation.joinPlayer(playerData, accountId, version);

      res.json({
        message: 'Entrou na simulação autoritativa.',
        player: serverPlayer.toPlayerData(),
        worldSnapshot: simulation.getSnapshot()
      });
    } catch (err: any) {
      res.status(403).json({ error: err.message || 'Acesso negado ou erro ao entrar na simulação.' });
    }
  });

  // POST /api/simulation/action - Executa comando de ação autoritativo
  router.post('/action', async (req: AuthenticatedRequest, res) => {
    try {
      const accountId = req.account!.id;
      const { characterId, action, payload } = req.body;

      const player = simulation.getPlayer(characterId);
      if (!player) {
        res.status(404).json({ error: 'Jogador não está ativo na simulação. Chame /join primeiro.' });
        return;
      }

      if (player.accountId !== accountId) {
        res.status(403).json({ error: 'Acesso negado: o personagem não pertence a esta conta.' });
        return;
      }

      let result: any = { success: false };

      switch (action) {
        case 'MOVE':
          result = simulation.processMove(characterId, payload.x, payload.y, payload.timestamp);
          break;

        case 'ATTACK':
          result = simulation.processAttack(characterId, payload.targetMonsterId);
          break;

        case 'SKILL1':
          result = simulation.processSkill1(characterId, payload.targetMonsterId);
          break;

        case 'GATHER':
          result = simulation.processGather(characterId, payload.nodeId);
          break;

        case 'PICKUP':
          result = simulation.processPickup(characterId, payload.dropId);
          break;

        case 'CRAFT':
          result = simulation.processCraft(characterId, payload.recipeId);
          break;

        case 'USE_ITEM':
          result = simulation.processUseItem(characterId, payload.slotIndex);
          break;

        case 'EQUIP':
          result = simulation.processEquip(characterId, payload.slotIndex);
          break;

        default:
          res.status(400).json({ error: `Ação desconhecida: ${action}` });
          return;
      }

      res.json({
        action,
        result,
        player: player.toPlayerData(),
        combatEvents: simulation.combatEvents.slice(-5)
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Erro ao processar ação autoritativa.' });
    }
  });

  // GET /api/simulation/state - Snapshot do mundo e entidades
  router.get('/state', (req, res) => {
    res.json(simulation.getSnapshot());
  });

  // POST /api/simulation/leave - Sai do mundo e persiste atomicamente
  router.post('/leave', async (req: AuthenticatedRequest, res) => {
    try {
      const accountId = req.account!.id;
      const { characterId } = req.body;

      const player = simulation.getPlayer(characterId);
      if (!player) {
        res.status(404).json({ error: 'Jogador não encontrado na simulação ativa.' });
        return;
      }

      if (player.accountId !== accountId) {
        res.status(403).json({ error: 'Acesso negado ao personagem.' });
        return;
      }

      // Persiste estado autoritativo
      const persisted = await characterService.saveAuthoritativePlayer(player.id, {
        level: player.level,
        currentXp: player.currentXp,
        gold: player.gold,
        hp: player.hp,
        mp: player.mp,
        x: player.x,
        y: player.y,
        version: player.version,
        inventory: player.inventory,
        equipped: player.equipped
      });

      simulation.leavePlayer(characterId);

      res.json({
        message: 'Progresso autoritativo salvo com sucesso.',
        player: persisted
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Erro ao sair da simulação.' });
    }
  });

  return router;
}
