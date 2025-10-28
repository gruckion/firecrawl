import type { Config } from "jest";

const config: Config = {
  verbose: true,
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: ["<rootDir>/dist/"],
  forceExit: true,
  detectOpenHandles: true,
  openHandlesTimeout: 120000,
  watchAll: false,
  reporters: [
    "default",
    "<rootDir>/src/__tests__/reporters/verbose-reporter.ts",
  ],
  // Add per-test timeout to help identify hanging tests
  testTimeout: 120000, // 2 minutes per test
  // Show individual test results immediately
  bail: false,
  maxWorkers: 1, // Run tests serially to make debugging easier
};

export default config;
