const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting CodeArena database seeding...');

  // Hash demo password (Password123!)
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Password123!', salt);

  // 1. Create Core Users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@codearena.dev' },
    update: { passwordHash, isVerified: true },
    create: {
      email: 'admin@codearena.dev',
      name: 'Devon Vance (Admin)',
      passwordHash,
      role: 'ADMIN',
      isVerified: true
    }
  });

  const interviewer = await prisma.user.upsert({
    where: { email: 'interviewer@codearena.dev' },
    update: { passwordHash, isVerified: true },
    create: {
      email: 'interviewer@codearena.dev',
      name: 'Sarah Connor (Staff Engineer)',
      passwordHash,
      role: 'INTERVIEWER',
      isVerified: true
    }
  });

  const candidate = await prisma.user.upsert({
    where: { email: 'candidate@codearena.dev' },
    update: { passwordHash, isVerified: true },
    create: {
      email: 'candidate@codearena.dev',
      name: 'Alex Rivera (Candidate)',
      passwordHash,
      role: 'CANDIDATE',
      isVerified: true
    }
  });

  console.log('✅ Verified core accounts (admin, interviewer, candidate)');

  // 2. Comprehensive Question Catalog
  const questionsData = [
    // -------------------------------------------------------------
    // CODING QUESTIONS
    // -------------------------------------------------------------
    {
      id: '00000000-0000-0000-0000-000000000001',
      title: 'Two Sum',
      category: 'ARRAYS',
      type: 'CODING',
      difficulty: 'EASY',
      tags: ['Arrays', 'Hash Map', 'Two Pointer'],
      supportedLanguages: ['javascript', 'python', 'java'],
      starterCode: {
        javascript: `/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nfunction twoSum(nums, target) {\n  const map = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const comp = target - nums[i];\n    if (map.has(comp)) return [map.get(comp), i];\n    map.set(nums[i], i);\n  }\n  return [];\n}`,
        python: `def twoSum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        diff = target - n\n        if diff in seen:\n            return [seen[diff], i]\n        seen[n] = i\n    return []`,
        java: `import java.util.*;\npublic class Solution {\n    public static int[] twoSum(int[] nums, int target) {\n        Map<Integer, Integer> map = new HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            int diff = target - nums[i];\n            if (map.containsKey(diff)) return new int[]{map.get(diff), i};\n            map.put(nums[i], i);\n        }\n        return new int[]{};\n    }\n}`
      },
      defaultCodeSnippet: `function twoSum(nums, target) {\n  const map = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const comp = target - nums[i];\n    if (map.has(comp)) return [map.get(comp), i];\n    map.set(nums[i], i);\n  }\n  return [];\n}`,
      description: `### Problem Description\nGiven an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.\n\nYou may assume that each input would have **exactly one solution**, and you may not use the same element twice.`,
      constraints: `2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9\nOnly one valid answer exists.`,
      hints: [
        'A brute force approach checks all pairs in O(n^2) time. Can we use a hash map to do it in O(n)?',
        'Store the seen numbers and their indices as you iterate through the array.'
      ],
      testCases: [
        { input: '[[2,7,11,15], 9]', expectedOutput: '[0,1]', isHidden: false, explanation: 'nums[0] + nums[1] = 2 + 7 = 9' },
        { input: '[[3,2,4], 6]', expectedOutput: '[1,2]', isHidden: false, explanation: 'nums[1] + nums[2] = 2 + 4 = 6' },
        { input: '[[3,3], 6]', expectedOutput: '[0,1]', isHidden: true, explanation: 'Duplicate number handling' },
        { input: '[[-1,-2,-3,-4,-5], -8]', expectedOutput: '[2,4]', isHidden: true, explanation: 'Negative numbers handling' }
      ]
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      title: 'Valid Parentheses',
      category: 'STACK_QUEUE',
      type: 'CODING',
      difficulty: 'EASY',
      tags: ['Stack', 'Strings'],
      supportedLanguages: ['javascript', 'python', 'java'],
      starterCode: {
        javascript: `function validParentheses(s) {\n  const stack = [];\n  const pairs = { ')': '(', '}': '{', ']': '[' };\n  for (const c of s) {\n    if (c === '(' || c === '{' || c === '[') {\n      stack.push(c);\n    } else if (stack.pop() !== pairs[c]) {\n      return false;\n    }\n  }\n  return stack.length === 0;\n}`,
        python: `def validParentheses(s):\n    stack = []\n    pairs = {')': '(', '}': '{', ']': '['}\n    for c in s:\n        if c in '({[':\n            stack.append(c)\n        elif not stack or stack.pop() != pairs.get(c):\n            return False\n    return len(stack) == 0`,
        java: `import java.util.*;\npublic class Solution {\n    public static boolean validParentheses(String s) {\n        Stack<Character> stack = new Stack<>();\n        for (char c : s.toCharArray()) {\n            if (c == '(') stack.push(')');\n            else if (c == '{') stack.push('}');\n            else if (c == '[') stack.push(']');\n            else if (stack.isEmpty() || stack.pop() != c) return false;\n        }\n        return stack.isEmpty();\n    }\n}`
      },
      defaultCodeSnippet: `function validParentheses(s) {\n  const stack = [];\n  const pairs = { ')': '(', '}': '{', ']': '[' };\n  for (const c of s) {\n    if (c === '(' || c === '{' || c === '[') {\n      stack.push(c);\n    } else if (stack.pop() !== pairs[c]) {\n      return false;\n    }\n  }\n  return stack.length === 0;\n}`,
      description: `### Problem Description\nGiven a string \`s\` containing just the characters \`'(' \`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.\n\nAn input string is valid if open brackets are closed by the same type of brackets in the correct order.`,
      constraints: `1 <= s.length <= 10^4\ns consists of parentheses only '()[]{}'.`,
      hints: ['Use a last-in-first-out stack structure to match open and closing symbols.'],
      testCases: [
        { input: '["()"]', expectedOutput: 'true', isHidden: false },
        { input: '["()[]{}"]', expectedOutput: 'true', isHidden: false },
        { input: '["(]"]', expectedOutput: 'false', isHidden: false },
        { input: '["([)]"]', expectedOutput: 'false', isHidden: true },
        { input: '["{[]}"]', expectedOutput: 'true', isHidden: true }
      ]
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      title: 'LRU Cache Design',
      category: 'HASHING',
      type: 'CODING',
      difficulty: 'MEDIUM',
      tags: ['Hash Map', 'Doubly Linked List', 'Design'],
      supportedLanguages: ['javascript', 'python', 'java'],
      starterCode: {
        javascript: `function solve(ops, vals) {\n  const capacity = vals[0][0];\n  const cache = new Map();\n  const res = [];\n  for (let i = 1; i < ops.length; i++) {\n    if (ops[i] === 'put') {\n      const [k, v] = vals[i];\n      if (cache.has(k)) cache.delete(k);\n      else if (cache.size >= capacity) cache.delete(cache.keys().next().value);\n      cache.set(k, v);\n      res.push(null);\n    } else if (ops[i] === 'get') {\n      const [k] = vals[i];\n      if (!cache.has(k)) { res.push(-1); } else {\n        const val = cache.get(k);\n        cache.delete(k);\n        cache.set(k, val);\n        res.push(val);\n      }\n    }\n  }\n  return res;\n}`,
        python: `def solve(ops, vals):\n    from collections import OrderedDict\n    cap = vals[0][0]\n    cache = OrderedDict()\n    res = []\n    for op, val in zip(ops[1:], vals[1:]):\n        if op == 'put':\n            k, v = val\n            if k in cache: cache.move_to_end(k)\n            elif len(cache) >= cap: cache.popitem(last=False)\n            cache[k] = v\n            res.push(None) if hasattr(res, 'push') else res.append(None)\n        elif op == 'get':\n            k = val[0]\n            if k not in cache: res.append(-1)\n            else:\n                cache.move_to_end(k)\n                res.append(cache[k])\n    return res`,
        java: `import java.util.*;\npublic class Solution {\n    // Implement LRU Cache\n}`
      },
      defaultCodeSnippet: `function solve(ops, vals) {\n  // LRU Cache evaluation harness\n}`,
      description: `### Problem Description\nDesign a data structure that follows the constraints of a **Least Recently Used (LRU) cache** with O(1) average time complexity for both \`get\` and \`put\`.`,
      constraints: `1 <= capacity <= 3000\n0 <= key <= 10^4\n0 <= value <= 10^5\nAt most 2 * 10^5 calls to get and put.`,
      hints: ['A Hash Map combined with a Doubly Linked List enables O(1) lookups and O(1) head/tail evictions.'],
      testCases: [
        { input: '[["LRUCache","put","put","get","put","get","put","get","get","get"], [[2],[1,1],[2,2],[1],[3,3],[2],[4,4],[1],[3],[4]]]', expectedOutput: '[null,null,1,null,-1,null,-1,3,4]', isHidden: false },
        { input: '[["LRUCache","get","put","get"], [[1],[0],[0,0],[0]]]', expectedOutput: '[-1,null,0]', isHidden: true }
      ]
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      title: 'Merge Intervals',
      category: 'SORTING_SEARCHING',
      type: 'CODING',
      difficulty: 'MEDIUM',
      tags: ['Arrays', 'Sorting'],
      supportedLanguages: ['javascript', 'python', 'java'],
      starterCode: {
        javascript: `function merge(intervals) {\n  if (!intervals.length) return [];\n  intervals.sort((a, b) => a[0] - b[0]);\n  const res = [intervals[0]];\n  for (let i = 1; i < intervals.length; i++) {\n    const curr = intervals[i];\n    const last = res[res.length - 1];\n    if (curr[0] <= last[1]) {\n      last[1] = Math.max(last[1], curr[1]);\n    } else {\n      res.push(curr);\n    }\n  }\n  return res;\n}`,
        python: `def merge(intervals):\n    intervals.sort(key=lambda x: x[0])\n    merged = []\n    for interval in intervals:\n        if not merged or merged[-1][1] < interval[0]:\n            merged.append(interval)\n        else:\n            merged[-1][1] = max(merged[-1][1], interval[1])\n    return merged`,
        java: `import java.util.*;\npublic class Solution {\n    // Merge intervals\n}`
      },
      defaultCodeSnippet: `function merge(intervals) {\n  // Implementation\n}`,
      description: `### Problem Description\nGiven an array of \`intervals\` where \`intervals[i] = [starti, endi]\`, merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.`,
      constraints: `1 <= intervals.length <= 10^4\nintervals[i].length == 2\n0 <= starti <= endi <= 10^4`,
      hints: ['Sort the intervals by their start times first.'],
      testCases: [
        { input: '[[[1,3],[2,6],[8,10],[15,18]]]', expectedOutput: '[[1,6],[8,10],[15,18]]', isHidden: false },
        { input: '[[[1,4],[4,5]]]', expectedOutput: '[[1,5]]', isHidden: false },
        { input: '[[[1,4],[0,4]]]', expectedOutput: '[[0,4]]', isHidden: true }
      ]
    },
    {
      id: '00000000-0000-0000-0000-000000000005',
      title: 'Coin Change',
      category: 'DYNAMIC_PROGRAMMING',
      type: 'CODING',
      difficulty: 'MEDIUM',
      tags: ['Dynamic Programming', 'BFS'],
      supportedLanguages: ['javascript', 'python', 'java'],
      starterCode: {
        javascript: `function coinChange(coins, amount) {\n  const dp = new Array(amount + 1).fill(Infinity);\n  dp[0] = 0;\n  for (let i = 1; i <= amount; i++) {\n    for (const c of coins) {\n      if (i - c >= 0) dp[i] = Math.min(dp[i], dp[i - c] + 1);\n    }\n  }\n  return dp[amount] === Infinity ? -1 : dp[amount];\n}`,
        python: `def coinChange(coins, amount):\n    dp = [float('inf')] * (amount + 1)\n    dp[0] = 0\n    for i in range(1, amount + 1):\n        for c in coins:\n            if i - c >= 0:\n                dp[i] = min(dp[i], dp[i - c] + 1)\n    return dp[amount] if dp[amount] != float('inf') else -1`,
        java: `import java.util.*;\npublic class Solution {\n    // DP implementation\n}`
      },
      defaultCodeSnippet: `function coinChange(coins, amount) {\n  // Implementation\n}`,
      description: `### Problem Description\nYou are given an integer array \`coins\` representing coins of different denominations and an integer \`amount\` representing a total amount of money.\n\nReturn the fewest number of coins that you need to make up that amount. If that amount of money cannot be made up by any combination of the coins, return \`-1\`.`,
      constraints: `1 <= coins.length <= 12\n1 <= coins[i] <= 2^31 - 1\n0 <= amount <= 10^4`,
      hints: ['Let dp[i] represent the minimum coins needed to make amount i.'],
      testCases: [
        { input: '[[1,2,5], 11]', expectedOutput: '3', isHidden: false, explanation: '11 = 5 + 5 + 1' },
        { input: '[[2], 3]', expectedOutput: '-1', isHidden: false },
        { input: '[[1], 0]', expectedOutput: '0', isHidden: false },
        { input: '[[1,3,4,5], 7]', expectedOutput: '2', isHidden: true, explanation: '7 = 3 + 4' }
      ]
    },
    {
      id: '00000000-0000-0000-0000-000000000006',
      title: 'Trapping Rain Water',
      category: 'ARRAYS',
      type: 'CODING',
      difficulty: 'HARD',
      tags: ['Two Pointer', 'Dynamic Programming', 'Stack'],
      supportedLanguages: ['javascript', 'python', 'java'],
      starterCode: {
        javascript: `function trap(height) {\n  let left = 0, right = height.length - 1;\n  let leftMax = 0, rightMax = 0, total = 0;\n  while (left < right) {\n    if (height[left] < height[right]) {\n      if (height[left] >= leftMax) leftMax = height[left];\n      else total += leftMax - height[left];\n      left++;\n    } else {\n      if (height[right] >= rightMax) rightMax = height[right];\n      else total += rightMax - height[right];\n      right--;\n    }\n  }\n  return total;\n}`,
        python: `def trap(height):\n    left, right = 0, len(height) - 1\n    left_max, right_max = 0, 0\n    total = 0\n    while left < right:\n        if height[left] < height[right]:\n            if height[left] >= left_max: left_max = height[left]\n            else: total += left_max - height[left]\n            left += 1\n        else:\n            if height[right] >= right_max: right_max = height[right]\n            else: total += right_max - height[right]\n            right -= 1\n    return total`,
        java: `public class Solution {\n    // Two-pointer water trapping\n}`
      },
      defaultCodeSnippet: `function trap(height) {\n  // Implementation\n}`,
      description: `### Problem Description\nGiven \`n\` non-negative integers representing an elevation map where the width of each bar is \`1\`, compute how much water it can trap after raining.`,
      constraints: `n == height.length\n1 <= n <= 2 * 10^4\n0 <= height[i] <= 10^5`,
      hints: ['A two-pointer approach maintains leftMax and rightMax to compute trapped water in O(1) auxiliary space.'],
      testCases: [
        { input: '[[0,1,0,2,1,0,1,3,2,1,2,1]]', expectedOutput: '6', isHidden: false },
        { input: '[[4,2,0,3,2,5]]', expectedOutput: '9', isHidden: false },
        { input: '[[3,0,2,0,4]]', expectedOutput: '7', isHidden: true }
      ]
    },

    // -------------------------------------------------------------
    // TECHNICAL QUESTIONS (Discussion & Concepts)
    // -------------------------------------------------------------
    {
      id: '00000000-0000-0000-0000-000000000007',
      title: 'Operating Systems: Virtual Memory, Paging, and TLB',
      category: 'OS',
      type: 'TECHNICAL',
      difficulty: 'MEDIUM',
      tags: ['Operating Systems', 'Memory', 'Paging', 'TLB'],
      description: `### Technical Discussion Topic\n1. Explain the mechanism of virtual memory and how page tables map virtual addresses to physical frames.\n2. What is a Translation Lookaside Buffer (TLB), and how does a TLB miss impact CPU performance?\n3. Walk through the exact steps of a **Page Fault** handled by the OS kernel.`,
      rubric: {
        level1: 'Mentions RAM and disk, but lacks clear understanding of page tables or MMU.',
        level3: 'Accurately explains virtual-to-physical mapping, page tables, page faults, and swapping.',
        level5: 'Exceptional depth: explains multi-level page tables, inverted tables, TLB shootdown, demand paging, and page replacement policies (LRU, Clock).'
      },
      hints: ['Consider what happens when the requested page is not in physical memory (valid bit is 0).']
    },
    {
      id: '00000000-0000-0000-0000-000000000008',
      title: 'Database Indexing: B+ Trees vs Hash Indexes & ACID Isolation',
      category: 'DATABASE',
      type: 'TECHNICAL',
      difficulty: 'MEDIUM',
      tags: ['Databases', 'Indexing', 'ACID', 'Transactions'],
      description: `### Technical Discussion Topic\n1. Contrast B+ Tree indexes with Hash indexes. Why do relational databases (PostgreSQL, MySQL) default to B+ Trees?\n2. Detail the four ANSI SQL Isolation Levels (Read Uncommitted, Read Committed, Repeatable Read, Serializable) and the anomalies they mitigate (Dirty Read, Non-repeatable Read, Phantom Read).\n3. How does Multi-Version Concurrency Control (MVCC) eliminate read-write locking conflicts?`,
      rubric: {
        level1: 'Understands basic index concepts; confused about isolation levels and locks.',
        level3: 'Explains range query support in B+ Trees; distinguishes phantom reads from non-repeatable reads.',
        level5: 'Deep grasp of write amplification, vacuuming in MVCC, write skew anomalies in Repeatable Read, and snapshot isolation.'
      },
      hints: ['Think about range scan queries like WHERE age BETWEEN 20 AND 30.']
    },
    {
      id: '00000000-0000-0000-0000-000000000009',
      title: 'Computer Networks: TCP 3-Way Handshake, Flow Control, and Congestion Control',
      category: 'NETWORKING',
      type: 'TECHNICAL',
      difficulty: 'EASY',
      tags: ['Networking', 'TCP', 'UDP', 'Protocols'],
      description: `### Technical Discussion Topic\n1. Explain the TCP 3-Way Handshake (SYN, SYN-ACK, ACK) and 4-Way Teardown (FIN, ACK, FIN, ACK).\n2. What is the difference between TCP Flow Control (Sliding Window) and Congestion Control (Slow Start, Congestion Avoidance, Fast Retransmit)?\n3. Why is WebRTC using UDP as its transport protocol for audio and video instead of TCP?`,
      rubric: {
        level3: 'Accurately describes packet sequences, window sizes, and transport trade-offs.'
      },
      hints: ['In real-time audio/video, is retransmitting a dropped packet 300ms later useful?']
    },
    {
      id: '00000000-0000-0000-0000-000000000010',
      title: 'OOP & Architecture: SOLID Principles & Decoupled Architecture',
      category: 'OOP',
      type: 'TECHNICAL',
      difficulty: 'EASY',
      tags: ['OOP', 'Design Patterns', 'Architecture', 'Clean Code'],
      description: `### Technical Discussion Topic\nExplain each of the **SOLID** design principles with real-world software engineering examples:\n- Single Responsibility Principle (SRP)\n- Open/Closed Principle (OCP)\n- Liskov Substitution Principle (LSP)\n- Interface Segregation Principle (ISP)\n- Dependency Inversion Principle (DIP)`,
      rubric: {
        level3: 'Can clearly define each principle and illustrate with realistic object models.'
      }
    },

    // -------------------------------------------------------------
    // SYSTEM DESIGN QUESTIONS
    // -------------------------------------------------------------
    {
      id: '00000000-0000-0000-0000-000000000011',
      title: 'System Design: Scalable URL Shortener (TinyURL)',
      category: 'SYSTEM_DESIGN',
      type: 'SYSTEM_DESIGN',
      difficulty: 'MEDIUM',
      tags: ['System Design', 'Scalability', 'Hashing', 'Caching'],
      description: `### System Design Challenge\nDesign a distributed URL shortening service like TinyURL or Bitly.\n\n#### Functional Requirements:\n1. Given a long URL, generate a shorter and unique alias (e.g. \`https://tiny.cc/aB9x1\`).\n2. Redirect users accessing the short alias to the original long URL with sub-50ms latency.\n3. Custom aliases and URL expiration.\n\n#### Non-Functional Requirements:\n1. 100 million new URLs generated per month; 10:1 read-to-write ratio.\n2. High availability (99.99%) and low read latency.\n3. Safe from brute-force enumeration and hash collisions.`,
      hints: ['Base62 encoding vs MD5 hash truncation; Pre-generating keys using a Key Generation Service (KGS).']
    },
    {
      id: '00000000-0000-0000-0000-000000000012',
      title: 'System Design: Distributed Rate Limiter',
      category: 'SYSTEM_DESIGN',
      type: 'SYSTEM_DESIGN',
      difficulty: 'MEDIUM',
      tags: ['System Design', 'Rate Limiting', 'Redis', 'Distributed Systems'],
      description: `### System Design Challenge\nDesign a distributed API Rate Limiter to protect internal microservices from denial-of-service traffic and quota abuse.\n\n#### Requirements:\n1. Support user-level and IP-level limits (e.g. 100 requests/minute per client).\n2. Sub-millisecond decision overhead.\n3. Discuss algorithms: Token Bucket, Leaky Bucket, Fixed Window, Sliding Window Log, Sliding Window Counter.\n4. Handle synchronization across multiple API gateway nodes using Redis and Lua scripting.`,
      hints: ['Lua scripts in Redis guarantee atomic check-and-increment operations without multi-client race conditions.']
    },
    {
      id: '00000000-0000-0000-0000-000000000013',
      title: 'System Design: Multi-Channel Real-Time Notification Service',
      category: 'SYSTEM_DESIGN',
      type: 'SYSTEM_DESIGN',
      difficulty: 'HARD',
      tags: ['System Design', 'Message Queues', 'Kafka', 'WebSockets'],
      description: `### System Design Challenge\nDesign a global notification system capable of sending billions of events per day across Push notifications (APNS, FCM), SMS, Email, and in-app WebSockets.\n\n#### Requirements:\n1. Decoupled producer services via distributed message queues (Apache Kafka/RabbitMQ).\n2. Rate-limiting, user notification preferences, and deduplication.\n3. Dead-letter queues (DLQ) and retry policies for downstream vendor outages.`,
      hints: ['Partition messages by user ID in Kafka to guarantee ordered processing per user.']
    },
    {
      id: '00000000-0000-0000-0000-000000000014',
      title: 'System Design: Distributed Key-Value Store with Consistent Hashing',
      category: 'SYSTEM_DESIGN',
      type: 'SYSTEM_DESIGN',
      difficulty: 'HARD',
      tags: ['System Design', 'Consistent Hashing', 'Replication', 'CAP Theorem'],
      description: `### System Design Challenge\nDesign a distributed key-value storage engine modeled after Amazon DynamoDB or Apache Cassandra.\n\n#### Requirements:\n1. Partitioning and data distribution using a **Consistent Hashing Ring** with virtual nodes.\n2. Configurable consistency (Quorum consensus: N, R, W).\n3. Gossip protocol for failure detection and anti-entropy with Merkle trees.`,
      hints: ['Virtual nodes prevent hot-spotting when nodes have heterogeneous capacity.']
    },

    // -------------------------------------------------------------
    // BEHAVIORAL QUESTIONS
    // -------------------------------------------------------------
    {
      id: '00000000-0000-0000-0000-000000000015',
      title: 'Behavioral: Resolving Technical Disagreements in High-Stakes Situations',
      category: 'BEHAVIORAL',
      type: 'BEHAVIORAL',
      difficulty: 'MEDIUM',
      tags: ['Communication', 'Leadership', 'Teamwork'],
      description: `### Behavioral Scenario\nDescribe a situation where you had a strong technical disagreement with a teammate or technical lead regarding system architecture, library adoption, or implementation.\n\n- How did you approach the disagreement?\n- What data, benchmarks, or prototypes did you use to evaluate alternatives?\n- What was the outcome, and how did you maintain team cohesion?`,
      rubric: {
        level1: 'Complains about the colleague or forced their way without objective evaluation.',
        level3: 'Used structured trade-off matrices and prototypes to make an objective decision; committed to the team consensus.',
        level5: 'Exemplifies egoless engineering: explains trade-offs with empathy, articulates opposing viewpoints clearly, and focuses entirely on project impact.'
      }
    },
    {
      id: '00000000-0000-0000-0000-000000000016',
      title: 'Behavioral: Production Outage Post-Mortem & Blameless Ownership',
      category: 'BEHAVIORAL',
      type: 'BEHAVIORAL',
      difficulty: 'HARD',
      tags: ['Ownership', 'Problem Solving', 'Resilience'],
      description: `### Behavioral Scenario\nTell me about a time a software change you released caused a critical failure, regression, or production incident.\n\n- What was the failure mode and impact?\n- How did you triage, mitigate, and communicate during the incident?\n- How did you conduct the post-mortem to ensure systemic prevention rather than blaming individuals?`,
      rubric: {
        level3: 'Takes responsibility, explains containment steps, and highlights automated tests/monitoring added.'
      }
    },
    {
      id: '00000000-0000-0000-0000-000000000017',
      title: 'Behavioral: Delivering High-Impact Engineering Under Ambiguity',
      category: 'BEHAVIORAL',
      type: 'BEHAVIORAL',
      difficulty: 'MEDIUM',
      tags: ['Initiative', 'Ambiguity', 'Adaptability'],
      description: `### Behavioral Scenario\nDescribe a project where requirements were vague or rapidly changing.\n\n- How did you break down the problem and identify critical milestones?\n- How did you align stakeholders and prioritize the MVP?`,
      rubric: {
        level3: 'Demonstrates strong customer focus and pragmatic incremental delivery.'
      }
    },

    // -------------------------------------------------------------
    // MCQ QUESTIONS (Options & Strictly Hidden Answers)
    // -------------------------------------------------------------
    {
      id: '00000000-0000-0000-0000-000000000018',
      title: 'MCQ: Asymptotic Time Complexity of Quicksort',
      category: 'SORTING_SEARCHING',
      type: 'MCQ',
      difficulty: 'EASY',
      tags: ['Algorithms', 'Complexity', 'Sorting'],
      description: `What are the best-case, average-case, and worst-case time complexities of standard Lomuto/Hoare Quicksort without randomized pivots?`,
      options: [
        'Best: O(n log n), Average: O(n log n), Worst: O(n^2)',
        'Best: O(n), Average: O(n log n), Worst: O(n log n)',
        'Best: O(1), Average: O(n), Worst: O(n^2)',
        'Best: O(n log n), Average: O(n^2), Worst: O(n^2)'
      ],
      correctAnswer: 'Best: O(n log n), Average: O(n log n), Worst: O(n^2)'
    },
    {
      id: '00000000-0000-0000-0000-000000000019',
      title: 'MCQ: JavaScript Event Loop Execution Order',
      category: 'STRINGS',
      type: 'MCQ',
      difficulty: 'MEDIUM',
      tags: ['JavaScript', 'Async', 'Event Loop'],
      description: `Consider the following JavaScript code snippet:\n\`\`\`javascript\nconsole.log('1');\nsetTimeout(() => console.log('2'), 0);\nPromise.resolve().then(() => console.log('3'));\nconsole.log('4');\n\`\`\`\nIn what exact order will the numbers be logged to the console?`,
      options: [
        '1, 4, 3, 2',
        '1, 2, 3, 4',
        '1, 4, 2, 3',
        '3, 1, 4, 2'
      ],
      correctAnswer: '1, 4, 3, 2'
    },
    {
      id: '00000000-0000-0000-0000-000000000020',
      title: 'MCQ: Database Boyce-Codd Normal Form (BCNF)',
      category: 'DATABASE',
      type: 'MCQ',
      difficulty: 'MEDIUM',
      tags: ['Databases', 'Normalization', 'Relational Theory'],
      description: `In relational database theory, what condition must hold for a relation to be in Boyce-Codd Normal Form (BCNF)?`,
      options: [
        'For every non-trivial functional dependency X -> Y, X must be a superkey.',
        'No non-prime attribute may depend on a subset of any candidate key.',
        'All multi-valued dependencies must be eliminated.',
        'Every column must contain atomic, non-decomposable values only.'
      ],
      correctAnswer: 'For every non-trivial functional dependency X -> Y, X must be a superkey.'
    },
    {
      id: '00000000-0000-0000-0000-000000000021',
      title: 'MCQ: Necessary Coffman Conditions for Deadlocks',
      category: 'OS',
      type: 'MCQ',
      difficulty: 'HARD',
      tags: ['Operating Systems', 'Concurrency', 'Deadlocks'],
      description: `Which set of four conditions are simultaneously necessary and sufficient for a deadlock to occur in an operating system?`,
      options: [
        'Mutual exclusion, Hold and wait, No preemption, Circular wait',
        'Race conditions, Starvation, Critical section, Spinlock',
        'Paging, Memory leak, Context switch, Livelock',
        'Atomic execution, Cache coherence, Semaphore wait, Barrier'
      ],
      correctAnswer: 'Mutual exclusion, Hold and wait, No preemption, Circular wait'
    }
  ];

  for (const q of questionsData) {
    const { testCases = [], ...qFields } = q;
    await prisma.question.upsert({
      where: { id: q.id },
      update: {
        title: qFields.title,
        description: qFields.description,
        type: qFields.type,
        difficulty: qFields.difficulty,
        category: qFields.category,
        tags: qFields.tags,
        supportedLanguages: qFields.supportedLanguages,
        starterCode: qFields.starterCode,
        defaultCodeSnippet: qFields.defaultCodeSnippet,
        constraints: qFields.constraints,
        hints: qFields.hints,
        rubric: qFields.rubric,
        options: qFields.options,
        correctAnswer: qFields.correctAnswer,
        isSystem: true
      },
      create: {
        ...qFields,
        isSystem: true
      }
    });

    if (testCases.length > 0) {
      await prisma.testCase.deleteMany({ where: { questionId: q.id } });
      await prisma.testCase.createMany({
        data: testCases.map(tc => ({
          questionId: q.id,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isHidden: tc.isHidden,
          explanation: tc.explanation || null
        }))
      });
    }
  }

  console.log(`✅ Seeded ${questionsData.length} diverse multi-format questions across categories`);

  // 3. Seed Candidate Initial Practice Question Bookmarks for Alex Rivera
  await prisma.practiceQuestion.upsert({
    where: {
      userId_questionId: {
        userId: candidate.id,
        questionId: '00000000-0000-0000-0000-000000000001' // Two Sum
      }
    },
    update: { status: 'SOLVED', solvedAt: new Date() },
    create: {
      userId: candidate.id,
      questionId: '00000000-0000-0000-0000-000000000001',
      status: 'SOLVED',
      solvedAt: new Date(),
      lastAttemptedAt: new Date()
    }
  });

  await prisma.practiceQuestion.upsert({
    where: {
      userId_questionId: {
        userId: candidate.id,
        questionId: '00000000-0000-0000-0000-000000000003' // LRU Cache
      }
    },
    update: { status: 'ATTEMPTED', lastAttemptedAt: new Date() },
    create: {
      userId: candidate.id,
      questionId: '00000000-0000-0000-0000-000000000003',
      status: 'ATTEMPTED',
      lastAttemptedAt: new Date()
    }
  });

  await prisma.practiceQuestion.upsert({
    where: {
      userId_questionId: {
        userId: candidate.id,
        questionId: '00000000-0000-0000-0000-000000000002' // Valid Parentheses
      }
    },
    update: { status: 'SAVED' },
    create: {
      userId: candidate.id,
      questionId: '00000000-0000-0000-0000-000000000002',
      status: 'SAVED'
    }
  });

  console.log('✅ Seeded candidate practice list (Two Sum = Solved, LRU Cache = Attempted, Valid Parentheses = Saved)');

  // 4. Seed a Realistic Active/Scheduled Interview
  const interviewId = '11111111-1111-1111-1111-111111111111';
  await prisma.interviewQuestion.deleteMany({ where: { interviewId } });
  await prisma.interview.upsert({
    where: { id: interviewId },
    update: {
      status: 'SCHEDULED',
      scheduledAt: new Date(Date.now() + 3600000)
    },
    create: {
      id: interviewId,
      title: 'Senior Full-Stack Engineer Technical Round',
      description: 'Algorithmic efficiency, state management, and distributed systems discussion.',
      status: 'SCHEDULED',
      durationMinutes: 60,
      scheduledAt: new Date(Date.now() + 3600000),
      interviewerId: interviewer.id,
      candidateId: candidate.id,
      questions: {
        create: [
          { questionId: '00000000-0000-0000-0000-000000000001', order: 1 },
          { questionId: '00000000-0000-0000-0000-000000000002', order: 2 },
          { questionId: '00000000-0000-0000-0000-000000000011', order: 3 }
        ]
      }
    }
  });

  console.log('✅ Seeded demo interview (ID: 11111111-1111-1111-1111-111111111111)');
  console.log('🎉 CodeArena database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
