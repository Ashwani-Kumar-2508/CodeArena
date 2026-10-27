/**
 * CodeArena Test Suite — Execution Engine (Sandbox Runner)
 *
 * Tests: JavaScript, Python (if available), timeout protection,
 * global isolation, and edge cases.
 */

const { runInSandbox, runJavaScript } = require('../../execution-worker/runner');

describe('Execution Engine — JavaScript Runner', () => {
  const twoSumCases = [
    { id: 't1', input: '[[2,7,11,15], 9]', expectedOutput: '[0,1]' },
    { id: 't2', input: '[[3,2,4], 6]', expectedOutput: '[1,2]' }
  ];

  const twoSumCode = `
function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const comp = target - nums[i];
    if (map.has(comp)) return [map.get(comp), i];
    map.set(nums[i], i);
  }
  return [];
}
`;

  test('passes Two Sum test cases correctly', () => {
    const result = runInSandbox(twoSumCode, twoSumCases, { language: 'javascript' });
    expect(result.allPassed).toBe(true);
    expect(result.passedCount).toBe(2);
    expect(result.totalCount).toBe(2);
  });

  test('returns correct per-test result shape', () => {
    const result = runInSandbox(twoSumCode, twoSumCases, { language: 'javascript' });
    for (const r of result.results) {
      expect(r).toHaveProperty('testId');
      expect(r).toHaveProperty('passed');
      expect(r).toHaveProperty('executionTimeMs');
      expect(r).toHaveProperty('actualOutput');
      expect(r).toHaveProperty('expectedOutput');
      expect(r).toHaveProperty('input');
      expect(r).toHaveProperty('isHidden');
    }
  });

  test('fails when code returns wrong answer', () => {
    const wrongCode = `function twoSum(nums, target) { return [0, 0]; }`;
    const result = runInSandbox(wrongCode, twoSumCases, { language: 'javascript' });
    expect(result.allPassed).toBe(false);
    expect(result.passedCount).toBe(0);
  });

  test('timeout protection: kills infinite loops', () => {
    const infiniteLoop = `function solution() { while(true) {} }`;
    const result = runInSandbox(infiniteLoop, twoSumCases, { language: 'javascript', timeoutMs: 500 });
    expect(result.allPassed).toBe(false);
    expect(result.results[0].error).toMatch(/timed out/i);
  });

  test('global isolation: process is undefined in sandbox', () => {
    const exploitCode = `function solution() { return typeof process; }`;
    const result = runInSandbox(exploitCode, [{ input: '[]', expectedOutput: 'undefined' }], { language: 'javascript' });
    expect(result.results[0].actualOutput).toBe('undefined');
    expect(result.results[0].passed).toBe(true);
  });

  test('global isolation: require is not accessible', () => {
    const exploitCode = `function solution() { return typeof require; }`;
    const result = runInSandbox(exploitCode, [{ input: '[]', expectedOutput: 'undefined' }], { language: 'javascript' });
    expect(result.results[0].actualOutput).toBe('undefined');
    expect(result.results[0].passed).toBe(true);
  });

  test('handles empty test cases gracefully', () => {
    const result = runInSandbox(twoSumCode, [], { language: 'javascript' });
    expect(result.passedCount).toBe(0);
    expect(result.totalCount).toBe(0);
    expect(result.allPassed).toBe(false);
  });

  test('handles code with console.log output (logs are captured)', () => {
    // Input [[1,2,3]] parsed as [[1,2,3]], spread gives nums=[1,2,3], so nums[0]=1
    const code = `function solution(nums) { console.log('hello'); return nums[0]; }`;
    const result = runInSandbox(code, [{ input: '[[1,2,3]]', expectedOutput: '1' }], { language: 'javascript' });
    expect(result.results[0].passed).toBe(true);
    expect(result.results[0].logs).toContain('hello');
  });

  test('handles hidden test cases: isHidden flag preserved', () => {
    const result = runInSandbox(twoSumCode, [
      { id: 'vis', input: '[[2,7,11,15], 9]', expectedOutput: '[0,1]', isHidden: false },
      { id: 'hid', input: '[[3,2,4], 6]', expectedOutput: '[1,2]', isHidden: true }
    ], { language: 'javascript' });

    const visible = result.results.find(r => r.testId === 'vis');
    const hidden = result.results.find(r => r.testId === 'hid');
    expect(visible.isHidden).toBe(false);
    expect(hidden.isHidden).toBe(true);
    expect(result.allPassed).toBe(true);
  });

  test('auto-detects last defined function when no known name matches', () => {
    const code = `function myCustomSolver(a, b) { return a + b; }`;
    const result = runInSandbox(code, [{ input: '[3, 4]', expectedOutput: '7' }], { language: 'javascript' });
    expect(result.results[0].passed).toBe(true);
  });

  test('handles runtime error gracefully (not a crash)', () => {
    const buggyCode = `function solution(x) { return x.nonExistent.property; }`;
    const result = runInSandbox(buggyCode, [{ input: '[1]', expectedOutput: 'anything' }], { language: 'javascript' });
    expect(result.results[0].passed).toBe(false);
    expect(result.results[0].error).toBeTruthy();
  });

  test('normalizeOutput handles JSON-like expected outputs', () => {
    // Both [0,1] and [0, 1] should match due to JSON normalization
    const code = `function twoSum() { return [0, 1]; }`;
    const result = runInSandbox(code, [{ input: '[]', expectedOutput: '[0,1]' }], { language: 'javascript' });
    expect(result.results[0].passed).toBe(true);
  });
});

describe('Execution Engine — Python Runner', () => {
  const pyTwoSumCode = `
def twoSum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        diff = target - n
        if diff in seen:
            return [seen[diff], i]
        seen[n] = i
    return []
`;

  const twoSumCases = [
    { id: 't1', input: '[[2,7,11,15], 9]', expectedOutput: '[0,1]' },
    { id: 't2', input: '[[3,2,4], 6]', expectedOutput: '[1,2]' }
  ];

  // Wrapped in try/skip in case Python isn't available in the CI/dev env
  test('passes Two Sum test cases (skipped if python not available)', () => {
    const result = runInSandbox(pyTwoSumCode, twoSumCases, { language: 'python' });
    // If python is unavailable, the result will have errors — we check conditionally
    const hasRuntimeError = result.results.some(r => r.error && (
      r.error.includes('ENOENT') || r.error.includes('not found') || r.error.includes('python')
    ));
    if (!hasRuntimeError) {
      expect(result.allPassed).toBe(true);
      expect(result.passedCount).toBe(2);
    }
  });
});

describe('Execution Engine — Language Dispatcher', () => {
  test('defaults to JavaScript when language is unrecognized', () => {
    const code = `function solution() { return 42; }`;
    const result = runInSandbox(code, [{ input: '[]', expectedOutput: '42' }], { language: 'brainfuck' });
    // Should fall through to JS runner
    expect(result.results[0].passed).toBe(true);
  });

  test('recognizes "py" as python alias', () => {
    // Just check it doesn't throw and returns valid structure
    const code = `def solution(): return 1`;
    const result = runInSandbox(code, [{ input: '[]', expectedOutput: '1' }], { language: 'py' });
    expect(result).toHaveProperty('passedCount');
    expect(result).toHaveProperty('totalCount');
    expect(result).toHaveProperty('results');
  });
});
