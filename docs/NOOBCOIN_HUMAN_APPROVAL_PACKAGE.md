# NOOBCOIN (NOOB) — PACOTE DEFINITIVO DE DECISÃO E APROVAÇÃO HUMANA (MISSÃO 30E)

**Data do Documento:** 19 de Outubro de 2026  
**Projeto:** NoobRPG  
**Pacote Responsável:** `@noobrpg/solana-worker` ([packages/solana-worker/](file:///D:/NoobRPG/packages/solana-worker/))  
**Rede Pretendida:** Solana Devnet (Ambiente de Testes)  
**Status do Gate Geral:** 🟡 **`READY FOR HUMAN DECISION (AGUARDANDO DELIBERAÇÃO HUMANA)`**  
**Status do Bloqueio Operacional R2:** 🔴 **`BLOCKED (Rotação de Credenciais Cloudflare R2 Pendente)`**  
**Transações On-Chain Executadas:** **ZERO (0)** — Nenhuma carteira real, mint, assinatura ou transferência on-chain foi executada nesta missão.

---

## 1. Resumo Executivo e Princípios Inegociáveis

Este documento consolida o **pacote formal de decisão humana** para a eventual inicialização da integração entre o NoobRPG e a rede de testes Solana Devnet.

Em conformidade rigorosa com as diretrizes do projeto:
- **NENHUMA CARTEIRA FOI GERADA OU IMPORTADA.**
- **NENHUMA MINT ON-CHAIN FOI CRIADA.**
- **NENHUMA TRANSAÇÃO FOI ASSINADA OU TRANSMITIDA.**
- **NENHUM SOL FOI SOLICITADO A FAUCETS.**
- **NENHUM TOKEN FOI EMITIDO.**
- **NENHUM ACESSO À MAINNET OCORREU OU FOI CONFIGURADO.**
- **NENHUM SEGREDO OU CHAVE PRIVADA FOI LIDO OU EXPOSTO.**

O objetivo deste pacote é fornecer ao proprietário do projeto todas as opções técnicas, impactos, custos estimados, riscos e alternativas, para que a decisão de avançar para a emissão de um token de teste na Devnet seja deliberada e autorizada de forma explícita e consciente.

---

## 2. Decisões Recomendadas pela Engenharia

A equipe de engenharia e segurança avaliou as alternativas e recomenda a seguinte configuração inicial:

| Tópico de Decisão | Recomendação Técnica | Racional Técnico e de Segurança |
| :--- | :--- | :--- |
| **Programa de Token** | **SPL Token Original** (`TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`) | Compatibilidade universal imediata com 100% das carteiras (Phantom, Solflare, Backpack), exploradores de blocos e ferramentas Devnet. Tamanho de conta fixo e previsível (165 bytes para token accounts), facilidade máxima de auditoria e ausência de extensões complexas. |
| **Supply de Teste** | **Opção A: 1.000.000 tNOOB** (Supply Reduzido de Teste) | Isola os testes de staging da economia teórica de 1 bilhão. Evita distorções em faucets da Devnet e deixa inequívoco que o ativo não possui valor econômico. |
| **Decimais** | **6 Casas Decimais** ($10^6$ unidades mínimas) | Padrão nativo da rede Solana (USDC/USDT SPL). Garante representação como inteiros puros em JavaScript (`amountRaw`) sem perda de precisão IEEE-754 de ponto flutuante. |
| **Símbolo e Nome** | `tNOOB` / `NoobCoin Test Token` | O prefixo `t` explicita que o ativo é estritamente de teste na Devnet em qualquer visualização pública no Solscan ou carteiras. |
| **Mint Authority** | **Ativa na Carteira do Worker (Fase Devnet)** | Permite que o worker emita lotes adicionais controlados para testes de carga. Deve ser revogada ou transferida para multisig caso o ativo avance para fases futuras. |
| **Freeze Authority** | **Ativa na Carteira do Worker (ou Nula)** | Manter ativa em Devnet permite testar o comportamento do cliente e do worker diante de contas congeladas (circuit breaker). |
| **Provedor RPC** | `https://api.devnet.solana.com` | Nó público oficial gratuito, suficiente para validação piloto de baixa frequência (latência média comprovada de ~250 ms na Missão 30D). |
| **Custódia Local** | Arquivo JSON local em `packages/solana-worker/secrets/` | Isolamento fora da árvore rastreada pelo Git (`*keypair*.json` já blindado no `.gitignore`). Permissões de arquivo restritas ao sistema operacional. |

---

## 3. Matriz Comparativa: Alternativas e Consequências

### 3.1 Programa de Token: SPL Token Original vs. Token-2022

| Aspecto de Análise | SPL Token Original (Recomendado) | Token-2022 (Extensions Program) | Consequência da Escolha |
| :--- | :--- | :--- | :--- |
| **Endereço do Programa** | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` | Mudança estrutural no ID do programa chamado pelas instruções. |
| **Metadados On-Chain** | Exige programa externo Metaplex (`mpl-token-metadata`). | Suporta extensão embutida *Metadata Pointer*. | Token-2022 economiza contas externas, mas adiciona complexidade na serialização. |
| **Taxas de Transferência** | Não suporta taxas embutidas no protocolo de token. | Suporta *Transfer Fee* nativa retida automaticamente. | Se o NoobCoin exigir taxa de queima automática on-chain na transferência entre jogadores, Token-2022 seria obrigatório. |
| **Compatibilidade de Carteiras** | 100% compatível com qualquer software de carteira Solana. | Requer suporte explícito da carteira para visualização correta de saldos com extensões. | Usuários de carteiras legadas podem enfrentar falhas visuais no Token-2022. |
| **Complexidade de Auditoria** | Mínima. Contratos com mais de 4 anos de maturidade. | Média/Alta. Cada extensão ativada adiciona superfície de análise. | O SPL Original minimiza riscos de bugs no worker de distribuição. |

### 3.2 Suprimento de Teste: Reduzido (Opção A) vs. 1 Bilhão (Opção B)

| Aspecto | Opção A: Reduzido (1.000.000 tNOOB) | Opção B: Completo (1.000.000.000 tNOOB) | Consequência |
| :--- | :--- | :--- | :--- |
| **Finalidade** | Validação funcional, testes de concorrência e reconciliação. | Simulação exata dos 100% da economia planejada. | A Opção A é mais segura e rápida para calibrar testes sem poluir o estado. |
| **Percepção Pública** | Explícito que se trata de lote de teste fechado. | Pode gerar falsas expectativas em exploradores públicos. | Opção A previne ruído em comunidades e exploradores da Devnet. |
| **Representação Inteira** | $1.000.000 \times 10^6 = 10^{12}$ unidades brutas. | $1.000.000.000 \times 10^6 = 10^{15}$ unidades brutas. | Ambos cabem dentro do teto de inteiros seguros de JS (`9.007.199.254.740.991`). |

---

## 4. Parâmetros Definitivos Aguardando Aprovação Humana

Os parâmetros abaixo dependem de decisão formal do proprietário antes de qualquer execução:

```
[ ] PROGRAMA DE TOKEN:
    ( ) SPL Token Original (Tokenkeg) [RECOMENDADO]
    ( ) Token-2022 (Extensions)

[ ] SUPPLY DE TESTE INICIAL:
    ( ) 100.000 tNOOB
    ( ) 1.000.000 tNOOB [RECOMENDADO]
    ( ) 1.000.000.000 tNOOB (Cap Total Teórico)
    ( ) Outro valor: ____________________

[ ] CASAS DECIMAIS:
    ( ) 6 Casas Decimais (10^6 unidades mínimas) [RECOMENDADO]
    ( ) Outro valor: ____________________

[ ] AUTORIDADE DE CONGELAMENTO (FREEZE AUTHORITY):
    ( ) Habilitada na chave do Worker (para testes de contingência) [RECOMENDADO]
    ( ) Desabilitada permanentemente (Nula)

[ ] MODELO DE CUSTÓDIA LOCAL (MISSÃO 30F/30G):
    ( ) Aprovado armazenamento em secrets/ com permissões restritas (0600/ACLs) [RECOMENDADO]
    ( ) Requer modelo alternativo de custódia remota

[ ] PROVEDOR RPC DA DEVNET:
    ( ) RPC Público Oficial (api.devnet.solana.com) [RECOMENDADO]
    ( ) RPC Privado Dedicado (Helius / QuickNode / Alchemy)
```

---

## 5. Revisão da Separação entre Jogo e Blockchain

A auditoria de código confirmou a separação estrita em 5 camadas:

1. **Desacoplamento do Ouro (Gold):** O ouro interno do jogo (`gold_transactions`) é 100% virtual, operando no SQLite/PostgreSQL sem rota ou gatilho de conversão automática em NoobCoin.
2. **Governança de Recompensas:** O serviço [noobcoinRewardService.ts](file:///D:/NoobRPG/packages/server/src/services/noobcoinRewardService.ts) impõe checagem de pausa global (`distribution_paused`), tetos diários UTC por personagem/conta e chave de idempotência exclusiva.
3. **Zero Client Trust:** O cliente Phaser 3 não possui rotas de submissão, assinaturas ou chaves Web3. Todas as recompensas dependem de eventos autoritativos verificados no servidor (abate de chefes, conquistas, temporadas).
4. **Resiliência a Falhas de Conexão:** Quedas de conexão ou timeouts na chamada `sendAndConfirmTransaction` mantêm a transação em `SUBMITTED`, e o ciclo seguinte apenas audita o status na blockchain sem emitir transferências duplicadas.
5. **Reconciliação Periódica:** O módulo [LedgerReconciler](file:///D:/NoobRPG/packages/solana-worker/src/reconciler.ts) compara as somas registradas no ledger com as transações confirmadas na blockchain, alertando sobre qualquer descompasso.

---

## 6. Procedimento de Parada Imediata (Kill Switch) e Contingência

Caso ocorra qualquer anomalia durante uma eventual sessão de testes autorizada:

1. **Parada do Worker:** O processo pode ser interrompido imediatamente com `Ctrl+C` no terminal ou encerrando o processo Node.js. Nenhuma transação fica em estado inconsistente graças à persistência atômica prévia de `SUBMITTED`.
2. **Pausa Administrativa de Concessões:** Atualizar a tabela de configurações internas para pausar a distribuição:
   ```sql
   UPDATE noobcoin_config SET config_value = '1' WHERE config_key = 'distribution_paused';
   ```
3. **Congelamento On-Chain (se Freeze Authority configurada):** Caso uma conta de destinatário de teste apresente atividade suspeita, a instrução `freezeAccount` pode ser disparada pela autoridade para interromper transferências.

---

## 7. Status do Bloqueio Operacional: Cloudflare R2

- **Hardening Local do Repositório:** 🟢 **`CONCLUÍDO`** — Variantes de `.env` no `.gitignore`, templates sem segredos e sanitização em logs.
- **Validação Operacional com Novas Chaves:** 🟢 **`CONCLUÍDO`** — Novas credenciais aplicadas em arquivo `.env` local seguro e conectividade S3 comprovada com criação e detecção do bucket `noobrpg-assets` via [test_r2_connectivity.ts](file:///D:/NoobRPG/packages/server/scripts/test_r2_connectivity.ts).
- **Revogação Externa no Painel Cloudflare:** 🟡 **`PENDENTE DE CONFIRMAÇÃO DO PROPRIETÁRIO`** — A geração de novas chaves não invalida automaticamente as chaves antigas. Aguarda-se a confirmação formal de exclusão das credenciais antigas no dashboard da Cloudflare para anulação completa do risco pregresso.

---

## 8. Comandos Propostos para Futura Execução (ESTRITAMENTE SEM EXECUÇÃO NESTA MISSÃO)

Os comandos abaixo são apresentados **exclusivamente para fins de documentação e revisão do plano**. Nenhum deles foi ou será executado nesta missão:

```bash
# PASSO 1 (Futuro): Gerar carteira local exclusiva para Fee Payer de Devnet
solana-keygen new --outfile packages/solana-worker/secrets/devnet-payer-keypair.json --no-bip39-passphrase

# PASSO 2 (Futuro): Solicitar SOL de teste no faucet oficial
solana airdrop 2 <CHAVE_PUBLICA_GERADA> --url https://api.devnet.solana.com

# PASSO 3 (Futuro): Criar Mint de Teste com 6 decimais
# Execução via script controlado packages/solana-worker/scripts/create_test_mint.ts

# PASSO 4 (Futuro): Inicializar worker em lote controlado de teste
npm run dev --workspace=@noobrpg/solana-worker
```

---

## 9. Riscos e Efeitos Irreversíveis

Mesmo na rede Solana Devnet, as seguintes ações produzem efeitos permanentes e irreversíveis no histórico do cluster:

1. **Imutabilidade de Contas de Mint:** Uma conta de Mint criada na Devnet existirá permanentemente no histórico de blocos até que o cluster seja reinicializado pela Solana Labs (o que ocorre raramente, a cada vários meses).
2. **Exposição Pública de Transações:** Qualquer carteira, endereço de mint ou transferência enviada à Devnet torna-se publicamente consultável em exploradores de blocos (`solscan.io/?cluster=devnet`).
3. **Consumo de Lamports por Rent:** Cada conta criada consome SOL de teste (~0.002 SOL por ATA). Se o saldo de teste da carteira pagadora se esgotar, novas contas não poderão ser abertas até novo airdrop.
4. **Irreversibilidade da Revogação de Autoridades:** Revogar a `Mint Authority` ou a `Freeze Authority` on-chain é um ato definitivo e permanente para aquele mint.

---

## 10. Seção de Aprovação e Deliberação Humana (Termo Formal Missão 30H)

Esta seção consolida as sete decisões humanas mandatórias para a governança do NoobCoin.
Nenhuma operação on-chain pode ser realizada sem o preenchimento e confirmação explícita do proprietário.

```
========================================================================================
           MATRIZ OFICIAL DE APROVAÇÃO E GOVERNANÇA HUMANA — NOOBCOIN (tNOOB)
                                (Missão 30K — Consolidada)
========================================================================================

--- DECISÃO 1: PROGRAMA DO TOKEN ---
DECISÃO: Escolha do programa on-chain (SPL Token Original vs Token-2022).
PROPOSTA TÉCNICA: SPL Token Original (TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA).
STATUS: APROVADO
JUSTIFICATIVA: Compatibilidade universal com 100% das carteiras, exploradores e ferramentas; maturidade técnica máxima e menor complexidade de auditoria.
ESCOPO: Parâmetro do programa do token. Não autoriza criação on-chain.

--- DECISÃO 2: SUPRIMENTO DE TESTE INICIAL ---
DECISÃO: Volume total proposto a ser emitido no mint piloto da Devnet.
PROPOSTA TÉCNICA: 1.000.000 tNOOB (Supply Reduzido de Teste = 10^12 unidades mínimas).
STATUS: APROVADO
JUSTIFICATIVA: Token estritamente de teste em Devnet sem valor financeiro; evita distorções em testes de concorrência e reconciliação.
ESCOPO: Parâmetro da oferta de teste. Não autoriza emissão.

--- DECISÃO 3: PRECISÃO DO TOKEN (CASAS DECIMAIS) ---
DECISÃO ANTERIOR: 9 Decimais.
NOVA DECISÃO HUMANA: 6 Decimais (1 NOOB = 1.000.000 unidades mínimas = 10^6; 1 unidade mínima = 0,000001 NOOB).
STATUS: APROVADO
JUSTIFICATIVA: Adoção formal da recomendação técnica e econômica da auditoria da Missão 30J (docs/NOOBCOIN_DECIMALS_ECONOMIC_AUDIT.md).
1. Segurança Aritmética JS: Com 6 decimais, o suprimento total planejado do Tokenomics de 1.000.000.000 NOOB resulta em 10^15 unidades mínimas, cabendo confortavelmente dentro do teto seguro de inteiros de JavaScript (Number.MAX_SAFE_INTEGER = 9.007.199.254.740.991). Com 9 decimais, o suprimento total equivaleria a 10^18 unidades, estourando o limite JS em mais de 111 vezes e provocando corrupção aritmética silenciosa sem refatoração profunda para BigInt.
2. Padrão Dominante Solana SPL: Alinhado com USDC e USDT na rede Solana.
3. Código e Testes Existentes: Código do backend, worker e suíte de 56 testes automatizados já foram projetados e validados em 6 decimais.
4. Granularidade de MMORPG: 10^-6 atende a 100% dos casos de uso de recompensas sem poluição de zeros na interface.
ESCOPO: Decisão sobre a precisão planejada do token.
LIMITE: Não autoriza implementação no código, geração de carteira ou qualquer operação on-chain.

--- DECISÃO 4A: POLÍTICA DA MINT AUTHORITY ---
DECISÃO: Política de retenção da autoridade de emissão (Mint Authority).
PROPOSTA TÉCNICA: Ativa sob controle do Worker durante os testes autorizados na Devnet.
STATUS: APROVADA COMO PARÂMETRO
JUSTIFICATIVA: Permite emitir novos lotes para testes controlados de carga. Ciente de que a revogação on-chain é irreversível.
LIMITE: A aprovação do parâmetro NÃO autoriza emissão de tokens nem execução on-chain.

--- DECISÃO 4B: POLÍTICA DA FREEZE AUTHORITY ---
DECISÃO: Política de retenção da autoridade de congelamento (Freeze Authority).
PROPOSTA TÉCNICA: Habilitada durante a fase Devnet para testes de contingência/circuit breaker.
STATUS: APROVADA COMO PARÂMETRO
JUSTIFICATIVA: Permite simular contenção de exploits em contas de teste. Ciente de que a revogação on-chain é irreversível.
LIMITE: A aprovação do parâmetro NÃO autoriza congelamento de contas nem execução on-chain.

--- DECISÃO 5: MODELO DE CUSTÓDIA LOCAL ---
DECISÃO: Arquitetura de armazenamento e isolamento da chave do Fee Payer para testes.
PROPOSTA TÉCNICA: Arquivo em disco (packages/solana-worker/secrets/devnet-payer-keypair.json) protegido, restrito ao worker (0600 / ACLs) e fora do Git (.gitignore).
STATUS: APROVADA COMO PLANO
JUSTIFICATIVA: Isolamento comprovado contra vazamento em repositório. Reconhece-se que em Mainnet exigirá KMS/HSM ou Multi-Sig.
LIMITE: A aprovação do plano NÃO autoriza a geração ou carregamento de arquivos de chave nesta fase.

--- DECISÃO 6: REMEDIAÇÃO CLOUDFLARE R2 ---
DECISÃO: Revogação e exclusão das credenciais antigas no dashboard Cloudflare.
STATUS: DECLARAÇÃO HUMANA REGISTRADA
JUSTIFICATIVA: O proprietário confirmou expressamente a exclusão do token antigo no painel web Cloudflare em 19/10/2026 ("exclui o token antigo"). Registrado estritamente como declaração humana, diferenciando confirmação do proprietário de evidência técnica externa independente. Hardening local e conectividade S3 com novo token validados com sucesso no repositório.

--- PAINEL DE BLOQUEIOS OPERACIONAIS ATIVOS (ON-CHAIN) ---
| Operação On-Chain | Status de Governança | Restrição Vigente |
| :--- | :---: | :--- |
| **Geração de Carteira Devnet** | 🔴 **BLOQUEADA** | Não autorizada. Zero keypairs gerados ou importados. |
| **Solicitação de SOL via Faucet** | 🔴 **BLOQUEADA** | Não autorizada. Zero requisições a airdrops. |
| **Criação de Mint** | 🔴 **BLOQUEADA** | Não autorizada. Zero contas de token criadas. |
| **Emissão de Tokens** | 🔴 **BLOQUEADA** | Não autorizada. Zero tokens cunhados. |
| **Assinatura de Transações** | 🔴 **BLOQUEADA** | Não autorizada. Zero assinaturas criptográficas emitidas. |
| **Transferências On-Chain** | 🔴 **BLOQUEADAS** | Não autorizadas. Zero instruções SPL despachadas. |
| **Mainnet e Testnet** | 🔴 **BLOQUEADAS** | Proibidas em definitivo nesta fase. NetworkGuard ativo. |
========================================================================================
```

---

## 11. Parecer do Gate da Missão 30K

- **Classificação:** 🟢 **`GOVERNANCE DECISION CONSOLIDATED (6 DECIMALS APPROVED)`**
- **Justificativa:** A decisão humana de adotar 6 decimais para o NoobCoin foi expressamente aprovada e formalizada na Matriz Oficial de Governança. Os parâmetros técnicos e planos de custódia estão aprovados, enquanto todas as operações on-chain permanecem estritamente bloqueadas.
- **Implementação no Código:** PENDENTE DE MISSÃO POSTERIOR ESPECÍFICA.
- **Restrição Estrita:** Nenhuma operação on-chain foi executada. O sistema permanece em repouso estático, fail-closed e seguro.

