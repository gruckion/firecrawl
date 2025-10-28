// Custom Jest reporter to show test progress in real-time
// This helps debug which tests are running and hanging in CI

class VerboseTestReporter {
  private testStartTimes = new Map<string, number>();

  onRunStart() {
    console.log("\n🚀 Test suite starting...\n");
  }

  onTestFileStart(test: any) {
    const relativePath = test.path.replace(process.cwd() + "/", "");
    console.log(`\n📝 Starting test file: ${relativePath}`);
  }

  onTestCaseStart(test: any, testCaseStartInfo: any) {
    const testPath = test.path.replace(process.cwd() + "/", "");
    const testName = testCaseStartInfo.fullName || testCaseStartInfo.title;
    const key = `${testPath}::${testName}`;
    this.testStartTimes.set(key, Date.now());
    console.log(`  ⏱️  Starting: ${testName}`);
  }

  onTestCaseResult(test: any, testCaseResult: any) {
    const testPath = test.path.replace(process.cwd() + "/", "");
    const testName = testCaseResult.fullName || testCaseResult.title;
    const key = `${testPath}::${testName}`;
    const startTime = this.testStartTimes.get(key);
    const duration = startTime ? Date.now() - startTime : 0;
    this.testStartTimes.delete(key);

    if (testCaseResult.status === "passed") {
      console.log(`  ✅ Passed (${duration}ms): ${testName}`);
    } else if (testCaseResult.status === "failed") {
      console.log(`  ❌ Failed (${duration}ms): ${testName}`);
    } else if (testCaseResult.status === "skipped") {
      console.log(`  ⏭️  Skipped: ${testName}`);
    }
  }

  onTestFileResult(test: any, testResult: any) {
    const relativePath = test.path.replace(process.cwd() + "/", "");
    const { numPassingTests, numFailingTests, numPendingTests } = testResult;
    const duration =
      testResult.perfStats.runtime ||
      testResult.perfStats.end - testResult.perfStats.start;

    console.log(`\n✨ Finished: ${relativePath}`);
    console.log(
      `   Passed: ${numPassingTests}, Failed: ${numFailingTests}, Skipped: ${numPendingTests}`,
    );
    console.log(`   Duration: ${duration}ms\n`);
  }

  onRunComplete(testContexts: any, results: any) {
    console.log("\n" + "=".repeat(80));
    console.log("📊 Test Suite Complete");
    console.log("=".repeat(80));
    console.log(`Total Tests: ${results.numTotalTests}`);
    console.log(`Passed: ${results.numPassedTests}`);
    console.log(`Failed: ${results.numFailedTests}`);
    console.log(`Skipped: ${results.numPendingTests}`);
    console.log(
      `Duration: ${results.testResults.reduce((acc: number, r: any) => acc + (r.perfStats.runtime || 0), 0)}ms`,
    );
    console.log("=".repeat(80) + "\n");
  }

  getLastError(): void {
    // No-op
  }
}

export default VerboseTestReporter;
