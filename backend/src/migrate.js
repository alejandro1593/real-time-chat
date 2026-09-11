require('dotenv').config();
const { sequelize } = require('./models');

const QUERIES = [
  `ALTER TABLE messages ADD COLUMN IF NOT EXISTS "image" TEXT`,
  `ALTER TABLE messages ADD COLUMN IF NOT EXISTS "edited" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE messages ADD COLUMN IF NOT EXISTS "deleted" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE messages ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP WITH TIME ZONE`,
  `ALTER TABLE messages ADD COLUMN IF NOT EXISTS "readBy" JSONB NOT NULL DEFAULT '[]'`,
  `ALTER TABLE messages ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
  `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS "ownerId" UUID`
];

async function migrate() {
  await sequelize.authenticate();
  for (const q of QUERIES) {
    await sequelize.query(q);
  }
  console.log('Migración completada');
}

if (require.main === module) {
  migrate()
    .then(() => sequelize.close())
    .catch((err) => {
      console.error('Error en migración:', err);
      process.exit(1);
    });
}

module.exports = migrate;