import { pino } from "pino";

const logger = pino(
    {
        level: "info",
        formatters: {
            level: (label: string) => ({ level: label.toUpperCase() })
        },
        timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
        messageKey: "message",
        nestedKey: "payload"
    },
    process.stderr // Write to stderr instead of stdout for MCP compatibility
);

export default logger;
