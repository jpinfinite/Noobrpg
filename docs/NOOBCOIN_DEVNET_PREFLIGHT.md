# NOOBCOIN (NOOB) — PLANO DE PRÉ-VOO DEVNET E GATE DE AUTORIZAÇÃO (MISSÃO 30C)

**Data do Documento:** 19 de Outubro de 2026  
**Projeto:** NoobRPG  
**Pacote Responsável:** `@noobrpg/solana-worker` ([packages/solana-worker/](file:///D:/NoobRPG/packages/solana-worker/))  
**Rede Alvo:** Solana Devnet (Cluster de Testes)  
**Status do Gate de Segurança:** 🟡 **READY FOR HUMAN REVIEW (SEM AUTORIZAÇÃO AUTOMÁTICA)**  
**Status do Bloqueio Operacional R2:** 🔴 **BLOCKED (Rotação de Credenciais Cloudflare R2 Pendente)**  
**Transações On-Chain Executadas:** **ZERO (0)** — Nenhuma carteira real, mint, assinatura ou transferência on-chain foi executada nesta missão.

---

## 1. Resumo Executivo e Regra Inegociável

Este documento consolida o **plano de pré-voo técnico e os parâmetros de governança** necessários antes de qualquer interação com a rede Solana Devnet.

Em conformidade com as regras inegociáveis do projeto:
- **NENHUMA transação on-chain foi enviada.**
- **NENHUMA mint ou carteira real foi gerada ou importada nesta missão.**
- **NENHUMA credencial privada ou seed phrase foi lida, impressa ou exposta.**
- Todos os testes e validações documentados em [NOOBCOIN_DEVNET_TEST_EVIDENCE.md](file:///D:/NoobRPG/docs/NOOBCOIN_DEVNET_TEST_EVIDENCE.md) foram realizados exclusivamente em ambiente local simulado com mocks e bancos de dados em memória.

---

## 2. Parâmetros Técnicos e Matriz de Decisão Humana

A tabela abaixo lista os parâmetros operacionais do token e da infraestrutura de teste, identificando formalmente os itens que aguardam deliberação do proprietário:

| Parâmetro | Proposta Técnica | Estado de Aprovação | Racional / Impacto Técnico |
| :--- | :--- | :---: | :--- |
| **Programa de Token** | **SPL Token Original** (`TokenkegQfeZyi...`) | `PENDENTE DE DECISÃO` | Máxima compatibilidade com carteiras Web3 (Phantom, Solflare, Backpack) e ferramentas de teste da Devnet. Alternativa: Token-2022 caso se deseje recursos de transfer fees futuros. |
| **Supply Máximo de Teste** | **1.000.000.000 NOOB** ($10^9$ unidades) | `PENDENTE DE DECISÃO` | Alinhado com o documento de Tokenomics ([NOOBCOIN_TOKENOMICS.md](file:///D:/NoobRPG/NOOBCOIN_TOKENOMICS.md)). Para testes iniciais de devnet, pode-se optar por cunhagem parcial controlada (ex: 100.000 tNOOB). |
| **Decimais (Precisão)** | **6 casas decimais** ($10^6$ unidades mínimas) | **PROPOSTO (Recomendado)** | Padrão da rede Solana (equivalente a USDC/USDT SPL), permitindo representação inteira sem perdas de ponto flutuante em `amountRaw`. |
| **Símbolo e Nome** | `tNOOB` / `NoobCoin Test Token` | `PENDENTE DE DECISÃO` | Prefixo `t` explicita que o ativo é exclusivamente de teste na Devnet, evitando confusão ou falsas expectativas no explorador de blocos. |
| **Endereço da Mint** | *Ainda não gerado* | `PENDENTE DE GERAÇÃO` | Será gerado localmente em tempo de execução somente após aprovação humana formal. |
| **Carteira Pagadora (Fee Payer)** | *Ainda não gerada* | `PENDENTE DE GERAÇÃO` | Exige arquivo local em `packages/solana-worker/secrets/devnet-payer-keypair.json` (bloqueado no `.gitignore`). Nenhum endereço existe atualmente. |
| **Mint Authority** | Chave pública do Fee Payer local do Worker | `PENDENTE DE DECISÃO` | Permite emissão inicial controlada. Pode ser revogada ou transferida para multisig no futuro. |
| **Freeze Authority** | Chave pública do Fee Payer (ou Nula) | `PENDENTE DE DECISÃO` | Recomendado manter ativa apenas para testes de contenção em Devnet; nula para descentralização final. |
| **Método de Custódia Local** | Arquivo JSON local com permissões `0600` | **RECOMENDADO PARA TESTES** | Arquivo isolado fora da árvore versionada do Git. Para Mainnet futura, exigirá módulo Cloud KMS / HSM. |
| **Endpoint RPC** | `https://api.devnet.solana.com` | **PROPOSTO** | Nó oficial da Solana Labs para Devnet (rate limit moderado). Para testes intensivos, recomenda-se provedor privado (Helius/QuickNode). |

---

## 3. Custos Estimados em SOL (Devnet) e Procedimento de Faucet

Todos os custos na rede Solana Devnet utilizam SOL puramente fictício de teste, sem qualquer valor econômico real:

1. **Estimativa de Custo de Aluguel de Contas (Rent-Exempt):**
   - Criação da Conta da Mint: ~**0.00146 SOL**
   - Criação da Associated Token Account (ATA) de Origem: ~**0.00204 SOL**
   - Criação de ATA por Destinatário (jogador de teste): ~**0.00204 SOL** por jogador
   - Taxa de Transação (`transferChecked`): **0.000005 SOL** (5.000 lamports) por transferência
2. **Procedimento de Obtenção de Fundos de Teste (Quando Autorizado):**
   - Via CLI oficial da Solana:
     ```bash
     solana airdrop 2 <ENDEREÇO_PUBLICO_GERADO> --url https://api.devnet.solana.com
     ```
   - Via Web Faucet: `https://faucet.solana.com` ou `https://solfaucet.com` selecionando rede Devnet.
   - Nenhuma transação com SOL real ou Mainnet é permitida.

---

## 4. Roteiro Passo a Passo de Execução Prevista (Sujeito a Aprovação)

Quando e se a autorização humana for concedida, a operação seguirá rigorosamente as seguintes etapas isoladas:

```
[ETAPA 1: Preparação Segura]
       │
       ▼
Geração de Keypair Local (secrets/) ──► Obtenção de 2 SOL no Faucet Devnet
       │
       ▼
[ETAPA 2: Emissão da Mint de Teste]
       │
       ▼
Execução do Script createTestMint() ──► Verificação do Genesis Hash e Cluster
       │
       ▼
Salvaguarda do Endereço Público da Mint (NOOB_TEST_MINT_ADDRESS)
       │
       ▼
[ETAPA 3: Teste de Transferência Controlada]
       │
       ▼
Criação de ATA de Teste ──► Transferência de 100 tNOOB com SPL Token Checked
       │
       ▼
[ETAPA 4: Auditoria e Reconciliação]
       │
       ▼
LedgerReconciler compara Saldo On-Chain vs Banco Relacional
```

### Detalhamento das Etapas e Efeitos:

#### Etapa 1: Geração de Chaves de Teste (Local)
- **Comando:**
  ```bash
  solana-keygen new --outfile packages/solana-worker/secrets/devnet-payer-keypair.json --no-bip39-passphrase
  ```
- **Efeito:** Cria arquivo de 64 bytes local no formato JSON array.
- **Risco:** Mínimo. Arquivo reside em pasta ignorada pelo `.gitignore`.
- **Reversibilidade:** Total (arquivo pode ser apagado a qualquer momento).

#### Etapa 2: Criação da Mint de Teste (On-Chain Devnet)
- **Comando Previsto:** Script interno `packages/solana-worker/scripts/create_test_mint.ts` consumindo [SolanaTokenService.createTestMint()](file:///D:/NoobRPG/packages/solana-worker/src/tokenService.ts#L43-L67).
- **Salvaguardas Ativas:** [NetworkGuard.verifyRpcCluster()](file:///D:/NoobRPG/packages/solana-worker/src/networkGuard.ts#L46-L78) consulta o nó RPC antes da instrução e aborta caso o Genesis Hash seja diferente de `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`.
- **Efeito:** Registra uma conta de SPL Mint na Devnet com 6 decimais.
- **Risco:** Baixo (ambiente Devnet gratuito).
- **Reversibilidade:** Irreversível na Devnet (a conta permanece no ledger público), porém descartável (pode ser abandonada sem custos).

#### Etapa 3: Distribuição Controlada de Teste
- **Comando Previsto:** Inicialização do worker em lote único:
  ```bash
  cmd /c npm run dev --workspace=@noobrpg/solana-worker
  ```
- **Efeito:** Transiciona uma recompensa de teste (`APPROVED` -> `QUEUED` -> `SUBMITTED` -> `CONFIRMED`).
- **Risco:** Timeout do nó RPC Devnet público.
- **Mitigação:** Reconciliação preventiva implementada no worker (`fetchSubmittedRewards`).

---

## 5. Procedimentos de Parada de Emergência e Recuperação

1. **Procedimento de Parada Imediata (Kill Switch):**
   - O worker pode ser finalizado instantaneamente via interrupção de processo (`Ctrl+C` ou finalização do PID Node.js).
   - Como o worker processa transações item a item com gravação atômica de `SUBMITTED` e assinatura, nenhuma transação em andamento é corrompida.
2. **Procedimento de Recuperação Pós-Incidente:**
   - Ao religar, o worker consulta `fetchSubmittedRewards` antes de buscar novas recompensas.
   - O reconciliador contábil ([LedgerReconciler](file:///D:/NoobRPG/packages/solana-worker/src/reconciler.ts#L14-L61)) varre as assinaturas on-chain e corrige divergências pendentes no ledger.

---

## 6. Parecer Final do Gate de Segurança

Com base nas evidências factuais obtidas na inspeção do código, nos 38 testes de resiliência aprovados, na validação de conectividade read-only comprovada em tempo real na Missão 30D e na ausência total de transações on-chain:

1. **Conectividade de Leitura (Smoke Test Real — Missão 30D):**
   - **Estado:** 🟢 **`PASS — READ-ONLY DEVNET VERIFIED`**
   - **Evidência:** Conexão HTTPS com `https://api.devnet.solana.com` respondeu com Genesis Hash exato da Devnet (`EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`), slot `512955617` e versão `4.4.0-beta.0`. Documentado em [NOOBCOIN_DEVNET_CONNECTIVITY_REPORT.md](file:///D:/NoobRPG/docs/NOOBCOIN_DEVNET_CONNECTIVITY_REPORT.md).
2. **Gate Operacional Solana Devnet:**
   - **Estado:** 🟡 **`READY FOR HUMAN REVIEW`**
   - **Justificativa:** O pacote `@noobrpg/solana-worker` implementa todas as salvaguardas fail-closed requeridas e a conectividade de leitura foi comprovada. Está tecnicamente preparado para análise e deliberação humana. **NÃO autoriza operações de escrita ou emissão de ativos sem aprovação prévia.**
3. **Bloqueio de Infraestrutura Externa (R2):**
   - **Estado:** 🔴 **`BLOCKED (R2 Rotation Pending)`**
   - **Justificativa:** A rotação manual das credenciais Cloudflare R2 no painel web pelo proprietário permanece pendente. Nenhuma ação externa dependente do R2 pode ser disparada.

**Declaração de Encerramento:** Nenhuma transação on-chain foi submetida. O sistema permanece bloqueado para emissões reais aguardando comando e autorização humana explícita.
