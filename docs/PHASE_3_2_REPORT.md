# NOOBRPG — RELATÓRIO TÉCNICO DE ENTREGA
## FASE 3.2: EVOLUÇÃO SEGURA DO MAPA

**Projeto:** `D:\NoobRPG`  
**Motor:** Phaser 3  
**Arquitetura:** Monorepo (`@noobrpg/shared`, `@noobrpg/client`, `@noobrpg/server`)  
**Data:** 19/10/2026

---

### 1. ARQUIVOS MODIFICADOS

1. [`packages/server/src/simulation/SimulationConstants.ts`](file:///d:/NoobRPG/packages/server/src/simulation/SimulationConstants.ts)
   - Unificado `MAP_HEIGHT: 320` (anteriormente divergente em 270 px, gerando rubberbanding no sul).
2. [`packages/server/src/simulation/MapCollisionGrid.ts`](file:///d:/NoobRPG/packages/server/src/simulation/MapCollisionGrid.ts)
   - Atualizados os limites das paredes laterais para altura 320 px.
   - Ajustada a borda física sul para a linha 19 (`y = 304..320`).
   - Cadastrada a geometria de colisão física autoritativa do Lago (5 caixas cobrindo a massa de água entre $x = 304..448$ e $y = 16..112$).
3. [`packages/server/tests/simulation_authoritative.test.ts`](file:///d:/NoobRPG/packages/server/tests/simulation_authoritative.test.ts)
   - Adicionadas asserções permanentes para bloqueio no lago, bloqueio na parede sul e permissão de caminhada na nova região sul expandida ($y = 285$).
4. [`packages/client/src/utils/TextureGenerator.ts`](file:///d:/NoobRPG/packages/client/src/utils/TextureGenerator.ts)
   - Expandido o tileset `tileset_prototype` de $128 \times 32$ px para $128 \times 64$ px (32 células de $16 \times 16$ px).
   - Preservados os 8 tiles originais (GIDs 1 a 8).
   - Implementados 24 novos tiles em pixel art (variações de grama, margens de lago, bordas/cantos de trilha, calçamento ornamental da forja, placa, arbustos floridos, rocha lisa e tiles de árvore).
   - Implementada a geração separada de texturas de árvore: `prop_tree_trunk` (base com sombra e tronco colidível) e `prop_tree_canopy` (copa visual volumosa para ordenação Y e ver-através).
5. [`packages/client/public/assets/maps/map_prototype.json`](file:///d:/NoobRPG/packages/client/public/assets/maps/map_prototype.json)
   - Atualizado para 32 tiles no tileset (`imageheight: 64`).
   - Estruturado em 4 camadas padronizadas:
     - `Ground_Base` ($30 \times 20$): solo base, calçamento da forja, trilhas e água profunda com margens.
     - `Ground_Deco` ($30 \times 20$): bordas de caminho autotile-like, tufos, cascalho, trevos, flores, placas e arbustos.
     - `Collision` ($30 \times 20$): camada de colisão física sólida perimetral e água do lago.
     - `Overhead_Foliage` ($30 \times 20$): copas de árvores aéreas cenográficas com renderização superior.
6. [`packages/client/src/scenes/WorldScene.ts`](file:///d:/NoobRPG/packages/client/src/scenes/WorldScene.ts)
   - Carregamento e ordenação de profundidade das 4 camadas (`Ground_Base` depth 0, `Ground_Deco` depth 1, `Collision` depth 2, `Overhead_Foliage` depth 2000).
   - Adicionado sistema de animação de cintilação do lago em 3 frames dinâmicos via `time.addEvent`.
   - Gerenciamento de oclusão inteligente (`updateCanopyOcclusion`) no loop de atualização para árvores de cenário.
7. [`packages/client/src/entities/EnvironmentProp.ts`](file:///d:/NoobRPG/packages/client/src/entities/EnvironmentProp.ts)
   - Separação entre base sólida do tronco (`prop_tree_trunk`, hitbox de $14 \times 10$ px na raiz) e copa associada (`prop_tree_canopy`).
   - Profundidade estática baseada na posição vertical da base (`this.setDepth(this.y)`).
   - Implementado efeito de ver-através (alpha fade para 0.65 quando o jogador passa por trás da copa).
8. [`packages/client/src/entities/GatheringNode.ts`](file:///d:/NoobRPG/packages/client/src/entities/GatheringNode.ts)
   - Árvores de madeira (`GatheringNodeType.TREE`) agora utilizam tronco e copa separados.
   - A copa oculta/reaparece dinamicamente conforme o ciclo de coleta e respawn.

---

### 2. BACKUPS CRIADOS

- Backup de segurança do mapa original preservado em:  
  [`packages/client/public/assets/maps/map_prototype.v1.backup.json`](file:///d:/NoobRPG/packages/client/public/assets/maps/map_prototype.v1.backup.json)

---

### 3. PROBLEMAS ENCONTRADOS E CORRIGIDOS

1. **Divergência de Altura e Rubberbanding no Sul:**
   - *Problema:* O mapa do cliente tinha $480 \times 320$ px ($30 \times 20$ tiles), enquanto `SimulationConstants.ts` no servidor limitava `MAP_HEIGHT = 270`. Ao caminhar para o sul além de $y = 254$, o servidor rejeitava a posição e forçava teleporte/rubberbanding.
   - *Correção:* Unificado `MAP_HEIGHT = 320` no servidor e ajustada a parede sul em `MapCollisionGrid.ts` para $y = 304..320$.
2. **Ausência de Colisão Autoritativa do Lago:**
   - *Problema:* O lago no nordeste existia visualmente no cliente, mas o servidor não possuía caixas de colisão cadastradas para a água, permitindo que clientes maliciosos ou dessincronizados andassem sobre a água.
   - *Correção:* Cadastradas 5 caixas AABB em `MapCollisionGrid.ts` cobrindo a geometria exata da camada de água ($x: 304..448$, $y: 16..112$).
3. **Árvores em Bloco Único:**
   - *Problema:* Sprite monolítico causava corte brusco de profundidade e impedia que o jogador visse sua silhueta ao andar atrás da folhagem.
   - *Correção:* Separação do tronco e da copa com ver-através suave (alpha 0.65) e depth sorting estrito por coordenada Y.
4. **Camadas Desorganizadas:**
   - *Problema:* O mapa anterior misturava solo e decorações em uma única camada `Ground`, sem separação para detalhes, copas ou autotiling.
   - *Correção:* Divisão em `Ground_Base`, `Ground_Deco`, `Collision` e `Overhead_Foliage` com compatibilidade reversa.

---

### 4. DECISÕES DE COORDENADAS E COLISÃO

- **Convenção de Coordenadas:** A posição autoritativa $(x, y)$ representa o ponto de apoio dos pés do personagem (`origin = 0.5, 0.85` de sprite $16 \times 24$, body offset $2, 16$).
- **Validação no Servidor:** O servidor valida o movimento em `isWalkable(x, y, radius = 5)`, que projeta uma caixa AABB de $10 \times 10$ px ao redor dos pés, perfeitamente compatível com a hitbox física de $12 \times 8$ px do cliente.
- **Geometria das Paredes:**
  - Parede Norte: $x = 0..480, y = 0..16$
  - Parede Sul: $x = 0..480, y = 304..320$
  - Parede Oeste: $x = 0..16, y = 0..320$
  - Parede Leste: $x = 464..480, y = 0..320$
- **Geometria Autoritativa do Lago:**
  - Faixa 1 (linha 1): $x = 336..416, y = 16..32$
  - Faixa 2 (linha 2): $x = 320..432, y = 32..48$
  - Faixa 3 (linhas 3 e 4): $x = 304..448, y = 48..80$
  - Faixa 4 (linha 5): $x = 320..416, y = 80..96$
  - Faixa 5 (linha 6): $x = 352..400, y = 96..112$

---

### 5. MAPEAMENTO DOS ÍNDICES DO TILESET (128 × 64 px)

Tamanho: 32 células ($16 \times 16$ px), 8 colunas $\times$ 4 linhas. `firstgid = 1`.

| GID | Célula (Col, Linha) | Nome do Tile | Descrição e Função |
|:---:|:---:|:---|:---|
| **1** | (0, 0) | `Grass_Base` | Grama verde rica padrão (canônico preservado) |
| **2** | (1, 0) | `Dirt_Path_Base` | Terra batida / caminho rústico padrão (canônico preservado) |
| **3** | (2, 0) | `Stone_Cobble_Base` | Pavimento de pedra cinza (canônico preservado) |
| **4** | (3, 0) | `Dungeon_Wall` | Parede de pedra sólida / tijolos escuros (colidível) |
| **5** | (4, 0) | `Water_Deep` | Água azul profunda com ondulação (colidível) |
| **6** | (5, 0) | `Grass_Yellow_Flowers` | Flores amarelas silvestres sobre grama |
| **7** | (6, 0) | `Grass_Red_Flowers` | Flores vermelhas sobre grama |
| **8** | (7, 0) | `Fence_Wood` | Cerca rústica de ripas de madeira |
| **9** | (0, 1) | `Grass_Dense_Tufts` | Grama com tufos densos e brotos verde-claros |
| **10** | (1, 1) | `Grass_Pebbles` | Relva com pequenos seixos e cascalho embutido |
| **11** | (2, 1) | `Grass_Wild_Herbs` | Relva com trevos de 4 folhas e folhas silvestres |
| **12** | (3, 1) | `Water_Shore_North` | Margem norte do lago (areia/terra acima, água abaixo) |
| **13** | (4, 1) | `Water_Shore_South` | Margem sul do lago (água acima, terra abaixo com espuma) |
| **14** | (5, 1) | `Water_Shore_West` | Margem oeste do lago (areia à esquerda, água à direita) |
| **15** | (6, 1) | `Water_Shore_East` | Margem leste do lago (água à esquerda, areia à direita) |
| **16** | (7, 1) | `Water_Shimmer` | Água com cintilação de luz e reflexo cristalino |
| **17** | (0, 2) | `Path_Edge_North` | Trilha de terra com dentes de grama ao norte |
| **18** | (1, 2) | `Path_Edge_South` | Trilha de terra com dentes de grama ao sul |
| **19** | (2, 2) | `Path_Edge_West` | Trilha de terra com borda de grama a oeste |
| **20** | (3, 2) | `Path_Edge_East` | Trilha de terra com borda de grama a leste |
| **21** | (4, 2) | `Path_Corner_NW` | Canto noroeste de transição da trilha |
| **22** | (5, 2) | `Path_Corner_NE` | Canto nordeste de transição da trilha |
| **23** | (6, 2) | `Path_Corner_SW` | Canto sudoeste de transição da trilha |
| **24** | (7, 2) | `Path_Corner_SE` | Canto sudeste de transição da trilha |
| **25** | (0, 3) | `Forge_Square_Cobble` | Lajes nobres de basalto da Praça da Forja com fuligem e faíscas |
| **26** | (1, 3) | `Village_Signpost` | Poste e marco de sinalização da vila |
| **27** | (2, 3) | `Deco_Bush` | Arbusto denso decorativo com bagas azuladas |
| **28** | (3, 3) | `Deco_Rock` | Rocha arredondada de granito com líquens |
| **29** | (4, 3) | `Tree_Canopy_Top` | Copa da árvore (topo/centro para overhead) |
| **30** | (5, 3) | `Tree_Canopy_Left` | Copa da árvore (flanco esquerdo) |
| **31** | (6, 3) | `Tree_Canopy_Right` | Copa da árvore (flanco direito) |
| **32** | (7, 3) | `Tree_Trunk_Base` | Tronco e raízes de carvalho fincados no solo |

---

### 6. TESTES EXECUTADOS E RESULTADOS REAIS

#### A. Testes Unitários e de Integração
- **Pacote `@noobrpg/shared`:**
  - Comando: `npm test`
  - Resultado: **12/12 aprovados** (duração: 351 ms)
- **Pacote `@noobrpg/server`:**
  - Comando: `npm --workspace=@noobrpg/server test`
  - Resultado: **45/45 aprovados** (duração: 8.3 s)
  - Inclui teste formal de colisão autoritativa do lago, teste de retenção na parede sul e permissão de caminhada no sul expandido.
- **Total de Testes Automatizados:** **57/57 testes aprovados (100%)**

#### B. Validação TypeScript e Build
- **Typecheck:** `npx tsc --noEmit` -> **0 erros**
- **Build de Produção do Cliente:** `npm --workspace=@noobrpg/client run build` -> **Sucesso** (bundle Vite gerado em 9.74s)

#### C. Testes Autoritativos com WebSocket em Tempo Real
- **Teste de Limite Sul:** Jogador move-se de $y = 160$ até $y = 285$. Servidor confirma posição autoritativa via snapshot sem rubberbanding.
- **Teste de Parede Sul:** Jogador tenta mover-se para $y = 315$. Servidor retém o jogador em $y = 285$ impedindo atravessar a parede ($y \ge 304$).
- **Teste de Colisão do Lago:** Jogador tenta mover-se para dentro da água em $x = 340, y = 60$. Servidor bloqueia o avanço em $x = 296$ (início físico do lago em $x = 304$).
- **Teste Multiplayer e AOI:** Duas sessões conectadas simultaneamente. Jogador 1 recebe Jogador 2 com precisão em $(180, 260)$ sem duplicação de entidades.

---

### 7. LIMITAÇÕES EXISTENTES

1. **Ambiente Automatizado Playwright:** O subagente de browser Playwright encontrou restrição de rede no sandbox para download externo de binários do driver, impossibilitando gravação automatizada via CDP headless neste ambiente. A validação funcional e autoritativa foi realizada via suite Node.js e testes HTTP/WebSocket em tempo real.
2. **Object Layer Tiled:** Conforme acordado na Etapa C, os spawns de monstros, nós e props continuam instanciados via código TypeScript autoritativo em `WorldScene.ts` e `GameSimulation.ts`, mantendo total segurança Zero Client Trust.

---

### 8. CONFIRMAÇÃO DE PRESERVAÇÃO DOS SPAWNS CANÔNICOS

Todos os pontos canônicos foram auditados na grade de $30 \times 20$ e continuam em tiles desobstruídos com colisão 0:

| Objeto / Entidade | Posição $(x, y)$ | Tile (Col, Linha) | Status de Colisão |
|:---|:---:|:---:|:---:|
| **Spawn do Jogador** | $(180, 160)$ | Col 11, Linha 10 | Desobstruído (Livre) |
| **Forja de Crafting** | $(190, 140)$ | Col 11, Linha 8 | Desobstruído (Praça) |
| **Madeira 1** | $(90, 80)$ | Col 5, Linha 5 | Desobstruído (Livre) |
| **Madeira 2** | $(300, 210)$ | Col 18, Linha 13 | Desobstruído (Livre) |
| **Minério 1** | $(140, 60)$ | Col 8, Linha 3 | Desobstruído (Livre) |
| **Minério 2** | $(260, 60)$ | Col 16, Linha 3 | Desobstruído (Livre) |
| **Ervas 1** | $(100, 150)$ | Col 6, Linha 9 | Desobstruído (Livre) |
| **Ervas 2** | $(270, 160)$ | Col 16, Linha 10 | Desobstruído (Livre) |
| **Slime 1** | $(220, 130)$ | Col 13, Linha 8 | Desobstruído (Livre) |
| **Slime 2** | $(120, 190)$ | Col 7, Linha 11 | Desobstruído (Livre) |
| **Slime 3** | $(260, 190)$ | Col 16, Linha 11 | Desobstruído (Livre) |
| **Goblin** | $(280, 70)$ | Col 17, Linha 4 | Desobstruído (Livre) |
