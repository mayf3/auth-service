export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class OAuthHttpError extends HttpError {
  constructor(status: number, error: string) {
    super(status, error);
    this.name = 'OAuthHttpError';
  }
}
