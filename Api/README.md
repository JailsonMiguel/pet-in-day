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
- `POST /v1/pets`: Cadastro de pet com código público único (`publicCode`) e vínculo ao Tutor autenticado (como tutor principal).
- `GET /v1/pets`: Listagem paginada dos pets do tutor autenticado. Query: `?page` (padrão 1), `?limit` (padrão 20, máx 100), `?status`, `?species`, `?sort` (`createdAt` \| `-createdAt` \| `name` \| `-name`). Resposta: `{ data, meta: { page, limit, total, totalPages } }`.
- `GET /v1/pets/:id`: Detalhes de um pet específico. Liberado para qualquer tutor vinculado (ou `platform_admin`).
- `PATCH /v1/pets/:id`: Atualização parcial. **Apenas o tutor principal** (`isPrimary`) ou `platform_admin`; co-tutores recebem `403`.
- `DELETE /v1/pets/:id`: Soft delete (`deletedAt` + status `archived`). Mesma regra do `PATCH`.

### 3. `Vaccines` (`/v1/vaccines`) — catálogo de vacinas

Primeira peça da Carteira de Vacinação. Leitura liberada para qualquer usuário
autenticado; escrita restrita a `platform_admin`.

- `GET /v1/vaccines`: Lista o catálogo. Query: `?species`, `?isActive` (`true`/`false`).
- `GET /v1/vaccines/:id`: Detalhe de uma vacina, com o esquema de doses (`protocols`).
- `POST /v1/vaccines` (`platform_admin`): Cria a vacina e, opcionalmente, seu esquema de doses (`protocols: [{ doseNumber, minAgeDays?, intervalDays?, isBooster?, notes? }]`).
- `PATCH /v1/vaccines/:id` (`platform_admin`): Atualiza dados da vacina (nome, fabricante, espécies, descrição, `isActive`). O esquema de doses não é editável por aqui — é definido na criação.

### 4. `Clinics` (`/v1/clinics`) — cadastro de clínicas

Auto-serviço: qualquer usuário autenticado pode cadastrar uma clínica e vira
automaticamente seu administrador (`ClinicUser.role = admin`). Autorização de
recurso (quem pode editar/vincular) é resolvida no service, no mesmo padrão do
`PetsService` (não depende de `@Roles`, e sim de vínculo com o recurso).

- `POST /v1/clinics`: Cadastra a clínica (`cnpj`, `legalName`, `tradeName?`, `email`, `phone?`, `address`). CNPJ único; aceita qualquer formatação (dígitos são extraídos).
- `GET /v1/clinics/:id`: Detalhe da clínica.
- `PATCH /v1/clinics/:id`: **Apenas o admin da clínica** (ou `platform_admin`). `cnpj` não é editável.
- `POST /v1/clinics/:id/veterinarians`: Vincula um veterinário já registrado à clínica, buscando por `crmv`. **Apenas o admin da clínica** (ou `platform_admin`). `404` se o CRMV não existir, `409` se o vínculo já existir.

Não implementado: convite por e-mail/token (`/clinics/{id}/invites/*`), busca
geográfica (`/clinics/search`), cadastro de recepção/staff.

### 5. `Veterinarians` (`/v1/veterinarians`)

- `POST /v1/veterinarians/register` (`@Public`): Autocadastro do veterinário (email, senha, nome, `crmv`, `crmvState`, `specialty?`) — cria `User` (`role: veterinarian`) e o perfil `Veterinarian`. CRMV único. Simplificação deliberada: o contrato original previa convite pela clínica; aqui o veterinário se cadastra como o tutor faz, e uma clínica o vincula depois via `POST /v1/clinics/:id/veterinarians`.
- `GET /v1/veterinarians/me`: Perfil do veterinário autenticado + lista de clínicas ativas vinculadas.

Não implementado: `pending-prescriptions` (lista de prescrições pendentes por
veterinário — hoje dá para chegar lá via `GET /v1/prescriptions/:id` uma a uma).

### 6. `Prescriptions` (`/v1/prescriptions`)

Só `@Roles(veterinarian)` cria; leitura/edição são autorizadas por recurso no
service (autor, colega ativo na mesma clínica, ou `platform_admin`).

- `POST /v1/prescriptions`: Prescreve uma dose (`petId`, `clinicId`, `vaccineId`, `doseNumber?` [padrão 1], `scheduledAt?`, `notes?`). Exige que o veterinário esteja **ativamente vinculado** à clínica informada. `404` pet/vacina inexistente ou vacina inativa; `422` pet arquivado/falecido.
- `GET /v1/prescriptions/:id`: Detalhe.
- `PATCH /v1/prescriptions/:id`: Atualiza `status` (`scheduled`/`cancelled`/`no_show`) e/ou `notes`. Definir `status: "applied"` diretamente é bloqueado (`400`) — isso só acontece via `POST /v1/vaccinations`.

