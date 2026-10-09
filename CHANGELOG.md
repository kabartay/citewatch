# Changelog

All notable changes to Citewatch. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.2] — 2026-10-09

### Changed

- The status bar keeps showing the last project while the Output panel or another non-file
  editor has focus, instead of disappearing.
- The log names the project Citewatch chose, or says why it found none, once per change.

## [0.1.1] — 2026-10-09

### Fixed

- A workspace that holds many repositories, such as a whole `~/projects` folder, now works.
  Citewatch follows the file being edited to its project (the nearest directory with
  `CITATION.cff` or `.zenodo.json`, else with `.git`). Before, it looked only at the workspace
  folder's root and found nothing there. Files in subfolders are now checked too, except under
  `node_modules`.

## [0.1.0] — 2026-10-09

### Added

- Checks for `.zenodo.json` as you type: valid JSON, the six required fields, upload type,
  access right, licence case, creators written `Family, Given`, ORCID check digits, keywords.
- The licence checked against Zenodo's live licence vocabulary, cached per session.
- Checks for `CITATION.cff`: required keys, `date-released` format and future dates, ORCID
  check digits and URL form, DOI form, versions written without a `v`.
- A warning on every file whose version disagrees with the others: `package.json`,
  `pyproject.toml`, `CITATION.cff`, `.zenodo.json`.
- Schema validation and completion for both files, with the official Citation File Format 1.2.0
  schema.
- A status bar item with the concept DOI and newest archived version, amber when Zenodo's
  webhook is missing from the repository.
- Commands to copy the concept DOI, the latest version DOI and a shields.io DOI badge, and to
  set one version in every file.

[Unreleased]: https://github.com/kabartay/citewatch/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/kabartay/citewatch/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/kabartay/citewatch/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/kabartay/citewatch/releases/tag/v0.1.0
