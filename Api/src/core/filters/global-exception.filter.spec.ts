import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  GlobalExceptionFilter,
  ErrorResponseBody,
} from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let json: jest.Mock<void, [ErrorResponseBody]>;
  let status: jest.Mock;
  let host: ArgumentsHost;
  let errorLog: jest.SpyInstance;
  let debugLog: jest.SpyInstance;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    json = jest.fn() as jest.Mock<void, [ErrorResponseBody]>;
    status = jest.fn().mockReturnValue({ json });

    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url: '/v1/recurso', method: 'POST' }),
      }),
    } as unknown as ArgumentsHost;

    errorLog = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    debugLog = jest
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  const errorBody = () => json.mock.calls[0][0].error;
  // `expect.any(...)` é tipado como `any`; encapsula para satisfazer o lint.
  const anyString = expect.any(String) as unknown;

  it('normaliza HttpException no envelope { error }', () => {
    filter.catch(new ConflictException('E-mail já cadastrado'), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(errorBody()).toMatchObject({
      statusCode: 409,
      message: 'E-mail já cadastrado',
      path: '/v1/recurso',
      method: 'POST',
      timestamp: anyString,
    });
  });

  it('preserva o array de mensagens do ValidationPipe', () => {
    filter.catch(
      new BadRequestException(['email inválido', 'senha curta']),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(errorBody().message).toEqual(['email inválido', 'senha curta']);
  });

  it('mapeia Prisma P2002 (unique) para 409 citando os campos', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Unique failed', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['email'] },
    });

    filter.catch(err, host);

    expect(status).toHaveBeenCalledWith(409);
    expect(errorBody().message).toBe(
      'Já existe um registro com esse valor de: email',
    );
  });

  it('mapeia Prisma P2025 (registro ausente) para 404', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Not found', {
      code: 'P2025',
      clientVersion: 'test',
    });

    filter.catch(err, host);

    expect(status).toHaveBeenCalledWith(404);
    expect(errorBody().message).toBe('Registro não encontrado');
  });

  it('não vaza detalhes de erro desconhecido e retorna 500', () => {
    filter.catch(
      new Error('conexão recusada em postgres://user:pass@host'),
      host,
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(errorBody().message).toBe('Erro interno do servidor');
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('postgres://');
  });

  it('loga 5xx com stack e 4xx apenas em debug', () => {
    filter.catch(new Error('boom'), host);
    expect(errorLog).toHaveBeenCalledTimes(1);

    filter.catch(new NotFoundException('nada aqui'), host);
    expect(debugLog).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalledTimes(1);
  });
});
