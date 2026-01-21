import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Browser, chromium } from "playwright";
import { z } from "zod";
import { LeetCodeBaseService } from "../../leetcode/leetcode-base-service.js";
import { LeetCodeCredentials } from "../../types/credentials.js";
import { credentialsStorage } from "../../utils/credentials.js";
import { ToolRegistry } from "./tool-registry.js";

const LEETCODE_LOGIN_URL = "https://leetcode.com/accounts/login/";

interface AuthorizationResult {
    success: boolean;
    message: string;
    error?: string;
}

async function authorizeLeetCode(
    site: "global" | "cn" = "global"
): Promise<AuthorizationResult> {
    let browser: Browser | null = null;

    try {
        // Launch browser with visible UI
        browser = await chromium.launch({ headless: false });
        const context = await browser.newContext();
        const page = await context.newPage();

        const loginUrl =
            site === "cn"
                ? "https://leetcode.cn/accounts/login/"
                : LEETCODE_LOGIN_URL;

        // Navigate to login page
        await page.goto(loginUrl);

        // Wait for user to complete login (detect successful login by checking for profile page elements)
        console.log("Waiting for user to log in...");

        // Wait for either:
        // 1. User profile dropdown (successful login)
        // 2. Timeout (60 seconds)
        try {
            await page.waitForSelector('[data-cypress="user-menu"]', {
                timeout: 60000
            });
        } catch (error) {
            return {
                success: false,
                message: "Login timeout. Please try again.",
                error: "User did not complete login within 60 seconds"
            };
        }

        // Extract cookies
        const cookies = await context.cookies();

        const csrfCookie = cookies.find((c) => c.name === "csrftoken");
        const sessionCookie = cookies.find(
            (c) => c.name === "LEETCODE_SESSION"
        );

        if (!csrfCookie || !sessionCookie) {
            return {
                success: false,
                message: "Failed to extract authentication cookies",
                error: "csrftoken or LEETCODE_SESSION cookie not found"
            };
        }

        // Save credentials
        const credentials: LeetCodeCredentials = {
            csrftoken: csrfCookie.value,
            LEETCODE_SESSION: sessionCookie.value,
            site,
            createdAt: new Date().toISOString()
        };

        await credentialsStorage.save(credentials);

        await browser.close();

        return {
            success: true,
            message: "Successfully authorized with LeetCode! Credentials saved."
        };
    } catch (error) {
        if (browser) {
            await browser.close();
        }

        return {
            success: false,
            message: "Authorization failed",
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Auth tool registry class that handles registration of LeetCode authentication tools.
 */
export class AuthToolRegistry extends ToolRegistry {
    protected registerCommon(): void {
        // Authorization tool
        this.server.tool(
            "authorize_leetcode",
            "Authorize with LeetCode by launching a browser for one-time login. Saves credentials for future use.",
            {
                site: z
                    .enum(["global", "cn"])
                    .default("global")
                    .describe("LeetCode site to authorize with (global or cn)")
            },
            async ({ site }) => {
                const result = await authorizeLeetCode(site);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }
        );
    }

    protected registerGlobal(): void {
        // No global-specific auth tools
    }

    protected registerCN(): void {
        // No CN-specific auth tools
    }
}

export function registerAuthTools(
    server: McpServer,
    leetcodeService: LeetCodeBaseService
): void {
    const registry = new AuthToolRegistry(server, leetcodeService);
    registry.registerTools();
}
