// Strategy (playbook) rules are stored as JSON arrays of { id, text }.

export type Rule = { id: string; text: string };

export function parseRules(json: string): Rule[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v)
      ? v.filter((r) => r && typeof r.id === "string" && typeof r.text === "string").map((r) => ({ id: r.id, text: r.text }))
      : [];
  } catch {
    return [];
  }
}

export function parseIdList(json: string | null | undefined): string[] {
  try {
    const v = JSON.parse(json ?? "[]");
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