### 7. `Vaccinations` (`/v1/vaccinations`) — aplicação e retificação

- `POST /v1/vaccinations` (`@Roles(veterinarian)`): Registra a aplicação (`prescriptionId?`, `petId`, `clinicId`, `vaccineId`, `doseNumber`, `batchNumber`, `batchExpiry`, `applicationSite?`, `appliedAt`, `notes?`). Calcula `nextDoseAt` a partir do próximo `VaccineProtocol` da vacina (`appliedAt` + `intervalDays` da dose seguinte; `null` se não houver próxima dose). Gera `qrCodeToken` público. Se `prescriptionId` for informado: valida que pet/vacina/dose batem com a prescrição, marca-a como `applied` e bloqueia reaplicação (`409` se já aplicada).
- `GET /v1/vaccinations/:id`: Detalhe (mesma regra de autorização de `Prescriptions`).
- `POST /v1/vaccinations/:id/rectify`: Retificação **auditada** — nunca edita o registro original diretamente. Cria um `VaccinationRectification` com o "antes/depois" (`previousData`/`newData`) e move o status para `rectified`. Retorna `updatedFields` (só os campos que de fato mudaram).
- `GET /v1/vaccinations/verify/:qrCodeToken` (`@Public`): Verificação pública e limitada. Token inexistente ou vacinação anulada (`voided`) → `{ valid: false }` (sempre `200`, nunca `404`, para não vazar a existência do registro).

### 8. Carteira de vacinação — `GET /v1/pets/:id/wallet`

Adicionado ao `PetsController`/`PetsService` (reaproveita a mesma autorização de
`GET /v1/pets/:id`: tutor vinculado ou `platform_admin`). Agrega:

- `summary`: `totalApplied` (vacinações), `totalPending`/`totalOverdue` (prescrições `pending`/`scheduled`, com/sem `scheduledAt` vencido) e um `status` derivado (`overdue` > `pending` > `up_to_date` > `unknown`).
- `entries`: vacinações aplicadas + prescrições em aberto (prescrições `cancelled`/`no_show`/`applied` não aparecem — a aplicada já virou uma entrada de vacinação), ordenadas por data mais recente primeiro.

Ainda não implementado: `GET /v1/pets/:id/wallet/export` (PDF), lembretes
(`vaccination_reminders`), notificações.

### 9. Consentimento LGPD — `Clinics` ↔ `Pets` (`/v1/pets/:petId/consents`)

Um veterinário só pode prescrever (`POST /v1/prescriptions`) ou aplicar
(`POST /v1/vaccinations`) em um pet se a clínica dele tiver consentimento
ativo do tutor para aquele pet — sem isso, ambas as rotas retornam `403`.
Autorização por recurso no service, no mesmo padrão do `PetsService`
(`@Roles(tutor)` só nas rotas de escrita).

- `POST /v1/pets/:petId/consents` (`@Roles(tutor)`): Concede o consentimento (`clinicId`). Qualquer tutor vinculado ao pet pode conceder (não só o principal). `404` se pet ou clínica não existirem; `409` se já houver consentimento ativo para essa clínica.
- `GET /v1/pets/:petId/consents`: Lista o histórico de consentimentos (concedidos e revogados) do pet. Mesma regra de acesso de `GET /v1/pets/:id` (tutor vinculado ou `platform_admin`).
- `DELETE /v1/pets/:petId/consents/:clinicId` (`@Roles(tutor)`): Revoga o consentimento ativo daquela clínica (`revokedAt`). `404` se não houver consentimento ativo para revogar.

Não implementado: notificação da clínica quando um consentimento é concedido
ou revogado.

---

## 🛠️ Tecnologias e Dependências

- **NestJS** (v11)
- **Prisma ORM** (PostgreSQL)
- **Passport JWT** & `@nestjs/jwt`
- **class-validator** & `@nestjs/mapped-types`
- **Jest** (Testes unitários)

---

## 🏁 Como Executar

### Pré-requisitos

- Node.js 22
- Docker + Docker Compose (para o banco de desenvolvimento)

### Configuração do Ambiente
```bash
# Instalar dependências
$ npm install

# Criar o arquivo de variáveis de ambiente a partir do template
$ cp .env.example .env

# Gerar um JWT_SECRET forte e colar no .env
$ node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# Subir o Postgres local (container `petemdia-postgres`, porta 5434 no host)
$ npm run db:up

# Banco novo (vazio): aplica todas as migrations
$ npx prisma migrate deploy

# Banco já existente (criado antes via `prisma db push`): marque o baseline
# como aplicado uma única vez e então aplique as migrations pendentes
$ npx prisma migrate resolve --applied 0_init
$ npx prisma migrate deploy

# Popular o catálogo de vacinas de desenvolvimento (V10, Antirrábica)
$ npx prisma db seed
```

