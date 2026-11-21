// Sound, all synthesized with WebAudio — no audio files. Engine hum follows the
// car's speed, sirens wail while wanted, and gunshots, punches, pickups and UI
// blips are short noise or tone bursts. Everything is guarded: no audio context,
// no crash, and M mutes it all.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.value = freq;
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch { /* sound is decoration, never fatal */ }
  }

  function noise(dur, vol, low) {
    if (!ensure() || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = low || 1200;
      const gain = ctx.createGain();
      gain.gain.value = vol || 0.3;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch { /* sound is decoration, never fatal */ }
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    isMuted() { return muted; },
    engine(speed, driving) {
      if (!ensure() || muted) return;
      try {
        const target = driving ? 0.05 + Math.min(0.12, Math.abs(speed) / 6000) : 0;
        engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(55 + Math.abs(speed) * 0.16, ctx.currentTime, 0.1);
      } catch { /* ignore */ }
    },
    siren(wanted) {
      if (!ensure() || muted) return;
      try {
        sirenGain.gain.setTargetAtTime(wanted > 0 ? 0.045 : 0, ctx.currentTime, 0.2);
        if (wanted > 0) sirenOsc.frequency.setTargetAtTime(650 + Math.sin(performance.now() / 380) * 220, ctx.currentTime, 0.05);
      } catch { /* ignore */ }
    },
    gunshot() { noise(0.12, 0.4, 900); tone(160, 0.08, 'square', 0.15, 60); },
    punch() { noise(0.08, 0.3, 500); },
    pickup() { tone(880, 0.12, 'sine', 0.22); tone(1320, 0.16, 'sine', 0.18); },
    blip() { tone(660, 0.07, 'sine', 0.2); },
    mission() { tone(523, 0.14, 'sine', 0.25); tone(784, 0.2, 'sine', 0.25); },
    busted() { tone(220, 0.5, 'sawtooth', 0.2, 110); },
  };
}
