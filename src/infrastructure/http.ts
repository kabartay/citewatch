/**
 * @file A small JSON-over-HTTPS GET returning the status as well as the body.
 *
 * `https.request` rather than `fetch`, because VS Code patches the former to honour the user's
 * `http.proxy` setting.
 */

import type { ClientRequest, IncomingMessage, RequestOptions } from 'http';
import * as https from 'https';

/** Signature shared by `https.request` and `http.request`. */
export type RequestFn = (options: RequestOptions, callback: (res: IncomingMessage) => void) => ClientRequest;

/** Where requests go; tests point it at a local server. */
export interface Endpoint {
  readonly hostname: string;
  readonly port?: number;
  readonly request: RequestFn;
  readonly timeoutMs: number;
}

/** A response: the status, and the parsed body when it was JSON. */
export interface JsonResponse {
  readonly status: number;
  readonly body: unknown;
}

const MAX_BYTES = 4 * 1024 * 1024;

/**
 * GETs a path. Never throws for an HTTP status; only for a network failure or timeout.
 *
 * @param token - Sent as a bearer token to this endpoint only, when given.
 */
export function getJson(endpoint: Endpoint, path: string, token?: string): Promise<JsonResponse> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': 'citewatch' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const req = endpoint.request(
      { hostname: endpoint.hostname, port: endpoint.port, path, method: 'GET', timeout: endpoint.timeoutMs, headers },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) {
            req.destroy(new Error(`${path}: response larger than ${MAX_BYTES} bytes`));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () => {
          let body: unknown;
          try {
            body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          } catch {
            body = undefined;
          }
          resolve({ status: res.statusCode ?? 0, body });
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error(`${endpoint.hostname} did not answer within ${endpoint.timeoutMs / 1000} s`)));
    req.on('error', (err) => reject(err));
    req.end();
  });
}

export const ZENODO: Endpoint = { hostname: 'zenodo.org', request: https.request, timeoutMs: 10_000 };
export const GITHUB: Endpoint = { hostname: 'api.github.com', request: https.request, timeoutMs: 10_000 };
