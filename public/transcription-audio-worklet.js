class Pcm16ChunkProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.samples = [];
    this.chunkSamples = Math.max(128, Math.round(sampleRate * ((options.processorOptions?.chunkMilliseconds ?? 100) / 1000)));
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    for (let index = 0; index < input.length; index += 1) this.samples.push(input[index]);
    while (this.samples.length >= this.chunkSamples) {
      const pcm = new Int16Array(this.chunkSamples);
      for (let index = 0; index < pcm.length; index += 1) {
        const sample = Math.max(-1, Math.min(1, this.samples[index]));
        pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      }
      this.samples.splice(0, this.chunkSamples);
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }
    return true;
  }
}
registerProcessor("clinicflow-pcm16", Pcm16ChunkProcessor);
