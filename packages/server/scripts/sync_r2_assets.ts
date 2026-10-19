import path from 'node:path';
import { R2StorageClient } from '../src/storage/R2StorageClient.js';

async function main() {
  console.log('====================================================');
  console.log('   NOOBRPG — SINCRONIZADOR DE ASSETS CLOUDFLARE R2  ');
  console.log('====================================================\n');

  try {
    const storage = new R2StorageClient();
    console.log(`[1/3] Conectando ao Cloudflare R2...`);
    console.log(`      Endpoint: ${process.env.R2_ENDPOINT}`);
    console.log(`      Bucket:   ${process.env.R2_BUCKET_NAME || 'noobrpg-assets'}`);

    const bucketReady = await storage.ensureBucket();
    if (bucketReady) {
      console.log(`      ✓ Bucket verificado com sucesso.\n`);
    } else {
      console.log(`      ℹ Prosseguindo com o bucket configurado.\n`);
    }

    // 1. Sincronizar Assets do Cliente (Mapas, Tilesets, Áudios)
    const clientAssetsDir = path.resolve(process.cwd(), 'packages/client/public/assets');
    console.log(`[2/3] Sincronizando assets do cliente (${clientAssetsDir})...`);
    const clientSync = await storage.syncDirectory(clientAssetsDir, 'assets');
    console.log(`      Arquivos analisados: ${clientSync.totalFiles}`);
    console.log(`      Enviados:           ${clientSync.uploadedFiles} (${(clientSync.totalBytesUploaded / 1024).toFixed(2)} KB)`);
    console.log(`      Inalterados/Skip:   ${clientSync.skippedFiles}`);
    if (clientSync.failedFiles > 0) {
      console.log(`      Falhas:             ${clientSync.failedFiles}`);
    }

    // 2. Sincronizar Spritesheets e Manisfestos se existirem
    const spritesDir = path.resolve(process.cwd(), 'files-sprites');
    console.log(`\n[3/3] Sincronizando biblioteca de spritesheets (${spritesDir})...`);
    const spriteSync = await storage.syncDirectory(spritesDir, 'sprites', ['.png', '.json', '.webp']);
    console.log(`      Arquivos analisados: ${spriteSync.totalFiles}`);
    console.log(`      Enviados:           ${spriteSync.uploadedFiles} (${(spriteSync.totalBytesUploaded / (1024 * 1024)).toFixed(2)} MB)`);
    console.log(`      Inalterados/Skip:   ${spriteSync.skippedFiles}`);
    if (spriteSync.failedFiles > 0) {
      console.log(`      Falhas:             ${spriteSync.failedFiles}`);
    }

    console.log('\n====================================================');
    console.log('   RESUMO DA SINCRONIZAÇÃO                          ');
    console.log('====================================================');
    const totalUploaded = clientSync.uploadedFiles + spriteSync.uploadedFiles;
    const totalBytes = clientSync.totalBytesUploaded + spriteSync.totalBytesUploaded;
    console.log(`✓ Total de arquivos enviados: ${totalUploaded}`);
    console.log(`✓ Volume total transferido:    ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`✓ Status: CONCLUÍDO COM SUCESSO!\n`);

    if (totalUploaded > 0) {
      console.log('Exemplos de URLs sincronizadas:');
      const sample = [...clientSync.details, ...spriteSync.details].filter((d) => d.status === 'uploaded').slice(0, 5);
      for (const item of sample) {
        console.log(` - ${item.remoteKey} -> ${item.url}`);
      }
    }
  } catch (err: any) {
    console.error('\n❌ ERRO NA SINCRONIZAÇÃO COM O CLOUDFLARE R2:');
    console.error(err.message || err);
    process.exit(1);
  }
}

main();
