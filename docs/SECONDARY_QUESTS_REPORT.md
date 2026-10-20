# Relatório da Missão 6: Missões Secundárias, NPCs Interativos e Expansão Controlada do Gameplay

**Projeto:** NoobRPG (MMORPG 2D Top-Down)  
**Data:** 19 de Outubro de 2026  
**Status da Missão:** Concluída com Sucesso Absoluto (129/129 Testes Aprovados, Build de Produção Válido)

---

## 1. Baseline Inicial

Antes de qualquer modificação, a baseline técnica foi verificada no ambiente real do projeto:
- **Testes do `@noobrpg/shared`:** 12/12 testes aprovados.
- **Testes do `@noobrpg/server`:** 87/87 testes aprovados em 11 suítes.
- **Testes Live Server E2E (`e2e_full_game_live.ts`):** 15/15 testes aprovados.
- **Total Inicial:** 114/114 testes aprovados (100% verde).
- **Mapa canônico de produção:** [packages/client/public/assets/maps/map_prototype.json](file:///d:/NoobRPG/packages/client/public/assets/maps/map_prototype.json) intacto.
- **Build de produção do cliente:** Aprovado em 8.19s com 0 erros.

---

## 2. Arquitetura de Quests Encontrada

A auditoria da implementação prévia (`starter_tutorial`) revelou uma infraestrutura sólida e modular:
- **Tabela Relacional `character_quests`:** Chave primária composta `(character_id, quest_id)` com colunas `step INTEGER`, `completed BOOLEAN`, `claimed_rewards TEXT (JSON)`, `created_at` e `updated_at`. Suporta qualquer quantidade de missões simultâneas de forma independente.
- **Repositório e Serviço:** [questRepository.ts](file:///d:/NoobRPG/packages/server/src/repositories/questRepository.ts) e [characterService.ts](file:///d:/NoobRPG/packages/server/src/services/characterService.ts) serializam e desserializam `CharacterQuestData` por ID de missão, integrando-se nativamente a transações SQLite e PostgreSQL.
- **Modelo de Dados do Jogador:** [ServerPlayer.ts](file:///d:/NoobRPG/packages/server/src/simulation/ServerPlayer.ts) armazena `quests: Map<string, CharacterQuestData>`, permitindo múltiplos estados ativos em paralelo.
- **Protocolo de Rede:** `C2S_QUEST_ACTION` e `S2C_QUEST_UPDATE` fornecem um canal autoritativo e bidirecional de controle de missões.
- **Decisão Arquitetural:** Para acomodar missões secundárias sem reinventar a roda ou criar frameworks excessivamente genéricos, bastou:
  1. Definir tipos e esquemas estáticos em `@noobrpg/shared` (`QuestType`, `QuestRewardConfig`, `QuestDefinition` e `QUEST_DEFINITIONS`).
  2. Adicionar rastreamento autoritativo de eventos de combate (`checkHuntingQuests`) em [GameSimulation.ts](file:///d:/NoobRPG/packages/server/src/simulation/GameSimulation.ts) quando monstros morrem.
  3. Expandir `processQuestAction` para lidar com máquinas de estado de caça e de coleta com consumo atômico de materiais e prevenção de duplicação.

---

## 3. NPCs e Missões Implementados

### 3.1 Guarda do Portão (Guarda Alistair — `npc_guard`)
- **Localização:**
  - Vila Inicial (`map_starter_village`): $(450, 90)$ — próximo à guarita da saída Norte.
  - Protótipo (`map_prototype`): $(210, 130)$ — junto ao portal de saída.
- **Aparência Visual:** Spritesheet procedural 16x24 px criado em [TextureGenerator.ts](file:///d:/NoobRPG/packages/client/src/utils/TextureGenerator.ts) com armadura de placas prateadas polidas, elmo com pluma escarlate, alabarda e escudo.
- **Missão Oferecida:** **Ameaças nas Planícies** (`quest_plains_threat`).
  - **Tipo:** Caça (`HUNT`).
  - **Diálogo Contextual:** Alerta sobre monstros rondando os arredores da vila e pede auxílio para eliminar ameaças imediatas.
  - **Objetivo:** Derrotar 3 Slimes (`SLIME`) autoritativamente no servidor.
  - **Máquina de Estados:**
    - Step 0 (Disponível): Jogador fala com o Guarda e aceita a missão $\rightarrow$ Step 1.
    - Step 1 (Em Progresso): Cada morte de Slime em combate físico ou habilidade registra um marco de abate (`slime_kill_1`, `slime_kill_2`, `slime_kill_3`) em `claimedRewards`. Ao atingir 3 abates autoritativos, avança automaticamente para Step 2.
    - Step 2 (Objetivo Cumprido): Jogador retorna ao Guarda Alistair para relatar o sucesso.
    - Step 3 (Concluída): Recompensas concedidas $\rightarrow$ 60 Gold, 40 XP e 2 Poções Menores de Vida (`potion_hp_minor`).
  - **Zero Client Trust:** O cliente não pode avançar o contador de mortes; apenas mortes em combates processados na sala autoritativa são contabilizadas.

### 3.2 Taverneiro (Taverneiro Tobin — `npc_tavern`)
- **Localização:**
  - Vila Inicial (`map_starter_village`): $(510, 290)$ — ao lado da taverna e mesas ao ar livre.
  - Protótipo (`map_prototype`): $(200, 180)$ — na praça comercial da vila.
- **Aparência Visual:** Spritesheet procedural 16x24 px em [TextureGenerator.ts](file:///d:/NoobRPG/packages/client/src/utils/TextureGenerator.ts) com camisa rústica vermelha, avental de couro marrom, fivela dourada, bigode característico e caneca de cerveja espumante.
- **Missão Oferecida:** **Suprimentos para a Taverna** (`quest_tavern_supplies`).
  - **Tipo:** Coleta e Entrega (`GATHER`).
  - **Diálogo Contextual:** Tobin precisa de ervas medicinais frescas para produzir tônicos revigorantes aos viajantes.
  - **Objetivo:** Entregar 3 Ervas Verdes (`herb_green`) existentes no inventário.
  - **Máquina de Estados:**
    - Step 0 (Disponível): Jogador fala com Tobin e aceita a missão $\rightarrow$ Step 1.
    - Step 1 (Em Progresso): O servidor verifica se o jogador possui no mínimo 3 `herb_green`. Se tiver menos, a entrega é rejeitada com motivo `INSUFFICIENT_ITEMS` e nenhum item é removido.
    - Step 2 (Concluída): Se possuir as 3 ervas, o servidor executa o consumo atômico via `removeItemById(player.inventory, 'herb_green', 3)` e concede as recompensas $\rightarrow$ 50 Gold, 35 XP e 1 Poção Média de Vida (`potion_hp_medium`).
  - **Idempotência:** Tentativas subsequentes reconhecem a conclusão e não cobram novas ervas nem duplicam prêmios.

---

## 4. Arquivos Criados e Alterados

| Arquivo | Tipo | Descrição das Modificações |
| :--- | :---: | :--- |
| [packages/shared/src/types/index.ts](file:///d:/NoobRPG/packages/shared/src/types/index.ts) | Modificado | Adicionados `QuestType`, `QuestRewardConfig`, `QuestDefinition` e campos opcionais em payloads. |
| [packages/shared/src/constants/index.ts](file:///d:/NoobRPG/packages/shared/src/constants/index.ts) | Modificado | Adicionado catálogo imutável `QUEST_DEFINITIONS` para `starter_tutorial`, `quest_plains_threat` e `quest_tavern_supplies`. |
| [packages/server/src/simulation/GameSimulation.ts](file:///d:/NoobRPG/packages/server/src/simulation/GameSimulation.ts) | Modificado | Adicionados spawns dos novos NPCs em `NPC_SPAWNS`; implementado `checkHuntingQuests` em `processAttack` e `processSkill1`; expandido `processQuestAction` com máquinas de estado autoritativas para caça e coleta atômica. |
| [packages/server/src/multiplayer/PlainsRoom.ts](file:///d:/NoobRPG/packages/server/src/multiplayer/PlainsRoom.ts) | Modificado | Propagação de `S2C_QUEST_UPDATE` e `S2C_INVENTORY_UPDATE` durante combate e interações de quest; persistência serializada via `saveQueue`. |
| [packages/client/src/utils/TextureGenerator.ts](file:///d:/NoobRPG/packages/client/src/utils/TextureGenerator.ts) | Modificado | Implementadas funções `generateGuardSpritesheet` (`npc_guard`) e `generateTavernkeeperSpritesheet` (`npc_tavern`). |
| [packages/client/src/scenes/WorldScene.ts](file:///d:/NoobRPG/packages/client/src/scenes/WorldScene.ts) | Modificado | Instanciação e registro interativo de `npc_guard` e `npc_tavern`; sistema de fade-out e fade-in de câmera durante transição de mapas com fallback à prova de travamentos. |
| [packages/client/src/scenes/UIScene.ts](file:///d:/NoobRPG/packages/client/src/scenes/UIScene.ts) | Modificado | Implementados `setupGuardDialog()`, `setupTavernDialog()`, seletor dinâmico de retratos e rastreador dinâmico de quests em `updateTutorialHUD()`. |
| [packages/server/tests/secondary_quests.test.ts](file:///d:/NoobRPG/packages/server/tests/secondary_quests.test.ts) | Criado | Suíte com 15 testes automatizados cobrindo caça, coleta atômica, combate, Zero Client Trust, isolamento, persistência e convivência com o tutorial. |
| [docs/COMPLETION_PLAN.md](file:///d:/NoobRPG/docs/COMPLETION_PLAN.md) | Modificado | Registrado requisito `QST-02` como VERIFIED. |
| [docs/WORK_LOG.md](file:///d:/NoobRPG/docs/WORK_LOG.md) | Modificado | Registro detalhado do Ciclo da Missão 6. |
| [docs/NEXT_SESSION.md](file:///d:/NoobRPG/docs/NEXT_SESSION.md) | Modificado | Atualizada baseline de 129 testes, status de build e próximos passos. |

---

## 5. Regras de Segurança e Persistência

1. **Zero Client Trust em Abates e Caça:** O cliente nunca envia mensagens do tipo "matei um monstro". O servidor avalia dano, HP do monstro, autoridade de abate e atualiza as quotas internamente.
2. **Consumo Atômico de Materiais:** Na missão do taverneiro, a verificação da quantidade e a dedução das 3 `herb_green` ocorrem na mesma rotina síncrona antes da concessão das recompensas. Em caso de quantidade insuficiente, nenhuma erva é consumida.
3. **Prevenção de Duplicação e Idempotência:** Requisições repetidas de conclusão (`COMPLETE`) verificam a flag `completed: true` e a presença do marcador em `claimedRewards`, retornando sucesso sem reenviar novos prêmios ou consumir itens adicionais.
4. **Proteção Concorrente (`Promise.all`):** 10 requisições simultâneas de entrega da mesma missão resultam em exatamente uma concessão de recompensas.
5. **Anti-Range e Anti-Teleport:** Interações de quest validam proximidade euclidiana ($\le 60\text{ px}$) do jogador ao NPC no mapa atual. Ações fora de alcance são prontamente rejeitadas com `TOO_FAR_FROM_NPC`.
6. **Bloqueio de Personagem Derrotado:** Jogadores mortos (`isDead = true`) são bloqueados de iniciar, progredir ou concluir missões (`PLAYER_DEAD`).
7. **Persistência Relacional Híbrida (SQLite & PostgreSQL):** O estado é salvo com integridade referencial em `character_quests`. O ledger de ouro registra as premiações com descrições auditáveis (`Quest Reward: quest_plains_threat` e `Quest Reward: quest_tavern_supplies`).

---

## 6. Testes Executados e Resultados

### 6.1 Nova Suíte: `packages/server/tests/secondary_quests.test.ts` (15/15)
- ✔ **1. Missão de Caça:** Aceite com Guarda Alistair avança para Step 1.
- ✔ **2. Missão de Caça Zero Client Trust:** Bloqueio de avanço ou recompensa prematura sem 3 mortes e bloqueio de NPC incorreto.
- ✔ **3. Missão de Caça:** Registro autoritativo de 3 mortes de Slimes no combate e avanço para Step 2.
- ✔ **4. Missão de Caça:** Conclusão e concessão única de +60 Gold, +40 XP e 2 Poções Menores de Vida.
- ✔ **5. Missão de Caça Idempotência:** Tentativas repetidas não duplicam recompensas.
- ✔ **6. Missão de Coleta:** Aceite com Taverneiro Tobin e avanço para Step 1.
- ✔ **7. Missão de Coleta Zero Client Trust:** Rejeição com ervas insuficientes (nada consumido).
- ✔ **8. Missão de Coleta:** Entrega atômica com consumo de 3 Ervas Verdes e concessão de recompensas (+50 Gold, +35 XP, 1 Poção Média).
- ✔ **9. Missão de Coleta Idempotência:** Entrega repetida não consome ervas extras nem duplica prêmios.
- ✔ **10. Concorrência Atômica:** 10 requisições simultâneas via `Promise.all` protegidas contra duplicação.
- ✔ **11. Anti-Range:** Rejeição física de interação fora do alcance dos novos NPCs.
- ✔ **12. Bloqueio de Morte:** Jogador derrotado não pode interagir com Guarda ou Taverneiro.
- ✔ **13. Isolamento entre Personagens:** Progresso e inventário de missões 100% independentes.
- ✔ **14. Persistência Relacional:** Salvamento e recuperação completa de múltiplas quests no SQLite.
- ✔ **15. Coexistência com o Tutorial:** Não-regressão do tutorial da Vila Inicial durante execução simultânea de missões secundárias.

### 6.2 Suítes Globais do Monorepo
- **`@noobrpg/shared`:** 12/12 testes aprovados.
- **`@noobrpg/server`:** 102/102 testes aprovados em 12 suítes.
- **Live Server E2E (`e2e_full_game_live.ts`):** 15/15 testes aprovados.
- **Total:** **129/129 testes aprovados (100% verde)**.

---

## 7. Build do Cliente

O comando `npm run build --workspace=@noobrpg/client` (`tsc && vite build`) foi executado no ambiente real:
- Transformação de 29 módulos sem erros.
- Bundle `dist/assets/index-Dp6sPTL6.js`: 197.79 kB (46.36 kB gzip).
- Bundle vendor `dist/assets/phaser-CaWnzXme.js`: 1,478.57 kB (339.68 kB gzip).
- Tempo de compilação: **8.58 segundos**.
- **0 erros de compilação TypeScript e Vite**.

---

## 8. Limitações de Testes Visuais

- O ambiente de testes em contêiner/terminal não possui GPU ou renderização nativa de tela WebGL/Canvas; portanto, animações visuais como `cameras.main.fadeOut` e interpolações de shader foram validadas no nível da API Phaser e com fallbacks em código (`cameras.main.fadeIn` dispara no callback de transição ou em timeout de segurança de 800ms para evitar tela preta em caso de falha de renderização).
- Os sprites procedurais foram gerados via rotinas matemáticas em Canvas 2D determinísticas idênticas às já aprovadas nas missões anteriores.

---

## 9. Riscos Remanescentes

1. **Escalonamento Distribuído do Servidor:** A fila `saveQueue` e a persistência em memória operam por processo. Em caso de implantação com múltiplos processos (múltiplas instâncias Node), a coordenação de salvamento exigirá um mecanismo distribuído (como Redis Locks ou locks transacionais no PostgreSQL). No estágio atual monoprocesso, a solução é 100% segura e livre de conflitos.
2. **Capacidade do Inventário:** Se o inventário do jogador estiver totalmente lotado ao concluir uma missão que concede itens (como as poções de cura), o item restante atualmente é descartado se não houver espaço livre. Recomenda-se implementar entrega em correio/baú de sobra no futuro.

---

## 10. Próxima Etapa Recomendada

1. **Alquimia & Caldeirão de Poções:** Permitir que o jogador utilize as ervas coletadas diretamente em uma bancada de alquimia na taverna para produzir poções de cura e mana.
2. **Sistema de Missões Repetíveis / Diárias:** Expandir o modelo atual para suportar reset de missões diárias com timestamp de expiração para o Guarda e Taverneiro.
3. **Novas Áreas e Monstros de Nível Superior:** Criar rotas para além dos portões da Vila Inicial levando a cavernas ou florestas profundas.
