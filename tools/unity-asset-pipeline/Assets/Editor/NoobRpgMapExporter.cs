using System;
using System.IO;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using UnityEngine.Tilemaps;

namespace NoobRPG.EditorPipeline
{
    /// <summary>
    /// Exportador de Tilemaps do Unity para o formato Tiled JSON (v1.10) consumível pelo Phaser 3.
    /// Compatível com Phaser: this.load.tilemapTiledJSON(key, url).
    /// </summary>
    public static class NoobRpgMapExporter
    {
        [Serializable]
        public class TiledMapJson
        {
            public int compressionlevel = -1;
            public int width;
            public int height;
            public bool infinite = false;
            public string orientation = "orthogonal";
            public string renderorder = "right-down";
            public string tiledversion = "1.10.2";
            public int tileheight = 16;
            public int tilewidth = 16;
            public string version = "1.10";
            public int nextlayerid;
            public int nextobjectid = 1;
            public List<TiledLayerJson> layers = new List<TiledLayerJson>();
            public List<TiledTilesetRefJson> tilesets = new List<TiledTilesetRefJson>();
        }

        [Serializable]
        public class TiledLayerJson
        {
            public List<int> data = new List<int>();
            public int height;
            public int id;
            public string name;
            public float opacity = 1f;
            public string type = "tilelayer";
            public bool visible = true;
            public int width;
            public int x = 0;
            public int y = 0;
        }

        [Serializable]
        public class TiledTilesetRefJson
        {
            public int columns = 8;
            public int firstgid = 1;
            public string image = "tileset_prototype";
            public int imageheight = 64;
            public int imagewidth = 128;
            public int margin = 0;
            public string name = "tileset_prototype";
            public int spacing = 0;
            public int tilecount = 32;
            public int tileheight = 16;
            public int tilewidth = 16;
            public List<TiledTileMetaJson> tiles = new List<TiledTileMetaJson>();
        }

        [Serializable]
        public class TiledTileMetaJson
        {
            public int id;
            public List<TiledPropertyJson> properties = new List<TiledPropertyJson>();
        }

        [Serializable]
        public class TiledPropertyJson
        {
            public string name = "collides";
            public string type = "bool";
            public bool value = true;
        }

        [MenuItem("Tools/NoobRPG/Export Active Tilemap to Phaser JSON")]
        public static void ExportActiveTilemapMenu()
        {
            var grid = UnityEngine.Object.FindFirstObjectByType<Grid>();
            if (grid == null)
            {
                EditorUtility.DisplayDialog("Erro", "Nenhum componente 'Grid' com Tilemaps encontrado na cena ativa.", "OK");
                return;
            }

            string defaultPath = Path.Combine(Application.dataPath, "../../packages/client/public/assets/staging/map_unity_export.json");
            string outputPath = EditorUtility.SaveFilePanel("Salvar Mapa para Phaser 3", Path.GetDirectoryName(defaultPath), "map_unity_export.json", "json");
            
            if (string.IsNullOrEmpty(outputPath)) return;

            ExportGridToTiledJson(grid, outputPath);
            EditorUtility.DisplayDialog("Sucesso", $"Mapa exportado com sucesso para:\n{outputPath}", "OK");
        }

        /// <summary>
        /// Método de exportação headless executável via linha de comando do Unity CLI:
        /// unity run -- -executeMethod NoobRPG.EditorPipeline.NoobRpgMapExporter.ExportFromCommandLine -mapOutput <path>
        /// </summary>
        public static void ExportFromCommandLine()
        {
            string outputPath = null;
            string[] args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "-mapOutput" && i + 1 < args.Length)
                {
                    outputPath = args[i + 1];
                    break;
                }
            }

            if (string.IsNullOrEmpty(outputPath))
            {
                outputPath = Path.Combine(Application.dataPath, "../../packages/client/public/assets/staging/map_unity_export.json");
            }

            var grid = UnityEngine.Object.FindFirstObjectByType<Grid>();
            if (grid == null)
            {
                Debug.LogError("[NoobRpgMapExporter] Nenhum componente 'Grid' encontrado na cena.");
                EditorApplication.Exit(1);
                return;
            }

