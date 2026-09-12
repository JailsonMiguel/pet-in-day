import { PetSpecies, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

interface SeedProtocol {
  doseNumber: number;
  minAgeDays?: number;
  intervalDays?: number;
  isBooster?: boolean;
}

interface SeedVaccine {
  name: string;
  manufacturer?: string;
  species: PetSpecies[];
  description?: string;
  protocols: SeedProtocol[];
}

async function seedVaccine(data: SeedVaccine) {
  const existing = await prisma.vaccine.findFirst({
    where: { name: data.name },
  });

  if (existing) {
    console.log(`Vacina "${data.name}" já existe (${existing.id}), pulando.`);
    return existing;
  }

  const vaccine = await prisma.vaccine.create({
    data: {
      name: data.name,
      manufacturer: data.manufacturer,
      species: data.species,
      description: data.description,
      protocols: { create: data.protocols },
    },
  });

  console.log(`Vacina "${data.name}" criada (${vaccine.id}).`);
  return vaccine;
}

async function main() {
  await seedVaccine({
    name: 'V10',
    manufacturer: 'Fabricante X',
    species: [PetSpecies.dog],
    description: 'Vacina múltipla canina (10 em 1)',
    protocols: [
      { doseNumber: 1, minAgeDays: 45, intervalDays: 21 },
      { doseNumber: 2, intervalDays: 21 },
      { doseNumber: 3, intervalDays: 365, isBooster: true },
    ],
  });

  await seedVaccine({
    name: 'Antirrábica',
    species: [PetSpecies.dog, PetSpecies.cat],
    description: 'Vacina antirrábica',
    protocols: [
      { doseNumber: 1, minAgeDays: 90, intervalDays: 365 },
      { doseNumber: 2, intervalDays: 365, isBooster: true },
    ],
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
