import pg from "pg";
const db = new pg.Client({connectionString:process.env.DIRECT_URL,connectionTimeoutMillis:10000});
await db.connect();
try {
  const {rows}=await db.query("select (select count(*) from products) as products,(select count(*) from locations) as locations,(select count(*) from shipping_rates) as shipping_rates,(select count(*) from customers) as customers");
  console.log("Test environment counts:",rows[0]);
  console.log("Provider configuration present:",Object.fromEntries(["KASHIER_API_KEY","KASHIER_MERCHANT_ID","BOSTA_API_KEY","MYLERZ_USERNAME","MYLERZ_PASSWORD","TELEGRAM_BOT_TOKEN","GOOGLE_SHEETS_WEBHOOK_URL","META_CONVERSIONS_API_ACCESS_TOKEN","NEXT_PUBLIC_SITE_URL"].map(k=>[k,Boolean(process.env[k])])));
} finally {await db.end();}
