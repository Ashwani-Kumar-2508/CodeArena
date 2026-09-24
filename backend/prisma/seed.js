const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting CodeArena database seeding...');

  // Hash demo password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Password123!', salt);

  // 1. Create Users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@codearena.dev' },
    update: {},
    create: {
      email: 'admin@codearena.dev',
      name: 'Devon Vance (Admin)',
      passwordHash,
      role: 'ADMIN',
    },
  });

  const interviewer = await prisma.user.upsert({
    where: { email: 'interviewer@codearena.dev' },
    update: {},
    create: {
      email: 'interviewer@codearena.dev',
      name: 'Sarah Connor (Staff Engineer)',
      passwordHash,
      role: 'INTERVIEWER',
    },
  });

  const candidate = await prisma.user.upsert({
    where: { email: 'candidate@codearena.dev' },
    update: {},
    create: {
      email: 'candidate@codearena.dev',
      name: 'Alex Rivera (Candidate)',
      passwordHash,
      role: 'CANDIDATE',
    },
  });

  console.log('✅ Demo Users created/verified:');
  console.log('   - Admin: admin@codearena.dev (Password123!)');
  console.log('   - Interviewer: interviewer@codearena.dev (Password123!)');
  console.log('   - Candidate: candidate@codearena.dev (Password123!)');

  // 2. Create Questions with Test Cases
  // Question 1: Two Sum
  const qTwoSum = await prisma.question.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      title: 'Two Sum',
      description: `### Problem Description
Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.
You can return the answer in any order.

#### Constraints:
- \`2 <= nums.length <= 10^4\`
- \`-10^9 <= nums[i] <= 10^9\`
- \`-10^9 <= target <= 10^9\`
- Only one valid answer exists.

#### Example:
\`\`\`javascript
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].
\`\`\``,
      type: 'CODING',
      difficulty: 'EASY',
      language: 'javascript',
      defaultCodeSnippet: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function twoSum(nums, target) {
  // Write your solution here
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
  return [];
}`,
      hints: [
        'A brute force approach checks all pairs in O(n^2) time. Can we use a hash map to do it in O(n)?',
        'Store the seen numbers and their indices as you iterate through the array.'
      ],
      rubric: {
        timeComplexity: 'O(n) expected using hash map',
        spaceComplexity: 'O(n) auxiliary space',
        edgeCases: ['Negative numbers', 'Zero target', 'Two identical values summing to target']
      },
      testCases: {
        create: [
          {
            input: '[[2,7,11,15], 9]',
            expectedOutput: '[0,1]',
            isHidden: false,
            explanation: 'nums[0] + nums[1] = 2 + 7 = 9'
          },
          {
            input: '[[3,2,4], 6]',
            expectedOutput: '[1,2]',
            isHidden: false,
            explanation: 'nums[1] + nums[2] = 2 + 4 = 6'
          },
          {
            input: '[[3,3], 6]',
            expectedOutput: '[0,1]',
            isHidden: false,
            explanation: 'nums[0] + nums[1] = 3 + 3 = 6'
          },
          // Hidden test cases (Candidate should not see these)
          {
            input: '[[-1,-2,-3,-4,-5], -8]',
            expectedOutput: '[2,4]',
            isHidden: true,
            explanation: 'Negative numbers test case'
          },
          {
            input: '[[0,4,3,0], 0]',
            expectedOutput: '[0,3]',
            isHidden: true,
            explanation: 'Zero values test case'
          }
        ]
      }
    }
  });

  // Question 2: Valid Parentheses
  const qValidParentheses = await prisma.question.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      title: 'Valid Parentheses',
      description: `### Problem Description
