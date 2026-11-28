---
name: gg-audio-dsp-acoustics
description: Universal audio DSP and voice acoustics measurement skill distilled from GenerativeGame's Tool/voiceclone/voice_metrics.py and RealtimeAudioMeter plugin. Computes F0, HNR, spectral centroid, 2-8kHz consonant onset energy, tail pitch slope, and dBFS metering.
---

# GG Audio DSP & Voice Acoustics Analyzer

Distilled from `Tool/voiceclone/voice_metrics.py` and `Plugins/RealtimeAudioMeter`. Use this skill whenever a task requires **objective voice/TTS quality evaluation**, **acoustic drift detection**, **prosody/intonation analysis**, or **realtime PCM-to-dBFS audio metering**.

## When to use

- "帮我做一个检测配音质量或者看实时音量跳动的小工具，能测出声音有没有杂音、咬字清不清楚、句尾语调是不是拖腔，再带一个实时的分贝音量条。"
- Any task measuring voice/TTS clarity (F0, HNR, spectral centroid, consonant burst energy, tail pitch slope) or building a realtime dBFS audio meter.

## Three-Round Hidden Verification Gate (Headless DSP Core First)

- **R1 (Silence Gate & PCM Normalization)**: Filter out unvoiced/silent frames ($E_{\text{RMS}} < 200$ in int16 scale) and normalize PCM buffers before spectral or autocorrelation passes.
- **R2 (Autocorrelation F0/HNR & P90 Consonant Burst Gate)**: Clamp normalized lag peak $r_{\max} \in [10^{-6}, 1-10^{-6}]$ over $[60, 450]\text{ Hz}$ for `f0`/`hnr`, and compute 90th-percentile 2–8 kHz energy `onset_hi_p90`.
- **R3 (Phrase-Tail Slope & Safe dBFS Gate)**: Fit linear regression on the last 30% of voiced phrase segments (`tail_slope`, semitone span $12\log_2$) and clamp linear amplitude at $10^{-5}$ before $20\log_{10}$ dBFS conversion (zero `NaN`/`-Infinity`).

## Single Source of Truth in GenerativeGame

- When working inside the `GenerativeGame` repository on Python audio/TTS scripts, **always import `from voice_metrics import analyze` (`Tool/voiceclone/voice_metrics.py`)** rather than copying FFT or autocorrelation snippets into new `gen_*` or `test_*` scripts.
- When building standalone tools or web/game audio analyzers outside `Tool/voiceclone`, implement the exact mathematical definitions below to maintain metric parity.

## 1. Time-Domain & Autocorrelation Metrics ($F_0$ & HNR)

Given a mono 16-bit PCM signal $x[n]$ sampled at $f_s$ (converted to `float64`):

1. **Framing & Voiced Gate**:
   - Window length $L = \lfloor 0.04 f_s \rfloor$ (40 ms), hop size $H = \lfloor 0.02 f_s \rfloor$ (20 ms), Hanning window $w[n]$.
   - Compute frame RMS energy $E = \sqrt{\frac{1}{L}\sum seg[n]^2}$. Ignore silent/unvoiced frames where $E < 200$ (in int16 scale).
2. **Normalized Autocorrelation**:
   - Zero-mean and window the segment: $s[n] = (seg[n] - \bar{seg}) \cdot w[n]$.
   - Compute autocorrelation $R[\tau] = \sum_{n} s[n]s[n+\tau]$ for lag $\tau \ge 0$, and normalize by zero-lag energy: $r[\tau] = R[\tau] / R[0]$.