O seed ([`prisma/seed.ts`](prisma/seed.ts)) é idempotente — rodar de novo não
duplica as vacinas já existentes (checa por nome antes de criar).

> Clínica e veterinário já têm autocadastro (`POST /v1/clinics`,
> `POST /v1/veterinarians/register`). Só **`platform_admin` continua sem
> bootstrap** pela API — para testar rotas restritas a esse papel em dev,
> promova um usuário direto no banco:
> `UPDATE users SET role = 'platform_admin' WHERE email = '...';`.

O banco de desenvolvimento roda em container, definido em
[`docker-compose.yml`](docker-compose.yml) (`postgres:16-alpine`, volume nomeado
`petemdia-pgdata`). O host expõe a porta **5434** (o container usa 5432
internamente) para não colidir com uma instalação nativa do Postgres. Scripts
auxiliares:

| Script | Ação |
| --- | --- |
| `npm run db:up` | Sobe o Postgres em background |
| `npm run db:down` | Para o container (preserva os dados) |
| `npm run db:reset` | Destrói o volume e recria o banco do zero |
| `npm run db:logs` | Acompanha os logs do Postgres |

Não há Postgres local instalado? Basta o Docker — nada é instalado na máquina
além do container. Quem preferir um Postgres nativo pode apontar o
`DATABASE_URL` para ele; a estratégia padrão do projeto, porém, é o container.

> As migrations ficam em [`prisma/migrations`](prisma/migrations). `0_init` é o
> baseline com o schema completo anterior; `20260906120000_add_auth_audit_log`
> cria a tabela de auditoria de autenticação.

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
| `LOG_LEVEL` | não | `info` | Nível mínimo do pino: `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace` \| `silent` |

### Segurança HTTP

- **helmet** aplica cabeçalhos de segurança em todas as respostas.
- **CORS** opera por allowlist via `CORS_ORIGINS`; requisições sem `Origin` (curl, apps mobile) continuam permitidas.
- **Rate limiting** global via `@nestjs/throttler` (`ThrottlerGuard` registrado como guard global), com limite reforçado de 5 requisições/minuto em `POST /v1/auth/login` e `POST /v1/auth/register`.

### Autenticação e autorização

A API é **autenticada por padrão**: `JwtAuthGuard` e `RolesGuard` são guards
globais (`APP_GUARD` em [`app.module.ts`](src/app.module.ts), na ordem
throttler → autenticação → papel). Toda rota exige `Authorization: Bearer <access_token>`
a menos que seja marcada com `@Public()` (hoje: `GET /` e todo o `AuthController`).

- `@Public()` — dispensa autenticação na rota ou no controller.
- `@Roles(UserRole.veterinarian, ...)` — restringe a rota aos papéis listados;
  sem o decorator, qualquer usuário autenticado passa. Falha de papel retorna `403`.
- `@CurrentUser()` — injeta o usuário da request. O `JwtStrategy` usa `select`
  explícito: `passwordHash` e `mfaSecret` nunca são anexados; usuários com
  `deletedAt`, `blocked` ou `inactive` são rejeitados no `validate`.

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
token, logout, registro), `AuthAuditService`, `JwtStrategy`, `JwtAuthGuard`,
`RolesGuard`, `PetsService` (criação, paginação/filtros, regra de tutor
principal em `update`/`remove`, agregação da carteira de vacinação),
`VaccinesService`, `ClinicsService` (autorização por admin da clínica, vínculo
de veterinário), `VeterinariansService`, `PrescriptionsService`,
`VaccinationsService` (cálculo de `nextDoseAt`, retificação auditada,
verificação pública, bloqueio sem consentimento do tutor), `ConsentsService`
(concessão/revogação, autorização por vínculo com o pet) e
`GlobalExceptionFilter`.

### Observabilidade e Auditoria

Logging estruturado via **pino** (`nestjs-pino`), configurado em
[`src/core/logging`](src/core/logging/logger.module.ts): uma linha JSON por
evento em produção, `pino-pretty` fora dela, nível controlado por `LOG_LEVEL`.
`authorization`, `cookie` e `x-api-key` são redigidos antes de qualquer escrita.
Cada request recebe um `req.id` para correlação.

Eventos de autenticação (login ok/falha, logout, refresh ok/falha, cadastro)
são persistidos na tabela `auth_audit_logs` pelo `AuthAuditService` — trilha de
auditoria para fins de LGPD, com `ipAddress`, `userAgent` e o motivo da falha
(`invalid_password`, `account_blocked`, …). A gravação é *best-effort*: uma
falha ao auditar é logada, mas nunca interrompe o fluxo de autenticação.

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

