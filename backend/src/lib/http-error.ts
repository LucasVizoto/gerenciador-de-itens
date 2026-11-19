export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    /** Identificador estável para o frontend tratar casos específicos (ex.: `TROCAR_SENHA`). */
    readonly codigo?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
