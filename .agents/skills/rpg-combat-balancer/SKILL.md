---
name: rpg-combat-balancer
description: Especialista em modelagem matemática de progressão, curvas de XP, cálculo de dano, balanceamento de monstros e classes para o NoobRPG.
---

# Skill: RPG Combat Balancer

## Objetivo
Manter o equilíbrio matemático do combate, curvas de XP, tempos de recarga e progressão entre jogadores e monstros no NoobRPG.

## Regras de Balanceamento
- **Fórmulas Canônicas:**
  - $XP_{total}(L) = 100(L-1)^2 + 400(L-1)$
  - $XP_{prox}(L) = 200(L-1) + 500$
  - $Dano = \max(1, Ataque_{efetivo} - Defesa_{efetiva})$
- **Matriz de Inviabilidade de Desafio Desproporcional:**
  - Um jogador nível 1 jamais deve conseguir derrotar um monstro nível 10 em combate solo.
  - Monstros com mais de 5 níveis abaixo do jogador sofrem penalidade de drop de XP (0% de XP para 10+ níveis abaixo).
- **Tempo para Matar (TTK) Alvo:**
  - Monstro comum de mesmo nível: 4 a 8 segundos.
  - Monstro elite / mini-boss: 15 a 30 segundos.
  - Chefe de Masmorra: 60 a 180 segundos.
- Documentação de referência em [COMBAT_AND_BALANCE.md](file:///d:/NoobRPG/docs/COMBAT_AND_BALANCE.md).
