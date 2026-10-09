/**
 * @file ORCID and DOI checks: format, and the ORCID checksum that a typo almost always breaks.
 */

/** `0000-0002-3093-3456`, optionally inside `https://orcid.org/…`. */
const ORCID = /^(?:https?:\/\/orcid\.org\/)?(\d{4}-\d{4}-\d{4}-\d{3}[\dX])$/;

/** A DOI as `10.<registrant>/<suffix>`, optionally as a `https://doi.org/` URL. */
const DOI = /^(?:https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/\S+)$/i;

/**
 * The ORCID check digit (ISO 7064 MOD 11-2) for its first 15 digits.
 *
 * @param base - 15 digits, without hyphens.
 */
export function orcidCheckDigit(base: string): string {
  let total = 0;
  for (const ch of base) {
    total = (total + Number(ch)) * 2;
  }
  const result = (12 - (total % 11)) % 11;
  return result === 10 ? 'X' : String(result);
}

/** Why an ORCID is invalid, or `undefined` when it is well formed and its checksum holds. */
export function orcidProblem(value: string): string | undefined {
  const m = ORCID.exec(value.trim());
  if (!m?.[1]) {
    return `"${value}" is not an ORCID; expected 0000-0000-0000-0000, optionally as https://orcid.org/…`;
  }
  const digits = m[1].replace(/-/g, '');
  const expected = orcidCheckDigit(digits.slice(0, 15));
  if (digits[15] !== expected) {
    return `ORCID ${m[1]} fails its checksum (last character should be ${expected}): probably a typo`;
  }
  return undefined;
}

/** The bare DOI (`10.5281/zenodo.123`) from a DOI or DOI URL, or `undefined`. */
export function bareDoi(value: string): string | undefined {
  return DOI.exec(value.trim())?.[1];
}

/** The Zenodo record id from a Zenodo DOI (`10.5281/zenodo.23269419` → `23269419`). */
export function zenodoRecordId(doi: string): string | undefined {
  return /^10\.5281\/zenodo\.(\d+)$/i.exec(doi)?.[1];
}
