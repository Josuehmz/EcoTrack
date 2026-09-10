/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  transform: {
    // El tsconfig del proyecto está afinado para Next (ESM + jsx preserve);
    // las pruebas del dominio corren en CommonJS, así que ts-jest usa su
    // propia configuración en vez de pelear con la del framework.
    '^.+\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'ES2022',
          module: 'commonjs',
          moduleResolution: 'node',
          esModuleInterop: true,
          strict: true,
          noUncheckedIndexedAccess: true,
          skipLibCheck: true,
        },
      },
    ],
  },
  collectCoverageFrom: ['lib/**/*.ts', '!lib/llm.ts'],
  coverageReporters: ['text'],
};
