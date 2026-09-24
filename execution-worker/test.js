const { runInSandbox } = require('./runner');

console.log('--- Running Sandboxed Execution Engine Tests ---');

// Test 1: Two Sum solution
const code = `
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

const testCases = [
  { id: 't1', input: '[[2,7,11,15], 9]', expectedOutput: '[0,1]' },
  { id: 't2', input: '[[3,2,4], 6]', expectedOutput: '[1,2]' }
];

const r1 = runInSandbox(code, testCases);
console.log('Test 1 (Valid Solution):', r1.allPassed ? 'PASSED' : 'FAILED', `(${r1.passedCount}/${r1.totalCount})`);
if (!r1.allPassed) {
  console.error('Test 1 details:', r1.results);
  process.exit(1);
}

// Test 2: Infinite loop timeout protection
const badCode = 'function twoSum() { while(true) {} }';
const r2 = runInSandbox(badCode, testCases, { timeoutMs: 1000 });
const timedOut = r2.results[0].error && r2.results[0].error.includes('timed out');
console.log('Test 2 (Timeout / Infinite Loop Protection):', timedOut ? 'PASSED' : 'FAILED');
if (!timedOut) {
  console.error('Test 2 details:', r2.results);
  process.exit(1);
}

// Test 3: Restricted globals isolation
const exploitCode = 'function solution() { return typeof process; }';
const r3 = runInSandbox(exploitCode, [{ input: '[]', expectedOutput: 'undefined' }]);
const isUndefined = r3.results[0].actualOutput === 'undefined';
console.log('Test 3 (Global Isolation):', isUndefined ? 'PASSED' : 'FAILED');
if (!isUndefined) {
  console.error('Test 3 details:', r3.results);
  process.exit(1);
}

console.log('--- ALL SANDBOX TESTS PASSED ---');
