// QA teardown: delete the throwaway writer (cascades to Translator + Manga +
// Chapters via onDelete: Cascade). Pass the user id as argv[2].
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
(async () => {
  const id = process.argv[2];
  if (!id) throw new Error("usage: qa-writer-teardown.cjs <userId>");
  await prisma.user.delete({ where: { id } });
  console.log("DELETED", id);
  await prisma.$disconnect();
})().catch((e) => {
  console.error("TEARDOWN_FAIL", e.message);
  process.exit(1);
});
