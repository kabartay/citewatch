/**
 * @file Problems in `.zenodo.json`, `CITATION.cff` and version mismatches, shown as diagnostics.
 */

import * as vscode from 'vscode';
import { readVersions } from '../application/citationService';
import type { LicenceChecker } from '../application/licenceChecker';
import { checkCitationCff } from '../domain/citationCff';
import type { Problem } from '../domain/types';
import { versionMismatches } from '../domain/versions';
import { checkZenodoJson, lineOfKey, zenodoLicence } from '../domain/zenodoJson';
import { readConfig } from './config';
import { EditorAwareFiles, watchedFile } from './files';

/** The `source` shown beside every diagnostic. */
export const SOURCE = 'citewatch';

const SEVERITY = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  info: vscode.DiagnosticSeverity.Information,
} as const;

function toDiagnostic(p: Problem, document: vscode.TextDocument): vscode.Diagnostic {
  const line = Math.min(p.line, Math.max(0, document.lineCount - 1));
  const text = document.lineAt(line).text;
  const start = text.length - text.trimStart().length;
  const d = new vscode.Diagnostic(new vscode.Range(line, start, line, Math.max(start + 1, text.trimEnd().length)), p.message, SEVERITY[p.severity]);
  d.source = SOURCE;
  d.code = p.code;
  return d;
}

/** `YYYY-MM-DD` for today, local time. */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Keeps diagnostics in step with the watched files that are open. */
export class CitationDiagnostics implements vscode.Disposable {
  private readonly collection = vscode.languages.createDiagnosticCollection(SOURCE);
  private readonly subscriptions: vscode.Disposable[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly licences: LicenceChecker) {}

  start(): void {
    const schedule = () => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.checkAll(), 400);
    };
    this.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument(schedule),
      vscode.workspace.onDidChangeTextDocument((e) => watchedFile(e.document) && schedule()),
      vscode.workspace.onDidSaveTextDocument(schedule),
      vscode.workspace.onDidCloseTextDocument((d) => this.collection.delete(d.uri)),
      vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration('citewatch') && schedule()),
    );
    void this.checkAll();
  }

  /** Rechecks every open watched file; a version change in one file affects the others. */
  async checkAll(): Promise<void> {
    for (const document of vscode.workspace.textDocuments) {
      const watched = watchedFile(document);
      if (!watched) {
        continue;
      }
      const problems = await this.problems(document, watched.file, watched.folder);
      if (!document.isClosed) {
        this.collection.set(document.uri, problems.map((p) => toDiagnostic(p, document)));
      }
    }
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.subscriptions.forEach((s) => void s.dispose());
    this.collection.dispose();
  }

  private async problems(document: vscode.TextDocument, file: string, folder: vscode.WorkspaceFolder): Promise<Problem[]> {
    const text = document.getText();
    const out: Problem[] = [];
    if (file === '.zenodo.json') {
      const offline = checkZenodoJson(text);
      out.push(...offline);
      const licence = zenodoLicence(text);
      if (licence && readConfig().checkLicenceOnline && !offline.some((p) => p.code === 'zenodo.license-case')) {
        if ((await this.licences.isKnown(licence)) === false) {
          out.push({
            severity: 'error',
            code: 'zenodo.license-unknown',
            line: lineOfKey(text, 'license'),
            message: `Zenodo's licence vocabulary has no "${licence}"; the deposit would be dropped. Use a lowercase SPDX id such as "mit" or "apache-2.0".`,
          });
        }
      }
    }
    if (file === 'CITATION.cff') {
      out.push(...checkCitationCff(text, today()));
    }
    const mismatch = versionMismatches(await readVersions(new EditorAwareFiles(folder))).get(file as never);
    if (mismatch) {
      out.push(mismatch);
    }
    return out;
  }
}
