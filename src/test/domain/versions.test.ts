/**
 * @file Tests for reading, comparing and rewriting versions across the four files.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { readVersion, referenceVersion, versionMismatches, withVersion } from '../../domain/versions';

const PKG = '{\n  "name": "jobwatch",\n  "version": "0.1.3",\n  "main": "out/extension.js"\n}\n';
const PY = '[build-system]\nrequires = ["setuptools"]\n\n[project]\nname = "fintfm"\nversion = "0.6.0"  # bump with care\n';
const CFF = 'cff-version: 1.2.0\nversion: 0.1.2\n';
const ZEN = '{\n  "title": "x",\n  "version": "0.1.3"\n}\n';

describe('readVersion', () => {
  it('reads each file kind with its line', () => {
    assert.deepEqual(readVersion('package.json', PKG), { file: 'package.json', version: '0.1.3', line: 2 });
    assert.deepEqual(readVersion('pyproject.toml', PY), { file: 'pyproject.toml', version: '0.6.0', line: 5 });
    assert.deepEqual(readVersion('CITATION.cff', CFF), { file: 'CITATION.cff', version: '0.1.2', line: 1 });
    assert.deepEqual(readVersion('.zenodo.json', ZEN), { file: '.zenodo.json', version: '0.1.3', line: 2 });
  });

  it('ignores a version outside [project] and a dynamic one', () => {
    assert.equal(readVersion('pyproject.toml', '[tool.other]\nversion = "9"\n'), undefined);
    assert.equal(readVersion('pyproject.toml', '[project]\ndynamic = ["version"]\n'), undefined);
  });
});

describe('versionMismatches', () => {
  it('flags the file that disagrees with the package manifest, not the manifest', () => {
    const sources = [readVersion('package.json', PKG), readVersion('CITATION.cff', CFF), readVersion('.zenodo.json', ZEN)].filter((s) => s !== undefined);
    assert.equal(referenceVersion(sources)?.file, 'package.json');
    const problems = versionMismatches(sources);
    assert.deepEqual([...problems.keys()], ['CITATION.cff']);
    assert.match(problems.get('CITATION.cff')?.message ?? '', /Version 0\.1\.2 here, but package\.json says 0\.1\.3/);
  });

  it('treats v1.0 and 1.0 as the same version', () => {
    const sources = [readVersion('package.json', PKG), readVersion('CITATION.cff', 'version: v0.1.3\n')].filter((s) => s !== undefined);
    assert.equal(versionMismatches(sources).size, 0);
  });
});

describe('withVersion', () => {
  it('changes only the version, keeping formatting and comments', () => {
    assert.equal(withVersion('pyproject.toml', PY, '0.7.0'), PY.replace('0.6.0', '0.7.0'));
    assert.equal(withVersion('package.json', PKG, '0.2.0'), PKG.replace('0.1.3', '0.2.0'));
    assert.equal(withVersion('CITATION.cff', CFF, '0.2.0'), CFF.replace('0.1.2', '0.2.0'));
  });

  it('leaves a file without a version alone', () => {
    assert.equal(withVersion('package.json', '{"name":"x"}', '1.0.0'), undefined);
  });
});
