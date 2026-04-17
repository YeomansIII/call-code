import { Client, GatewayIntentBits, type Guild } from "discord.js";
import { config } from "../config.ts";

export async function createBot(): Promise<{ client: Client; guild: Guild }> {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
    ],
  });

  await client.login(config.discord.token);

  await new Promise<void>((resolve) => {
    if (client.isReady()) return resolve();
    client.once("ready", () => resolve());
  });

  const guild = client.guilds.cache.get(config.discord.guildId);
  if (!guild) {
    throw new Error(`Guild ${config.discord.guildId} not found. Is the bot invited?`);
  }

  console.log(`[discord] Logged in as ${client.user!.tag}`);
  return { client, guild };
}
