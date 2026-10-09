# Troubleshooting

Start with **Citewatch: Show Log**. Each summary writes one line: the repository, the DOI, how
many versions are archived, what the files say, and the Zenodo switch.

## No status bar item

The file you are editing belongs to no project with `CITATION.cff` or `.zenodo.json` (the log
line names the project it found), or `citewatch.showStatusBar` is off.

## "Zenodo integration: unknown"

Citewatch has no GitHub session with a scope that can read webhooks, or the account lacks admin
access to the repository. Choose **Sign in to GitHub** from the status bar menu. Unknown is
never shown as off.

## "No DOI yet" although the project is on Zenodo

Add the concept DOI to `CITATION.cff` under `identifiers` (type `doi`), or a Zenodo DOI badge to
`README.md`. The title search finds the record only when its title is exactly the local one and
one of its creators shares a family name with yours.

## A licence error for a licence that exists

Zenodo's vocabulary uses lowercase SPDX ids: `mit`, `apache-2.0`, `gpl-3.0-or-later`. If Zenodo
cannot be reached, no licence error is shown; turn `citewatch.checkLicenceOnline` off to keep
the check offline.

## No squiggles in `CITATION.cff` from the schema

Schema validation of YAML comes from the YAML extension (`redhat.vscode-yaml`). Citewatch's
own checks work without it.
