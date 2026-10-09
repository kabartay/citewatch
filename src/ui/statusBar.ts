/**
 * @file The status bar item: the folder's DOI and latest archived version, amber when Zenodo is
 * not switched on.
 */

import * as vscode from 'vscode';
import type { CitationService } from '../application/citationService';
import type { Logger } from '../application/ports';
import { needsAttention, statusText, tooltipMarkdown } from '../domain/format';
import type { CitationSummary } from '../domain/types';
import { readConfig } from './config';
import { activeFolder, EditorAwareFiles, watchedFile } from './files';

/** Owns the status bar item and the summary it shows. */
export class CitationStatusBar implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem('citewatch.status', vscode.StatusBarAlignment.Left, 40);
  private readonly subscriptions: vscode.Disposable[] = [];
  private timer: ReturnType<typeof setInterval> | undefined;
  current: CitationSummary | undefined;

  constructor(
    private readonly service: CitationService,
    private readonly log: Logger,
  ) {
    this.item.name = 'Citewatch';
    this.item.command = 'citewatch.actions';
  }

  start(): void {
    this.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => void this.refresh()),
      vscode.workspace.onDidSaveTextDocument((d) => watchedFile(d) && void this.refresh(true)),
      vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration('citewatch') && void this.refresh(true)),
    );
    this.timer = setInterval(() => void this.refresh(), 10 * 60 * 1000);
    void this.refresh();
  }

  /** Re-reads the active folder's citation state; `force` bypasses the cache. */
  async refresh(force = false): Promise<void> {
    const folder = activeFolder();
    if (!folder || !readConfig().showStatusBar) {
      this.item.hide();
      return;
    }
    try {
      this.current = await this.service.summary(folder.uri.fsPath, new EditorAwareFiles(folder), { checkSwitch: readConfig().checkZenodoSwitch }, force);
    } catch (err) {
      this.log.warn(`status: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    if (!this.current.citable && !this.current.conceptDoi) {
      this.item.hide();
      return;
    }
    this.item.text = statusText(this.current);
    this.item.tooltip = new vscode.MarkdownString(tooltipMarkdown(this.current));
    this.item.backgroundColor = needsAttention(this.current) ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined;
    this.item.show();
  }

  dispose(): void {
    clearInterval(this.timer);
    this.subscriptions.forEach((s) => void s.dispose());
    this.item.dispose();
  }
}
