/**
 * Stub CommonJS de `@nestjs/config` para a suíte de testes unitários.
 *
 * `@nestjs/config@12` é publicado como ESM puro (`"type": "module"`), o que o
 * Jest (rodando em CommonJS via ts-jest) não consegue carregar de `node_modules`.
 * Os specs sempre injetam um mock de `ConfigService`, então basta expor o token
 * de DI e o formato de `ConfigModule` aqui. Mapeado em `jest.moduleNameMapper`.
 */

export class ConfigService {
  get(): unknown {
    return undefined;
  }
}

export const ConfigModule = {
  forRoot: () => ({ module: class ConfigModuleStub {}, providers: [] }),
  forRootAsync: () => ({ module: class ConfigModuleStub {}, providers: [] }),
};
