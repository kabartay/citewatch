/**
 * @file Tests for ORCID checksums and DOI parsing.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { bareDoi, orcidCheckDigit, orcidProblem, zenodoRecordId } from '../../domain/identifiers';

describe('ORCID', () => {
  it('accepts real ORCIDs, bare or as URLs', () => {
    assert.equal(orcidProblem('0000-0002-3093-3456'), undefined);
    assert.equal(orcidProblem('https://orcid.org/0000-0002-1825-0097'), undefined, "ORCID's own documentation example");
    assert.equal(orcidProblem('0000-0002-1694-233X'), undefined, 'an X check digit');
  });

  it('catches a one-digit typo by its checksum', () => {
    assert.match(orcidProblem('0000-0002-3093-3457') ?? '', /fails its checksum \(last character should be 6\)/);
  });

  it('refuses a malformed value', () => {
    assert.match(orcidProblem('0000-0002-3093') ?? '', /is not an ORCID/);
  });

  it('computes the MOD 11-2 check digit', () => {
    assert.equal(orcidCheckDigit('000000021825009'), '7');
  });
});

describe('DOI', () => {
  it('strips a doi.org URL and reads a Zenodo record id', () => {
    assert.equal(bareDoi('https://doi.org/10.5281/zenodo.23269419'), '10.5281/zenodo.23269419');
    assert.equal(zenodoRecordId('10.5281/zenodo.23269419'), '23269419');
    assert.equal(zenodoRecordId('10.1000/xyz'), undefined);
    assert.equal(bareDoi('not a doi'), undefined);
  });
});
