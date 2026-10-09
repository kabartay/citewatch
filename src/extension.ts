/**
 * @file Composition root: builds the object graph and hands its disposables to VS Code.
 */

import * as vscode from 'vscode';
import { CitationService } from './application/citationService';
import { LicenceChecker } from './application/licenceChecker';
import { GitHubClient } from './infrastructure/gitHubClient';
import { ZenodoClient } from './infrastructure/zenodoClient';
import { registerCommands } from './ui/commands';
import { CitationDiagnostics } from './ui/diagnostics';
import { gitHubToken } from './ui/gitHubAuth';
import { CitationStatusBar } from './ui/statusBar';

/** Called by VS Code when a citation file or a JSON/YAML document is present. */
export function activate(context: vscode.ExtensionContext): void {
  const log = vscode.window.createOutputChannel('Citewatch', { log: true });
  const version = (context.extension.packageJSON as { version?: string }).version ?? '?';
  log.info(`Citewatch ${version} activated`);

  const zenodo = new ZenodoClient();
  const service = new CitationService(zenodo, new GitHubClient(gitHubToken), log);
  const diagnostics = new CitationDiagnostics(new LicenceChecker(zenodo));
  const bar = new CitationStatusBar(service, log);

  context.subscriptions.push(log, diagnostics, bar, ...registerCommands(bar, () => log.show(true)));
  diagnostics.start();
  bar.start();
}

/** Nothing to do: every resource is in `context.subscriptions`. */
export function deactivate(): void {}
