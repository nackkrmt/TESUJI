import { rankToPowerLevel } from "@/lib/go/ranks";

export const selfDeclaredRankOptions = [
  ...Array.from({ length: 15 }, (_, index) => `${15 - index} Kyu`),
  ...Array.from({ length: 9 }, (_, index) => `${index + 1} Dan`),
] as const;

export function getSelfDeclaredPowerLevel(rank: string): number | null {
  if (!selfDeclaredRankOptions.includes(rank as (typeof selfDeclaredRankOptions)[number])) {
    return null;
  }

  return rankToPowerLevel(rank);
}
