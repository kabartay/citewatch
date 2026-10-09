/**
 * @file Reads the `citewatch.*` settings.
 */

import * as vscode from 'vscode';

/** The settings section every key lives under. */
export const CONFIG_SECTION = 'citewatch';

/** The settings, with defaults applied. */
export interface CitewatchConfig {
  readonly checkLicenceOnline: boolean;
  readonly checkZenodoSwitch: boolean;
  readonly showStatusBar: boolean;
}

/** @returns The current settings; read on every use, so changes apply without a reload. */
export function readConfig(): CitewatchConfig {
  const c = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return {
    checkLicenceOnline: c.get<boolean>('checkLicenceOnline') ?? true,
    checkZenodoSwitch: c.get<boolean>('checkZenodoSwitch') ?? true,
    showStatusBar: c.get<boolean>('showStatusBar') ?? true,
  };
}
