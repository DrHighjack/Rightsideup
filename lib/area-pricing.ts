import { prisma } from "@/lib/prisma";

export function normalizeCity(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export function normalizeCities(cities: string[]) {
  return Array.from(new Set(cities.map(normalizeCity).filter(Boolean)));
}

function addressContainsCity(address: string, city: string) {
  const normalizedAddress = normalizeCity(address);
  const normalizedCity = normalizeCity(city);
  const cityPattern = normalizedCity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[,\\s])${cityPattern}(?:$|[,\\s])`, "i").test(normalizedAddress);
}

export async function resolveAreaPriceGroup(address: string) {
  if (!address.trim()) return null;

  const groups = await prisma.areaPriceGroup.findMany({
    where: { isActive: true },
    select: { id: true, name: true, cities: true, amountCents: true },
    orderBy: { createdAt: "asc" },
  });

  for (const group of groups) {
    const matchedCity = group.cities.find((city) => addressContainsCity(address, city));
    if (matchedCity) {
      return { ...group, matchedCity };
    }
  }

  return null;
}
