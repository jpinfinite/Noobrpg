# NoobCoin (NOOB) — Relatório de Auditoria de Prontidão, Ledger e Segurança

**Data da Auditoria:** 19 de Outubro de 2026  
**Auditor Técnico:** Antigravity Pro (Auditoria Independente de Engenharia)  
**Escopo:** Ledger interno, modelos relacionais, regras financeiras, módulo `packages/solana-worker`, proteções de rede e salvaguardas antes de qualquer integração on-chain.

---

## 1. Veredito Geral e Declaração de Prontidão

> [!CRITICAL]
> **DECLARAÇÃO DE PRONTIDÃO TÉCNICA:**
> A existência de uma proposta de tokenomics documentada e a implementação de um livro-razão (ledger) interno relacional **NÃO COMPROVAM nem autorizam o lançamento do token em blockchain real ou a captação de recursos financeiros.**
> 
> O subsistema NoobCoin encontra-se **ESTRITAMENTE EM ESTÁGIO DE PREPARAÇÃO CONTÁBIL E TESTES DE ISOLAMENTO**. Nenhuma transação foi submetida a qualquer rede pública (Mainnet ou Devnet), nenhuma autoridade de minting foi cunhada e nenhuma liquidez foi aportada.

---

## 2. Auditoria do Livro-Razão Interno (Ledger)

