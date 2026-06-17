// QA: create a throwaway WRITER (verified, credentials login) for the e2e
// creator-journey pass. Prints the email/password for the e2e script.
// Teardown: scripts/qa-writer-teardown.cjs (deletes the user + cascades).
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

(async () => {
  const ts = Date.now();
  const email = `qa-writer-${ts}@inkverse.test`;
  const password = `Qa!${ts}`;
  const passwordHash = await bcrypt.hash(password, 10);
  const username = `qa_writer_${ts}`;

  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      role: "TRANSLATOR",
      emailVerified: new Date(),
      translator: {
        create: { penName: `QA Writer ${ts}`, kind: "WRITER", bio: "qa throwaway" },
      },
    },
    include: { translator: true },
  });

  console.log(JSON.stringify({ id: user.id, email, password, translatorId: user.translator.id }));
  await prisma.$disconnect();
})().catch((e) => {
  console.error("SETUP_FAIL", e.message);
  process.exit(1);
});
