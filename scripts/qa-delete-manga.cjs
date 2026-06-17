// One-off: delete a manga by id (cascades chapters/etc). Pass id as argv[2].
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
(async () => {
  const id = process.argv[2];
  if (!id) throw new Error("usage: qa-delete-manga.cjs <mangaId>");
  await prisma.manga.delete({ where: { id } });
  console.log("DELETED manga", id);
  await prisma.$disconnect();
})().catch((e) => { console.error("FAIL", e.message); process.exit(1); });
