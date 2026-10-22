// The town's sound: a small chiptune sequencer (pulse-wave arpeggios, a triangle bass, a wandering melody) and the
// beeps of an old game for errands, coins, pigeons, and births. Off until someone turns it on.

const NOTE = (midi) => 440 * 2 ** ((midi - 69) / 12);
// I–vi–IV–V in C, and a softer ii–V–I–vi for the night.
const DAY = [
    [48, 60, 64, 67],
    [45, 57, 60, 64],
    [41, 57, 60, 65],
    [43, 55, 59, 62],
];
const NIGHT = [
    [50, 62, 65, 69],
    [43, 55, 59, 65],
    [48, 60, 64, 67],
    [45, 57, 60, 64],
];
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];

export class Sound {
    constructor() {
        this.ctx = null;
        this.on = false;
        this.night = false;
        this.window = 0;
        this.count = 0;
    }

    enable() {
        const Context = window.AudioContext || window.webkitAudioContext;

        if (!Context) {
            return false;
        }

        if (!this.ctx) {
            this.ctx = new Context();
            this.master = this.ctx.createGain();
            this.master.gain.value = 0.22;
            this.master.connect(this.ctx.destination);
            this.music = this.ctx.createGain();
            this.music.gain.value = 0.32;
            this.music.connect(this.master);
            this.pulse25 = this.pulseWave(0.25);
            this.pulse12 = this.pulseWave(0.125);
            this.noise = this.makeNoise();
        }

        this.ctx.resume().catch(() => {});
        this.on = true;
        this.step = 0;
        this.nextAt = this.ctx.currentTime + 0.1;
        clearInterval(this.timer);
        this.timer = setInterval(() => this.schedule(), 40);

        return true;
    }

    disable() {
        this.on = false;
        clearInterval(this.timer);
        this.ctx?.suspend().catch(() => {});
    }

    close() {
        this.disable();
        this.ctx?.close().catch(() => {});
        this.ctx = null;
    }

    setNight(night) {
        this.night = night;
    }

    pulseWave(duty) {
        const size = 32;
        const real = new Float32Array(size);
        const imag = new Float32Array(size);

        for (let n = 1; n < size; n++) {
            real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
        }

        return this.ctx.createPeriodicWave(real, imag);
    }

    makeNoise() {
        // Two seconds: longer than the longest hiss (thunder, 1.4 s).
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let index = 0; index < data.length; index++) {
            data[index] = Math.random() * 2 - 1;
        }

