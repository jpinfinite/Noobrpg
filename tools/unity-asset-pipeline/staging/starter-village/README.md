# Staging da Vila Inicial — NoobRPG

- **Nome do Mapa:** `map_starter_village.json`
- **Dimensões:** 60 x 40 tiles (960 x 640 pixels)
- **Tamanho do Tile:** 16 x 16 pixels
- **Orientação:** Ortogonal (Tiled JSON 1.10)
- **Tileset de Referência:** `tileset_prototype` (32 tiles, 8 colunas x 4 linhas)
- **Camadas Canônicas:**
  1. `Ground_Base` (depth 0)
  2. `Ground_Deco` (depth 1)
  3. `Collision` (depth 2, com propriedades `collides: true` registradas)
  4. `Overhead_Foliage` (depth 2000, copas de árvores e beirais acima do jogador)
- **Ponto de Spawn Recomendado:** Praça Central da Vila em x: 464, y: 320 (tile 29, 20)
