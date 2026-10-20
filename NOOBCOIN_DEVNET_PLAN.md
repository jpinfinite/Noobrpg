# NOOBCOIN — PLANO DE INTEGRAÇÃO COM SOLANA DEVNET
## Projeto NoobRPG | Antigravity Pro | Missão 29

> [!IMPORTANT]
> **DIRETRIZ MANDATÓRIA DE ENGENHARIA:**
> - **NENHUMA DEPENDÊNCIA BLOCKCHAIN FOI ADICIONADA AO RUNTIME PRINCIPAL DO JOGO NESTA MISSÃO.**
> - **NENHUMA MINT ON-CHAIN FOI CRIADA OU EXECUTADA.**
> - **NENHUM SCRIPT DEVE EXECUTAR SILENCIOSAMENTE NA MAINNET.**
> - A ativação on-chain do NoobCoin na Solana Devnet ocorrerá em missão futura dedicada, dependendo de aprovação humana formal prévia.

---

## 1. Avaliação Técnica Comparativa: SPL Token Original vs. Token-2022

A escolha do padrão de token na Solana é uma decisão de infraestrutura crítica. Abaixo apresentamos o comparativo técnico aprofundado entre o programa de token clássico (`TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`) e a extensão moderna **Token-2022** (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`).

| Critério de Análise | SPL Token Original (Tokenkeg) | Token-2022 (Extensions Program) | Avaliação para o NoobRPG |
| :--- | :--- | :--- | :--- |
| **Compatibilidade com Carteiras** | **100% Universal** (Suportado por Phantom, Solflare, Backpack, exchanges centralizadas e todas as ferramentas desde 2020). | **Boa e Crescente**, mas algumas carteiras legadas, pontes (bridges) e dApps terceiros ainda possuem suporte parcial para certas extensões. | O SPL Original oferece menor atrito de onboarding para jogadores leigos. |
| **Compatibilidade com Explorers & DEX** | Suporte universal imediato (Solscan, SolanaFM, Raydium, Orca, Jupiter). | Suportado nos exploradores e nos principais agregadores (Jupiter/Orca), mas ferramentas analíticas menores podem apresentar falhas de parse de metadados. | O SPL Original apresenta menor risco de incompatibilidade analítica. |
| **Complexidade Operacional** | **Muito Baixa**. Contas com tamanho fixo ($165\text{ bytes}$ para Token Account e $82\text{ bytes}$ para Mint). | **Média/Alta**. O tamanho das contas varia dinamicamente conforme as extensões ativadas na inicialização. | O SPL Original é mais simples de auditar e prever custos de armazenamento. |
| **Extensões Relevantes** | Não suporta extensões nativas. Metadados exigem programa externo do Metaplex (`mpl-token-metadata`). | Suporta **Metadados Embutidos** (*Metadata Pointer*), **Taxa de Transferência** (*Transfer Fee*), **Transfer Hooks**, e **Congelamento Padrão**. | O Token-2022 permite embutir metadados diretamente no mint sem depender de contratos externos do Metaplex. |
| **Custos de Rent (Aluguel de Contas)** | Mínimo fixo: $\approx 0.002039\text{ SOL}$ por Associated Token Account (ATA). | Ligeiramente maior ($\approx 0.0025\text{ a }0.003\text{ SOL}$) devido aos bytes extras de extensão. | Variação insignificante em termos absolutos de micro-SOL. |
| **Segurança e Maturidade** | Auditado há anos por múltiplas firmas renomadas; comprovado em batalha sob bilhões de dólares de valor bloqueado (TVL). | Desenvolvido e auditado pela Solana Labs, utilizado por grandes projetos (ex: tokens com transfer fee), mas com menor tempo total de exposição pública. | Ambos são altamente seguros, mas o SPL Original possui maior maturidade histórica. |
| **Facilidade de Auditoria** | Extremamente simples e transparente para auditores e desenvolvedores independentes. | Requer validação cuidadosa de cada extensão individualmente (ex: se *Transfer Hook* for ativado, pode introduzir vetores de falha se o programa de hook falhar). | A simplicidade do SPL Original favorece a auditoria. |

### Conclusão e Recomendação Técnica para o NoobCoin:
1. **Recomendação Preliminar:** Adotar o **SPL Token Original** para a primeira fase de testes na Solana Devnet, priorizando compatibilidade universal de carteiras, simplicidade operacional e facilidade de auditoria para os jogadores.
2. **Caminho de Avaliação Alternativo:** Caso se deseje incorporar metadados on-chain nativos sem depender de contas Metaplex, uma mint de teste com **Token-2022 (com extensão Metadata Pointer)** deverá ser criada em paralelo em Devnet para benchmarking de experiência de usuário (UX).

---

## 2. Pacotes e Dependências Avaliadas para o Futuro Serviço de Distribuição

Quando a missão de integração on-chain for autorizada, as dependências blockchain serão isoladas em um pacote independente (`packages/solana-worker/`), sem poluir o runtime do servidor de jogo ou do cliente Phaser:

- `@solana/web3.js` (v1.95+ ou v2.x): Conexão RPC, serialização de transações, criação de keypairs e confirmação de blocos.
- `@solana/spl-token`: Instruções padronizadas para `createMint`, `getOrCreateAssociatedTokenAccount`, `mintTo` e `transferChecked`.
- `bs58`: Codificação e decodificação Base58 para endereços públicos e assinaturas.
- `tweetnacl`: Verificação off-chain estritamente determinística de assinaturas Ed25519 para o SIWS.

---

## 3. Diretrizes de Segurança para Scripts de Devnet

Para assegurar que nenhum script ou comando acidentalmente execute na Solana Mainnet, os scripts futuros de migração e cunhagem deverão obedecer às seguintes salvaguardas:

```typescript
// Exemplo canônico de Fail-Safe obrigatório para scripts de Devnet:
export function assertDevnetEnvironment(connectionUrl: string): void {
  const network = process.env.SOLANA_NETWORK;
  
  if (network !== 'devnet') {
    throw new Error(
      `[FATAL] Execução abortada! A variável SOLANA_NETWORK deve ser estritamente 'devnet'. Valor atual: '${network}'`
    );
  }

  if (!connectionUrl.includes('devnet.solana.com') && !connectionUrl.includes('devnet')) {
    throw new Error(
      `[FATAL] O endpoint RPC configurado (${connectionUrl}) não aparenta ser da rede Devnet! Abortando por segurança.`
    );
  }

  console.log(`[SAFE] Ambiente Solana Devnet validado com sucesso: ${connectionUrl}`);
}
```

---

## 4. Roteiro Passo a Passo para Futura Missão Devnet (Fase Posterior)

Quando a diretoria aprovar a execução em Devnet, o cronograma seguirá esta ordem rigorosa:

1. **Aprovação Humana Formal:** Obter confirmação explícita no log de sessão e ata de decisão técnica.
2. **Setup do Pacote Worker:** Criar o pacote isolado `packages/solana-worker` com TypeScript e dependências Solana.
3. **Geração de Keypair de Teste:** Criar carteira pagadora de taxas em Devnet financiada via Solana Devnet Faucet (`solana airdrop 2`).
4. **Criação da Mint em Devnet:** Executar a inicialização da mint `NOOB` com 6 casas decimais apontada exclusivamente para `https://api.devnet.solana.com`.
5. **Configuração de Metadados de Teste:** Registrar Nome, Símbolo (`NOOB`) e URI de metadados JSON contendo logotipo oficial em pixel art.
6. **Teste de Ciclo Fechado no Ledger:**
   - Transicionar recompensa interna de `QUEUED` para `SUBMITTED`.
   - Worker assina e envia `transferChecked` na Devnet.
   - Aguardar finalização do bloco (`finalized`) e capturar assinatura `onchain_tx_signature`.
   - Transicionar para `CONFIRMED` e verificar consistência.
7. **Emissão de Relatório de Homologação em Devnet.**
