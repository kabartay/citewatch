/**
 * @file A GitHub token from VS Code's own GitHub sign-in, so nothing has to be pasted.
 *
 * Reading a repository's webhooks needs the `read:repo_hook` scope, or `repo`, which an editor
 * signed in for git often already has. The silent lookup never prompts; signing in is an explicit
 * action from the status bar menu.
 */

import * as vscode from 'vscode';

const SCOPES: readonly string[][] = [['repo'], ['read:repo_hook']];

/** @returns A token from an existing GitHub session, or `undefined`; never prompts. */
export async function gitHubToken(): Promise<string | undefined> {
  for (const scopes of SCOPES) {
    try {
      const session = await vscode.authentication.getSession('github', scopes, { silent: true });
      if (session) {
        return session.accessToken;
      }
    } catch {
      // No GitHub authentication provider, e.g. in a restricted environment.
    }
  }
  return undefined;
}

/** Asks the user to sign in with the narrowest scope that can read webhooks. */
export async function signInToGitHub(): Promise<boolean> {
  try {
    return !!(await vscode.authentication.getSession('github', ['read:repo_hook'], { createIfNone: true }));
  } catch {
    return false;
  }
}
