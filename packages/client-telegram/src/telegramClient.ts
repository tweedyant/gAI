import { Context, Telegraf } from "telegraf";
import { message } from 'telegraf/filters';
import { IAgentRuntime, elizaLogger } from "@ai16z/eliza";
import { MessageManager } from "./messageManager.ts";
import { getOrCreateRecommenderInBe } from "./getOrCreateRecommenderInBe.ts";
import adapter from "../../../packages/adapter-postgres"


const RATE_LIMITS = {
    MAX_MESSAGES: 100, // Max messages allowed in the timeframe
    TIMEFRAME: 60000, // Timeframe in milliseconds (1 minute)
    COOLDOWN: 300000, // Cooldown period in milliseconds (5 minutes)
};

const userRateLimits = new Map<string, { timestamps: number[]; cooldownUntil: number }>();

function isUserRateLimited(userId: string): boolean {
    const now = Date.now();
    const userRateData = userRateLimits.get(userId);

    if (!userRateData) {
        // First message from this user
        userRateLimits.set(userId, { timestamps: [now], cooldownUntil: 0 });
        return false; // Not rate-limited
    }

    // Check cooldown
    if (userRateData.cooldownUntil > now) {
        return true; // User is in cooldown
    }

    // Filter timestamps to keep only those within the timeframe
    userRateData.timestamps = userRateData.timestamps.filter(ts => now - ts <= RATE_LIMITS.TIMEFRAME);

    if (userRateData.timestamps.length >= RATE_LIMITS.MAX_MESSAGES) {
        // User exceeds limit, apply cooldown
        userRateData.cooldownUntil = now + RATE_LIMITS.COOLDOWN;
        return true; // Rate-limited
    }

    // Add current timestamp
    userRateData.timestamps.push(now);
    return false; // Not rate-limited
}


export class TelegramClient {
    private bot: Telegraf<Context>;
    private runtime: IAgentRuntime;
    private messageManager: MessageManager;
    private backend;
    private backendToken;
    private tgTrader;

    constructor(runtime: IAgentRuntime, botToken: string) {
        elizaLogger.log("📱 Constructing new TelegramClient...");
        this.runtime = runtime;
        this.bot = new Telegraf(botToken);
        this.messageManager = new MessageManager(this.bot, this.runtime);
        this.backend = runtime.getSetting("BACKEND_URL");
        this.backendToken = runtime.getSetting("BACKEND_TOKEN");
        this.tgTrader = runtime.getSetting("TG_TRADER"); // boolean To Be added to the settings
        elizaLogger.log("✅ TelegramClient constructor completed");
    }


    public async start(): Promise<void> {
        elizaLogger.log("🚀 Starting Telegram bot...");
        try {
            await this.initializeBot();
            this.setupMessageHandlers();
            this.setupShutdownHandlers();
        } catch (error) {
            elizaLogger.error("❌ Failed to launch Telegram bot:", error);
            throw error;
        }
    }

    private async initializeBot(): Promise<void> {
        this.bot.launch({ dropPendingUpdates: true });
        elizaLogger.log(
            "✨ Telegram bot successfully launched and is running!"
        );

        const botInfo = await this.bot.telegram.getMe();
        this.bot.botInfo = botInfo;
        elizaLogger.success(`Bot username: @${botInfo.username}`);

        this.messageManager.bot = this.bot;
    }

    private async isGroupAuthorized(ctx: Context): Promise<boolean> {
        return true; // Allow the bot to respond in all groups
    }


    private setupMessageHandlers(): void {
        elizaLogger.log("Setting up message handler...");

        this.bot.on(message('new_chat_members'), async (ctx) => {
            try {
                const newMembers = ctx.message.new_chat_members;
                const isBotAdded = newMembers.some(member => member.id === ctx.botInfo.id);

                if (isBotAdded && !(await this.isGroupAuthorized(ctx))) {
                    return;
                }
            } catch (error) {
                elizaLogger.error("Error handling new chat members:", error);
            }
        });

        this.bot.on("message", async (ctx) => {
            try {
                const roomId = ctx.chat.id.toString(); // Extract roomId from chat ID
                const userId = roomId; // Use roomId as userId
                const content = ctx.message.text || ""; // Message content

                if (!content) {
                    elizaLogger.warn("Empty message received.");
                    return;
                }

                // Rate-limiting logic
                if (isUserRateLimited(roomId)) {
                    elizaLogger.info(`Room ${roomId} is rate-limited.`);
                    await ctx.reply("if you keep spamming you're gonna get this faggot overwhemled.");
                    return;
                }

                // Pass roomId and userId to MessageManager
                await this.messageManager.handleMessage(ctx, { roomId, userId, content });

            } catch (error) {
                elizaLogger.error("Error handling message:", error);
                if (error?.response?.error_code !== 403) {
                    try {
                        await ctx.reply("*busts a nut on your screen*");
                    } catch (replyError) {
                        elizaLogger.error("Failed to send error message:", replyError);
                    }
                }
            }
        });


        this.bot.on("photo", (ctx) => {
            elizaLogger.log(
                "📸 Received photo message with caption:",
                ctx.message.caption
            );
        });

        this.bot.on("document", (ctx) => {
            elizaLogger.log(
                "📎 Received document message:",
                ctx.message.document.file_name
            );
        });

        this.bot.catch((err, ctx) => {
            elizaLogger.error(`❌ Telegram Error for ${ctx.updateType}:`, err);
            ctx.reply("*busts a nut on your screen*");

        });
    }

    private setupShutdownHandlers(): void {
        const shutdownHandler = async (signal: string) => {
            elizaLogger.log(
                `⚠️ Received ${signal}. Shutting down Telegram bot gracefully...`
            );
            try {
                await this.stop();
                elizaLogger.log("🛑 Telegram bot stopped gracefully");
            } catch (error) {
                elizaLogger.error(
                    "❌ Error during Telegram bot shutdown:",
                    error
                );
                throw error;
            }
        };

        process.once("SIGINT", () => shutdownHandler("SIGINT"));
        process.once("SIGTERM", () => shutdownHandler("SIGTERM"));
        process.once("SIGHUP", () => shutdownHandler("SIGHUP"));
    }

    public async stop(): Promise<void> {
        elizaLogger.log("Stopping Telegram bot...");
        await this.bot.stop();
        elizaLogger.log("Telegram bot stopped");
    }
}
