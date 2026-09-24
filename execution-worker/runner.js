const vm = require('node:vm');
const http = require('node:http');

/**
 * Sandboxed code executor for CodeArena.
 * Enforces execution timeout, sandbox globals neutralization,
 * output capture, and test case evaluation.
 */
function runInSandbox(code, testCases = [], options = {}) {
  const timeoutMs = options.timeoutMs || 3000;
  const maxOutputBytes = 50000;
  const results = [];
  let passedCount = 0;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const logs = [];
    let actualOutput = null;
    let error = null;
    const startTime = process.hrtime.bigint();

    // Create a secure sandbox context
    const sandboxConsole = {
      log: (...args) => {
        const text = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
        if (logs.join('\n').length < maxOutputBytes) logs.push(text);
      },
      error: (...args) => {
        const text = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
        if (logs.join('\n').length < maxOutputBytes) logs.push(`[ERR] ${text}`);
      },
      warn: (...args) => {
        const text = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
        if (logs.join('\n').length < maxOutputBytes) logs.push(`[WARN] ${text}`);
      }
    };

    // Restricted sandbox environment: no process, no require, no network, no fs
    const sandbox = {
      console: sandboxConsole,
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Map,
      Set,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      setTimeout: undefined,
      setInterval: undefined,
      setImmediate: undefined,
      process: undefined,
      require: undefined,
      Buffer: undefined,
      global: undefined
    };

    const context = vm.createContext(sandbox);

    try {
      // Parse input argument(s)
      let parsedArgs = [];
      if (tc.input !== undefined && tc.input !== null && tc.input !== '') {
        try {
          const parsed = JSON.parse(tc.input);
          parsedArgs = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          parsedArgs = [tc.input];
        }
      }

      // Inject test input into context
      context.__test_input_args__ = parsedArgs;

      // Wrap user code: evaluate code, find entry function or evaluate return value
      const wrappedScript = `
        "use strict";
        let __result__;
        ${code}

        // Auto-detect entry function if defined (e.g. twoSum, solve, solution, or first defined function)
        const candidates = ['solution', 'solve', 'twoSum', 'reverseString', 'isPalindrome', 'maxSubArray', 'validParentheses'];
        let entryFunc = null;
        for (const name of candidates) {
          if (typeof this[name] === 'function') {
            entryFunc = this[name];
            break;
          }
        }
        if (!entryFunc) {
          // Find any user-defined global function
          const keys = Object.keys(this).filter(k => typeof this[k] === 'function' && !k.startsWith('__'));
          if (keys.length > 0) entryFunc = this[keys[keys.length - 1]];
        }

        if (entryFunc) {
          __result__ = entryFunc.apply(null, __test_input_args__);
        }
        __result__;
      `;

      const script = new vm.Script(wrappedScript);
      const executionResult = script.runInContext(context, {
        timeout: timeoutMs,
        displayErrors: true
      });

      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1e6;

      // Extract output
      if (executionResult !== undefined) {
        actualOutput = typeof executionResult === 'object' ? JSON.stringify(executionResult) : String(executionResult);
      } else if (logs.length > 0) {
        actualOutput = logs.join('\n');
      } else {
        actualOutput = 'undefined';
      }

      // Normalize comparison
      const normalize = (val) => {
        if (val === null || val === undefined) return '';
        const trimmed = String(val).trim();
        try {
          return JSON.stringify(JSON.parse(trimmed));
        } catch {
          return trimmed;
        }
      };

      const expectedNormalized = normalize(tc.expectedOutput);
      const actualNormalized = normalize(actualOutput);
      const passed = expectedNormalized === actualNormalized;

      if (passed) passedCount++;

      results.push({
        testId: tc.id || `test_${i + 1}`,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput,
        logs: logs.join('\n'),
        passed,
        executionTimeMs: Math.round(executionTimeMs * 100) / 100,
        isHidden: !!tc.isHidden
      });

    } catch (err) {
      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1e6;
      const isTimeout = err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT' || err.message.includes('timed out');

      results.push({
        testId: tc.id || `test_${i + 1}`,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: null,
        logs: logs.join('\n'),
        passed: false,
        error: isTimeout ? `Execution timed out after ${timeoutMs}ms (infinite loop protection)` : (err.message || String(err)),
        executionTimeMs: Math.round(executionTimeMs * 100) / 100,
        isHidden: !!tc.isHidden
      });
    }
  }

  return {
    passedCount,
    totalCount: testCases.length,
    allPassed: passedCount === testCases.length && testCases.length > 0,
    results
  };
}

// Microservice HTTP server if executed directly
if (require.main === module) {
  const PORT = process.env.PORT || 6000;
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/execute') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const { code, testCases, timeoutMs } = payload;
          if (!code) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Code is required' }));
          }
          const output = runInSandbox(code, testCases || [], { timeoutMs });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(output));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    } else if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', worker: 'CodeArena Sandbox Runner' }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  server.listen(PORT, () => {
    console.log(`[Execution Worker] Running isolated sandbox service on port ${PORT}`);
  });
}

module.exports = { runInSandbox };
