# Security

## What is requested

| Request | Token | Why |
| --- | --- | --- |
| `GET zenodo.org/api/vocabularies/licenses/{id}` | none | Whether the licence exists, once per id |
| `GET zenodo.org/api/records?q=conceptrecid:…` | none | A record's archived versions |
| `GET zenodo.org/api/records?q=title:"…"` | none | The record, when no DOI is written locally |
| `GET api.github.com/repos/{repo}/hooks` | your VS Code GitHub session | Whether Zenodo's webhook is installed |

Nothing else. Nothing that creates or changes a release, a record or a webhook.

## The GitHub token

Taken from VS Code's own GitHub sign-in, silently if a session with the `repo` or
`read:repo_hook` scope exists. Citewatch asks for `read:repo_hook`, the narrowest scope that can
read webhooks, only when you choose **Sign in to GitHub**. The token is sent to
`api.github.com` only, and never written, logged or shown. Webhook configuration contains
Zenodo's access token in its URL; Citewatch reads only whether the URL is Zenodo's, and never
logs it.

## What is written

Nothing, except the version lines that **Set Version Everywhere** changes when you run it.

## Reporting a problem

Open an issue at [kabartay/citewatch](https://github.com/kabartay/citewatch/issues), or use
GitHub's private vulnerability reporting for anything sensitive.
