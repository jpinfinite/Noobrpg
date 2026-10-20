using System;
using System.IO;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;

namespace NoobRPG.EditorPipeline
{
    /// <summary>
    /// Exportador de Sprites e Animações do Unity para Spritesheets Horizontais (1 linha, N frames)
    /// compatível com o Phaser 3: this.load.spritesheet(key, path, { frameWidth, frameHeight }).
    /// </summary>
    public static class NoobRpgSpriteExporter
    {
        [Serializable]
        public class SpriteMetadataJson
        {
            public string sheetKey;
            public int frameWidth;
            public int frameHeight;
            public int frameCount;
            public int suggestedFps = 8;
            public float originX = 0.5f;
            public float originY = 1.0f;
            public string[] animations;
        }

        [MenuItem("Tools/NoobRPG/Export Selected Sprites as Horizontal Sheet")]
        public static void ExportSelectedSpritesMenu()
        {
            var selectedObjects = Selection.objects;
            var sprites = new List<Sprite>();

            foreach (var obj in selectedObjects)
            {
                if (obj is Sprite s)
                {
                    sprites.Add(s);
                }
                else if (obj is Texture2D tex)
                {
                    string path = AssetDatabase.GetAssetPath(tex);
                    var allAssets = AssetDatabase.LoadAllAssetsAtPath(path);
                    foreach (var sub in allAssets)
                    {
                        if (sub is Sprite subSprite) sprites.Add(subSprite);
                    }
                }
            }

            if (sprites.Count == 0)
            {
                EditorUtility.DisplayDialog("Aviso", "Selecione um ou mais Sprites na aba Project para exportar.", "OK");
                return;
            }

            string defaultPath = Path.Combine(Application.dataPath, "../../packages/client/public/assets/staging/spritesheet_unity_export.png");
            string outputPath = EditorUtility.SaveFilePanel("Salvar Spritesheet Horizontal", Path.GetDirectoryName(defaultPath), "spritesheet_unity_export.png", "png");

            if (string.IsNullOrEmpty(outputPath)) return;

            ExportSpritesToHorizontalSheet(sprites.ToArray(), outputPath);
            EditorUtility.DisplayDialog("Sucesso", $"Spritesheet exportada com sucesso ({sprites.Count} quadros):\n{outputPath}", "OK");
        }

        public static void ExportSpritesToHorizontalSheet(Sprite[] sprites, string outputPath, int fps = 8)
        {
            if (sprites == null || sprites.Length == 0)
            {
                throw new ArgumentException("Nenhum sprite fornecido para a spritesheet.");
            }

            // Normaliza largura e altura pelo primeiro quadro (padrão 16x24 ou 24x24)
            int frameWidth = Mathf.RoundToInt(sprites[0].rect.width);
            int frameHeight = Mathf.RoundToInt(sprites[0].rect.height);
            int frameCount = sprites.Length;

            int totalWidth = frameWidth * frameCount;
            int totalHeight = frameHeight;

            // Cria textura combinada em RGBA32 sem anti-aliasing
            Texture2D combined = new Texture2D(totalWidth, totalHeight, TextureFormat.RGBA32, false);
            combined.filterMode = FilterMode.Point;

            // Preenche com transparência total
            Color32[] clearPixels = new Color32[totalWidth * totalHeight];
            for (int i = 0; i < clearPixels.Length; i++) clearPixels[i] = new Color32(0, 0, 0, 0);
            combined.SetPixels32(clearPixels);

            for (int i = 0; i < frameCount; i++)
            {
                Sprite s = sprites[i];
                Texture2D sourceTex = s.texture;

                // Lê pixels do sprite individual
                Rect rect = s.rect;
                Color[] pixels = sourceTex.GetPixels((int)rect.x, (int)rect.y, (int)rect.width, (int)rect.height);

                combined.SetPixels(i * frameWidth, 0, frameWidth, frameHeight, pixels);
            }

            combined.Apply();

            byte[] pngBytes = combined.EncodeToPNG();
            string dir = Path.GetDirectoryName(outputPath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }
            File.WriteAllBytes(outputPath, pngBytes);

            // Gera metadados em JSON para fácil integração no Phaser
            string jsonPath = Path.ChangeExtension(outputPath, ".meta.json");
            string sheetName = Path.GetFileNameWithoutExtension(outputPath);

            var meta = new SpriteMetadataJson
            {
                sheetKey = $"sheet_{sheetName}",
                frameWidth = frameWidth,
                frameHeight = frameHeight,
                frameCount = frameCount,
                suggestedFps = fps,
                originX = 0.5f,
                originY = 1.0f,
                animations = new[] { $"{sheetName}_anim" }
            };

            File.WriteAllText(jsonPath, JsonUtility.ToJson(meta, true));
        }
    }
}
