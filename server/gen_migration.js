const { execSync } = require('child_process');
const fs = require('fs');

const dbUrl = "postgresql://neondb_owner:npg_Zajo0Bt1UbTC@ep-curly-mud-a1cswymj-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require&advisory_lock=false";
const cmd = `npx prisma migrate diff --from-url "${dbUrl}" --to-schema-datamodel prisma/schema.prisma --script`;

try {
  console.log('Running prisma migrate diff...');
  const sql = execSync(cmd).toString();
  fs.writeFileSync('migration_isolation.sql', sql, 'utf8');
  console.log('Successfully wrote migration_isolation.sql');
} catch (e) {
  console.error('Failed to generate migration:', e.stdout ? e.stdout.toString() : e.message);
  process.exit(1);
}
