import { Credential, LeetCode } from "leetcode-query";
import { LeetCodeBaseService } from "./leetcode-base-service.js";
import { LeetCodeGlobalService } from "./leetcode-global-service.js";

/**
 * Factory class for creating LeetCode service instances.
 * This factory handles the creation of Global LeetCode service implementations
 * and manages authentication credentials when provided.
 */
export class LeetCodeServiceFactory {
    /**
     * Creates and configures a LeetCode service instance with optional session credentials.
     *
     * @param sessionCookie - Optional session cookie string for authenticated API access
     * @returns A promise that resolves to a configured LeetCodeBaseService implementation
     */
    static async createService(
        sessionCookie?: string
    ): Promise<LeetCodeBaseService> {
        // Create authentication credential if session cookie is provided
        const credential: Credential = new Credential();
        if (sessionCookie) {
            await credential.init(sessionCookie);
        }

        // Create and return the global service
        return new LeetCodeGlobalService(new LeetCode(credential), credential);
    }
}
