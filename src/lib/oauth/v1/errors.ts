export type V1OAuthErrorCode =
  | 'invalid_client'
  | 'invalid_grant'
  | 'invalid_request'
  | 'invalid_scope'
  | 'invalid_target'
  | 'unsupported_grant_type'
  | 'unsupported_token_type'
  | 'temporarily_unavailable'
  | 'server_error';

const STATUS_BY_CODE: Record<V1OAuthErrorCode, number> = {
  invalid_client: 401,
  invalid_grant: 400,
  invalid_request: 400,
  invalid_scope: 400,
  invalid_target: 400,
  unsupported_grant_type: 400,
  unsupported_token_type: 400,
  temporarily_unavailable: 503,
  server_error: 500,
};

export class V1OAuthError extends Error {
  readonly statusCode: number;
  readonly category: string;

  constructor(code: V1OAuthErrorCode, category: string = code) {
    super(code);
    this.name = 'V1OAuthError';
    this.statusCode = STATUS_BY_CODE[code];
    this.category = category;
  }
}
