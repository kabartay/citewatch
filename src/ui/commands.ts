/**
 * @file The commands: copy DOIs and the badge, set the version everywhere, and the status bar's
 * action menu.
 */

import * as vscode from 'vscode';
import { readVersions } from '../application/citationService';
import { doiBadge } from '../domain/format';
import { referenceVersion, VERSION_FILES, withVersion } from '../domain/versions';
import type { CitationStatusBar } from './statusBar';
import { activeProject, EditorAwareFiles } from './files';
import { signInToGitHub } from './gitHubAuth';

/** Registers every command and returns their disposables. */
export function registerCommands(bar: CitationStatusBar, showLog: () => void): vscode.Disposable[] {
  const copy = async (text: string | undefined, what: string) => {
    if (!text) {
      void vscode.window.showInformationMessage(`Citewatch: no ${what} yet. Zenodo mints one when a release is published with the integration on.`);
      return;
    }
    await vscode.env.clipboard.writeText(text);
    void vscode.window.showInformationMessage(`Citewatch: copied ${text}`);
  };
  const conceptDoi = () => bar.current?.conceptDoi;
  const versionDoi = () => bar.current?.versions[0]?.doi;

  return [
    vscode.commands.registerCommand('citewatch.copyConceptDoi', () => copy(conceptDoi(), 'concept DOI')),
    vscode.commands.registerCommand('citewatch.copyVersionDoi', () => copy(versionDoi(), 'archived version')),
    vscode.commands.registerCommand('citewatch.copyBadge', () => copy(conceptDoi() && doiBadge(conceptDoi() ?? ''), 'DOI')),
    vscode.commands.registerCommand('citewatch.setVersion', () => setVersion(bar)),
    vscode.commands.registerCommand('citewatch.refresh', () => bar.refresh(true)),
    vscode.commands.registerCommand('citewatch.showLog', showLog),
    vscode.commands.registerCommand('citewatch.actions', () => actions(bar)),
  ];
}

async function actions(bar: CitationStatusBar): Promise<void> {
  const s = bar.current;
  const items: Array<vscode.QuickPickItem & { run: () => unknown }> = [];
  if (s?.conceptDoi) {
    items.push(
      { label: '$(copy) Copy concept DOI', description: s.conceptDoi, run: () => vscode.commands.executeCommand('citewatch.copyConceptDoi') },
      { label: '$(markdown) Copy DOI badge', description: 'shields.io, safe in a VS Code extension README', run: () => vscode.commands.executeCommand('citewatch.copyBadge') },
      { label: '$(link-external) Open the record', run: () => vscode.env.openExternal(vscode.Uri.parse(`https://doi.org/${s.conceptDoi}`)) },
    );
  }
  if (s?.versions[0]) {
    items.push({ label: '$(copy) Copy latest version DOI', description: `${s.versions[0].version} · ${s.versions[0].doi}`, run: () => vscode.commands.executeCommand('citewatch.copyVersionDoi') });
  }
  items.push({ label: '$(versions) Set version everywhere…', run: () => vscode.commands.executeCommand('citewatch.setVersion') });
  if (s?.zenodoSwitch === 'off') {
    items.push({ label: '$(warning) Switch Zenodo on for this repository', description: 'opens Zenodo\'s GitHub settings', run: () => vscode.env.openExternal(vscode.Uri.parse('https://zenodo.org/account/settings/github/')) });
  }
  if (s?.zenodoSwitch === 'unknown' && s.repo) {
    items.push({ label: '$(github) Sign in to GitHub to check Zenodo\'s switch', run: async () => (await signInToGitHub()) && bar.refresh(true) });
  }
  items.push({ label: '$(refresh) Refresh', run: () => bar.refresh(true) });
  const choice = await vscode.window.showQuickPick(items, { title: 'Citewatch' });
  await choice?.run();
}

/** Writes one version into every file that states one, keeping each file's formatting. */
async function setVersion(bar: CitationStatusBar): Promise<void> {
  const root = await activeProject();
  if (!root) {
    void vscode.window.showInformationMessage('Citewatch: open a file of the project first.');
    return;
  }
  const files = new EditorAwareFiles(root);
  const reference = referenceVersion(await readVersions(files));
  const version = await vscode.window.showInputBox({
    title: `Citewatch: set version everywhere in ${root.path.split('/').at(-1) ?? ''}`,
    prompt: `Written to every file that states a version: ${VERSION_FILES.join(', ')}. Without a leading "v".`,
    value: reference?.version.replace(/^v/i, ''),
    validateInput: (v) => (/^\d+(\.\d+)*([-+.][0-9A-Za-z.-]+)?$/.test(v.trim()) ? undefined : 'A version such as 1.2.3'),
  });
  if (!version) {
    return;
  }
  const changed: string[] = [];
  for (const file of VERSION_FILES) {
    const uri = vscode.Uri.joinPath(root, file);
    const text = await files.read(file);
    const next = text === undefined ? undefined : withVersion(file, text, version.trim());
    if (next === undefined || next === text) {
      continue;
    }
    const document = await vscode.workspace.openTextDocument(uri);
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, new vscode.Range(0, 0, document.lineCount, 0), next);
    if (await vscode.workspace.applyEdit(edit)) {
      await document.save();
      changed.push(file);
    }
  }
  void vscode.window.showInformationMessage(
    changed.length ? `Citewatch: version ${version.trim()} written to ${changed.join(', ')}.` : 'Citewatch: every file already states that version.',
  );
  await bar.refresh(true);
}
