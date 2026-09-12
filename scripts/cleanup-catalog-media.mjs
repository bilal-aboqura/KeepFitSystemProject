import pg from "pg";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

const required = ["DIRECT_URL", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"];
for (const name of required) if (!process.env[name]) throw new Error(`${name} is required.`);
const db = new pg.Client({ connectionString: process.env.DIRECT_URL });
const r2 = new S3Client({ region: "auto", endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } });

await db.connect();
try {
  const { rows } = await db.query(`select m.id,m.object_key from catalog_media m where m.provider='r2' and m.archived_at is not null and m.cleanup_after is not null and m.cleanup_after<=now() and not exists(select 1 from product_media p where p.media_id=m.id and p.archived_at is null) and not exists(select 1 from variant_media v where v.media_id=m.id and v.archived_at is null) order by m.cleanup_after limit 100`);
  for (const media of rows) {
    await r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: media.object_key }));
    await db.query("update catalog_media set cleanup_after=null,updated_at=now() where id=$1 and cleanup_after is not null", [media.id]);
  }
  console.log(`Cleaned ${rows.length} unreferenced archived R2 object(s).`);
} finally {
  await db.end();
}