        return buffer;
    }

    voice(frequency, at, length, { wave = "square", volume = 0.1, slide = 0, out } = {}) {
        const ctx = this.ctx;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();

        if (wave instanceof PeriodicWave) {
            oscillator.setPeriodicWave(wave);
        } else {
            oscillator.type = wave;
        }

        oscillator.frequency.setValueAtTime(frequency, at);

        if (slide) {
            oscillator.frequency.exponentialRampToValueAtTime(
                Math.max(30, frequency * slide),
                at + length,
            );
        }

        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(volume, at + 0.008);
        gain.gain.setValueAtTime(volume, at + length * 0.6);
        gain.gain.linearRampToValueAtTime(0, at + length);
        oscillator.connect(gain);
        gain.connect(out ?? this.master);
        oscillator.start(at);
        oscillator.stop(at + length + 0.02);
    }

    hiss(at, length, volume = 0.1, filter = 1200) {
        const ctx = this.ctx;
        const source = ctx.createBufferSource();
        const band = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        source.buffer = this.noise;
        band.type = "lowpass";
        band.frequency.value = filter;
        gain.gain.setValueAtTime(volume, at);
        gain.gain.exponentialRampToValueAtTime(0.001, at + length);
        source.connect(band);
        band.connect(gain);
        gain.connect(this.master);
        source.start(at, Math.random() * 0.5);
        source.stop(at + length);
    }

    /** The music: eighth notes, two bars a chord, scheduled a little ahead. */
    schedule() {
        if (!this.on || !this.ctx || document.hidden) {
            return;
        }

        const tempo = this.night ? 76 : 96;
        const eighth = 60 / tempo / 2;

        // Back from a hidden tab: start from now, never play the missed notes all at once.
        if (this.nextAt < this.ctx.currentTime - 0.1) {
            this.nextAt = this.ctx.currentTime + 0.1;
        }

        while (this.nextAt < this.ctx.currentTime + 0.2) {
            const step = this.step;
            const chords = this.night ? NIGHT : DAY;
            const chord = chords[Math.floor(step / 16) % chords.length];
            const at = this.nextAt;
            const beat = step % 16;

            if (beat % 4 === 0) {
                this.voice(NOTE(chord[0] - 12 + (beat === 8 ? 12 : 0)), at, eighth * 1.8, {
                    wave: "triangle",
                    volume: 0.28,
                    out: this.music,
                });
            }

            const arpeggio = [1, 2, 3, 2][beat % 4];

            this.voice(NOTE(chord[arpeggio] + 12), at, eighth * 0.7, {
                wave: this.pulse12,
                volume: this.night ? 0.035 : 0.05,
                out: this.music,
            });

            if (beat % 2 === 0 && Math.random() < (this.night ? 0.25 : 0.4)) {
                const root = chord[1];
                const note = root + 12 + PENTA[Math.floor(Math.random() * PENTA.length)];

                this.voice(NOTE(note), at, eighth * (Math.random() < 0.3 ? 3 : 1.6), {
                    wave: this.pulse25,
                    volume: 0.06,
                    out: this.music,
                });
            }

            if (!this.night && beat % 4 === 2) {
                this.hiss(at, 0.03, 0.05, 6000);
            }

            this.step++;
            this.nextAt += eighth;
        }
    }

    play(kind, index = 0) {
        if (!this.on || !this.ctx || document.hidden) {
            return;
        }

        const now = performance.now();

        if (now - this.window > 1000) {
            this.window = now;
            this.count = 0;
        }

        if (++this.count > 8) {
            return;
        }

        const at = this.ctx.currentTime + 0.01;

        switch (kind) {
            case "tool":
                this.voice(NOTE(72 + PENTA[index % PENTA.length]), at, 0.07, {
                    wave: this.pulse25,
                    volume: 0.07,
                });
                break;
            case "coin":
                this.voice(NOTE(83), at, 0.07, { volume: 0.06 });
                this.voice(NOTE(88), at + 0.07, 0.22, { volume: 0.06 });
                break;
            case "chirp":
                this.voice(NOTE(96), at, 0.06, { wave: this.pulse12, volume: 0.05, slide: 1.4 });
                this.voice(NOTE(98), at + 0.08, 0.05, {
                    wave: this.pulse12,
                    volume: 0.04,
                    slide: 1.3,
                });
                break;
            case "msg":
                this.voice(NOTE(79), at, 0.08, { wave: this.pulse25, volume: 0.07 });
                this.voice(NOTE(84), at + 0.09, 0.14, { wave: this.pulse25, volume: 0.07 });
                break;
            case "report":
                [76, 79, 84].forEach((note, step) =>
                    this.voice(NOTE(note), at + step * 0.07, 0.1, {
                        wave: this.pulse25,
                        volume: 0.07,
                    }),
                );
                break;
            case "link":
            case "start":
                [60, 64, 67, 72, 76, 79, 84].forEach((note, step) =>
                    this.voice(NOTE(note), at + step * 0.05, 0.08, { volume: 0.06 }),
                );
                break;
            case "error":
                this.voice(NOTE(45), at, 0.25, { volume: 0.1, slide: 0.5 });
                this.hiss(at, 0.15, 0.08, 800);
                break;
            case "thunder":
                this.hiss(at, 1.4, 0.35, 300);
                break;
            case "bell":
                this.voice(NOTE(84), at, 0.6, { wave: "sine", volume: 0.08 });
                this.voice(NOTE(96), at, 0.4, { wave: "sine", volume: 0.03 });
                break;
            case "select":
                this.voice(NOTE(88), at, 0.04, { wave: this.pulse12, volume: 0.05 });
                break;
            default:
                break;
        }
    }
}
