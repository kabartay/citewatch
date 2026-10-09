/**
 * @file Which documents Citewatch checks, and reading a folder's files with open editors'
 * unsaved text taking precedence over the disk.
 */

import * as vscode from 'vscode';
import type { FolderFiles } from '../application/ports';
import type { VersionFile } from '../domain/types';

/** The files Citewatch checks, at the root of a workspace folder. */
export const WATCHED: readonly VersionFile[] = ['.zenodo.json', 'CITATION.cff', 'package.json', 'pyproject.toml'];

/** The watched file a document is, and its workspace folder, or `undefined`. */
export function watchedFile(document: vscode.TextDocument): { file: VersionFile; folder: vscode.WorkspaceFolder } | undefined {
  if (document.uri.scheme !== 'file') {
    return undefined;
  }
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!folder) {
    return undefined;
  }
  const file = WATCHED.find((f) => vscode.Uri.joinPath(folder.uri, f).fsPath === document.uri.fsPath);
  return file ? { file, folder } : undefined;
}

/**
 * {@link FolderFiles} that prefers an open document's current text to the file on disk, and
 * reads the disk through VS Code's file system, so remote and virtual workspaces work too.
 */
export class EditorAwareFiles implements FolderFiles {
  constructor(private readonly folder: vscode.WorkspaceFolder) {}

  async read(name: string): Promise<string | undefined> {
    const uri = vscode.Uri.joinPath(this.folder.uri, name);
    const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
    if (open) {
      return open.getText();
    }
    try {
      return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
    } catch {
      return undefined;
    }
  }
}

/** The folder of the active editor, else the first folder. */
export function activeFolder(): vscode.WorkspaceFolder | undefined {
  const uri = vscode.window.activeTextEditor?.document.uri;
  return (uri && vscode.workspace.getWorkspaceFolder(uri)) ?? vscode.workspace.workspaceFolders?.[0];
}
