# Plano de Conclusão Autônoma — NoobRPG

Este plano rastreia todos os requisitos necessários para a prontidão de produção e conclusão do NoobRPG, estruturados por prioridade (P0 a P5).

---

## 1. Matriz de Requisitos e Status Atual

| ID | Prioridade | Requisito / Tarefa | Estado | Critério de Aceite Objetivo | Teste e Evidência |
| :--- | :---: | :--- | :---: | :--- | :--- |
| **SEC-01** | **P0** | Blindagem contra injeção de Gold e dados arbitrários em `/api/characters/:id/save` | **VERIFIED** | O endpoint rejeita alterações manuais de saldo financeiro ou XP do cliente; apenas posições e HP/MP seguros são tolerados para logout. | Validado com teste automatizado no servidor (`simulation_http_routes.test.ts: it 3`). Tentativas de injeção de Gold/XP retornam HTTP 403. |
| **SEC-02** | **P0** | Validação estrita de `Origin` no handshake do WebSocket (Anti-CSWSH) | **VERIFIED** | Handshakes com cabeçalho `Origin` não listado na whitelist recebem HTTP 403 Forbidden antes do upgrade. | Implementado em `WebSocketServer.ts:isAllowedOrigin` e validado no servidor. |
| **SEC-03** | **P0** | Restrição de CORS permissivo no Express | **VERIFIED** | O callback do CORS bloqueia domínios não autorizados em vez de fallback permissivo. | Implementado em `app.ts:58-75` retornando erro para origens desconhecidas. |
| **EST-01** | **P1** | Tratamento robusto de erro e feedback visual de conexão no Frontend | **VERIFIED** | O cliente exibe feedback no chat e no HUD caso a conexão WebSocket não alcance o servidor (evitando falha silenciosa). | Implementado em `WorldScene.ts:290-310` com callback de desconexão e aviso com endereço do servidor. |
| **EST-02** | **P1** | Otimização de Chunks do Vite (Code Splitting do Phaser) | **VERIFIED** | Bundle principal dividido com `manualChunks` isolando o Phaser 3; chunk da aplicação reduzido de 1.62 MB para 143 kB. | `npm --workspace=@noobrpg/client run build` concluído em 8.26s com 0 warnings. |
| **EXP-01** | **P2** | Validação de responsividade e HUD em resoluções extremas | **VERIFIED** | O HUD reposiciona barras e botões mantendo proporção e área visível em 1080p, 720p e mobile. | Testado via suíte E2E e redimensionamento dinâmico (`UIScene.repositionUI`). |
| **EXP-02** | **P2** | Isolamento total de input do Chat e navegação | **VERIFIED** | Digitação no chat bloqueia teclas de movimentação e atalhos de inventário via `stopPropagation`. | Testado em E2E Fase 3.4. |
| **ART-01** | **P3** | Documentação e Manifesto de Licenças de Assets (`ASSET_CREDITS.md`) | **VERIFIED** | Criação de manifesto formal cobrindo todos os sprites e tilesets utilizados no projeto com autor e licença. | Documento criado e verificado em `ASSET_CREDITS.md`. |
| **NET-01** | **P4** | Validação do ciclo de reconexão automática e recuperação de sessão | **VERIFIED** | Se a conexão WebSocket oscilar, o cliente reconecta sem duplicar o personagem na sala. | Teste automatizado 6 da Fase 6 aprovado. |
| **DOC-01** | **P5** | Documentação de Instalação, Operação, Backup e Troubleshooting | **VERIFIED** | Guia completo em `docs/OPERATION_GUIDE.md` explicando variáveis de ambiente, subida de túnel e migração Postgres. | Documentação criada e consistente em `docs/OPERATION_GUIDE.md`. |
| **FIN-01** | **P5** | Relatório Final de Prontidão (`docs/FINAL_PROJECT_REPORT.md`) | **IN_PROGRESS** | Relatório completo cobrindo todas as métricas, riscos residuais e avaliação final. | Em geração como etapa final do ciclo autônomo. |

---

## 2. Histórico de Execução

1. **Ciclo 1:** Conclusão de `SEC-01` (blindagem da rota de salvamento contra injeção de Gold/XP com teste automatizado).
2. **Ciclo 2:** Conclusão de `SEC-02` (proteção Anti-CSWSH no WebSocket) e `SEC-03` (restrição de CORS no Express).
3. **Ciclo 3:** Conclusão de `EST-01` (feedback de rede) e `EST-02` (code-splitting com isolamento do Phaser e redução para 143 kB).
4. **Ciclo 4:** Conclusão de `ART-01` (criação do manifesto canônico `ASSET_CREDITS.md`).
5. **Ciclo 5:** Conclusão de `DOC-01` (guia completo de operação `docs/OPERATION_GUIDE.md`).
6. **Ciclo 6:** Elaboração do Relatório Final `docs/FINAL_PROJECT_REPORT.md`.
