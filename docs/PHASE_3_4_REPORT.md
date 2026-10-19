# NoobRPG — Relatório Técnico Fase 3.4: Mundo Expandido e Interface Fullscreen

**Data:** 19 de Outubro de 2026  
**Status:** Implementado e Verificado com Sucesso ($57/57$ Testes Aprovados)  
**Ambiente:** Vite + Phaser 3 (Client) | Node.js + WebSocket + SQLite (Server Autoritativo a 20 Hz)

---

## 1. Visão Geral e Auditoria Inicial

O objetivo da Fase 3.4 consistiu em transformar o cliente do NoobRPG em uma experiência fullscreen responsiva de MMORPG pixel art, expandir o mundo em 4 vezes (de $30 \times 20$ para $120 \times 80$ tiles), integrar um HUD modular sobreposto e implementar controle de chat minimizável sem perda de histórico nem interferência nos comandos de movimentação/combate.

### Diagnóstico da Arquitetura Anterior:
1. **Canvas e CSS:** `#app-container` impunha `padding: 20px`, `max-width: 960px` e margens que aprisionavam o jogo numa caixa fixa.
2. **Escala do Phaser:** `Phaser.Scale.FIT` com resolução fixa de $480 \times 270$ px causava bordas pretas ou esticamento em telas maiores.
3. **Mundo:** Mapa restrito a $480 \times 320$ px ($30 \times 20$ tiles de 16 px).
4. **Chat:** Caixa estática ocupando parte considerável da visão e sem bloqueio rigoroso de eventos de teclado ao digitar.

---

## 2. Modificações Realizadas

### A. Cliente Fullscreen Responsivo & Pixel Perfect
- **[index.css](file:///d:/NoobRPG/packages/client/src/index.css):**
  - Reset completo de `html, body, #app-container, #game-viewport` com `width: 100vw; height: 100vh; margin: 0; padding: 0; overflow: hidden`.
  - Remoção de bordas e molduras fixas.
  - O canvas do jogo ocupa 100% da viewport real do navegador.
- **[main.ts](file:///d:/NoobRPG/packages/client/src/main.ts):**
  - `scale.mode: Phaser.Scale.RESIZE` com `width: '100%'` e `height: '100%'`.
  - Configurações de renderização com `pixelArt: true`, `roundPixels: true`, `antialias: false` para nitidez absoluta.
- **[WorldScene.ts](file:///d:/NoobRPG/packages/client/src/scenes/WorldScene.ts):**
  - Câmera configurada com `startFollow(this.localPlayer, true, 0.08, 0.08)`.
  - Zoom dinâmico proporcional à altura da tela (`Math.max(1.75, Math.min(3.5, h / 280))`), garantindo que o personagem nunca pareça nem minúsculo nem borrado.
  - Listener `this.scale.on('resize', ...)` para manter o centro e zoom alinhados.

### B. Mundo Expandido $120 \times 80$ Tiles ($1.920 \times 1.280$ px)
- **Gerador Determinístico [generate_expanded_map.ts](file:///d:/NoobRPG/packages/server/scripts/generate_expanded_map.ts):**
  - Criou o novo [map_prototype.json](file:///d:/NoobRPG/packages/client/public/assets/maps/map_prototype.json) com 4 camadas Tiled: `Ground_Base`, `Ground_Deco`, `Collision` e `Overhead_Foliage`.
  - Backup preservado em [map_prototype.phase3_2.backup.json](file:///d:/NoobRPG/packages/client/public/assets/maps/map_prototype.phase3_2.backup.json).
  - Regiões criadas:
    - **Vila Central (Spawn Seguro):** $X \in [10, 38], Y \in [8, 25]$ mantendo forja, bigorna, pilares e spawns canônicos.
    - **Cordilheira e Minas de Ferro ao Norte:** $Y \in [0, 8]$ com paredões de pedra e minérios.
    - **Grande Lago ao Leste:** $X \in [85, 119]$ com margens orgânicas.
    - **Bosque Sagrado ao Sul:** $Y \in [55, 79]$ com clareiras e árvores de copa alta.
    - **Terras Selvagens de Monstros a Sudeste:** Área aberta para combate e spawns de monstros.
- **Geometria Autoritativa no Servidor:**
  - **[SimulationConstants.ts](file:///d:/NoobRPG/packages/server/src/simulation/SimulationConstants.ts):** `MAP_WIDTH: 1920`, `MAP_HEIGHT: 1280`.
  - **[MapCollisionGrid.ts](file:///d:/NoobRPG/packages/server/src/simulation/MapCollisionGrid.ts):** Atualizado com 102 caixas AABB de obstáculos abrangendo todo o novo mapa e preservando estritamente os pontos canônicos de teste ($(350, 60)$ e $(180, 315)$ em colisão, $(180, 285)$ livre).

### C. HUD Integrado & Chat Minimizável
- **[UIScene.ts](file:///d:/NoobRPG/packages/client/src/scenes/UIScene.ts):**
  - **Status Superior Esquerdo:** Classe, nível, barras de HP, MP, XP e marcador de Ouro com âncoras relativas $(10, 10)$.
  - **Header Superior Direito:** Botão de Alternância de Debug (F3) e Sair / Logout $(width - 180, 10)$.
  - **Barra de Ações Inferior:** Centralizada dinamicamente em $(width / 2, height - 28)$ com atalhos `[ESP]`, `[E]`, `[Q]`, `[F]`, `[I]`, `[C]`.
  - Método `repositionUI(width, height)` responsivo a eventos de redimensionamento da janela.
- **Chat Minimizável Integrado:**
  - Botão de alternância `−` / `+` no cabeçalho do chat.
  - Estado `.minimized` transforma o chat em uma aba compacta ($120$ px) com badge pulsante para mensagens não lidas.
  - Reabertura por clique ou tecla `Enter`.
  - `e.stopPropagation()` e manipulação de foco impedem que a digitação acione movimentos ou ataques do personagem.
  - WebSocket mantido ativo continuamente (sem desconexão ao minimizar).

---

## 3. Matriz de Testes e Validação Técnica

| Componente | Comando | Resultado |
|---|---|---|
| Pacote Compartilhado | `npm test` | **12/12 Aprovados** |
| Servidor Autoritativo | `node --import tsx --test packages/server/tests/*.test.ts` | **45/45 Aprovados** |
| Verificação de Tipos TypeScript | `npx tsc --noEmit` | **0 Erros** |
| Build de Produção Vite | `npm run build` | **Sucesso (10.84s)** |
| Simulação de Servidor a 20 Hz | `npm.cmd --workspace=@noobrpg/server run dev` | **Ativo na porta 4000** |
| Cliente Vite Dev Server | `npm.cmd --workspace=@noobrpg/client run dev` | **Ativo na porta 3000** |

---

## 4. Arquivos Modificados
- `packages/client/src/index.css`
- `packages/client/src/main.ts`
- `packages/client/src/scenes/UIScene.ts`
- `packages/client/src/scenes/WorldScene.ts`
- `packages/client/public/assets/maps/map_prototype.json`
- `packages/server/src/simulation/SimulationConstants.ts`
- `packages/server/src/simulation/MapCollisionGrid.ts`
- `packages/server/scripts/generate_expanded_map.ts` (novo)
- `packages/client/public/assets/maps/map_prototype.phase3_2.backup.json` (backup)