Given a string \`s\` containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

#### Example:
\`\`\`javascript
Input: s = "()[]{}"
Output: true
\`\`\``,
      type: 'CODING',
      difficulty: 'EASY',
      language: 'javascript',
      defaultCodeSnippet: `/**
 * @param {string} s
 * @return {boolean}
 */
function validParentheses(s) {
  // Write your solution here
  const stack = [];
  const map = { ')': '(', '}': '{', ']': '[' };
  for (const char of s) {
    if (char === '(' || char === '{' || char === '[') {
      stack.push(char);
    } else {
      if (stack.pop() !== map[char]) return false;
    }
  }
  return stack.length === 0;
}`,
      hints: [
        'Think about which data structure is LIFO (Last-In-First-Out).',
        'When you encounter a closing bracket, does it match the most recently opened bracket?'
      ],
      rubric: {
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(n) for the stack'
      },
      testCases: {
        create: [
          {
            input: '["()"]',
            expectedOutput: 'true',
            isHidden: false,
            explanation: 'Simple pair'
          },
          {
            input: '["()[]{}"]',
            expectedOutput: 'true',
            isHidden: false,
            explanation: 'Multiple valid pairs'
          },
          {
            input: '["(]"]',
            expectedOutput: 'false',
            isHidden: false,
            explanation: 'Mismatched types'
          },
          // Hidden test cases
          {
            input: '["["]',
            expectedOutput: 'false',
            isHidden: true,
            explanation: 'Unclosed open bracket'
          },
          {
            input: '["{[]}"]',
            expectedOutput: 'true',
            isHidden: true,
            explanation: 'Nested brackets'
          }
        ]
      }
    }
  });

  // Question 3: Technical System Design
  await prisma.question.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      title: 'Design an In-Memory LRU Cache',
      description: `### System Design / Technical Architecture
Design a Least Recently Used (LRU) Cache data structure that supports:
- \`get(key)\`: Return value if exists, else -1.
- \`put(key, value)\`: Insert or update. When capacity exceeds, invalidate least recently used item.

Both operations must execute with **O(1)** average time complexity.
Discuss data structures (Hash Map + Doubly Linked List), concurrency locking, and cache eviction policies.`,
      type: 'TECHNICAL',
      difficulty: 'MEDIUM',
      rubric: {
        criteria: [
          'Understands Doubly Linked List + Hash Map combination for O(1) ops',
          'Explains thread-safety or Node event-loop concurrency',
          'Discusses memory leak prevention and eviction triggers'
        ]
      }
    }
  });

  // Question 4: Behavioral
  await prisma.question.upsert({
    where: { id: '00000000-0000-0000-0000-000000000004' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000004',
      title: 'Handling Technical Disagreements in Code Reviews',
      description: `### Behavioral Question
Tell me about a time when you strongly disagreed with a team member’s architectural proposal or code review feedback.
- What was the technical context?
- How did you communicate your concerns without creating friction?
- What was the final resolution and outcome?`,
      type: 'BEHAVIORAL',
      difficulty: 'MEDIUM',
      rubric: {
        criteria: [
          'Uses STAR framework (Situation, Task, Action, Result)',
          'Demonstrates empathy, data-driven reasoning, and collaboration',
          'Prioritizes product success over personal ego'
        ]
      }
    }
  });

  // 3. Create Sample Interview Session
  const sampleInterview = await prisma.interview.upsert({
    where: { id: '11111111-1111-1111-1111-111111111111' },
    update: {},
    create: {
      id: '11111111-1111-1111-1111-111111111111',
      title: 'Full-Stack Software Engineer Technical Screen',
      description: 'Live coding assessment: Data structures, algorithmic problem solving, and edge-case handling.',
      status: 'SCHEDULED',
      scheduledAt: new Date(),
      durationMinutes: 60,
      interviewerId: interviewer.id,
      candidateId: candidate.id,
      questions: {
        create: [
          {
            questionId: qTwoSum.id,
            order: 1,
            interviewerNotes: 'Look for O(n) hash map solution vs brute force.'
          },
          {
            questionId: qValidParentheses.id,
            order: 2,
            interviewerNotes: 'Check for empty string and odd-length edge cases.'
          }
        ]
      }
    }
  });

  console.log(`✅ Sample Interview created: "${sampleInterview.title}" (ID: ${sampleInterview.id})`);
  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
