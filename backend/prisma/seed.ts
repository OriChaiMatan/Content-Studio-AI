import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── User (dev account) — Phase 12: now loginable so existing seed-user cases
  //    stay accessible. Dev credentials: the email below / password "password123".
  const passwordHash = await bcrypt.hash('password123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'alex.rivera@alexandria-os.edu' },
    update: { passwordHash },   // backfill the hash for an already-seeded user
    create: {
      id: 'user-seed-1',
      name: 'Alex Rivera',
      email: 'alex.rivera@alexandria-os.edu',
      role: 'Lead Researcher',
      language: 'en',
      passwordHash,
      notifGenerationComplete: true,
      notifFactCheckConflict: true,
      notifDraftReady: false,
    },
  });

  console.log(`  ✓ User: ${user.name} (${user.email}) — dev password: password123`);
  console.log('Seed complete.');
}

main()
  .catch(e => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
