
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRaw`
    SELECT
        t.relname AS table_name,
        i.relname AS index_name,
        a.attname AS column_name
    FROM
        pg_class t,
        pg_class i,
        pg_index ix,
        pg_attribute a
    WHERE
        t.oid = ix.indrelid
        AND i.oid = ix.indexrelid
        AND a.attrelid = t.oid
        AND a.attnum = ANY(ix.indkey)
        AND t.relkind = 'r'
        AND ix.indisunique = true
        AND t.relname IN ('purchase_invoices', 'grns')
    ORDER BY
        t.relname,
        i.relname;
  `;
  console.log('Unique Indexes:', result);
}

main().catch(console.error).finally(() => prisma.$disconnect());
