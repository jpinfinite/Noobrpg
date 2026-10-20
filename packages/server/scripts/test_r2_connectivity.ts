import { S3Client, ListBucketsCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import https from 'node:https';
import dotenv from 'dotenv';

dotenv.config();

async function listR2Buckets() {
  const endpoint = process.env.R2_ENDPOINT || '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';

  const u = new URL(endpoint);
  const agent = new https.Agent({
    keepAlive: true,
    servername: u.host,
    rejectUnauthorized: true,
  });

  const client = new S3Client({
    region: 'auto',
    endpoint: endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
    requestHandler: new NodeHttpHandler({
      httpsAgent: agent,
    }),
  });

  console.log('[R2 Check] Listando buckets na conta Cloudflare R2...');
  try {
    const res = await client.send(new ListBucketsCommand({}));
    const bucketNames = (res.Buckets || []).map(b => b.Name);
    console.log('[R2 Check] Autenticação SUCESSO! Buckets encontrados:', bucketNames);

    const targetBucket = process.env.R2_BUCKET_NAME || 'noobrpg-assets';
    if (!bucketNames.includes(targetBucket)) {
      console.log(`[R2 Check] Criando bucket "${targetBucket}"...`);
      await client.send(new CreateBucketCommand({ Bucket: targetBucket }));
      console.log(`[R2 Check] Bucket "${targetBucket}" criado com sucesso!`);
    } else {
      console.log(`[R2 Check] Bucket "${targetBucket}" já existe.`);
    }

    process.exit(0);
  } catch (err: any) {
    console.error('[R2 Check] Erro na operação R2:', err.name, err.message);
    process.exit(1);
  }
}

listR2Buckets();