            ExportGridToTiledJson(grid, outputPath);
            Debug.Log($"[NoobRpgMapExporter] Exportação concluída com sucesso em: {outputPath}");
            EditorApplication.Exit(0);
        }

        public static void ExportGridToTiledJson(Grid grid, string outputPath)
        {
            var tilemaps = grid.GetComponentsInChildren<Tilemap>();
            if (tilemaps == null || tilemaps.Length == 0)
            {
                throw new InvalidOperationException("A Grid não possui componentes Tilemap filhos.");
            }

            // Calcula o bounding box unificado
            BoundsInt bounds = new BoundsInt(int.MaxValue, int.MaxValue, 0, int.MinValue, int.MinValue, 0);
            foreach (var tm in tilemaps)
            {
                tm.CompressBounds();
                if (tm.cellBounds.size.x > 0 && tm.cellBounds.size.y > 0)
                {
                    bounds.xMin = Math.Min(bounds.xMin, tm.cellBounds.xMin);
                    bounds.yMin = Math.Min(bounds.yMin, tm.cellBounds.yMin);
                    bounds.xMax = Math.Max(bounds.xMax, tm.cellBounds.xMax);
                    bounds.yMax = Math.Max(bounds.yMax, tm.cellBounds.yMax);
                }
            }

            // Se a cena for menor ou vazia, usa tamanho canônico mínimo de 120x80 (1920x1280 px)
            int mapWidth = Math.Max(120, bounds.size.x);
            int mapHeight = Math.Max(80, bounds.size.y);
            int originX = bounds.xMin < int.MaxValue ? bounds.xMin : 0;
            int originY = bounds.yMin < int.MaxValue ? bounds.yMin : 0;

            var mapJson = new TiledMapJson
            {
                width = mapWidth,
                height = mapHeight,
                tilewidth = 16,
                tileheight = 16,
                nextlayerid = tilemaps.Length + 1
            };

            var primaryTileset = new TiledTilesetRefJson();
            mapJson.tilesets.Add(primaryTileset);

            // Nomes de camadas canônicas esperadas pelo NoobRPG
            var canonicalLayerNames = new[] { "Ground_Base", "Ground_Deco", "Collision", "Overhead_Foliage" };
            int layerIdCounter = 1;
            HashSet<int> collisionGids = new HashSet<int>();

            foreach (var layerName in canonicalLayerNames)
            {
                Tilemap targetTm = null;
                foreach (var tm in tilemaps)
                {
                    if (string.Equals(tm.name, layerName, StringComparison.OrdinalIgnoreCase))
                    {
                        targetTm = tm;
                        break;
                    }
                }

                var layerJson = new TiledLayerJson
                {
                    id = layerIdCounter++,
                    name = layerName,
                    width = mapWidth,
                    height = mapHeight,
                    visible = true,
                    opacity = 1f
                };

                // No Tiled e Phaser, a coordenada (0,0) fica no canto superior esquerdo (Top-Left)
                // No Unity Tilemap, o Y cresce para cima. Mapeamos linha por linha: y de (mapHeight - 1) até 0
                for (int y = mapHeight - 1; y >= 0; y--)
                {
                    for (int x = 0; x < mapWidth; x++)
                    {
                        int gid = 0;
                        if (targetTm != null)
                        {
                            Vector3Int cellPos = new Vector3Int(originX + x, originY + y, 0);
                            TileBase tile = targetTm.GetTile(cellPos);
                            if (tile != null)
                            {
                                // Extrai índice numérico do tile ou usa mapeamento de GID
                                gid = ParseTileGid(tile);
                                if (string.Equals(layerName, "Collision", StringComparison.OrdinalIgnoreCase) && gid > 0)
                                {
                                    collisionGids.Add(gid);
                                }
                            }
                        }
                        layerJson.data.Add(gid);
                    }
                }

                mapJson.layers.Add(layerJson);
            }

            // Registra propriedades 'collides: true' para todos os tiles da camada Collision
            foreach (int cGid in collisionGids)
            {
                var tileMeta = new TiledTileMetaJson
                {
                    id = cGid - 1 // Tiled usa id 0-indexed no tileset
                };
                tileMeta.properties.Add(new TiledPropertyJson());
                primaryTileset.tiles.Add(tileMeta);
            }

            string jsonOutput = JsonUtility.ToJson(mapJson, true);
            string dir = Path.GetDirectoryName(outputPath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }
            File.WriteAllText(outputPath, jsonOutput);
        }

        private static int ParseTileGid(TileBase tile)
        {
            if (tile == null) return 0;
            string name = tile.name;

            // Se o nome terminar com número (ex: tile_4, grass_01), extrai o GID
            var parts = name.Split('_');
            if (parts.Length > 1 && int.TryParse(parts[parts.Length - 1], out int index))
            {
                return index > 0 ? index : 1;
            }

            // Fallback: hash determinístico mapeado dentro dos 32 tiles do prototype
            return (Math.Abs(name.GetHashCode()) % 31) + 1;
        }
    }
}
