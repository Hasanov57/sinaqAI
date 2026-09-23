const sourceHeader = /^([ABCD])\s+variantı\s+(\d+)\s+saylı\s+test\s+tapşırığı[.:]?\s*$/i;

export function stripDimSourceHeader(value: string): {
  text: string;
  sourceVariantNumbers: Partial<Record<"A" | "B" | "C" | "D", number>> | null;
} {
  const lines = value.split(/\r?\n/);
  const sourceVariantNumbers: Partial<Record<"A" | "B" | "C" | "D", number>> = {};
  let index = 0;
  while (index < lines.length) {
    const match = sourceHeader.exec(lines[index].trim());
    if (!match) break;
    const variant = match[1].toUpperCase() as "A" | "B" | "C" | "D";
    if (sourceVariantNumbers[variant] !== undefined) break;
    sourceVariantNumbers[variant] = Number(match[2]);
    index += 1;
  }

  // Requiring consecutive distinct booklet lines avoids changing academic prose.
  if (index < 2) return { text: value, sourceVariantNumbers: null };
  return {
    text: lines.slice(index).join("\n").replace(/^\s*\n*/, ""),
    sourceVariantNumbers,
  };
}
