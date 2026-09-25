const { runInSandbox } = require('./runner');

console.log('--- Running Sandboxed Multi-Language Execution Engine Tests ---');

// Test 1: JavaScript Two Sum solution
const jsCode = `
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

const r1 = runInSandbox(jsCode, testCases, { language: 'javascript' });
console.log('Test 1 (JavaScript):', r1.allPassed ? 'PASSED' : 'FAILED', `(${r1.passedCount}/${r1.totalCount})`);
if (!r1.allPassed) {
  console.error('Test 1 details:', r1.results);
  process.exit(1);
}

// Test 2: Python Two Sum solution
const pyCode = `
def twoSum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        diff = target - n
        if diff in seen:
            return [seen[diff], i]
        seen[n] = i
    return []
`;
const r2 = runInSandbox(pyCode, testCases, { language: 'python' });
console.log('Test 2 (Python):', r2.allPassed ? 'PASSED' : 'FAILED', `(${r2.passedCount}/${r2.totalCount})`);
if (!r2.allPassed) {
  console.error('Test 2 details:', r2.results);
  process.exit(1);
}

// Test 3: Java Solution
const javaCode = `
public class Solution {
    public static void main(String[] args) {
        System.out.print("[0,1]");
    }
}
`;
const r3 = runInSandbox(javaCode, [{ id: 'java1', input: '', expectedOutput: '[0,1]' }], { language: 'java' });
console.log('Test 3 (Java):', r3.allPassed ? 'PASSED' : 'FAILED', `(${r3.passedCount}/${r3.totalCount})`);
if (!r3.allPassed) {
  console.error('Test 3 details:', r3.results);
  process.exit(1);
}

// Test 5: Infinite loop timeout protection
const badCode = 'function twoSum() { while(true) {} }';
const r5 = runInSandbox(badCode, testCases, { timeoutMs: 1000, language: 'javascript' });
const timedOut = r5.results[0].error && r5.results[0].error.includes('timed out');
console.log('Test 5 (Timeout / Infinite Loop Protection):', timedOut ? 'PASSED' : 'FAILED');
if (!timedOut) {
  console.error('Test 5 details:', r5.results);
  process.exit(1);
}

// Test 6: Restricted globals isolation in JavaScript
const exploitCode = 'function solution() { return typeof process; }';
const r6 = runInSandbox(exploitCode, [{ input: '[]', expectedOutput: 'undefined' }], { language: 'javascript' });
const isUndefined = r6.results[0].actualOutput === 'undefined';
console.log('Test 6 (Global Isolation):', isUndefined ? 'PASSED' : 'FAILED');
if (!isUndefined) {
  console.error('Test 6 details:', r6.results);
  process.exit(1);
}

console.log('--- ALL MULTI-LANGUAGE SANDBOX TESTS PASSED ---');
