---
name: rpg-economy-designer
description: Modela, audita e equilibra a economia de duas moedas (Gold e Mérito), lojas de NPCs, mercado de jogadores com taxa de 5% e sumidouros monetários.
---

# Skill: RPG Economy Designer

## Objetivo
Preservar o valor do Gold, mitigar hiperinflação e projetar mercados dinâmicos e justos entre jogadores no NoobRPG.

## Diretrizes Econômicas
- **Taxa do Mercado:** Dedução obrigatória de **5%** em cada venda concluída entre jogadores no Player Marketplace. Essa quantia é destruída permanentemente (Sink).
- **Proporção Faucet / Sink:** A emissão de Gold por abate de monstros e missões deve ser absorvida em no mínimo 80% ao dia por reparos de equipamentos, taxas de forja, consumíveis e taxas de transação.
- **Transações ACID:** Nenhuma alteração de saldo ou inventário pode ser feita sem transação de banco de dados com lock pessimista (`SELECT FOR UPDATE`).
- **Abstração de Recompensas Futuras:** Usar Pontos de Mérito (não-transferíveis, intransferíveis, sem valor financeiro) na fase de testes. Não emitir tokens de rede principal ou NFTs na fase inicial.
- Documentação de referência em [ECONOMY_AND_TOKENOMICS.md](file:///d:/NoobRPG/docs/ECONOMY_AND_TOKENOMICS.md).
