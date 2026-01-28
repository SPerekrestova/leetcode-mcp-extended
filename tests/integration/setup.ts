/**
 * Common setup for integration tests
 * Provides utilities and configurations used across all integration tests
 */
import { afterAll, beforeAll } from "vitest";

/**
 * Global test timeout for integration tests (5 seconds)
 * Integration tests may take longer than unit tests due to MCP protocol overhead
 */
export const INTEGRATION_TEST_TIMEOUT = 5000;

/**
 * Setup function to run before all integration tests
 * Can be used for global test initialization
 */
export function setupIntegrationTests() {
    beforeAll(() => {
        // Set longer timeout for integration tests
        // Tests that interact through MCP protocol need more time
    });

    afterAll(() => {
        // Global cleanup if needed
    });
}

/**
 * Helper to create a delay for testing async operations
 * Useful for simulating API delays or testing timeouts
 *
 * @param ms Milliseconds to delay
 */
export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Common test assertions for MCP protocol responses
 */
export const assertions = {
    /**
     * Assert that tool result has expected structure
     */
    hasToolResultStructure(result: any) {
        if (!result.content || !Array.isArray(result.content)) {
            throw new Error(
                `Expected tool result to have content array, got: ${JSON.stringify(result)}`
            );
        }
        if (result.content.length === 0) {
            throw new Error(
                "Expected tool result to have at least one content item"
            );
        }
    },

    /**
     * Assert that resource result has expected structure
     */
    hasResourceStructure(result: any) {
        if (!result.contents || !Array.isArray(result.contents)) {
            throw new Error(
                `Expected resource result to have contents array, got: ${JSON.stringify(result)}`
            );
        }
    },

    /**
     * Assert that prompt result has expected structure
     */
    hasPromptStructure(result: any) {
        if (!result.messages || !Array.isArray(result.messages)) {
            throw new Error(
                `Expected prompt result to have messages array, got: ${JSON.stringify(result)}`
            );
        }
    }
};
