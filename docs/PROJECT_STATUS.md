# Estado Real do Projeto — NoobRPG

**Data da Auditoria:** 19 de Outubro de 2026  
**Ambiente:** Windows (PowerShell), Node.js v22.16.0, npm 10.9.2  
**Branch Atual:** `master` (sincronizada com `origin/master`)  
**Commit Base:** `5b2645d`  

---

## 1. Resumo Executivo da Auditoria

O projeto **NoobRPG** é um MMORPG 2D em pixel art com arquitetura cliente-servidor autoritativa. A inspeção técnica e execução de testes em ambiente real confirmaram que os módulos centrais de simulação física, combate e multiplayer em tempo real funcionam com alto rigor de testes automatizados (72/72 testes passando).

Entretanto, foram identificados **3 riscos de segurança e configuração de produção** (incluindo uma brecha crítica em rota HTTP legada e ausência de validação de `Origin` no WebSocket) que devem ser corrigidos antes de qualquer lançamento público.

---

## 2. Matriz de Estado dos Componentes

| Componente | Estado Real | Evidência de Verificação |
| :--- | :---: | :--- |
| **Monorepo & Workspaces** | **VERIFIED** | `packages/shared`, `packages/server`, `packages/client` compilam sem erros via `npm workspaces`. |
| **Testes Unitários (Shared)** | **VERIFIED** | 12/12 testes aprovados (`npm test`, 289 ms). |
| **Testes de Servidor** | **VERIFIED** | 45/45 testes aprovados (`node --test packages/server/tests/*.test.ts`, 7.95 s). |
| **Testes E2E ao Vivo** | **VERIFIED** | 15/15 testes ponta a ponta ao vivo aprovados (1.30 s). |
| **Compilação TypeScript** | **VERIFIED** | `npx tsc --noEmit` concluiu com 0 erros. |
| **Build do Frontend** | **VERIFIED** | Vite compilou bundle em 8.74 s (`dist/` gerado com sucesso). |
| **Simulação Autoritativa (20 Hz)** | **VERIFIED** | Validado em testes: anti-speedhack, anti-rangehack, cooldowns e colisão física estática (102 AABBs). |
| **Área de Interesse (AOI)** | **VERIFIED** | Histerese espacial ($400\times250$ px entrada / $480\times330$ px saída) e sincronização delta validadas. |
| **Frontend Fullscreen & HUD** | **VERIFIED** | Phaser opera em `Phaser.Scale.RESIZE`, câmera suave e chat recolhível com isolamento de input. |
| **Persistência & Ledger** | **VERIFIED** | Migrações 001 a 006 aplicadas no SQLite, constraints contábeis (`CHECK gold >= 0`) ativas. |
| **Hospedagem de Produção Backend** | **PENDING** | Backend local exposto provisoriamente via Cloudflare Tunnel (`trycloudflare.com`). Sem hospedagem dedicada permanente. |
| **Configuração Cloudflare Pages** | **RISK_IDENTIFIED** | Frontend exige variáveis `VITE_API_URL` e `VITE_WS_URL` no build. Fallback padrão aponta para porta 4000. |

---

## 3. Vulnerabilidades e Riscos Críticos Identificados

### 3.1 [CRÍTICO] Injeção de Saldo e Inventário na Rota HTTP Legada
- **Arquivo:** `packages/server/src/services/characterService.ts` (linhas 302–316)
- **Descrição:** A rota `/api/characters/:id/save` aceita `payload.goldChange` e atualizações de inventário fornecidas pelo cliente HTTP. Na arquitetura autoritativa (Fases 5 e 6), toda modificação financeira deve ser exclusivamente concedida pelo servidor (`saveAuthoritativePlayer`).
- **Impacto:** Um cliente malicioso com token de sessão válido poderia forjar requisições POST para creditar Gold infinito em seu personagem.
- **Ação Obrigatória:** Restringir o endpoint `/save` para aceitar apenas posições de logout ou desativar alterações de Gold via requisição direta do cliente.

### 3.2 [ALTO] Ausência de Validação de Origin no WebSocket (Risco CSWSH)
- **Arquivo:** `packages/server/src/multiplayer/WebSocketServer.ts` (linhas 60–108)
- **Descrição:** O handler de HTTP Upgrade aceita conexões WebSocket na rota `/ws` sem checar se o cabeçalho `Origin` corresponde aos domínios autorizados (`CLIENT_ORIGIN` ou lista segura).
- **Impacto:** Suscetibilidade a Cross-Site WebSocket Hijacking (CSWSH) se o cookie de sessão `session_token` for transmitido por um site terceiro malicioso.
- **Ação Obrigatória:** Validar estritamente o header `Origin` contra a whitelist de domínios no momento do upgrade HTTP.

### 3.3 [ALTO] Fallback Inadequado de WebSocket no Frontend para Produção
- **Arquivo:** `packages/client/src/net/MultiplayerClient.ts` (linhas 49–56)
- **Descrição:** Quando `VITE_WS_URL` não é injetado no build, o cliente tenta conectar em `${protocol}//${host}:4000/ws`. Em páginas hospedadas no Cloudflare Pages (`*.pages.dev`), a porta 4000 não está aberta, resultando em falha imediata de conexão sem mensagem amigável para o usuário.
- **Ação Obrigatória:** Fornecer diagnóstico visual na tela de login/mundo quando o WebSocket falhar e documentar a configuração obrigatória no Cloudflare Pages.

### 3.4 [MÉDIO] Regra de CORS permissiva no Express
- **Arquivo:** `packages/server/src/app.ts` (linha 71)
- **Descrição:** O callback de CORS executa `callback(null, true)` no bloco `else`, permitindo qualquer origem mesmo com `credentials: true`.
- **Ação Obrigatória:** Retornar `callback(new Error('Origem não permitida por CORS'))` para origens desconhecidas.

---

## 4. Próxima Etapa

Prosseguir para a criação do plano mestre em `docs/COMPLETION_PLAN.md` e iniciar imediatamente a implementação da tarefa **P0 — Correção da Brecha de Injeção de Gold e Blindagem de Segurança da Rota de Salvamento**.
