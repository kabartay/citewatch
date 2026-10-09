/**
 * @file Which documents Citewatch checks, and reading a folder's files with open editors'
 * unsaved text taking precedence over the disk.
 */

import * as vscode from 'vscode';
import type { FolderFiles } from '../application/ports';
import type { VersionFile } from '../domain/types';

/** The files Citewatch checks, in a project's root directory. */
export const WATCHED: readonly VersionFile[] = ['.zenodo.json', 'CITATION.cff', 'package.json', 'pyproject.toml'];

/** Files that mark a directory as a citable project's root. */
const CITATION_FILES = ['CITATION.cff', '.zenodo.json'];

/** How far up from a file to look for its project, when it is outside every workspace folder. */
const MAX_LEVELS = 12;

/**
 * The watched file a document is, and the directory it sits in, which is its project's root; or
 * `undefined`. Anything under `node_modules` is ignored.
 */
export function watchedFile(document: vscode.TextDocument): { file: VersionFile; root: vscode.Uri } | undefined {
  if (document.uri.scheme !== 'file' || document.uri.path.includes('/node_modules/')) {
    return undefined;
  }
  const file = WATCHED.find((f) => document.uri.path.endsWith(`/${f}`));
  return file ? { file, root: vscode.Uri.joinPath(document.uri, '..') } : undefined;
}

/**
 * {@link FolderFiles} for one project directory that prefers an open document's current text to
 * the file on disk, and reads the disk through VS Code's file system, so remote and virtual
 * workspaces work too.
 */
export class EditorAwareFiles implements FolderFiles {
  constructor(private readonly root: vscode.Uri) {}

  async read(name: string): Promise<string | undefined> {
    const uri = vscode.Uri.joinPath(this.root, name);
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

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

/**
 * The project root for a directory: the nearest directory at or above it, up to its workspace
 * folder, that holds `CITATION.cff` or `.zenodo.json`; else the nearest that holds `.git`.
 * A workspace that contains many repositories therefore follows the file being edited.
 */
async function projectRootFrom(dir: vscode.Uri): Promise<vscode.Uri | undefined> {
  const stop = vscode.workspace.getWorkspaceFolder(dir)?.uri.path;
  let repository: vscode.Uri | undefined;
  let current = dir;
  for (let level = 0; level < MAX_LEVELS; level++) {
    for (const name of CITATION_FILES) {
      if (await exists(vscode.Uri.joinPath(current, name))) {
        return current;
      }
    }
    if (!repository && (await exists(vscode.Uri.joinPath(current, '.git')))) {
      repository = current;
    }
    const parent = vscode.Uri.joinPath(current, '..');
    if (current.path === stop || parent.path === current.path) {
      break;
    }
    current = parent;
  }
  return repository;
}

/** Where the active project came from, for the log. */
export type ProjectChoice =
  | { readonly kind: 'file'; readonly root: vscode.Uri | undefined; readonly file: vscode.Uri }
  | { readonly kind: 'other'; readonly root: vscode.Uri | undefined };

/**
 * The project of the active editor's file. When the active editor is not a file on disk (the
 * Output panel, an untitled buffer) or there is none, `kind` is `other` and `root` is the first
 * workspace folder that is a project, so the caller can keep showing the last project instead.
 */
export async function activeProject(): Promise<ProjectChoice> {
  const uri = vscode.window.activeTextEditor?.document.uri;
  if (uri?.scheme === 'file') {
    return { kind: 'file', root: await projectRootFrom(vscode.Uri.joinPath(uri, '..')), file: uri };
  }
  return { kind: 'other', root: await firstWorkspaceProject() };
}

async function firstWorkspaceProject(): Promise<vscode.Uri | undefined> {
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const root = await projectRootFrom(folder.uri);
    if (root) {
      return root;
    }
  }
  return undefined;
}
