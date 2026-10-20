using System;
using System.IO;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using UnityEngine.Tilemaps;
using UnityEditor.SceneManagement;

namespace NoobRPG.EditorPipeline
{
    /// <summary>
    /// Construtor e autoria procedural da cena da Vila Inicial (NoobRPG_StarterVillage) no Unity.
    /// Cria a Grid, configura as 4 camadas canônicas e exporta para o Phaser 3.
    /// </summary>
    public static class StarterVillageBuilder
    {
        public const int MAP_WIDTH = 60;
        public const int MAP_HEIGHT = 40;
        public const string SCENE_PATH = "Assets/Scenes/NoobRPG_StarterVillage.unity";

        [MenuItem("Tools/NoobRPG/Build Starter Village Scene and Export")]
        public static void BuildAndExportMenu()
        {
            BuildStarterVillage();
            EditorUtility.DisplayDialog("Vila Inicial", "Cena 'NoobRPG_StarterVillage' construída e mapa exportado para staging!", "OK");
        }

        public static void BuildAndExportCommandLine()
        {
            BuildStarterVillage();
            EditorApplication.Exit(0);
        }

        public static void BuildStarterVillage()
        {
            // 1. Assegura diretório de cenas
            string scenesDir = Path.Combine(Application.dataPath, "Scenes");
            if (!Directory.Exists(scenesDir)) Directory.CreateDirectory(scenesDir);

            // 2. Cria nova cena vazia
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            // 3. Cria GameObject raiz Grid
            GameObject gridGo = new GameObject("Grid");
            Grid grid = gridGo.AddComponent<Grid>();
            grid.cellSize = new Vector3(1f, 1f, 0f);

            // 4. Cria as 4 camadas canônicas
            Tilemap groundBaseTm = CreateTilemapLayer(gridGo, "Ground_Base", 0);
            Tilemap groundDecoTm = CreateTilemapLayer(gridGo, "Ground_Deco", 1);
            Tilemap collisionTm = CreateTilemapLayer(gridGo, "Collision", 2);
            Tilemap overheadTm = CreateTilemapLayer(gridGo, "Overhead_Foliage", 3);

            // 5. Gera paleta de Tiles virtuais (GIDs 1 a 32)
            Dictionary<int, Tile> tiles = CreateTilePalette();

            // 6. Preenchimento de Ground_Base (Grama uniforme em toda a vila)
            for (int x = 0; x < MAP_WIDTH; x++)
            {
                for (int y = 0; y < MAP_HEIGHT; y++)
                {
                    groundBaseTm.SetTile(new Vector3Int(x, y, 0), tiles[1]); // GID 1: Grama base
                }
            }

            // 7. Preenchimento de Ground_Deco (Caminhos, Praça da Vila, Flores)
            // Estrada Norte-Sul (colunas 28 e 29)
            for (int y = 0; y < MAP_HEIGHT; y++)
            {
                groundDecoTm.SetTile(new Vector3Int(28, y, 0), tiles[2]); // GID 2: Terra
                groundDecoTm.SetTile(new Vector3Int(29, y, 0), tiles[2]);
            }

            // Estrada Leste-Oeste (linhas 19 e 20)
            for (int x = 10; x < 50; x++)
            {
                groundDecoTm.SetTile(new Vector3Int(x, 19, 0), tiles[2]);
                groundDecoTm.SetTile(new Vector3Int(x, 20, 0), tiles[2]);
            }

            // Praça Central Nobre (x: 24..33, y: 16..23)
            for (int x = 24; x <= 33; x++)
            {
                for (int y = 16; y <= 23; y++)
                {
                    groundDecoTm.SetTile(new Vector3Int(x, y, 0), tiles[25]); // GID 25: Basalto Nobre
                }
            }

            // Flores decorativas ao redor
            groundDecoTm.SetTile(new Vector3Int(22, 22, 0), tiles[6]); // Flores amarelas
            groundDecoTm.SetTile(new Vector3Int(23, 23, 0), tiles[7]); // Flores vermelhas
            groundDecoTm.SetTile(new Vector3Int(35, 17, 0), tiles[6]);
            groundDecoTm.SetTile(new Vector3Int(36, 18, 0), tiles[7]);
            groundDecoTm.SetTile(new Vector3Int(26, 14, 0), tiles[9]); // Tufo denso
            groundDecoTm.SetTile(new Vector3Int(31, 14, 0), tiles[10]); // Seixos

            // 8. Preenchimento de Collision
            // Bordas externas da vila (Cercas e árvores densas com abertura nas estradas)
            for (int x = 0; x < MAP_WIDTH; x++)
            {
                if (x != 28 && x != 29)
                {
                    collisionTm.SetTile(new Vector3Int(x, 0, 0), tiles[8]); // Cerca Sul
                    collisionTm.SetTile(new Vector3Int(x, MAP_HEIGHT - 1, 0), tiles[8]); // Cerca Norte
                }
            }
            for (int y = 0; y < MAP_HEIGHT; y++)
            {
                collisionTm.SetTile(new Vector3Int(0, y, 0), tiles[8]); // Cerca Oeste
                collisionTm.SetTile(new Vector3Int(MAP_WIDTH - 1, y, 0), tiles[8]); // Cerca Leste
            }

            // Construção 1: Forja do Ferreiro (Noroeste: x: 8..17, y: 26..32)
            BuildHouse(collisionTm, overheadTm, tiles, 8, 26, 10, 7);

            // Construção 2: Taverna da Vila (Nordeste: x: 40..51, y: 26..33)
            BuildHouse(collisionTm, overheadTm, tiles, 40, 26, 12, 8);

            // Construção 3: Casa do Ancião (Sudoeste: x: 8..17, y: 6..12)
            BuildHouse(collisionTm, overheadTm, tiles, 8, 6, 10, 7);

            // O Lago de Cristal (Sudeste: x: 42..54, y: 5..14)
            for (int x = 42; x <= 54; x++)
            {
                for (int y = 5; y <= 14; y++)
                {
                    int tileId = ((x + y) % 3 == 0) ? 16 : 5; // Água com reflexo ou lisa
                    collisionTm.SetTile(new Vector3Int(x, y, 0), tiles[tileId]);
                }
            }

            // Postes de iluminação na entrada da praça
            collisionTm.SetTile(new Vector3Int(27, 24, 0), tiles[26]);
            collisionTm.SetTile(new Vector3Int(30, 24, 0), tiles[26]);
            collisionTm.SetTile(new Vector3Int(27, 15, 0), tiles[26]);
            collisionTm.SetTile(new Vector3Int(30, 15, 0), tiles[26]);

            // 9. Preenchimento de Overhead_Foliage (Copas de árvores ao redor da vila)
            int[] treeX = { 4, 6, 21, 37, 56, 57, 4, 20, 36, 56 };
            int[] treeY = { 35, 34, 36, 36, 35, 20, 4, 4, 4, 4 };
            for (int i = 0; i < treeX.Length; i++)
            {
                int tx = treeX[i];
                int ty = treeY[i];
                collisionTm.SetTile(new Vector3Int(tx, ty, 0), tiles[32]); // Tronco sólido
                overheadTm.SetTile(new Vector3Int(tx, ty + 1, 0), tiles[29]); // Copa superior
                overheadTm.SetTile(new Vector3Int(tx - 1, ty + 1, 0), tiles[30]); // Borda esquerda
                overheadTm.SetTile(new Vector3Int(tx + 1, ty + 1, 0), tiles[31]); // Borda direita
            }

            // 10. Salva a cena
            EditorSceneManager.SaveScene(scene, SCENE_PATH);
            Debug.Log($"[StarterVillageBuilder] Cena salva em: {SCENE_PATH}");

            // 11. Exporta diretamente para Staging
            string stagingPipelinePath = Path.Combine(Application.dataPath, "../staging/starter-village/map_starter_village.json");
            string clientStagingPath = Path.Combine(Application.dataPath, "../../packages/client/public/assets/staging/map_starter_village.json");

            NoobRpgMapExporter.ExportGridToTiledJson(grid, stagingPipelinePath);
            NoobRpgMapExporter.ExportGridToTiledJson(grid, clientStagingPath);

            Debug.Log($"[StarterVillageBuilder] Mapa exportado com sucesso para:\n{stagingPipelinePath}\n{clientStagingPath}");
        }

