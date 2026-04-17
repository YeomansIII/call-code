import {
  joinVoiceChannel,
  EndBehaviorType,
  VoiceConnectionStatus,
  entersState,
  createAudioResource,
  createAudioPlayer,
  AudioPlayerStatus,
  type VoiceConnection,
} from "@discordjs/voice";
import type { Guild } from "discord.js";
import * as prism from "prism-media";
import { EventEmitter } from "node:events";
import { config } from "../config.ts";
import { downsample48kStereoTo16kMono } from "../audio/downsample.ts";

export class VoiceBridge extends EventEmitter {
  private connection: VoiceConnection | null = null;
  private player = createAudioPlayer();

  async connect(guild: Guild): Promise<void> {
    this.connection = joinVoiceChannel({
      channelId: config.discord.voiceChannelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    await entersState(this.connection, VoiceConnectionStatus.Ready, 20_000);
    this.connection.subscribe(this.player);
    console.log("[voice] Connected to voice channel");

    this.subscribeToUser();
  }

  private subscribeToUser(): void {
    if (!this.connection) return;

    const opusStream = this.connection.receiver.subscribe(config.discord.userId, {
      end: { behavior: EndBehaviorType.Manual },
    });

    const decoder = new prism.opus.Decoder({
      rate: 48_000,
      channels: 2,
      frameSize: 960,
    });

    opusStream.pipe(decoder);

    decoder.on("data", (pcm48kStereo: Buffer) => {
      const pcm16kMono = downsample48kStereoTo16kMono(pcm48kStereo);
      this.emit("audio", pcm16kMono);
    });
  }

  async play(filePath: string): Promise<void> {
    if (!this.connection) throw new Error("Not connected");

    const resource = createAudioResource(filePath);
    this.player.play(resource);

    await entersState(this.player, AudioPlayerStatus.Idle, 30_000);
  }

  stopPlayback(): void {
    this.player.stop(true);
  }

  get isPlaying(): boolean {
    return this.player.state.status === AudioPlayerStatus.Playing;
  }

  disconnect(): void {
    this.player.stop(true);
    this.connection?.destroy();
    this.connection = null;
  }
}
