import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { IDatabase } from './db/index.js';
import { AccountRepository, SessionRepository } from './repositories/accountRepository.js';
import { CharacterRepository } from './repositories/characterRepository.js';
import { InventoryRepository } from './repositories/inventoryRepository.js';
import { EquipmentRepository } from './repositories/equipmentRepository.js';
import { GoldLedgerRepository } from './repositories/goldLedgerRepository.js';
import { AuthService } from './services/authService.js';
import { CharacterService } from './services/characterService.js';
import { createAuthMiddleware } from './middleware/authMiddleware.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createCharacterRoutes } from './routes/characterRoutes.js';
import { GameSimulation } from './simulation/GameSimulation.js';
import { createSimulationRoutes } from './routes/simulationRoutes.js';
import { RoomManager } from './multiplayer/RoomManager.js';

export function createApp(db: IDatabase, simulationInstance?: GameSimulation): Express {
  const app = express();

  // Repositórios
  const accountRepo = new AccountRepository(db);
  const sessionRepo = new SessionRepository(db);
  const characterRepo = new CharacterRepository(db);
  const inventoryRepo = new InventoryRepository(db);
  const equipmentRepo = new EquipmentRepository(db);
  const goldLedgerRepo = new GoldLedgerRepository(db);

  // Serviços
  const authService = new AuthService(accountRepo, sessionRepo);
  const characterService = new CharacterService(
    db,
    characterRepo,
    inventoryRepo,
    equipmentRepo,
    goldLedgerRepo
  );

  // Simulação Autoritativa
  const simulation = simulationInstance || new GameSimulation();

  // Gerenciador de Salas Multiplayer (Fase 5B)
  const roomManager = new RoomManager(characterService, simulation);

  // Armazena no app.locals para consumo pelo servidor HTTP/WebSocket e testes
  app.locals.db = db;
  app.locals.authService = authService;
  app.locals.characterService = characterService;
  app.locals.characterRepo = characterRepo;
  app.locals.roomManager = roomManager;
  app.locals.simulation = simulation;

  // Middlewares
  const clientOrigin = process.env.CLIENT_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:3000';
  const allowedList = clientOrigin.split(',').map((s) => s.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Permite requisições sem origin (como curl, mobile) ou se bater com localhost / pages.dev / túnel
        if (
          !origin ||
          allowedList.includes(origin) ||
          origin.endsWith('.pages.dev') ||
          origin.includes('localhost') ||
          origin.includes('127.0.0.1') ||
          origin.includes('trycloudflare.com')
        ) {
          callback(null, true);
        } else {
          callback(new Error('Origem não autorizada pela política de CORS.'));
        }
      },
      credentials: true
    })
  );
  app.use(cookieParser());
  app.use(express.json());

  // Middleware de Autenticação
  const authMiddleware = createAuthMiddleware(authService);

  // Rotas
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'noobrpg-server', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', createAuthRoutes(authService, authMiddleware));
  app.use('/api/characters', createCharacterRoutes(characterService, authMiddleware));
  app.use('/api/simulation', createSimulationRoutes(simulation, characterService, authMiddleware));

  // Handler 404
  app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint não encontrado.' });
  });

  // Handler de Erros Global
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('[Server Error]', err);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  });

  return app;
}
