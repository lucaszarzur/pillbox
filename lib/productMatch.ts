// Casamento entre a apresentação cadastrada e os produtos de uma loja (cotação automática)

import type { VtexCandidate } from "@/lib/vtex"

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/,/g, ".")
    .replace(/(\d)\s+(mg|ml|g|gr|mcg|%)/g, "$1$2")
    .replace(/(\d)gr\b/g, "$1g")

const GENERIC_WORDS = new Set([
  "colirio", "xarope", "creme", "comprimido", "comprimidos", "capsula", "capsulas", "de", "com", "e", "-",
  "gr", "g", "mg", "ml", "mcg",
])

export function defaultSearchTerm(name: string) {
  const words = name
    .split(/[\s/]+/)
    .filter((w) => w && !GENERIC_WORDS.has(normalize(w)) && !/\d/.test(w))
  return words.slice(0, 2).join(" ") || name
}

const UNIT_WORDS = "(comprimidos?|comp|cpr|cps|caps|capsulas?|cp|un|unidades|drageas|envelopes|saches|tabletes)"

/** 0–1 = proporção das palavras do nome encontradas; -1 = dose, quantidade ou kit não batem. */
export function scoreCandidate(c: VtexCandidate, p: { medication: { name: string }; dosage: string | null; unitsPerPackage: number }) {
  const name = normalize(`${c.productName} ${c.itemName}`)
  if (/\bkit\b/.test(name) && !/\bkit\b/.test(normalize(p.medication.name))) return -1
  if (p.unitsPerPackage > 1 && !new RegExp(`\\b${p.unitsPerPackage}\\s*${UNIT_WORDS}\\b`).test(name)) return -1
  const dosage = normalize(p.dosage ?? "").replace(/\s+/g, "")
  if (dosage && !name.replace(/\s+/g, "").includes(dosage)) return -1
  const tokens = normalize(p.medication.name)
    .split(/[\s/()-]+/)
    .filter((w) => w.length > 1 && !GENERIC_WORDS.has(w))
  // Sem palavra reconhecível no nome não dá para confirmar que é o mesmo produto
  if (!tokens.length) return 0
  const hits = tokens.filter((t) => name.includes(t)).length
  return hits / tokens.length
}
