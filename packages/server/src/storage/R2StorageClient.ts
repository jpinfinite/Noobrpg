import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

// Carrega variáveis de ambiente caso ainda não tenham sido injetadas
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'packages/server/.env') });

export interface R2Config {
  accountId?: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  bucketName: string;
  publicUrl?: string;
}

export interface SyncFileResult {
  localPath: string;
  remoteKey: string;
  status: 'uploaded' | 'skipped' | 'failed';
  bytes: number;
  error?: string;
  url?: string;
}

export interface SyncSummary {
  totalFiles: number;
  uploadedFiles: number;
  skippedFiles: number;
  failedFiles: number;
  totalBytesUploaded: number;
  details: SyncFileResult[];
}

export class R2StorageClient {
  private client: S3Client;
  private bucketName: string;
  private publicUrl: string;

  constructor(config?: Partial<R2Config>) {
    const accessKeyId = config?.accessKeyId || process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = config?.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY;
    const endpoint = config?.endpoint || process.env.R2_ENDPOINT;
    const bucketName = config?.bucketName || process.env.R2_BUCKET_NAME || 'noobrpg-assets';
    const publicUrl = config?.publicUrl || process.env.R2_PUBLIC_URL || '';

    if (!accessKeyId || !secretAccessKey || !endpoint) {
      throw new Error(
        'Configurações do Cloudflare R2 ausentes. Certifique-se de definir R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY e R2_ENDPOINT no .env.'
      );
    }

    this.bucketName = bucketName;
    this.publicUrl = publicUrl;

    this.client = new S3Client({
      region: 'auto',
      endpoint: endpoint,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  /**
   * Garante que o bucket R2 existe, criando-o se necessário.
   */
  public async ensureBucket(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
      return true;
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        try {
          await this.client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
          return true;
        } catch (createErr: any) {
          console.error(`[R2Storage] Falha ao criar bucket "${this.bucketName}":`, createErr);
          throw createErr;
        }
      }
      // Se for 403 ou outro erro
      console.warn(`[R2Storage] Aviso ao verificar bucket "${this.bucketName}": ${err.message}`);
      return false;
    }
  }

  /**
   * Determina o Content-Type apropriado com base na extensão do arquivo.
   */
  public static getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.webp':
        return 'image/webp';
      case '.svg':
        return 'image/svg+xml';
      case '.json':
        return 'application/json';
      case '.ogg':
        return 'audio/ogg';
      case '.wav':
        return 'audio/wav';
      case '.mp3':
        return 'audio/mpeg';
      case '.css':
        return 'text/css';
      case '.js':
        return 'application/javascript';
      case '.txt':
        return 'text/plain';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Faz upload de um arquivo para o Cloudflare R2 com hash MD5 e cabeçalhos de cache otimizados.
   */
  public async uploadFile(
    localPath: string,
    remoteKey: string,
    contentType?: string
  ): Promise<{ key: string; bytes: number; url: string }> {
    const fileBuffer = await fs.promises.readFile(localPath);
    const mimeType = contentType || R2StorageClient.getContentType(localPath);

    // Cache-Control otimizado: 1 ano para imagens/áudio imutáveis, 1 hora para mapas/json
    const isImmutable = !localPath.endsWith('.json');
    const cacheControl = isImmutable
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=3600, stale-while-revalidate=86400';

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: remoteKey,
        Body: fileBuffer,
        ContentType: mimeType,
        CacheControl: cacheControl,
      })
    );

    const publicUrl = this.getPublicUrl(remoteKey);
    return {
      key: remoteKey,
      bytes: fileBuffer.length,
      url: publicUrl,
    };
  }

  /**
   * Retorna a URL pública do asset no R2 / CDN.
   */
  public getPublicUrl(remoteKey: string): string {
    if (this.publicUrl) {
      const base = this.publicUrl.endsWith('/') ? this.publicUrl.slice(0, -1) : this.publicUrl;
      const key = remoteKey.startsWith('/') ? remoteKey.slice(1) : remoteKey;
      return `${base}/${key}`;
    }
    // Fallback padrão para o endpoint do R2
    const endpoint = process.env.R2_ENDPOINT || '';
    return `${endpoint}/${this.bucketName}/${remoteKey}`;
  }

  /**
   * Obtém a lista de chaves e tamanhos de arquivos existentes no bucket.
   */
  public async listRemoteFiles(prefix = ''): Promise<Map<string, number>> {
    const remoteFiles = new Map<string, number>();
    let continuationToken: string | undefined = undefined;

    try {
      do {
        const response: any = await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.bucketName,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          })
        );

        if (response.Contents) {
          for (const item of response.Contents) {
            if (item.Key && item.Size !== undefined) {
              remoteFiles.set(item.Key, item.Size);
            }
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);
    } catch (err: any) {
      console.warn(`[R2Storage] Não foi possível listar arquivos remotos (pode ser bucket vazio ou permissões): ${err.message}`);
    }

    return remoteFiles;
  }

  /**
   * Sincroniza um diretório local recursivamente para o Cloudflare R2 com upload diferencial.
   */
  public async syncDirectory(
    localDir: string,
    remotePrefix: string,
    filterExts?: string[]
  ): Promise<SyncSummary> {
    const summary: SyncSummary = {
      totalFiles: 0,
      uploadedFiles: 0,
      skippedFiles: 0,
      failedFiles: 0,
      totalBytesUploaded: 0,
      details: [],
    };

    if (!fs.existsSync(localDir)) {
      console.warn(`[R2Storage] Diretório local não encontrado: ${localDir}`);
      return summary;
    }

    // Listar arquivos locais
    const localFiles = this.getAllFilesRecursively(localDir, filterExts);
    summary.totalFiles = localFiles.length;

    // Listar arquivos remotos já existentes para evitar uploads repetidos
    const prefix = remotePrefix.endsWith('/') ? remotePrefix : `${remotePrefix}/`;
    const cleanPrefix = prefix === '/' ? '' : prefix;
    const remoteIndex = await this.listRemoteFiles(cleanPrefix);

    for (const file of localFiles) {
      const relPath = path.relative(localDir, file).replace(/\\/g, '/');
      const remoteKey = `${cleanPrefix}${relPath}`;
      const stats = fs.statSync(file);

      // Checa se o arquivo remoto já existe com o mesmo tamanho exato
      const remoteSize = remoteIndex.get(remoteKey);
      if (remoteSize !== undefined && remoteSize === stats.size) {
        summary.skippedFiles++;
        summary.details.push({
          localPath: file,
          remoteKey,
          status: 'skipped',
          bytes: stats.size,
          url: this.getPublicUrl(remoteKey),
        });
        continue;
      }

      try {
        const result = await this.uploadFile(file, remoteKey);
        summary.uploadedFiles++;
        summary.totalBytesUploaded += result.bytes;
        summary.details.push({
          localPath: file,
          remoteKey,
          status: 'uploaded',
          bytes: result.bytes,
          url: result.url,
        });
      } catch (err: any) {
        summary.failedFiles++;
        summary.details.push({
          localPath: file,
          remoteKey,
          status: 'failed',
          bytes: stats.size,
          error: err.message,
        });
      }
    }

    return summary;
  }

  /**
   * Varre recursivamente diretórios e coleta arquivos.
   */
  private getAllFilesRecursively(dir: string, filterExts?: string[]): string[] {
    let results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(this.getAllFilesRecursively(fullPath, filterExts));
      } else if (entry.isFile()) {
        if (filterExts && filterExts.length > 0) {
          const ext = path.extname(entry.name).toLowerCase();
          if (!filterExts.includes(ext)) {
            continue;
          }
        }
        results.push(fullPath);
      }
    }

    return results;
  }
}
