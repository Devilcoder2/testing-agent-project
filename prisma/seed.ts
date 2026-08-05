import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const ava = await prisma.user.upsert({
    where: { email: "ava.tester@example.test" },
    update: { displayName: "Ava Tester", devPassword: "sentinel-dev" },
    create: {
      email: "ava.tester@example.test",
      displayName: "Ava Tester",
      devPassword: "sentinel-dev"
    }
  });

  const ben = await prisma.user.upsert({
    where: { email: "ben.tester@example.test" },
    update: { displayName: "Ben Tester", devPassword: "sentinel-dev" },
    create: {
      email: "ben.tester@example.test",
      displayName: "Ben Tester",
      devPassword: "sentinel-dev"
    }
  });

  const demoProduct = await prisma.product.upsert({
    where: { createdById_name: { createdById: ava.id, name: "Demo CRM" } },
    update: {},
    create: { name: "Demo CRM", createdById: ava.id }
  });

  await prisma.productMembership.upsert({
    where: { userId_productId: { userId: ava.id, productId: demoProduct.id } },
    update: {},
    create: { userId: ava.id, productId: demoProduct.id }
  });

  const privateProduct = await prisma.product.upsert({
    where: { createdById_name: { createdById: ben.id, name: "Ben's Sandbox" } },
    update: {},
    create: { name: "Ben's Sandbox", createdById: ben.id }
  });

  await prisma.productMembership.upsert({
    where: { userId_productId: { userId: ben.id, productId: privateProduct.id } },
    update: {},
    create: { userId: ben.id, productId: privateProduct.id }
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
