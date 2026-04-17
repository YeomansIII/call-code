import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
} from "@discordjs/voice";

const TOKEN = process.env.DISCORD_BOT_TOKEN!;
const GUILD_ID = process.env.DISCORD_GUILD_ID!;
const CHANNEL_ID = process.env.DISCORD_VOICE_CHANNEL_ID!;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.once("ready", async () => {
  console.log(`Logged in as ${client.user!.tag}`);

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.error(`Guild ${GUILD_ID} not found`);
    process.exit(1);
  }
  console.log(`Found guild: ${guild.name}`);

  const connection = joinVoiceChannel({
    channelId: CHANNEL_ID,
    guildId: GUILD_ID,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
    console.log("Voice connection ready!");
    console.log("Bot is in the voice channel. Disconnecting in 5 seconds...");
    setTimeout(() => {
      connection.destroy();
      client.destroy();
      console.log("Done. Connection test passed!");
      process.exit(0);
    }, 5000);
  } catch (e) {
    console.error("Failed to connect to voice:", e);
    process.exit(1);
  }
});

client.login(TOKEN);