3. **Fundamental Frequency ($F_0$) & Harmonics-to-Noise Ratio (HNR)**:
   - Search lag range corresponding to human pitch $[60\text{ Hz}, 450\text{ Hz}]$: $\tau \in \left[\lfloor f_s / 450 \rfloor, \lfloor f_s / 60 \rfloor\right]$.
   - Let $r_{\max} = \max_{\tau} r[\tau]$ at lag $\tau^* = \arg\max_{\tau} r[\tau]$.
   - If $r_{\max} \ge 0.5$ (voiced frame):
     $$
     F_0 = \frac{f_s}{\tau^*}, \qquad \text{HNR (dB)} = 10 \log_{10}\left(\frac{\text{clamp}(r_{\max}, 10^{-6}, 1-10^{-6})}{1 - \text{clamp}(r_{\max}, 10^{-6}, 1-10^{-6})}\right)
     $$
   - Aggregate across the clip using **median** for `hnr` and `f0`, and **standard deviation** for `f0_std` (pitch expressiveness / spread).

## 2. Frequency-Domain Articulation Metrics (Spectral Centroid & Consonant Onset)

Use 20 ms non-overlapping frames ($L_2 = \lfloor 0.02 f_s \rfloor$, Hanning window $w_2$, gated at $E \ge 200$):

1. **Real FFT Magnitude Spectrum**:
   - $S[k] = \left|\text{rfft}((seg - \bar{seg}) \cdot w_2)\right|$ at frequency bins $f[k]$.
2. **Spectral Centroid (Brightness / Presence)**:
   $$
   C_{\text{frame}} = \frac{\sum_{k} f[k] \cdot S[k]}{\sum_{k} S[k]}
   $$
3. **2–8 kHz Consonant / Sibilance Energy Ratio (`onset_hi` & `onset_hi_p90`)**:
   $$
   R_{2\text{–}8\text{kHz}} = \frac{\sum_{2000 \le f[k] \le 8000} S[k]}{\sum_{k} S[k]}
   $$
   - **Critical Rule**: Consonant plosives and fricatives occur in brief bursts. The median (`onset_hi`) smooths them out; always compute the **90th percentile (`onset_hi_p90`)** when evaluating articulation clarity or director emphasis tags.

## 3. Prosody & Phrase-Tail Intonation Metrics (`tail_slope` & `tail_semis`)

1. **Energy-Based Phrase Segmentation**:
   - Threshold frame energy at $8\%$ of peak frame energy ($E_{\text{thr}} = 0.08 \max E$).
   - Group contiguous frames with $E > E_{\text{thr}}$ of length $\ge 5$ frames ($\ge 100\text{ ms}$) into phrase segments $[a, b]$.
2. **Tail 30% Pitch Regression**:
   - For each phrase segment with at least 6 voiced points $(t_i, F_{0,i})$, take the last $n = \max(\lfloor 0.3 N_{\text{voiced}} \rfloor, 3)$ points.
   - Fit a 1st-order linear regression $F_0(t) \approx k_{\text{tail}} \cdot t + b$ (`np.polyfit(ts, fs, 1)[0]`) to obtain `tail_slope` (Hz/s).
   - Compute the tail semitone span to distinguish natural rising inflection from exaggerated sing-song dragging:
     $$
     \Delta_{\text{semis}} = 12 \log_2\left(\frac{F_{0,\text{end}}}{F_{0,\text{start}}}\right)
     $$

## 4. Realtime Audio Metering & Thread-Safety Rules

When implementing runtime or editor audio meters (e.g., `RealtimeAudioMeter` / WebAudio / C++ submix listeners):

- **Linear to dBFS Conversion**:
  $$
  \text{dBFS} = 20 \log_{10}\left(\max(|x|_{\text{norm}}, 10^{-5})\right) \in [-100\text{ dB}, 0\text{ dB}]
  $$
  Track instantaneous **Peak**, windowed **RMS**, and decaying **Peak Hold**.
- **Audio Thread Isolation**:
  - Never allocate unbounded arrays, perform disk I/O, or query game-thread scene objects on the audio render thread.
  - Enqueue bounded PCM chunks to a lock-free / background writer thread, and rotate diagnostic event logs (e.g., every 10,000 records).
