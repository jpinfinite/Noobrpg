---
name: game-asset-pipeline
description: Gerencia e valida o pipeline de spritesheets, mapas do Tiled, atlas de texturas, compressão e efeitos sonoros para o Phaser 3.
---

# Skill: Game Asset Pipeline

## Objetivo
Padronizar a integração de assets de arte pixel art e mapas no cliente Phaser 3, validando dimensões, alinhamento de grid e integridade de arquivos.

## Normas Técnicas
- **Tilesets:** Múltiplos exatos de 16px (16x16 por tile), sem anti-aliasing ou bordas borradas, formato PNG com canal alfa (RGBA 32-bit).
- **Spritesheets:** Padrão de 16x24 ou 24x32 por quadro para humanoides, âncora no pé (`originX: 0.5, originY: 0.85`).
- **Mapas do Tiled:** Formato JSON ortogonal. Camadas canônicas obrigatórias:
  - `Ground_Base`, `Ground_Deco`, `Collision_Walls`, `Objects_Y_Sort`, `Spawners_Objects`, `Overhead_Roof`.
- Documentação de referência em [ASSET_PIPELINE.md](file:///d:/NoobRPG/docs/ASSET_PIPELINE.md).
