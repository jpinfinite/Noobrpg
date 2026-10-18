# Registro de Decisões de Arquitetura (ADR) — NoobRPG

## ADR-001: Seleção de Phaser 3 e Vite para o Cliente Web
- **Status:** Aprovado
- **Contexto:** Necessidade de um motor de jogo 2D eficiente, leve e com suporte nativo a WebGL e Canvas, que rode em qualquer navegador moderno sem necessidade de plugins ou downloads pesados.
- **Decisão:** Adotar **Phaser 3** com TypeScript empacotado via **Vite**.
- **Consequências:** Inicialização ultra-rápida, Hot Module Replacement instantâneo durante o desenvolvimento e suporte maduro a mapas do Tiled e spritesheets em pixel art.

---

## ADR-002: Modelo de Simulação Autoritativa do Servidor (Zero Client Trust)
- **Status:** Aprovado
- **Contexto:** Jogos web são altamente vulneráveis a manipulação de memória, injeção de scripts e requisições forjadas via console de desenvolvedor do navegador.
- **Decisão:** Nenhuma lógica de dano, XP, inventário, loot ou movimentação definitiva será confiada ao cliente. O cliente apenas despacha intenções de comando; o servidor roda um loop fixo a 20 Hz (50ms) e transmite os deltas validados.
- **Consequências:** Imunidade a hacks de dano infinito, vida infinita e duplicação de moedas no cliente; ligeiro acréscimo de complexidade no código de rede do servidor.

---

## ADR-003: Estrutura em Monorepo com Pacote Compartilhado (`@noobrpg/shared`)
- **Status:** Aprovado
- **Contexto:** As fórmulas de progressão de XP, cálculo de dano, definições de itens e contratos de rede precisam ser idênticos no cliente e no servidor para permitir predição no cliente e validação no servidor.
- **Decisão:** Organizar o projeto em um monorepo com `packages/shared`, `packages/client` e `packages/server`.
- **Consequências:** Zero duplicação de regras matemáticas e tipagem TypeScript compartilhada de ponta a ponta.

---

## ADR-004: Resolução Lógica 480×270 e Grid de Tiles 16×16
- **Status:** Aprovado
- **Contexto:** O jogo precisa manter proporção widescreen 16:9 sem distorção em monitores Full HD (1080p), 2K e 4K, preservando estética pixel-perfect.
- **Decisão:** Renderização interna fixa em `480 × 270`, aplicando escala inteira (4× em 1080p) e tilesets de `16 × 16` pixels com personagens de `16 × 24` pixels.
- **Consequências:** Escala perfeita sem efeito de "shimmering", alta densidade de detalhes visuais e escopo de criação de assets viável e ágil.

---

## ADR-005: Transações Atômicas e Locks Pessimistas para o Mercado
- **Status:** Aprovado
- **Contexto:** Mercados entre jogadores são alvos primários de ataques de corrida de concorrência (*race condition*) para duplicação de itens e moedas.
- **Decisão:** Uso obrigatório de transações `SERIALIZABLE` com `SELECT FOR UPDATE` no PostgreSQL e restrição de banco `CHECK (gold >= 0)`. Taxa de 5% deduzida no momento exato da transferência de custódia.
- **Consequências:** Integridade matemática e contábil absoluta na economia do jogo, sem riscos de itens fantasmas ou saldos negativos.

---

## ADR-006: Adiamento de Blockchain e Adoção Provisória de Pontos de Mérito
- **Status:** Aprovado
- **Contexto:** Implementar contratos inteligentes e ativos negociáveis precocemente gera riscos regulatórios, atrito técnico e distrai do foco primário de criar um jogo divertido e equilibrado.
- **Decisão:** Nenhuma blockchain ou token real será implementado nas Fases 1 a 7. Todo o fluxo de recompensas avançadas será modelado como "Pontos de Mérito" intransferíveis e testado em ambiente de simulação.
- **Consequências:** Foco 100% na jogabilidade, economia estável e segurança do jogador antes de qualquer exposição externa.

---

---

## ADR-008: Camada de Transporte Multiplayer em Tempo Real (WebSocket Puro vs Colyseus)
- **Status:** Aprovado
- **Contexto:** A Fase 5B exige que múltiplos jogadores autenticados compartilhem a mesma instância de mapa em tempo real a 20 Hz, com baixa latência, rate limiting, chat seguro e sincronização contínua de estado.
- **Comparação Técnica:**
  - *Colyseus:* Oferece abstração de salas e serialização binária com `@colyseus/schema`. Contudo, impõe forte acoplamento a decoradores proprietários incompatíveis com as interfaces puras de `@noobrpg/shared`, além de introduzir sobreposição com o loop autoritativo de 20 Hz já consolidado no `GameSimulation`.
  - *WebSocket Puro (`ws`):* Protocolo padrão da web, sem dependências opacas ou decorators. Permite integrar o handshake de upgrade HTTP diretamente com o sistema de autenticação via cookies `session_token` HttpOnly (prevenindo vazamento de tokens em query strings e logs). Possibilita arquitetura limpa de salas (`PlainsRoom`), rate limiting granular por conexão e uso direto dos contratos de `@noobrpg/shared`.
- **Decisão:** Adotar **WebSocket Puro via biblioteca `ws`** estruturado no padrão de Salas (`RoomManager` / `PlainsRoom`), acoplado diretamente à `GameSimulation` autoritativa a 20 Hz.
- **Consequências:** Controle total sobre o ciclo de vida das mensagens e rate limiting; preservação integral da simulação da Fase 5A; simplicidade de depuração e testes automatizados sem dependência de schemas proprietários.

