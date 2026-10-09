/**
 * @file The creators' family names a project's own metadata states, used to tell its Zenodo record
 * from another project's record with the same title.
 */

/**
 * Lower-cased family names from `.zenodo.json` (`"Family, Given"`, else the last word) and from
 * `CITATION.cff` (`family-names:`). Malformed input yields what can be read, never an error.
 */
export function creatorFamilyNames(zenodoJson: string | undefined, cff: string | undefined): string[] {
  const names = new Set<string>();
  if (zenodoJson) {
    try {
      const creators = (JSON.parse(zenodoJson) as { creators?: unknown }).creators;
      for (const c of Array.isArray(creators) ? creators : []) {
        const name = typeof c === 'object' && c !== null ? (c as { name?: unknown }).name : undefined;
        if (typeof name === 'string' && name.trim()) {
          names.add(familyOf(name));
        }
      }
    } catch {
      // Malformed JSON: the diagnostics report it.
    }
  }
  for (const m of (cff ?? '').matchAll(/^\s*-?\s*family-names:\s*["']?([^"'\n#]+?)["']?\s*(?:#.*)?$/gm)) {
    names.add(m[1]?.trim().toLowerCase() ?? '');
  }
  names.delete('');
  return [...names];
}

/** The family name in `"Family, Given"`, else the last word, lower-cased. */
export function familyOf(name: string): string {
  const trimmed = name.trim();
  const family = trimmed.includes(',') ? trimmed.slice(0, trimmed.indexOf(',')) : trimmed.split(/\s+/).at(-1) ?? '';
  return family.trim().toLowerCase();
}