        private static void BuildHouse(Tilemap collisionTm, Tilemap overheadTm, Dictionary<int, Tile> tiles, int startX, int startY, int width, int height)
        {
            for (int x = 0; x < width; x++)
            {
                for (int y = 0; y < height; y++)
                {
                    int posX = startX + x;
                    int posY = startY + y;

                    // Metade inferior é parede sólida com porta transitável na base
                    if (y < height - 2)
                    {
                        // Porta central transitável
                        if (y == 0 && (x == width / 2 || x == width / 2 - 1))
                        {
                            continue;
                        }
                        collisionTm.SetTile(new Vector3Int(posX, posY, 0), tiles[4]); // Parede de tijolos
                    }
                    else
                    {
                        // Beirais superiores em overhead foliage
                        overheadTm.SetTile(new Vector3Int(posX, posY, 0), tiles[29]);
                    }
                }
            }
        }

        private static Tilemap CreateTilemapLayer(GameObject parent, string layerName, int sortingOrder)
        {
            GameObject layerGo = new GameObject(layerName);
            layerGo.transform.SetParent(parent.transform, false);

            Tilemap tilemap = layerGo.AddComponent<Tilemap>();
            TilemapRenderer renderer = layerGo.AddComponent<TilemapRenderer>();
            renderer.sortingOrder = sortingOrder;

            return tilemap;
        }

        private static Dictionary<int, Tile> CreateTilePalette()
        {
            var palette = new Dictionary<int, Tile>();
            for (int i = 1; i <= 32; i++)
            {
                Tile tile = ScriptableObject.CreateInstance<Tile>();
                tile.name = $"tile_{i}";
                palette[i] = tile;
            }
            return palette;
        }
    }
}
