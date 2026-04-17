export function downsample48kStereoTo16kMono(input: Buffer): Buffer {
  const samples = input.length / 4;
  const outputSamples = Math.floor(samples / 3);
  const output = Buffer.alloc(outputSamples * 2);

  for (let i = 0; i < outputSamples; i++) {
    const srcOffset = i * 3 * 4;
    const left = input.readInt16LE(srcOffset);
    const right = input.readInt16LE(srcOffset + 2);
    const mono = Math.round((left + right) / 2);
    output.writeInt16LE(mono, i * 2);
  }

  return output;
}
