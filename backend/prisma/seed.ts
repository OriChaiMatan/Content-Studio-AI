import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── User (development placeholder — auth will replace this) ───────────────
  const user = await prisma.user.upsert({
    where: { email: 'alex.rivera@alexandria-os.edu' },
    update: {},
    create: {
      id: 'user-seed-1',
      name: 'Alex Rivera',
      email: 'alex.rivera@alexandria-os.edu',
      role: 'Lead Researcher',
      language: 'en',
      notifGenerationComplete: true,
      notifFactCheckConflict: true,
      notifDraftReady: false,
    },
  });

  console.log(`  ✓ User: ${user.name} (${user.email})`);
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
