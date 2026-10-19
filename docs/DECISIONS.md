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

---

## ADR-009: Desduplicação de Entidades e Fatiamento de Texturas Procedurais
- **Status:** Aprovado
- **Contexto:** Na Fase 5B, foi observada uma grade com múltiplos bonecos desenhados na coordenada do jogador e suspeita de duplicação de entidades multiplayer no mapa.
- **Diagnóstico:**
  1. *Fatiamento de Canvas Procedural:* O gerador `TextureGenerator` criava um canvas de 64x72 px contendo 12 poses do personagem, porém não registrava os frames individuais no Phaser com `canvas.add()`. O Phaser tratava a textura como imagem inteiriça de 64x72 px, renderizando a folha completa de 12 bonecos em grade para um único sprite.
  2. *Idempotência e Identidade Local:* O cliente requeria identificador local imutável (`localPlayerId`) para garantir que o próprio personagem nunca seja instanciado como entidade remota, além de limpeza idempotente na desconexão do servidor (`PlainsRoom.onLeave`).
- **Decisão:**
  1. Registrar explicitamente cada frame ($16 \times 24$ px para heróis/goblins e $16 \times 16$ px para slimes) no `CanvasTexture` do Phaser.
  2. Indexar rigorosamente entidades remotas por UUID estável (`characterId`) com atualização in-place de estado e descarte estrito de IDs ausentes do snapshot.
  3. Implementar hook `shutdown()` para teardown limpo de cena no cliente e `.unref()` nos timers do servidor.
- **Consequências:** Eliminação total da matriz de bonecos; renderização de exatamente 1 sprite por jogador; suíte de regressão automatizada cobrindo 8 cenários críticos.

---

## ADR-010: Área de Interesse (AOI), Sincronização por Deltas e Controle de Sequência
- **Status:** Aprovado
- **Contexto:** Com o crescimento de jogadores simultâneos por sala, o broadcast de snapshots completos globais gerava um gargalo quadrático $O(N^2)$ (7,8 MB/s para 50 jogadores), sobrecarregando a banda do servidor e clientes.
- **Decisão:**
  1. **Área de Interesse (AOI) com Histerese:** Implementar gerenciador espacial com raio interno de entrada ($180 \times 120$ px) e raio externo de saída ($220 \times 150$ px), eliminando oscilações de fronteira (*flickering*). Clientes recebem apenas entidades dentro de sua vizinhança.
  2. **Filtragem de Eventos de Combate:** Broadcasts de combate são restritos aos participantes e aos clientes que têm atacante ou defensor em seu campo de visão.
  3. **Sincronização por Deltas Incrementais (`s2c_snapshot_delta`):** Transmissão apenas de deltas e supressão de atributos não modificados, com controle monótono de sequência (`seq`) para descarte estrito de pacotes fora de ordem.
  4. **Full Snapshot Âncora Periódico:** Transmissão de snapshot completo a cada 20 ticks (1s) e na entrada de novos clientes, servindo como âncora de integridade contra divergências de estado.
  5. **Autoridade Absoluta:** O AOI afeta unicamente a visibilidade e entrega de pacotes de rede; o motor de simulação (`GameSimulation`) continua avaliando 100% das regras de combate, movimento e recursos no servidor.
- **Consequências:** Redução de **80,5%** na largura de banda e **80,9%** no tamanho médio dos pacotes com 50 jogadores simultâneos, mantendo o consumo por tick do servidor em 4,69 ms (menos de 10% do orçamento de 50 ms a 20 Hz).



