# MCP End-to-End Testing Plan

## Interactive LeetCode MCP Server

**Version**: 3.0.0
**Date**: January 2026
**Goal**: Eliminate manual testing by achieving comprehensive automated test coverage

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Testing Strategy Overview](#testing-strategy-overview)
4. [Testing Layers](#testing-layers)
5. [Tools and Technologies](#tools-and-technologies)
6. [Implementation Plan](#implementation-plan)
7. [CI/CD Integration](#cicd-integration)
8. [Test Categories and Coverage](#test-categories-and-coverage)
9. [Mocking Strategy](#mocking-strategy)
10. [Security Testing](#security-testing)
11. [Performance Testing](#performance-testing)
12. [Maintenance and Best Practices](#maintenance-and-best-practices)

---

## Executive Summary

This document outlines a comprehensive end-to-end testing strategy for the Interactive LeetCode MCP Server. The plan addresses three critical testing layers:

1. **Unit Tests** - Testing individual components in isolation
2. **Integration Tests** - Testing MCP protocol compliance and component interactions
3. **End-to-End Tests** - Testing the complete server behavior through MCP protocol

### Key Objectives

- **100% tool coverage** - All 16 tools tested through MCP protocol
- **100% resource coverage** - All 5 resources tested
- **100% prompt coverage** - All 4 prompts tested
- **Protocol compliance** - Verify MCP specification adherence
- **CI automation** - All tests executable in GitHub Actions

---

## Current State Analysis

### Existing Test Coverage

| Category | Files | Coverage Level |
|----------|-------|----------------|
| Auth Tools | 1 file | Good - mocked handlers |
| Prompts | 3 files | Good - registry tests |
| Services | 2 files | Good - real API calls (30s timeout) |
| Utilities | 2 files | Good - credentials & browser launcher |
| Submission | 1 file | Partial |

### Current Testing Approach
- **Framework**: Vitest v3.1.3
- **Pattern**: Direct handler testing with mocked dependencies
- **Gap**: No MCP protocol-level testing (tools aren't called through MCP Client)

### Components Requiring E2E Coverage

**Tools (16 total)**:
- `start_leetcode_auth`, `save_leetcode_credentials`, `check_auth_status`
- `get_daily_challenge`, `get_problem`, `search_problems`
- `submit_solution`
- `get_user_profile`, `get_recent_submissions`, `get_recent_ac_submissions`
- `get_user_status`, `get_problem_submission_report`, `get_problem_progress`, `get_all_submissions`
- `list_problem_solutions`, `get_problem_solution`
- `get_user_contest_ranking`

**Resources (5 total)**:
- `categories://problems/all`
- `tags://problems/all`
- `langs://problems/all`
- `problem://{titleSlug}`
- `solution://{topicId}`

**Prompts (4 total)**:
- `leetcode_workspace_setup`
- `leetcode_learning_mode`
- `leetcode_problem_workflow`
- `leetcode_authentication_guide`

---

## Testing Strategy Overview

### Three-Layer Testing Pyramid

```
                    ┌─────────────────┐
                    │   E2E Tests     │  ← MCP Inspector CLI / Full protocol
                    │  (Few, Slow)    │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │ Integration     │  ← In-memory MCP Client
                    │    Tests        │
                    └────────┬────────┘
                             │
           ┌─────────────────┴─────────────────┐
           │         Unit Tests                │  ← Vitest with mocks
           │     (Many, Fast, Isolated)        │
           └───────────────────────────────────┘
```

### Testing Approach by Layer

| Layer | Tool | Scope | Speed | External Dependencies |
|-------|------|-------|-------|----------------------|
| Unit | Vitest | Individual functions | Fast (ms) | All mocked |
| Integration | MCP SDK Client | MCP protocol + handlers | Medium (s) | LeetCode API mocked |
| E2E | MCP Inspector CLI | Full server process | Slow (s) | Optional: real API |

---

## Testing Layers

### Layer 1: Unit Tests (Current + Enhanced)

**Purpose**: Test business logic in isolation

**What to Test**:
- Service methods (fetchDailyChallenge, fetchProblem, etc.)
- Utility functions (credentials storage, browser launcher)
- Input validation (Zod schemas)
- Error handling paths

**Example Pattern** (existing):
```typescript
// tests/mcp/tools/auth-tools.test.ts
vi.mock("axios");
vi.mock("../../../src/utils/credentials.js");

describe("AuthToolRegistry", () => {
    it("should validate credentials with LeetCode API", async () => {
        vi.mocked(axios.post).mockResolvedValue({ /* mock response */ });
        const tool = registeredTools.get("save_leetcode_credentials");
        const result = await tool.handler({ csrftoken: "test", session: "test" });
        expect(result.content[0].text).toContain("success");
    });
});
```

### Layer 2: Integration Tests (NEW - Priority)

**Purpose**: Test MCP protocol compliance with in-memory client-server binding

**Approach**: Use the official `@modelcontextprotocol/sdk` Client to connect directly to the server instance without spawning a subprocess.

**Implementation Pattern**:
```typescript
// tests/integration/mcp-integration.test.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

describe("MCP Integration Tests", () => {
    let server: McpServer;
    let client: Client;
    let serverTransport: InMemoryTransport;
    let clientTransport: InMemoryTransport;

    beforeEach(async () => {
        // Create linked in-memory transports
        [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

        // Initialize server
        server = new McpServer({ name: "Test Server", version: "1.0.0" });
        // Register tools, resources, prompts...

        // Initialize client
        client = new Client({ name: "Test Client", version: "1.0.0" });

        // Connect both ends
        await Promise.all([
            server.connect(serverTransport),
            client.connect(clientTransport)
        ]);
    });

    afterEach(async () => {
        await client.close();
        await server.close();
    });

    describe("Tool Discovery", () => {
        it("should list all registered tools", async () => {
            const { tools } = await client.listTools();
            expect(tools.map(t => t.name)).toContain("get_daily_challenge");
            expect(tools.map(t => t.name)).toContain("search_problems");
            expect(tools.length).toBe(16);
        });
    });

    describe("Tool Execution", () => {
        it("should call get_problem tool successfully", async () => {
            const result = await client.callTool({
                name: "get_problem",
                arguments: { titleSlug: "two-sum" }
            });
            expect(result.content[0].type).toBe("text");
            const data = JSON.parse(result.content[0].text);
            expect(data.titleSlug).toBe("two-sum");
        });
    });

    describe("Resource Access", () => {
        it("should list all registered resources", async () => {
            const { resources } = await client.listResources();
            expect(resources.map(r => r.uri)).toContain("categories://problems/all");
        });

        it("should read problem categories resource", async () => {
            const result = await client.readResource({
                uri: "categories://problems/all"
            });
            expect(result.contents[0].mimeType).toBe("application/json");
        });
    });

    describe("Prompt Templates", () => {
        it("should list all registered prompts", async () => {
            const { prompts } = await client.listPrompts();
            expect(prompts.map(p => p.name)).toContain("leetcode_learning_mode");
        });

        it("should get prompt with arguments", async () => {
            const result = await client.getPrompt({
                name: "leetcode_learning_mode",
                arguments: { titleSlug: "two-sum" }
            });
            expect(result.messages.length).toBeGreaterThan(0);
        });
    });
});
```

### Layer 3: End-to-End Tests (NEW - Full Protocol)

**Purpose**: Test the complete server as a subprocess through the MCP protocol

**Approach**: Use MCP Inspector CLI in automated mode

**Implementation Pattern**:
```typescript
// tests/e2e/mcp-e2e.test.ts
import { spawn, ChildProcess } from "child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe("MCP E2E Tests", () => {
    let inspectorProcess: ChildProcess;

    async function runInspectorCommand(method: string, args: Record<string, any> = {}): Promise<any> {
        return new Promise((resolve, reject) => {
            const argStrings = Object.entries(args)
                .map(([k, v]) => `--tool-arg ${k}=${JSON.stringify(v)}`)
                .join(" ");

            const cmd = `npx @modelcontextprotocol/inspector --cli \
                node build/index.js \
                --method ${method} ${argStrings}`;

            const proc = spawn("sh", ["-c", cmd], { cwd: process.cwd() });
            let stdout = "";
            let stderr = "";

            proc.stdout.on("data", (data) => stdout += data);
            proc.stderr.on("data", (data) => stderr += data);

            proc.on("close", (code) => {
                if (code === 0) {
                    resolve(JSON.parse(stdout));
                } else {
                    reject(new Error(`Inspector failed: ${stderr}`));
                }
            });
        });
    }

    describe("Server Startup", () => {
        it("should start and respond to initialize", async () => {
            const result = await runInspectorCommand("initialize");
            expect(result.serverInfo.name).toBe("LeetCode MCP Server");
        });
    });

    describe("Tool Listing via Protocol", () => {
        it("should list all tools through MCP protocol", async () => {
            const result = await runInspectorCommand("tools/list");
            expect(result.tools.length).toBe(16);
        });
    });

    describe("Tool Execution via Protocol", () => {
        it("should execute get_daily_challenge", async () => {
            const result = await runInspectorCommand("tools/call", {
                name: "get_daily_challenge"
            });
            expect(result.content[0].type).toBe("text");
        });
    });
});
```

---

## Tools and Technologies

### Primary Testing Stack

| Tool | Purpose | Installation |
|------|---------|--------------|
| **Vitest** | Test runner & assertions | `npm install -D vitest` |
| **@modelcontextprotocol/sdk** | MCP Client for integration tests | Already installed |
| **@modelcontextprotocol/inspector** | CLI for E2E tests | `npx @modelcontextprotocol/inspector` |
| **msw** (Mock Service Worker) | HTTP request mocking | `npm install -D msw` |
| **@vitest/coverage-v8** | Code coverage | `npm install -D @vitest/coverage-v8` |

### MCP Inspector CLI Commands

```bash
# List all tools
npx @modelcontextprotocol/inspector --cli node build/index.js --method tools/list

# Call a specific tool
npx @modelcontextprotocol/inspector --cli node build/index.js \
    --method tools/call \
    --tool-name get_problem \
    --tool-arg titleSlug=two-sum

# List resources
npx @modelcontextprotocol/inspector --cli node build/index.js --method resources/list

# Read a resource
npx @modelcontextprotocol/inspector --cli node build/index.js \
    --method resources/read \
    --resource-uri "categories://problems/all"

# List prompts
npx @modelcontextprotocol/inspector --cli node build/index.js --method prompts/list
```

### Alternative: Custom Test Client

For more control, implement a custom test client using the MCP SDK:

```typescript
// tests/helpers/test-client.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";

export async function createTestClient(): Promise<Client> {
    const serverProcess = spawn("node", ["build/index.js"], {
        stdio: ["pipe", "pipe", "pipe"]
    });

    const transport = new StdioClientTransport({
        command: "node",
        args: ["build/index.js"]
    });

    const client = new Client({
        name: "test-client",
        version: "1.0.0"
    });

    await client.connect(transport);
    return client;
}
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1)

**Tasks**:
1. Add test dependencies to package.json
2. Create test helper utilities
3. Set up in-memory transport testing infrastructure
4. Configure coverage reporting

**Files to Create**:
```
tests/
├── helpers/
│   ├── test-client.ts       # MCP client factory
│   ├── mock-leetcode.ts     # LeetCode API mocks
│   └── fixtures/            # Test data fixtures
├── integration/
│   └── setup.ts             # Integration test setup
└── e2e/
    └── setup.ts             # E2E test setup
```

**Package.json Updates**:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run tests/unit tests/mcp tests/utils tests/services",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "vitest run tests/e2e",
    "test:all": "vitest run",
    "test:coverage": "vitest run --coverage"
  },
  "devDependencies": {
    "@vitest/coverage-v8": "^3.1.3",
    "msw": "^2.0.0"
  }
}
```

### Phase 2: Integration Tests (Week 2)

**Tasks**:
1. Implement MCP protocol integration tests
2. Test all tool registrations
3. Test all resource registrations
4. Test all prompt registrations
5. Test capability negotiation

**Test Files**:
```
tests/integration/
├── mcp-protocol.test.ts     # Protocol compliance tests
├── tools-integration.test.ts # All tools via MCP Client
├── resources-integration.test.ts
├── prompts-integration.test.ts
└── capabilities.test.ts      # Capability negotiation
```

### Phase 3: E2E Tests (Week 3)

**Tasks**:
1. Set up subprocess-based testing with Inspector CLI
2. Test server startup and shutdown
3. Test real workflows (with mocked LeetCode API)
4. Test error handling through protocol

**Test Files**:
```
tests/e2e/
├── server-lifecycle.test.ts  # Start/stop/signals
├── workflow-daily.test.ts    # Daily challenge workflow
├── workflow-search.test.ts   # Problem search workflow
├── workflow-auth.test.ts     # Authentication flow
└── error-handling.test.ts    # Protocol-level errors
```

### Phase 4: CI Integration (Week 4)

**Tasks**:
1. Update GitHub Actions workflow
2. Add coverage thresholds
3. Add test result reporting
4. Set up test caching

---

## CI/CD Integration

### Updated GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"
      - run: npm ci
      - run: npm run build
      - name: Run unit tests
        run: npm run test:unit
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"
      - run: npm ci
      - run: npm run build
      - name: Run integration tests
        run: npm run test:integration
        timeout-minutes: 5

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"
      - run: npm ci
      - run: npm run build
      - name: Run E2E tests
        run: npm run test:e2e
        timeout-minutes: 10

  # Combined report
  test-report:
    needs: [unit-tests, integration-tests, e2e-tests]
    runs-on: ubuntu-latest
    steps:
      - name: Test Summary
        run: echo "All test suites passed!"
```

### Coverage Configuration

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        globals: true,
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov", "html"],
            include: ["src/**/*.ts"],
            exclude: ["src/index.ts", "**/*.d.ts"],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 75,
                statements: 80
            }
        }
    }
});
```

---

## Test Categories and Coverage

### Tool Tests Matrix

| Tool | Unit Test | Integration Test | E2E Test | Auth Required |
|------|-----------|------------------|----------|---------------|
| `start_leetcode_auth` | ✅ | ⬜ | ⬜ | No |
| `save_leetcode_credentials` | ✅ | ⬜ | ⬜ | No |
| `check_auth_status` | ✅ | ⬜ | ⬜ | No |
| `get_daily_challenge` | ⬜ | ⬜ | ⬜ | No |
| `get_problem` | ⬜ | ⬜ | ⬜ | No |
| `search_problems` | ⬜ | ⬜ | ⬜ | No |
| `submit_solution` | ⬜ | ⬜ | ⬜ | Yes |
| `get_user_profile` | ⬜ | ⬜ | ⬜ | No |
| `get_recent_submissions` | ⬜ | ⬜ | ⬜ | No |
| `get_recent_ac_submissions` | ⬜ | ⬜ | ⬜ | No |
| `get_user_status` | ⬜ | ⬜ | ⬜ | Yes |
| `get_problem_submission_report` | ⬜ | ⬜ | ⬜ | Yes |
| `get_problem_progress` | ⬜ | ⬜ | ⬜ | Yes |
| `get_all_submissions` | ⬜ | ⬜ | ⬜ | Yes |
| `list_problem_solutions` | ⬜ | ⬜ | ⬜ | No |
| `get_problem_solution` | ⬜ | ⬜ | ⬜ | No |
| `get_user_contest_ranking` | ⬜ | ⬜ | ⬜ | No |

### Resource Tests

| Resource | URI | Integration Test |
|----------|-----|------------------|
| Problem Categories | `categories://problems/all` | ⬜ |
| Problem Tags | `tags://problems/all` | ⬜ |
| Programming Languages | `langs://problems/all` | ⬜ |
| Problem Detail | `problem://{titleSlug}` | ⬜ |
| Solution Detail | `solution://{topicId}` | ⬜ |

### Prompt Tests

| Prompt | Arguments | Integration Test |
|--------|-----------|------------------|
| `leetcode_workspace_setup` | titleSlug | ⬜ |
| `leetcode_learning_mode` | titleSlug, hintLevel | ⬜ |
| `leetcode_problem_workflow` | titleSlug | ⬜ |
| `leetcode_authentication_guide` | - | ⬜ |

---

## Mocking Strategy

### LeetCode API Mocking

Create a comprehensive mock for the LeetCode API to enable offline testing:

```typescript
// tests/helpers/mock-leetcode.ts
import { vi } from "vitest";

export const mockLeetCodeService = {
    fetchDailyChallenge: vi.fn().mockResolvedValue({
        question: {
            questionId: "1",
            title: "Two Sum",
            titleSlug: "two-sum",
            difficulty: "Easy"
        }
    }),

    fetchProblem: vi.fn().mockResolvedValue({
        questionId: "1",
        title: "Two Sum",
        content: "<p>Given an array...</p>",
        difficulty: "Easy",
        topicTags: [{ name: "Array" }, { name: "Hash Table" }]
    }),

    fetchProblemSimplified: vi.fn().mockResolvedValue({
        questionId: "1",
        title: "Two Sum",
        titleSlug: "two-sum",
        difficulty: "Easy",
        topicTags: ["Array", "Hash Table"],
        codeSnippets: [{ lang: "JavaScript", code: "var twoSum = function(nums, target) {" }]
    }),

    searchProblems: vi.fn().mockResolvedValue({
        total: 100,
        problems: [
            { titleSlug: "two-sum", title: "Two Sum", difficulty: "Easy" },
            { titleSlug: "three-sum", title: "Three Sum", difficulty: "Medium" }
        ]
    }),

    // Add all other methods...
    isAuthenticated: vi.fn().mockReturnValue(false)
};

export function createMockLeetCodeService() {
    return { ...mockLeetCodeService };
}
```

### MSW (Mock Service Worker) for HTTP Mocking

```typescript
// tests/helpers/msw-handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
    // LeetCode GraphQL endpoint
    http.post("https://leetcode.com/graphql", async ({ request }) => {
        const body = await request.json();

        if (body.query.includes("userStatus")) {
            return HttpResponse.json({
                data: {
                    userStatus: {
                        isSignedIn: true,
                        username: "testuser"
                    }
                }
            });
        }

        if (body.query.includes("dailyChallenge")) {
            return HttpResponse.json({
                data: {
                    activeDailyCodingChallengeQuestion: {
                        question: {
                            questionId: "1",
                            title: "Two Sum",
                            titleSlug: "two-sum"
                        }
                    }
                }
            });
        }

        // Default response
        return HttpResponse.json({ data: {} });
    })
];
```

### Test Fixtures

```typescript
// tests/helpers/fixtures/problems.ts
export const TWO_SUM_PROBLEM = {
    questionId: "1",
    title: "Two Sum",
    titleSlug: "two-sum",
    difficulty: "Easy",
    content: `<p>Given an array of integers <code>nums</code> and an integer <code>target</code>, return <em>indices of the two numbers such that they add up to <code>target</code></em>.</p>`,
    topicTags: [
        { name: "Array", slug: "array" },
        { name: "Hash Table", slug: "hash-table" }
    ],
    codeSnippets: [
        {
            lang: "JavaScript",
            langSlug: "javascript",
            code: "/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nvar twoSum = function(nums, target) {\n    \n};"
        }
    ],
    hints: ["A brute force approach would use two loops."],
    sampleTestCase: "[2,7,11,15]\n9",
    exampleTestcases: "[2,7,11,15]\n9\n[3,2,4]\n6"
};

export const SEARCH_RESULTS = {
    total: 2847,
    problems: [
        { questionId: "1", title: "Two Sum", titleSlug: "two-sum", difficulty: "Easy" },
        { questionId: "15", title: "3Sum", titleSlug: "3sum", difficulty: "Medium" },
        { questionId: "18", title: "4Sum", titleSlug: "4sum", difficulty: "Medium" }
    ]
};
```

---

## Security Testing

### Authentication Flow Tests

```typescript
// tests/security/auth-security.test.ts
describe("Authentication Security", () => {
    it("should not expose credentials in error messages", async () => {
        const result = await client.callTool({
            name: "save_leetcode_credentials",
            arguments: {
                csrftoken: "secret-token",
                session: "secret-session"
            }
        });

        const text = result.content[0].text;
        expect(text).not.toContain("secret-token");
        expect(text).not.toContain("secret-session");
    });

    it("should store credentials with restricted permissions", async () => {
        // Verify file permissions are 0600
        const stats = await fs.stat(credentialsPath);
        expect(stats.mode & 0o777).toBe(0o600);
    });

    it("should reject malformed credentials", async () => {
        const result = await client.callTool({
            name: "save_leetcode_credentials",
            arguments: {
                csrftoken: "<script>alert('xss')</script>",
                session: "' OR '1'='1"
            }
        });

        const response = JSON.parse(result.content[0].text);
        expect(response.status).toBe("error");
    });
});
```

### Input Validation Tests

```typescript
// tests/security/input-validation.test.ts
describe("Input Validation", () => {
    const maliciousInputs = [
        "../../../etc/passwd",
        "$(rm -rf /)",
        "; DROP TABLE users;",
        "<script>alert('xss')</script>",
        "{{constructor.constructor('return this')()}}"
    ];

    maliciousInputs.forEach(input => {
        it(`should safely handle malicious input: ${input.slice(0, 20)}...`, async () => {
            await expect(
                client.callTool({
                    name: "get_problem",
                    arguments: { titleSlug: input }
                })
            ).resolves.not.toThrow();
        });
    });
});
```

---

## Performance Testing

### Response Time Benchmarks

```typescript
// tests/performance/benchmarks.test.ts
describe("Performance Benchmarks", () => {
    it("should list tools within 100ms", async () => {
        const start = performance.now();
        await client.listTools();
        const duration = performance.now() - start;
        expect(duration).toBeLessThan(100);
    });

    it("should handle concurrent tool calls", async () => {
        const start = performance.now();

        await Promise.all([
            client.callTool({ name: "get_problem", arguments: { titleSlug: "two-sum" } }),
            client.callTool({ name: "get_problem", arguments: { titleSlug: "three-sum" } }),
            client.callTool({ name: "get_problem", arguments: { titleSlug: "four-sum" } })
        ]);

        const duration = performance.now() - start;
        // Should complete within reasonable time (not 3x sequential)
        expect(duration).toBeLessThan(5000);
    });
});
```

---

## Maintenance and Best Practices

### Test Organization Guidelines

1. **Co-locate related tests** - Keep unit tests near the code they test
2. **Use descriptive names** - Test names should describe the expected behavior
3. **One assertion per test** - Prefer focused tests over multi-assertion tests
4. **Test edge cases** - Include tests for error paths and boundary conditions
5. **Keep tests deterministic** - Avoid time-dependent or random test failures

### Fixture Management

1. **Centralize test data** - Store fixtures in `tests/helpers/fixtures/`
2. **Use factories** - Create test data programmatically when possible
3. **Version fixtures** - Update fixtures when API responses change
4. **Document fixture sources** - Note where fixture data came from

### CI Best Practices

1. **Parallelize test suites** - Run unit, integration, and E2E tests concurrently
2. **Cache dependencies** - Use npm/pnpm cache to speed up CI runs
3. **Set appropriate timeouts** - Different test types need different timeouts
4. **Fail fast** - Stop on first failure in PR checks
5. **Report coverage trends** - Track coverage over time

### Test Maintenance

1. **Review flaky tests weekly** - Investigate and fix non-deterministic tests
2. **Update mocks when API changes** - Keep mocks in sync with real API
3. **Prune unused fixtures** - Remove fixtures that are no longer referenced
4. **Monitor test performance** - Track test suite duration over time

---

## Appendix A: Example Test Files

### Complete Integration Test Example

```typescript
// tests/integration/tools-integration.test.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { registerProblemTools } from "../../src/mcp/tools/problem-tools.js";
import { createMockLeetCodeService } from "../helpers/mock-leetcode.js";

describe("Problem Tools Integration", () => {
    let server: McpServer;
    let client: Client;
    let mockService: ReturnType<typeof createMockLeetCodeService>;

    beforeEach(async () => {
        // Setup in-memory transport
        const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

        // Create server
        server = new McpServer({ name: "Test", version: "1.0.0" });

        // Create mock service
        mockService = createMockLeetCodeService();

        // Register tools with mock service
        registerProblemTools(server, mockService as any);

        // Create client
        client = new Client({ name: "TestClient", version: "1.0.0" });

        // Connect both
        await Promise.all([
            server.connect(serverTransport),
            client.connect(clientTransport)
        ]);
    });

    afterEach(async () => {
        await client.close();
        await server.close();
    });

    describe("get_daily_challenge", () => {
        it("should return daily challenge through MCP protocol", async () => {
            const result = await client.callTool({
                name: "get_daily_challenge",
                arguments: {}
            });

            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe("text");

            const data = JSON.parse(result.content[0].text as string);
            expect(data.date).toBeDefined();
            expect(data.problem.question.title).toBe("Two Sum");
            expect(mockService.fetchDailyChallenge).toHaveBeenCalledOnce();
        });
    });

    describe("get_problem", () => {
        it("should return problem details with valid slug", async () => {
            const result = await client.callTool({
                name: "get_problem",
                arguments: { titleSlug: "two-sum" }
            });

            const data = JSON.parse(result.content[0].text as string);
            expect(data.titleSlug).toBe("two-sum");
            expect(mockService.fetchProblemSimplified).toHaveBeenCalledWith("two-sum");
        });

        it("should handle missing titleSlug argument", async () => {
            await expect(
                client.callTool({
                    name: "get_problem",
                    arguments: {}
                })
            ).rejects.toThrow();
        });
    });

    describe("search_problems", () => {
        it("should search with default parameters", async () => {
            const result = await client.callTool({
                name: "search_problems",
                arguments: {}
            });

            const data = JSON.parse(result.content[0].text as string);
            expect(data.problems).toBeDefined();
            expect(mockService.searchProblems).toHaveBeenCalled();
        });

        it("should pass filter parameters correctly", async () => {
            await client.callTool({
                name: "search_problems",
                arguments: {
                    difficulty: "EASY",
                    tags: ["array", "hash-table"],
                    limit: 5,
                    offset: 10
                }
            });

            expect(mockService.searchProblems).toHaveBeenCalledWith(
                "all-code-essentials",
                ["array", "hash-table"],
                "EASY",
                5,
                10,
                undefined
            );
        });
    });
});
```

---

## Appendix B: Reference Documentation

### Sources

- [MCP Best Practices](https://modelcontextprotocol.info/docs/best-practices/)
- [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector)
- [MCP Inspector GitHub](https://github.com/modelcontextprotocol/inspector)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [FastMCP Testing Guide](https://gofastmcp.com/patterns/testing)
- [MCP Integration Testing Guide](https://mcpcat.io/guides/integration-tests-mcp-flows/)
- [MCP in CI/CD](https://glama.ai/blog/2025-08-16-building-ai-cicd-pipelines-with-mcp)
- [Top MCP Testing Tools 2025](https://testomat.io/blog/mcp-server-testing-tools/)

---

## Summary

This testing plan provides a comprehensive approach to achieving full automated test coverage for the Interactive LeetCode MCP Server. By implementing the three-layer testing pyramid (unit, integration, E2E), we can:

1. **Eliminate manual testing** - All MCP functionality is automatically verified
2. **Ensure protocol compliance** - Tests verify MCP specification adherence
3. **Enable confident deployments** - CI pipeline catches regressions before release
4. **Maintain code quality** - Coverage thresholds prevent untested code

The recommended implementation order is:
1. **Phase 1**: Set up testing infrastructure and helpers
2. **Phase 2**: Implement integration tests using in-memory MCP Client
3. **Phase 3**: Add E2E tests using MCP Inspector CLI
4. **Phase 4**: Integrate with CI/CD and set coverage thresholds

With this plan in place, the project will have industry-standard test coverage comparable to official MCP reference implementations.
