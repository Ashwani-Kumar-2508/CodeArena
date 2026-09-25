const vm = require('node:vm');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

/**
 * Sandboxed Multi-Language Code Executor for CodeArena.
 * Supports: JavaScript, Python, Java, C++, and C.
 * Enforces per-language timeouts, isolated execution, output normalization,
 * and test case evaluation.
 */

function normalizeOutput(val) {
  if (val === null || val === undefined) return '';
  const trimmed = String(val).trim();
  try {
    return JSON.stringify(JSON.parse(trimmed));
  } catch {
    return trimmed;
  }
}

/**
 * 1. JavaScript Runner (In-Memory VM Context)
 */
function runJavaScript(code, testCases = [], options = {}) {
  const timeoutMs = options.timeoutMs || 3000;
  const maxOutputBytes = 50000;
  const results = [];
  let passedCount = 0;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const logs = [];
    let actualOutput = null;
    const startTime = process.hrtime.bigint();

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

    const sandbox = {
      console: sandboxConsole,
      JSON, Math, Date, Array, Object, String, Number, Boolean, RegExp, Map, Set,
      parseInt, parseFloat, isNaN, isFinite
    };

    const context = vm.createContext(sandbox);

    try {
      let parsedArgs = [];
      if (tc.input !== undefined && tc.input !== null && tc.input !== '') {
        try {
          const parsed = JSON.parse(tc.input);
          parsedArgs = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          parsedArgs = [tc.input];
        }
      }

      context.__test_input_args__ = parsedArgs;

      const wrappedScript = `
        "use strict";
        let __result__;
        ${code}

        const candidates = ['solution', 'solve', 'twoSum', 'reverseString', 'isPalindrome', 'maxSubArray', 'validParentheses', 'merge', 'coinChange', 'maxPathSum', 'trap'];
        let entryFunc = null;
        for (const name of candidates) {
          if (typeof this[name] === 'function') {
            entryFunc = this[name];
            break;
          }
        }
        if (!entryFunc) {
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

      if (executionResult !== undefined) {
        actualOutput = typeof executionResult === 'object' ? JSON.stringify(executionResult) : String(executionResult);
      } else if (logs.length > 0) {
        actualOutput = logs.join('\n');
      } else {
        actualOutput = 'undefined';
      }

      const passed = normalizeOutput(tc.expectedOutput) === normalizeOutput(actualOutput);
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

/**
 * 2. Python Runner
 */
function runPython(code, testCases = [], options = {}) {
  const timeoutMs = options.timeoutMs || 4000;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codearena_py_'));
  const results = [];
  let passedCount = 0;

  try {
    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const harnessScript = `
import sys, json

# Candidate solution code:
${code}

def __run_test():
    test_input_raw = ${JSON.stringify(tc.input || '')}
    args = []
    if test_input_raw:
        try:
            parsed = json.loads(test_input_raw)
            args = parsed if isinstance(parsed, list) else [parsed]
        except Exception:
            args = [test_input_raw]

    # Find entry function
    func_names = ['twoSum', 'solve', 'solution', 'reverseString', 'isPalindrome', 'maxSubArray', 'validParentheses', 'merge', 'coinChange', 'maxPathSum', 'trap']
    target_func = None
    
    # Check if Solution class exists
    if 'Solution' in globals() and isinstance(globals()['Solution'], type):
        inst = globals()['Solution']()
        for name in func_names:
            if hasattr(inst, name) and callable(getattr(inst, name)):
                target_func = getattr(inst, name)
                break
        if not target_func:
            methods = [getattr(inst, m) for m in dir(inst) if not m.startswith('_') and callable(getattr(inst, m))]
            if methods:
                target_func = methods[0]

    if not target_func:
        for name in func_names:
            if name in globals() and callable(globals()[name]):
                target_func = globals()[name]
                break

    if not target_func:
        user_funcs = [v for k, v in list(globals().items()) if callable(v) and not k.startswith('_') and k != '__run_test']
        if user_funcs:
            target_func = user_funcs[-1]

    if target_func:
        res = target_func(*args)
        print("__CA_RES__:" + json.dumps(res))
    else:
        print("__CA_NO_FUNC__")

if __name__ == '__main__':
    __run_test()
`;

      const scriptPath = path.join(tempDir, `test_${i}.py`);
      fs.writeFileSync(scriptPath, harnessScript, 'utf8');

      const startTime = process.hrtime.bigint();
      const proc = spawnSync('python', [scriptPath], {
        timeout: timeoutMs,
        maxBuffer: 1024 * 512,
        encoding: 'utf8'
      });
      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1e6;

      let actualOutput = null;
      let error = null;
      let logs = '';

      if (proc.error) {
        if (proc.error.code === 'ETIMEDOUT') {
          error = `Execution timed out after ${timeoutMs}ms (infinite loop protection)`;
        } else {
          error = proc.error.message;
        }
      } else if (proc.status !== 0) {
        error = proc.stderr ? proc.stderr.trim() : `Process exited with error code ${proc.status}`;
      } else {
        const stdout = proc.stdout || '';
        const lines = stdout.split('\n');
        const resLine = lines.find(l => l.startsWith('__CA_RES__:'));
        if (resLine) {
          actualOutput = resLine.substring('__CA_RES__:'.length).trim();
          logs = lines.filter(l => !l.startsWith('__CA_RES__:')).join('\n').trim();
        } else if (stdout.includes('__CA_NO_FUNC__')) {
          error = 'No callable entry function found in Python script';
        } else {
          actualOutput = stdout.trim();
        }
      }

      const passed = !error && normalizeOutput(tc.expectedOutput) === normalizeOutput(actualOutput);
      if (passed) passedCount++;

      results.push({
        testId: tc.id || `test_${i + 1}`,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput,
        logs,
        passed,
        error,
        executionTimeMs: Math.round(executionTimeMs * 100) / 100,
        isHidden: !!tc.isHidden
      });
    }
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }

  return {
    passedCount,
    totalCount: testCases.length,
    allPassed: passedCount === testCases.length && testCases.length > 0,
    results
  };
}

/**
 * 3. Java Runner
 */
function runJava(code, testCases = [], options = {}) {
  const timeoutMs = options.timeoutMs || 5000;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codearena_java_'));
  const results = [];
  let passedCount = 0;

  try {
    // Determine whether code already contains class Solution or main
    let javaSource = code;
    const hasClass = /class\s+Solution/m.test(code);
    const hasMain = /public\s+static\s+void\s+main/m.test(code);

    if (!hasClass && !hasMain) {
      javaSource = `
import java.util.*;
import java.io.*;

public class Solution {
    ${code}
}
`;
    }

    const srcPath = path.join(tempDir, 'Solution.java');
    fs.writeFileSync(srcPath, javaSource, 'utf8');

    // Compile Java file
    const compileProc = spawnSync('javac', ['Solution.java'], {
      cwd: tempDir,
      timeout: 8000,
      encoding: 'utf8'
    });

    if (compileProc.status !== 0) {
      const compileErr = compileProc.stderr || compileProc.stdout || 'Java compilation failed';
      for (let i = 0; i < testCases.length; i++) {
        results.push({
          testId: testCases[i].id || `test_${i + 1}`,
          input: testCases[i].input,
          expectedOutput: testCases[i].expectedOutput,
          actualOutput: null,
          passed: false,
          error: `Compilation Error:\n${compileErr.trim()}`,
          executionTimeMs: 0,
          isHidden: !!testCases[i].isHidden
        });
      }
      return { passedCount: 0, totalCount: testCases.length, allPassed: false, results };
    }

    // Execute test cases
    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const startTime = process.hrtime.bigint();

      const runProc = spawnSync('java', ['-cp', '.', 'Solution'], {
        cwd: tempDir,
        input: tc.input || '',
        timeout: timeoutMs,
        encoding: 'utf8'
      });

      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1e6;

      let actualOutput = null;
      let error = null;

      if (runProc.error) {
        error = runProc.error.code === 'ETIMEDOUT' ? `Execution timed out after ${timeoutMs}ms` : runProc.error.message;
      } else if (runProc.status !== 0) {
        error = runProc.stderr ? runProc.stderr.trim() : `Runtime error (exit ${runProc.status})`;
      } else {
        actualOutput = (runProc.stdout || '').trim();
      }

      const passed = !error && normalizeOutput(tc.expectedOutput) === normalizeOutput(actualOutput);
      if (passed) passedCount++;

      results.push({
        testId: tc.id || `test_${i + 1}`,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput,
        passed,
        error,
        executionTimeMs: Math.round(executionTimeMs * 100) / 100,
        isHidden: !!tc.isHidden
      });
    }

  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }

  return {
    passedCount,
    totalCount: testCases.length,
    allPassed: passedCount === testCases.length && testCases.length > 0,
    results
  };
}

/**
 * 4. C++ / C Runner
 */
function runCompiledNative(code, testCases = [], options = {}, isCpp = true) {
  const timeoutMs = options.timeoutMs || 4000;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), isCpp ? 'codearena_cpp_' : 'codearena_c_'));
  const srcFile = isCpp ? 'solution.cpp' : 'solution.c';
  const binFile = process.platform === 'win32' ? 'solution.exe' : './solution';
  const results = [];
  let passedCount = 0;

  try {
    const srcPath = path.join(tempDir, srcFile);
    fs.writeFileSync(srcPath, code, 'utf8');

    const compiler = isCpp ? 'g++' : 'gcc';
    const compileArgs = isCpp ? ['-O2', '-std=c++17', srcFile, '-o', 'solution.exe'] : ['-O2', srcFile, '-o', 'solution.exe'];

    const compileProc = spawnSync(compiler, compileArgs, {
      cwd: tempDir,
      timeout: 8000,
      encoding: 'utf8'
    });

    if (compileProc.status !== 0) {
      const compileErr = compileProc.stderr || compileProc.stdout || 'Compilation failed';
      for (let i = 0; i < testCases.length; i++) {
        results.push({
          testId: testCases[i].id || `test_${i + 1}`,
          input: testCases[i].input,
          expectedOutput: testCases[i].expectedOutput,
          actualOutput: null,
          passed: false,
          error: `Compilation Error:\n${compileErr.trim()}`,
          executionTimeMs: 0,
          isHidden: !!testCases[i].isHidden
        });
      }
      return { passedCount: 0, totalCount: testCases.length, allPassed: false, results };
    }

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const startTime = process.hrtime.bigint();

      const runProc = spawnSync(path.join(tempDir, binFile), [], {
        cwd: tempDir,
        input: tc.input || '',
        timeout: timeoutMs,
        encoding: 'utf8'
      });

      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1e6;

      let actualOutput = null;
      let error = null;

      if (runProc.error) {
        error = runProc.error.code === 'ETIMEDOUT' ? `Execution timed out after ${timeoutMs}ms` : runProc.error.message;
      } else if (runProc.status !== 0) {
        error = runProc.stderr ? runProc.stderr.trim() : `Runtime error (exit ${runProc.status})`;
      } else {
        actualOutput = (runProc.stdout || '').trim();
      }

      const passed = !error && normalizeOutput(tc.expectedOutput) === normalizeOutput(actualOutput);
      if (passed) passedCount++;

      results.push({
        testId: tc.id || `test_${i + 1}`,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput,
        passed,
        error,
        executionTimeMs: Math.round(executionTimeMs * 100) / 100,
        isHidden: !!tc.isHidden
      });
    }

  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }

  return {
    passedCount,
    totalCount: testCases.length,
    allPassed: passedCount === testCases.length && testCases.length > 0,
    results
  };
}

/**
 * Dispatcher for sandboxed execution across all supported languages
 */
function runInSandbox(code, testCases = [], options = {}) {
  const language = (options.language || 'javascript').toLowerCase();

  if (language === 'python' || language === 'py') {
    return runPython(code, testCases, options);
  } else if (language === 'java') {
    return runJava(code, testCases, options);
  } else if (language === 'cpp' || language === 'c++') {
    return runCompiledNative(code, testCases, options, true);
  } else if (language === 'c') {
    return runCompiledNative(code, testCases, options, false);
  } else {
    // Default to JavaScript
    return runJavaScript(code, testCases, options);
  }
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
          const { code, testCases, language, timeoutMs } = payload;
          if (!code) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Code is required' }));
          }
          const output = runInSandbox(code, testCases || [], { language, timeoutMs });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(output));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    } else if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', worker: 'CodeArena Multi-Language Sandbox Runner' }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  server.listen(PORT, () => {
    console.log(`[Execution Worker] Running multi-language sandbox service on port ${PORT}`);
  });
}

module.exports = {
  runInSandbox,
  runJavaScript,
  runPython,
  runJava,
  runCompiledNative
};
