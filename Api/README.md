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

# Executar migrations do Prisma (se necessário)
$ npx prisma migrate dev
```

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

