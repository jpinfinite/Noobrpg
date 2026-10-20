# NOOBRPG — RELATÓRIO DA MISSÃO 7
## Alquimia, Integridade do Inventário e Economia de Recompensas

**Data:** 19 de Outubro de 2026  
**Status do Projeto:** Consolidado e 100% Aprovado (147/147 Testes Verificados)  
**Ambiente:** Node.js v22.14.0, Phaser 3.80.1, TypeScript 5.4.5, Vite 5.4.21, SQLite/PostgreSQL  
**Mapa Canônico de Produção:** `packages/client/public/assets/maps/map_prototype.json` (Preservado)

---

## 1. Baseline Inicial vs. Baseline Final

| Métrica / Suíte | Baseline Missão 6 | Baseline Final Missão 7 | Status |
| :--- | :--- | :--- | :--- |
| **Testes `@noobrpg/shared`** | 12 / 12 aprovados | **12 / 12 aprovados** | ✔ Sem regressão |
| **Testes `@noobrpg/server`** | 102 / 102 (12 suítes) | **120 / 120 (13 suítes)** | ✔ +18 novos testes |
| **Testes Live Server E2E** | 15 / 15 aprovados | **15 / 15 aprovados** | ✔ Servidor real 20 Hz |
| **Total Global de Testes** | **129 / 129** | **147 / 147** | ✔ **100% Aprovados** |
| **Build de Produção Cliente** | Aprovado (0 erros) | **Aprovado (`tsc && vite build`)** | ✔ 30 módulos empacotados |
| **Capacidade de Inventário** | 24 slots (risco de overflow) | **24 slots + Recompensas Pendentes** | ✔ Zero perda de itens |
| **Bancada de Alquimia** | Inexistente (apenas forja) | **Operacional (Vila & Protótipo)** | ✔ Zero Client Trust |

---

## 2. Problema de Inventário Identificado na Auditoria

Durante a auditoria de integridade do inventário, identificou-se que qualquer concessão de recompensa de missões (`starter_tutorial`, `quest_plains_threat`, `quest_tavern_supplies`) invocava a rotina `addItemToInventory(player.inventory, item.itemId, item.quantity)`.
Quando o jogador possuía todos os 24 slots preenchidos e não havia pilhas compatíveis com capacidade restante:
1. `addItemToInventory` retornava `{ success: false, addedQuantity: 0, remainingQuantity: X }`.
2. O servidor autoritativo ignorava silenciosamente esse retorno na conclusão de missões.
3. A missão era marcada como `completed = true`, adicionava a flag em `claimedRewards`, mas os itens excedentes eram perdidos de forma irreversível e sem nenhum registro.

---

## 3. Solução Escolhida e Justificativa

Em conformidade com a hierarquia de menor complexidade e máxima segurança:
1. **Entrega Direta com Empilhamento:** O servidor sempre tenta primeiro alocar no inventário respeitando os 24 slots e os limites `maxStack`.
2. **Desvio Atômico para Recompensas Pendentes (`character_pending_rewards`):** Qualquer excedente (`remainingQuantity > 0`) é direcionado para `player.pendingRewards`.
3. **Resgate Autoritativo Sob Demanda (`C2S_CLAIM_PENDING_REWARDS`):** O jogador pode liberar espaço e acionar o resgate via interface (botão flutuante na HUD, banner no modal de inventário ou diálogo contextual com NPCs).
4. **Idempotência e Prevenção de Duplicação:**
   - O resgate transfere apenas as unidades que couberem no inventário livre.
   - Pacotes resgatados são expurgados do banco de dados na mesma transação atômica (`saveAuthoritativePlayer`).
   - Requisições repetidas ou concorrentes via `Promise.all` são rejeitadas com segurança (`INVENTORY_FULL` ou `NO_PENDING_REWARDS`) sem duplicar itens.
   - Reconexões restauram o estado estrito salvo no banco sem conceder novos prêmios.

---

## 4. Sistema de Alquimia e Receitas Implementadas

Implementou-se a separação estrita entre estações de trabalho:
- **Bancadas de Alquimia (`ALCHEMY_STATIONS`):** Localizadas em $(530, 290)$ na Vila Inicial e $(220, 180)$ no Protótipo.
- **Bigornas de Forja (`CRAFTING_STATIONS`):** Localizadas em $(410, 310)$ na Vila Inicial e $(160, 140)$ no Protótipo.

### Receitas Canônicas de Alquimia
1. **Poção Menor de Ervas (`recipe_hp_potion_simple`):**
   - Categoria: `ItemCategory.CONSUMABLE`.
   - Ingredientes: 3x `herb_green`.
   - Nível Requerido: 1.
   - Resultado: 1x `potion_hp_minor` (Restaura 35 HP).