### 2.1 Modelagem Relacional e Integridade ACID
A persistência do NoobCoin é governada pela migração [010_create_noobcoin_ledger.sql](file:///d:/NoobRPG/packages/server/src/db/migrations/010_create_noobcoin_ledger.sql):
- **Tabela `noobcoin_rewards_ledger`:**
  - `amount_raw BIGINT NOT NULL CHECK (amount_raw > 0)`: Garante integridade matemática e impede valores nulos, negativos ou zerados.
  - `idempotency_key TEXT NOT NULL UNIQUE`: Blindagem cripto-transacional contra repetições de requisições ou replays de rede.
  - `status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'QUEUED', 'SUBMITTED', 'CONFIRMED', 'REJECTED', 'CANCELLED'))`: Restrição estrita de domínio.
  - Chaves estrangeiras ativas com `ON DELETE CASCADE` para `characters(id)` e `accounts(id)`.
- **Tabela `noobcoin_daily_limits`:**
  - `UNIQUE (entity_type, entity_id, limit_date)`: Assegura consolidação diária idempotente por personagem e por conta.

### 2.2 Representação Numérica e Decimais Fixos
- Implementado em [noobcoinRewardService.ts](file:///d:/NoobRPG/packages/server/src/services/noobcoinRewardService.ts):
  - Utilitários estáticos `parseUnits()` e `formatUnits()` padronizados em **6 casas decimais** ($1\text{ NOOB} = 1.000.000\text{ unidades brutas}$).
  - Manipulação baseada estritamente em strings e inteiros seguros (`Number.isSafeInteger`). Ponto flutuante IEEE-754 banido de todas as operações monetárias.

### 2.3 Máquina de Estados e Bloqueio On-Chain
- Implementado em [noobcoinRepository.ts](file:///d:/NoobRPG/packages/server/src/repositories/noobcoinRepository.ts):
  - Fluxo permitido: `PENDING -> APPROVED -> QUEUED -> SUBMITTED -> CONFIRMED`.
  - Estados `SUBMITTED` e `CONFIRMED` possuem bloqueio explícito no repositório com flag `allowOnchainTransitions: false` por padrão, impedindo que o servidor web convencional transicione estados para blockchain.
  - Estados `CONFIRMED`, `REJECTED` e `CANCELLED` são terminais (não admitem novas transições).

### 2.4 Proteção Contra Concorrência e Limites Diários
- Em SQLite: [sqlite.ts](file:///d:/NoobRPG/packages/server/src/db/sqlite.ts) serializa todas as transações concorrentes através de uma `transactionQueue` transparente.
- Em [noobcoinRewardService.grantReward](file:///d:/NoobRPG/packages/server/src/services/noobcoinRewardService.ts#L90-L191):
  - Idempotência verificada antes da transação e revalidada atomicamente dentro do bloco `db.transaction()`.
  - Consulta de tetos diários (100 NOOB por personagem e 250 NOOB por conta) executada dentro da mesma transação antes da inserção e incremento.

---

## 3. Auditoria do Pacote `packages/solana-worker`

### 3.1 Arquitetura Desacoplada
- O diretório [packages/solana-worker](file:///d:/NoobRPG/packages/solana-worker) constitui um pacote Node.js autônomo.
- As dependências `@solana/web3.js` e `@solana/spl-token` estão instaladas exclusivamente dentro de `packages/solana-worker/package.json`. O servidor HTTP/WebSocket (`packages/server`) e o cliente Phaser (`packages/client`) **não possuem qualquer dependência de bibliotecas Solana**.

### 3.2 Proteção Matemática Anti-Mainnet (`NetworkGuard`)
- Localização: [packages/solana-worker/src/networkGuard.ts](file:///d:/NoobRPG/packages/solana-worker/src/networkGuard.ts).
- Validado com 9 testes automatizados em [network_guard.test.ts](file:///d:/NoobRPG/packages/solana-worker/tests/network_guard.test.ts):
  - Checagem do Genesis Hash oficial da Solana Devnet: `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`.
  - Bloqueio explícito do Genesis Hash da Mainnet-Beta (`5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`) e da Testnet (`4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY`).
  - Rejeição de URLs RPC contendo a palavra `"mainnet"` ou endpoints ambíguos sem `"devnet"`.

### 3.3 Status do Teste do Worker
- Validado com 11 testes automatizados em [worker_distribution.test.ts](file:///d:/NoobRPG/packages/solana-worker/tests/worker_distribution.test.ts):
  - Testes executados usando `MockTokenService` e `InMemoryLedgerAdapter`.
  - **Zero chamadas de rede reais realizadas durante os testes.**
  - **Nenhuma chave privada, seed phrase ou carteira de produção encontrada no código ou nos repositórios.**

---

## 4. Matriz de Classificação de Riscos do Subsistema NoobCoin

| Risco | Nível | Evidência / Diagnóstico | Mitigação Atual | Ação Pendente |
| :--- | :---: | :--- | :--- | :--- |
| **Transação Acidental na Mainnet** | **BAIXO** | `NetworkGuard` bloqueia Genesis Hash e endpoints; dependências isoladas em worker. | Validação em runtime e testes unitários dedicados. | Manter bloqueio permanente no CI/CD. |
| **Exposição de Chaves Privadas** | **BAIXO** | Nenhuma chave privada ou seed phrase está presente no repositório. Mocks utilizados para testes. | Self-custody do usuário e hot wallet futura prevista em Cloud KMS. | Nunca adicionar chaves privadas em arquivos de texto locais. |
| **Vazamento Contábil por Timeout de RPC** | **MÉDIO** | Quedas de rede durante `sendAndConfirmTransaction` podem deixar transações sem confirmação local. | Reconciliação preventiva em [worker.ts](file:///d:/NoobRPG/packages/solana-worker/src/worker.ts) verificando assinaturas antes de reenvio. | Testar timeouts simulados com instâncias Devnet lentas. |
| **Discrepância SQLite vs Postgres em Alta Concorrência** | **MÉDIO** | SQLite usa fila em memória serializada; se houver múltiplos nós, SQLite não escala concorrentemente. | `transactionQueue` no SQLite funciona para instância única de teste. | Migrar formalmente para PostgreSQL em produção com clustering. |
| **Risco Regulatório e Promessa de Valor** | **ALTO** | O token ainda não possui parecer formal de conformidade com os pareceres de orientação da CVM (ex.: Parecer 40/2022). | Checklist preliminar elaborado em [NOOBCOIN_LEGAL_CHECKLIST_BR.md](file:///d:/NoobRPG/docs/NOOBCOIN_LEGAL_CHECKLIST_BR.md). | Homologação jurídica externa antes de qualquer distribuição a terceiros. |

---

## 5. Critérios Objetivos para Autorização da Próxima Fase (Solana Devnet)

A integração controlada na Solana Devnet **SÓ DEVERÁ SER AUTORIZADA** quando os seguintes pré-requisitos forem formalmente cumpridos:

1. **Aprovação Humana Explícita:** O usuário/desenvolvedor deve autorizar a execução da fase de conexão via comando no ambiente.
2. **Uso Exclusivo de Faucet e Airdrop Devnet:** Apenas SOL de teste obtidos via faucet oficial da Devnet podem ser usados para pagar aluguel de contas e taxas de rede.
3. **Bloqueio Contínuo de Mainnet:** O `NetworkGuard` deve permanecer ativado em qualquer execução do worker.
4. **Isolamento de Contabilidade:** Nenhuma alteração no saldo de Gold tradicional do jogo deve impactar o balanço de tokens sem passar pelo ledger auditado.
