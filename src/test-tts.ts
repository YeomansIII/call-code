import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  createAudioResource,
  createAudioPlayer,
  AudioPlayerStatus,
} from "@discordjs/voice";
import { speak } from "./tts/speak.ts";

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

  const guild = client.guilds.cache.get(GUILD_ID)!;
  const connection = joinVoiceChannel({
    channelId: CHANNEL_ID,
    guildId: GUILD_ID,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
  console.log("Voice connected, generating TTS...");

  const audioFile = await speak("Jarvis online. All systems operational.");
  console.log(`TTS file: ${audioFile}`);

  const player = createAudioPlayer();
  connection.subscribe(player);

  const resource = createAudioResource(audioFile);
  player.play(resource);

  player.on("error", (err) => console.error("Player error:", err));

  await entersState(player, AudioPlayerStatus.Idle, 15_000);
  console.log("Playback complete. Disconnecting...");

  connection.destroy();
  client.destroy();
  process.exit(0);
});

client.login(TOKEN);
