export function normalizeThaiName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[ศษ]/g, "ส")
    .replace(/ณ/g, "น")
    .replace(/ญ/g, "ย")
    .replace(/ภ/g, "พ")
    .replace(/ฎ/g, "ด")
    .replace(/ฏ/g, "ต")
    .replace(/ฑ/g, "ท")
    .replace(/ใ/g, "ไ")
    .replace(/์/g, "");
}

