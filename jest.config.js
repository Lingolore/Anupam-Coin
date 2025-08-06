export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testMatch: ['**/*.jest.test.ts'],
  moduleNameMapper: {
    '^(\.{1,2}/.*)\.js$': '$1'
  },
  transform: {
    '^.+\.ts$': ['ts-jest', {
      useESM: true
    }]
  },
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 30000
};

