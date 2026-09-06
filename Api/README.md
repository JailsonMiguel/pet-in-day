# PetEmDia - API NestJS

API Backend para a plataforma **PetEmDia**, responsável pelo gerenciamento de carteira de vacinação digital de pets, tutores, médicos veterinários e clínicas.

---

## 🚀 Módulos Implementados

### 1. `Auth` (`/v1/auth`)
- `POST /v1/auth/register`: Cadastro B2C de tutores com consentimentos (LGPD).
- `POST /v1/auth/login`: Autenticação (JWT + Refresh Token).
- `POST /v1/auth/refresh`: Rotação de Refresh Tokens.
- `POST /v1/auth/logout`: Revogação de Refresh Token.

### 2. `Pets` (`/v1/pets`)
- `POST /v1/pets`: Cadastro de pet com código público único (`publicCode`) e vínculo ao Tutor autenticado.
- `GET /v1/pets`: Listagem de todos os pets associados ao tutor autenticado.
- `GET /v1/pets/:id`: Detalhes de um pet específico (com verificação de vínculo/permissão).
- `PATCH /v1/pets/:id`: Atualização de dados do pet (peso, raça, foto, microchip, status).
- `DELETE /v1/pets/:id`: Soft delete (`deletedAt` + status `archived`).

---

## 🛠️ Tecnologias e Dependências

- **NestJS** (v11)
- **Prisma ORM** (PostgreSQL)
- **Passport JWT** & `@nestjs/jwt`
- **class-validator** & `@nestjs/mapped-types`
- **Jest** (Testes unitários)

---

## 🏁 Como Executar

### Configuração do Ambiente
```bash
# Instalar dependências
$ npm install

# Criar o arquivo de variáveis de ambiente a partir do template
$ cp .env.example .env

# Gerar um JWT_SECRET forte e colar no .env
$ node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# Executar migrations do Prisma (se necessário)
$ npx prisma migrate dev
```

> As variáveis de ambiente são validadas no boot (`src/core/config/env.validation.ts`).
> A aplicação **não sobe** se `DATABASE_URL` ou `JWT_SECRET` estiverem ausentes/inválidos
> (`JWT_SECRET` exige no mínimo 32 caracteres).

| Variável | Obrigatória | Padrão | Descrição |
| --- | --- | --- | --- |
| `DATABASE_URL` | sim | — | String de conexão PostgreSQL |
| `JWT_SECRET` | sim | — | Segredo de assinatura dos access tokens (mín. 32 caracteres) |
| `NODE_ENV` | não | `development` | `development` \| `production` \| `test` |
| `PORT` | não | `3000` | Porta HTTP |
| `JWT_ACCESS_EXPIRES_IN_SECONDS` | não | `3600` | Validade do access token |
| `JWT_REFRESH_EXPIRES_IN_DAYS` | não | `7` | Validade do refresh token |
| `CORS_ORIGINS` | não | `` (vazio) | Allowlist de origens (separadas por vírgula). Vazio libera tudo em dev e bloqueia tudo em produção |
| `THROTTLE_TTL_SECONDS` | não | `60` | Janela do rate limit global (por IP) |
| `THROTTLE_LIMIT` | não | `100` | Máximo de requisições por janela; `login` e `register` usam limite próprio de 5/min |

### Segurança HTTP

- **helmet** aplica cabeçalhos de segurança em todas as respostas.
- **CORS** opera por allowlist via `CORS_ORIGINS`; requisições sem `Origin` (curl, apps mobile) continuam permitidas.
- **Rate limiting** global via `@nestjs/throttler` (`ThrottlerGuard` registrado como guard global), com limite reforçado de 5 requisições/minuto em `POST /v1/auth/login` e `POST /v1/auth/register`.

### Rodar a Aplicação
```bash
# Desenvolvimento (Watch mode)
$ npm run start:dev

# Produção
$ npm run build
$ npm run start:prod
```

### Executar Testes
```bash
# Testes unitários
$ npm run test
```

Cobertura atual de testes unitários: `AuthService` (login, rotação de refresh
token, logout, registro), `JwtStrategy`, `PetsService` e `GlobalExceptionFilter`.

### Tratamento de Erros

Toda exceção passa pelo `GlobalExceptionFilter`
([`src/core/filters`](src/core/filters/global-exception.filter.ts)), registrado
como `APP_FILTER`. As respostas de erro seguem um envelope único, espelhando o
`{ data }` das respostas de sucesso:

```jsonc
{
  "error": {
    "statusCode": 409,
    "message": "E-mail já cadastrado", // string ou string[] (erros de validação)
    "path": "/v1/auth/register",
    "method": "POST",
    "timestamp": "2026-09-06T12:00:00.000Z"
  }
}
```

Erros conhecidos do Prisma são mapeados para o status adequado (`P2002` → 409,
`P2025` → 404, `P2003` → 409). Erros não tratados retornam `500` genérico —
stack trace, SQL e mensagens internas nunca chegam ao cliente; o detalhe
completo é logado no servidor.

### Integração Contínua

O workflow [`.github/workflows/api-ci.yml`](../.github/workflows/api-ci.yml)
roda a cada push em `master` e em cada Pull Request que toque em `Api/`,
executando (todos bloqueantes): `npm run lint:ci` → `npm run build` → `npm test`.
O rate limit é desativado quando `NODE_ENV=test` para não gerar `429` na suíte.

