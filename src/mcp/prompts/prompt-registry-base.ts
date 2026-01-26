// src/mcp/prompts/prompt-registry-base.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export interface PromptParameter {
    name: string;
    description: string;
    required: boolean;
}

export type PromptHandler = (args: Record<string, string | undefined>) => {
    messages: Array<{
        role: "user" | "assistant";
        content: {
            type: "text";
            text: string;
        };
    }>;
};

/**
 * Base class for MCP prompt registries
 * Provides common functionality for registering prompts
 */
export abstract class PromptRegistry {
    constructor(protected readonly server: McpServer) {
        this.registerPrompts();
    }

    /**
     * Subclasses implement this to register their prompts
     */
    protected abstract registerPrompts(): void;

    /**
     * Registers a prompt with the MCP server
     * @param name - Prompt name
     * @param description - Prompt description
     * @param parameters - Array of prompt parameters
     * @param handler - Function that generates prompt text from arguments
     */
    protected registerPrompt(
        name: string,
        description: string,
        parameters: PromptParameter[],
        handler: PromptHandler
    ): void {
        // Convert parameters to Zod schema format
        const paramSchema: Record<
            string,
            z.ZodString | z.ZodOptional<z.ZodString>
        > = {};
        for (const param of parameters) {
            let schema: z.ZodString | z.ZodOptional<z.ZodString> = z
                .string()
                .describe(param.description);
            if (!param.required) {
                schema = schema.optional();
            }
            paramSchema[param.name] = schema;
        }

        this.server.prompt(name, description, paramSchema, handler);
    }
}