2. **Poção Menor de Vida (`recipe_hp_potion`):**
   - Categoria: `ItemCategory.CONSUMABLE`.
   - Ingredientes: 2x `herb_green` + 1x `slime_gel`.
   - Nível Requerido: 1.
   - Resultado: 1x `potion_hp_minor`.
3. **Poção de Vida Reforçada (`recipe_medium_hp_potion`):**
   - Categoria: `ItemCategory.CONSUMABLE`.
   - Ingredientes: 2x `potion_hp_minor` + 3x `herb_green`.
   - Nível Requerido: 3.
   - Resultado: 1x `potion_hp_medium` (Restaura 75 HP).

### Validações Autoritativas no Servidor
- **Proximidade Física:** Jogador deve estar a $\le 48\text{ px}$ da bancada correspondente (`TOO_FAR_FROM_CRAFTING_STATION`).
- **Estado Vital:** Jogador derrotado não pode fabricar itens (`PLAYER_DEAD`).
- **Atomicidade Transacional:** `executeCrafting` roda sobre um clone do inventário. Se faltarem materiais ou se o inventário estiver cheio (`INVENTORY_FULL`), a operação é abortada sem consumir nenhum ingrediente.

---

## 5. Arquivos Modificados e Criados

### Arquivos Criados
1. [packages/server/src/db/migrations/008_create_character_pending_rewards.sql](file:///d:/NoobRPG/packages/server/src/db/migrations/008_create_character_pending_rewards.sql): Esquema DDL compatível SQLite/PostgreSQL para persistência relacional de recompensas pendentes.
2. [packages/server/src/repositories/pendingRewardRepository.ts](file:///d:/NoobRPG/packages/server/src/repositories/pendingRewardRepository.ts): Repositório com métodos `getByCharacterId`, `savePendingRewards`, `addPendingReward` e `deleteById`.
3. [packages/client/src/entities/AlchemyStation.ts](file:///d:/NoobRPG/packages/client/src/entities/AlchemyStation.ts): Entidade física do Phaser 3 com dica visual `[F] Bancada de Alquimia`.
4. [packages/server/tests/alchemy_inventory_integrity.test.ts](file:///d:/NoobRPG/packages/server/tests/alchemy_inventory_integrity.test.ts): Suíte com 18 testes automatizados para a Missão 7.
5. [docs/ALCHEMY_INVENTORY_INTEGRITY_REPORT.md](file:///d:/NoobRPG/docs/ALCHEMY_INVENTORY_INTEGRITY_REPORT.md): Este relatório executivo e técnico.

### Arquivos Modificados
1. [packages/shared/src/types/index.ts](file:///d:/NoobRPG/packages/shared/src/types/index.ts): Interface `PendingRewardItem`, extensão de `PlayerData`, novas mensagens de rede `C2S_CLAIM_PENDING_REWARDS` e `S2C_PENDING_REWARDS_UPDATE`.
2. [packages/shared/src/constants/index.ts](file:///d:/NoobRPG/packages/shared/src/constants/index.ts): Nova receita `recipe_hp_potion_simple` (3x `herb_green` $\rightarrow$ 1x `potion_hp_minor`).
3. [packages/server/src/simulation/ServerPlayer.ts](file:///d:/NoobRPG/packages/server/src/simulation/ServerPlayer.ts): Array `pendingRewards`, método `addPendingReward()`, getters e setters para `currentHp` e `currentMp`.
4. [packages/server/src/simulation/GameSimulation.ts](file:///d:/NoobRPG/packages/server/src/simulation/GameSimulation.ts): Coordenadas `ALCHEMY_STATIONS`, separação autoritativa entre forja e alquimia em `processCraft()`, rotinas `deliverItemOrPend()` e `claimPendingRewards()`.
5. [packages/server/src/multiplayer/PlainsRoom.ts](file:///d:/NoobRPG/packages/server/src/multiplayer/PlainsRoom.ts): Handler de `C2S_CLAIM_PENDING_REWARDS`, sincronização em `onJoin()` e persistência relacional.
6. [packages/server/src/services/characterService.ts](file:///d:/NoobRPG/packages/server/src/services/characterService.ts): Integração atômica de `PendingRewardRepository` em `getCharacter()` e `saveAuthoritativePlayer()`.
7. [packages/client/src/net/MultiplayerClient.ts](file:///d:/NoobRPG/packages/client/src/net/MultiplayerClient.ts): Callback `onPendingRewardsUpdate` e método `sendClaimPendingRewards()`.
8. [packages/client/src/utils/TextureGenerator.ts](file:///d:/NoobRPG/packages/client/src/utils/TextureGenerator.ts): Geração procedural da textura `prop_alchemy_bench` (22x24 px).
9. [packages/client/src/scenes/WorldScene.ts](file:///d:/NoobRPG/packages/client/src/scenes/WorldScene.ts): Instanciação de `AlchemyStation`, repasse de eventos de rede para a interface.
10. [packages/client/src/scenes/UIScene.ts](file:///d:/NoobRPG/packages/client/src/scenes/UIScene.ts): Modal de Forja & Alquimia com tags `[Alquimia]` e `[Forja]`, badge flutuante de recompensas pendentes, banner de resgate no inventário e opções nos diálogos de NPCs.
11. [packages/server/tests/auth_persistence.test.ts](file:///d:/NoobRPG/packages/server/tests/auth_persistence.test.ts): Atualizada contagem de migrações para 8 tabelas canônicas.

---

## 6. Migrações e Esquema de Dados

### Migração 008 (`008_create_character_pending_rewards.sql`)
```sql
CREATE TABLE IF NOT EXISTS character_pending_rewards (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  source TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (character_id) REFERENCES characters (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pending_rewards_character_id ON character_pending_rewards (character_id);
```

---

## 7. Resultados dos Testes Automatizados

### `@noobrpg/shared` (12 testes)
```
✔ Recálculo de atributos de classes ao subir de nível
✔ Progressão de XP e disparo de Level Up
✔ Ciclo determinístico de combate: Guerreiro vs Slime
✔ Distância e alcance euclidiano
✔ Curva de XP acumulada e delta de níveis
✔ Fórmula de dano determinístico e limites mínimos
✔ Taxa de 5% do Mercado e integridade de repasse
✔ Normalização de vetor 2D para movimento em 8 direções
✔ Inventário de 24 slots: criação, empilhamento e limite de capacidade
✔ Remoção de itens e limpeza de slots
✔ Equipamentos: cálculo idempotente de atributos sem duplicidade de bônus
✔ Crafting Atômico: sucesso, falta de materiais e inventário cheio
Resultado: 12/12 aprovados (0 falhas).
```

### `@noobrpg/server` — Nova Suíte `alchemy_inventory_integrity.test.ts` (18 testes)
```
✔ 1. Recompensa com inventário vazio: entrega direta e sem pendências
✔ 2. Recompensa com pilha existente: empilha sem criar novo slot e sem perda
✔ 3. Recompensa com inventário 100% cheio: zero perda, desvio seguro para pendingRewards
✔ 4. Resgate autoritativo após liberar espaço (claimPendingRewards)
✔ 5. Resgate parcial: quando há espaço apenas para fração dos pacotes pendentes
✔ 6. Idempotência: requisições concorrentes de resgate via Promise.all não duplicam itens
✔ 7. Persistência relacional: restauração após restart do banco de dados
✔ 8. Isolamento entre múltiplos personagens
✔ 9. Alquimia: Fabricação com sucesso da Poção Menor de Vida pura com 3 ervas
✔ 10. Alquimia: Fabricação com sucesso da Poção Média de Vida combinando poções e ervas
✔ 11. Alquimia Zero Client Trust: Bloqueio por distância da bancada (TOO_FAR_FROM_CRAFTING_STATION)
✔ 12. Alquimia Zero Client Trust: Bloqueio por ingredientes insuficientes (MISSING_INGREDIENTS)
✔ 13. Alquimia Zero Client Trust: Bloqueio quando inventário está cheio sem consumir materiais
✔ 14. Consumíveis: Uso autoritativo de poção cura respeitando maxHp e consome 1 unidade
✔ 15. Consumíveis: Cura limitada ao teto de maxHp
✔ 16. Consumíveis: Concorrência com Promise.all na última poção disponível
✔ 17. Regressão Quests: Conclusão de quest_tavern_supplies com inventário cheio não perde a poção recompensada
✔ 18. Regressão Quests: Conclusão com inventário 100% cheio guarda recompensa em pendingRewards sem duplicação
Resultado: 18/18 aprovados (0 falhas).
```

### `@noobrpg/server` Global (120 testes em 13 suítes)
```
✔ auth_persistence.test.ts (10 testes)
✔ character_service.test.ts (9 testes)
✔ gameplay_hardening.test.ts (10 testes)
✔ gameplay_loop.test.ts (10 testes)
✔ multiplayer_sync.test.ts (9 testes)
✔ quest_security_rewards.test.ts (8 testes)
✔ secondary_quests.test.ts (15 testes)
✔ alchemy_inventory_integrity.test.ts (18 testes)
✔ simulation_routes.test.ts (3 testes)
✔ simulation_authoritative.test.ts (10 testes)
✔ starter_village_gameplay.test.ts (6 testes)
✔ unity_asset_pipeline.test.ts (7 testes)
✔ room_state.test.ts (5 testes)
Resultado: 120/120 aprovados (0 falhas).
```

### Live Server E2E (`e2e_full_game_live.ts` - 15 testes)
```
✔ [1/15] Health check online: ok
✔ [2/15] Jogador 1 registrado
✔ [3/15] 4 classes criadas no banco de dados (Warrior, Ranger, Mage, Druid)
✔ [4/15] Jogador 1 conectado ao WebSocket
✔ [5/15] Handshake de entrada concluído na sala plains_01
✔ [6/15] Snapshot autoritativo a 20 Hz recebido
✔ [7/15] Movimentação autoritativa aceita nas novas regiões expandidas (x=500..750)
✔ [8/15] Mensagem de chat transmitida e distribuída via WebSocket
✔ [9/15] Comando de ataque enviado contra mob_slime_1
✔ [10/15] Jogador 2 registrado
✔ [11/15] Jogador 1 recebeu S2C_PLAYER_JOINED em tempo real para o Jogador 2
✔ [12/15] Chat multiplayer cruzado
✔ [13/15] Jogador 2 desconectou; Jogador 1 recebeu S2C_PLAYER_LEFT
✔ [14/15] Estado do mundo expandido salvo no SQLite com Zero Client Trust
✔ [15/15] Conexão do Jogador 1 encerrada com sucesso
Resultado: 15/15 aprovados (0 falhas).
```

---

## 8. Resultado do Build de Produção

O comando `npm run build --workspace=@noobrpg/client` executou a compilação completa sem nenhum aviso ou erro:
```
> @noobrpg/client@0.1.0 build
> tsc && vite build

vite v5.4.21 building for production...
transforming...
✓ 30 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     1.64 kB │ gzip:   0.81 kB
dist/assets/index-BN--zelO.css      3.80 kB │ gzip:   1.36 kB
dist/assets/index-Cxc2akI2.js     204.88 kB │ gzip:  47.97 kB
dist/assets/phaser-CaWnzXme.js  1,478.57 kB │ gzip: 339.68 kB
✓ built in 8.26s
```

---

## 9. Evidências de Persistência e Prevenção de Duplicação

1. **Atomicidade em Transação de Banco:** `saveAuthoritativePlayer` limpa e reinsere os pacotes em `character_pending_rewards` dentro da mesma transação `db.transaction(...)` que versiona o personagem (`version = version + 1`).
2. **Concorrência Protegida:** A suíte executou `Promise.all` disparando 3 chamadas simultâneas de `claimPendingRewards` para o mesmo personagem. Exatamente 1 chamada obteve sucesso (`claimed = 1`), e as subsequentes foram rejeitadas sem duplicar itens (`getItemCount === 1`).
3. **Consumo de Itens na Forja e Alquimia:** Se o jogador não estiver próximo à bancada ou não tiver os ingredientes exatos, nenhum item é removido do inventário.
4. **Resistência a Desconexão:** Um personagem que desconectou com 2 pacotes pendentes teve o servidor reiniciado e, ao reconectar via `getCharacter`, seus pacotes estavam 100% preservados e prontos para resgate.

---

## 10. Limitações de Testes Visuais

1. **Ambiente Headless sem WebGL de GPU Física:** Os testes em tempo de build validam as instâncias de Phaser e gráficos através do runtime Node.js; testes com shaders WebGL profundos continuam dependendo da execução em navegador real.
2. **Interação com Toque Móvel:** Os botões de HUD suportam clique do mouse (`pointerdown`), porém gestos multitoque avançados de dispositivos móveis não foram avaliados nesta suíte.

---

## 11. Riscos Remanescentes

1. **Acúmulo Excessivo de Recompensas Pendentes:** Jogadores que completem dezenas de missões consecutivas sem resgatar acumularão linhas em `character_pending_rewards`. Recomendado na Missão 8 limitar a 50 pacotes pendentes por personagem com expiração configurável ou aviso visual.
2. **Concorrência entre Múltiplos Nós de Servidor (Multi-Instance):** O modelo atual utiliza coordenação por personagem (`saveQueue` em memória e transação relacional). Para cluster distribuído com dezenas de nós de servidor, um lock distribuído (ex: Redis Redlock) será necessário antes da escala massiva.

---

## 12. Recomendações para a Missão 8

1. **Sistema de Banco/Baú de Aethelgard:** Expandir a infraestrutura de itens pendentes para um Baú Pessoal de Armazenamento com capacidade de 48 slots nos entrepostos da vila.
2. **Novos Elixires e Cooldown de Consumo:** Adicionar poções de mana e elixires temporários de defesa/ataque, com cooldown global de 1.5s entre consumos para maior profundidade tática no combate PvP/PvE.
3. **Expansão Controlada do Mapa de Planícies:** Conectar a zona exterior da vila a uma dungeon de caverna utilizando o pipeline automatizado do Unity.
