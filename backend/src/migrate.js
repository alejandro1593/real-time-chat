require('dotenv').config();
const { sequelize } = require('./models');

const QUERIES = [
  `ALTER TABLE messages ADD COLUMN IF NOT EXISTS "image" TEXT`,
  `ALTER TABLE messages ADD COLUMN IF NOT EXISTS "file" JSONB`,
  `ALTER TABLE messages ADD COLUMN IF NOT EXISTS "replyTo" JSONB`,
  `ALTER TABLE messages ADD COLUMN IF NOT EXISTS "reactions" JSONB NOT NULL DEFAULT '{}'`,
  `ALTER TABLE messages ADD COLUMN IF NOT EXISTS "edited" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE messages ADD COLUMN IF NOT EXISTS "deleted" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE messages ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP WITH TIME ZONE`,
  `ALTER TABLE messages ADD COLUMN IF NOT EXISTS "readBy" JSONB NOT NULL DEFAULT '[]'`,
  `ALTER TABLE messages ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
  `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS "ownerId" UUID`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS "avatarColor" VARCHAR(20)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS "avatar" TEXT`,
  `UPDATE users SET "avatarColor" = (ARRAY['#22d3ee','#a78bfa','#34d399','#f472b6','#fb923c','#facc15','#60a5fa','#f87171'])[1 + (floor(random() * 8))] WHERE "avatarColor" IS NULL`
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