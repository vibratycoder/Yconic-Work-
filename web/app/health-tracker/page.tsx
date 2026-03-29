'use client';

/**
 * Bio Tracker — real-time animated vitals and EKG monitor.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

/* ── EKG waveform math ───────────────────────────────────────────────────── */

/**
 * Returns normalised ECG amplitude for a given cardiac cycle phase (0–1).
 *
 * Uses Gaussian curves to model each deflection of a real Lead II trace:
 *   P wave  → small rounded atrial depolarisation bump
 *   Q wave  → small negative pre-QRS notch
 *   R wave  → tall sharp ventricular spike
 *   S wave  → brief negative post-R undershoot
 *   T wave  → broad asymmetric repolarisation hump
 *
 * Timings derived from standard 70 BPM sinus rhythm (860 ms cycle):
 *   P peak  ~80 ms  → phase 0.093
 *   QRS onset ~165 ms → phase 0.192
 *   R peak  ~220 ms → phase 0.256
 *   T peak  ~480 ms → phase 0.558
 */
function ecgSample(phase: number): number {
  const g = (x: number, mu: number, sigma: number) =>
    Math.exp(-0.5 * ((x - mu) / sigma) ** 2);

  const p = g(phase, 0.093, 0.021) * 0.18;          // P  wave — smooth, small
  const q = -g(phase, 0.207, 0.009) * 0.13;          // Q  wave — narrow negative notch
  const r = g(phase, 0.248, 0.013) * 1.0;            // R  wave — dominant spike
  const s = -g(phase, 0.285, 0.011) * 0.24;          // S  wave — brief undershoot
  const t = g(phase, 0.530, 0.062) * 0.31            // T  wave — broad, asymmetric
           + g(phase, 0.565, 0.038) * 0.09;          //         — slight right-lean

  return p + q + r + s + t;
}

/* ── Simulation helpers ──────────────────────────────────────────────────── */

const STEP_GOAL = 10_000;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function jitter(base: number, range: number) {
  return base + (Math.random() - 0.5) * 2 * range;
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

interface RingProps { value: number; goal: number; color: string; size?: number }
function Ring({ value, goal, color, size = 80 }: RingProps) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, value / goal);
  const dash = pct * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,0.07)" strokeWidth={8} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease', filter: `drop-shadow(0 0 6px ${color})` }}
      />
    </svg>
  );
}

interface SparklineProps { data: number[]; color: string; width?: number; height?: number }
function Sparkline({ data, color, width = 120, height = 36 }: SparklineProps) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 6) - 3;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2}
        strokeLinejoin="round" strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}

interface SleepBarProps { hours: number }
function SleepBar({ hours }: SleepBarProps) {
  // Approximate sleep stages from total hours
  const awake = 0.05, rem = 0.22, light = 0.46, deep = 0.27;
  const stages = [
    { label: 'Awake',  pct: awake,  color: '#ff453a' },
    { label: 'REM',    pct: rem,    color: '#bf5af2' },
    { label: 'Light',  pct: light,  color: '#38bdf8' },
    { label: 'Deep',   pct: deep,   color: '#0ea5e9' },
  ];
  return (
    <div className="w-full">
      <div className="flex w-full rounded-full overflow-hidden h-3 gap-0.5">
        {stages.map((s) => (
          <div key={s.label} style={{ width: `${s.pct * 100}%`, backgroundColor: s.color,
            boxShadow: `0 0 6px ${s.color}` }} />
        ))}
      </div>
      <div className="flex gap-3 mt-2 flex-wrap">
        {stages.map((s) => (
          <div key={s.label} className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label} {(s.pct * hours).toFixed(1)}h
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── EKG Canvas ──────────────────────────────────────────────────────────── */

interface EKGCanvasProps { bpm: number }
function EKGCanvas({ bpm }: EKGCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bpmRef = useRef(bpm);
  const bufferRef = useRef<number[]>([]);
  const tRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastRef = useRef<number>(0);

  useEffect(() => { bpmRef.current = bpm; }, [bpm]);

  // Per-beat variance state — amplitude scale and period jitter change each beat
  const beatAmpRef = useRef(1.0);
  const beatPeriodJitterRef = useRef(0.0);
  const lastBeatPhaseRef = useRef(0.0);
  const baselineRef = useRef(0.0);
  const baselineTargetRef = useRef(0.0);
  const baselineStepRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const SPEED = 50;     // px / s
    const SAMPLE_HZ = 300;

    // Pre-fill buffer so the screen is never blank
    const prefill = canvas.width + 60;
    while (bufferRef.current.length < prefill) {
      const period = 60 / bpmRef.current;
      const phase = (tRef.current % period) / period;
      bufferRef.current.push(ecgSample(phase));
      tRef.current += 1 / SAMPLE_HZ;
    }

    const draw = (ts: number) => {
      const dt = Math.min((ts - lastRef.current) / 1000, 0.05);
      lastRef.current = ts;

      const w = canvas.width;
      const h = canvas.height;

      // Add new samples proportional to elapsed time
      const newSamples = Math.round(SPEED * dt * (SAMPLE_HZ / SPEED));
      for (let i = 0; i < newSamples; i++) {
        const nominalPeriod = 60 / bpmRef.current;
        // Apply per-beat period jitter (±6% of nominal period)
        const period = nominalPeriod * (1 + beatPeriodJitterRef.current);
        const phase = (tRef.current % period) / period;

        // Detect new beat (phase wrapped around) → refresh per-beat variance
        if (phase < lastBeatPhaseRef.current) {
          beatAmpRef.current = 0.78 + Math.random() * 0.46;          // 0.78–1.24
          beatPeriodJitterRef.current = (Math.random() - 0.5) * 0.12; // ±6%
        }
        lastBeatPhaseRef.current = phase;

        // Slow baseline wander: drift toward a wandering target
        baselineStepRef.current++;
        if (baselineStepRef.current % 180 === 0) {
          // Pick a new wander target every ~0.6 s
          baselineTargetRef.current = (Math.random() - 0.5) * 0.06;
        }
        baselineRef.current += (baselineTargetRef.current - baselineRef.current) * 0.003;

        // Tiny high-frequency muscle noise on top
        const noise = (Math.random() - 0.5) * 0.018;

        bufferRef.current.push(
          ecgSample(phase) * beatAmpRef.current + baselineRef.current + noise
        );
        tRef.current += 1 / SAMPLE_HZ;
      }
      while (bufferRef.current.length > w + 60) {
        bufferRef.current.shift();
      }

      // Background
      ctx.fillStyle = '#020b17';
      ctx.fillRect(0, 0, w, h);

      // Grid lines
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(56,189,248,0.055)';
      for (let x = 0; x < w; x += 25) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 25) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      // Major grid every 5
      ctx.strokeStyle = 'rgba(56,189,248,0.10)';
      for (let x = 0; x < w; x += 125) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 125) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // Waveform
      const buf = bufferRef.current;
      const mid = h / 2;
      const amp = h * 0.38;
      const start = Math.max(0, buf.length - w);

      ctx.beginPath();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 10;

      for (let i = 0; i < w && start + i < buf.length; i++) {
        const y = mid - buf[start + i] * amp;
        if (i === 0) ctx.moveTo(i, y); else ctx.lineTo(i, y);
      }
      ctx.stroke();

      // Fade-out at the leading edge (right side) — makes it look like it's appearing
      const fadeW = 60;
      const grad = ctx.createLinearGradient(w - fadeW, 0, w, 0);
      grad.addColorStop(0, 'rgba(2,11,23,0)');
      grad.addColorStop(1, 'rgba(2,11,23,1)');
      ctx.fillStyle = grad;
      ctx.fillRect(w - fadeW, 0, fadeW, h);

      ctx.shadowBlur = 0;
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Resize canvas to its CSS dimensions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    ro.observe(canvas);
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    return () => ro.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height: '180px', display: 'block', borderRadius: '0 0 1rem 1rem' }}
    />
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function HealthTrackerPage(): React.ReactElement {
  const router = useRouter();

  // Live values
  const [bpm, setBpm] = useState(68);
  const [bpmHistory, setBpmHistory] = useState<number[]>([68, 70, 67, 69, 71, 68, 66, 70, 69, 68]);
  const [steps, setSteps] = useState(6240);
  const [calories, setCalories] = useState(1847);
  const [sleepHours] = useState(7.38); // last night — static

  // Tick: heart rate fluctuates, steps accumulate slowly
  useEffect(() => {
    const hrInterval = setInterval(() => {
      setBpm((prev) => {
        const next = clamp(Math.round(jitter(prev, 4)), 52, 110);
        setBpmHistory((h) => [...h.slice(-19), next]);
        return next;
      });
    }, 1600);

    const stepInterval = setInterval(() => {
      setSteps((s) => s + Math.floor(Math.random() * 4));
      setCalories((c) => c + (Math.random() < 0.4 ? 1 : 0));
    }, 2200);

    return () => { clearInterval(hrInterval); clearInterval(stepInterval); };
  }, []);

  const cardStyle = {
    background: 'linear-gradient(135deg, rgba(3,105,161,0.18) 0%, rgba(14,165,233,0.08) 100%)',
    border: '1px solid rgba(56,189,248,0.18)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
  };

  return (
    <div className="min-h-screen" style={{ background: 'radial-gradient(ellipse at 30% 20%, #071e3d 0%, #04090f 70%)' }}>
      {/* Ambient glows */}
      <div className="pointer-events-none fixed top-[-80px] left-[-80px] w-[420px] h-[420px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.07) 0%, transparent 70%)' }} />
      <div className="pointer-events-none fixed bottom-[-60px] right-[-60px] w-[360px] h-[360px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(48,209,88,0.05) 0%, transparent 70%)' }} />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            {/* Logo */}
            <div className="flex items-center justify-center w-9 h-9 rounded-xl mr-2"
              style={{ background: 'linear-gradient(135deg, #0369a1 0%, #0f4c75 100%)',
                boxShadow: '0 4px 16px rgba(3,105,161,0.5), 0 0 12px rgba(56,189,248,0.2)' }}>
              <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
                <polyline points="3,20 9,10 15,15 21,6 25,9"
                  stroke="white" strokeWidth="2.5" fill="none"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            {/* Nav tabs */}
            {[
              { label: 'Chat', path: '/' },
              { label: 'Blood Work', path: '/bloodwork' },
            ].map(({ label, path }) => (
              <button key={label} onClick={() => router.push(path)}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{ color: 'rgba(255,255,255,0.45)', border: '1px solid transparent', background: 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = 'transparent'; }}
              >{label}</button>
            ))}

            <button className="px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200"
              style={{ color: '#38bdf8',
                background: 'linear-gradient(135deg, rgba(3,105,161,0.2) 0%, rgba(14,165,233,0.1) 100%)',
                border: '1px solid rgba(56,189,248,0.3)',
                boxShadow: '0 0 16px rgba(56,189,248,0.15)' }}>
              Bio Tracker
            </button>
          </div>

          <button onClick={() => router.push('/')}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200"
            style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
          >← Back to chat</button>
        </div>

        {/* Page title */}
        <div className="mb-6 flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-black text-white">Bio Tracker</h1>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Live vitals · Apple Health
            </p>
          </div>
          <span className="ml-2 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(48,209,88,0.12)', border: '1px solid rgba(48,209,88,0.3)', color: '#30d158' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live
          </span>
        </div>

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

          {/* Steps */}
          <div className="rounded-2xl p-5 flex flex-col gap-3" style={cardStyle}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(56,189,248,0.7)' }}>Steps</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round">
                <path d="M13 4h-2l-1 5H7l-1 4h3l-1 7h2l3-7h3l1-4h-3z" />
              </svg>
            </div>
            <div className="flex items-center gap-3">
              <Ring value={steps} goal={STEP_GOAL} color="#38bdf8" size={72} />
              <div>
                <p className="text-2xl font-black text-white">{steps.toLocaleString()}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Goal {STEP_GOAL.toLocaleString()}
                </p>
                <p className="text-xs font-semibold mt-1" style={{ color: '#38bdf8' }}>
                  {Math.round((steps / STEP_GOAL) * 100)}%
                </p>
              </div>
            </div>
          </div>

          {/* Heart Rate */}
          <div className="rounded-2xl p-5 flex flex-col gap-3" style={cardStyle}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,69,58,0.8)' }}>Heart Rate</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#ff453a" stroke="none">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
            <div>
              <div className="flex items-end gap-1.5">
                <span className="text-3xl font-black" style={{ color: '#ff453a', textShadow: '0 0 20px rgba(255,69,58,0.5)' }}>{bpm}</span>
                <span className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>BPM</span>
              </div>
              <Sparkline data={bpmHistory} color="#ff453a" width={120} height={32} />
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {bpm < 60 ? 'Low' : bpm < 100 ? 'Normal' : 'Elevated'}
              </p>
            </div>
          </div>

          {/* Calories */}
          <div className="rounded-2xl p-5 flex flex-col gap-3" style={cardStyle}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,159,10,0.8)' }}>Calories</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#ff9f0a" stroke="none">
                <path d="M12 2c0 0-5 5.5-5 10a5 5 0 0010 0C17 7.5 12 2 12 2z" />
                <path d="M12 10c0 0-2.5 2.5-2.5 4.5a2.5 2.5 0 005 0C14.5 12.5 12 10 12 10z" fill="#ff453a" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-black" style={{ color: '#ff9f0a', textShadow: '0 0 20px rgba(255,159,10,0.4)' }}>
                {calories.toLocaleString()}
              </p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>kcal burned</p>
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, (calories / 2500) * 100)}%`,
                    background: 'linear-gradient(90deg, #ff9f0a, #ff453a)',
                    boxShadow: '0 0 8px rgba(255,159,10,0.5)' }} />
              </div>
              <p className="text-xs mt-1 text-right" style={{ color: 'rgba(255,255,255,0.3)' }}>Goal 2,500</p>
            </div>
          </div>

          {/* Sleep */}
          <div className="rounded-2xl p-5 flex flex-col gap-3" style={cardStyle}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(191,90,242,0.8)' }}>Sleep</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#bf5af2" stroke="none">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </div>
            <div>
              <div className="flex items-end gap-1.5 mb-2">
                <span className="text-3xl font-black" style={{ color: '#bf5af2', textShadow: '0 0 20px rgba(191,90,242,0.4)' }}>
                  {Math.floor(sleepHours)}
                </span>
                <span className="text-lg font-bold mb-0.5" style={{ color: '#bf5af2' }}>h</span>
                <span className="text-2xl font-black" style={{ color: '#bf5af2' }}>
                  {Math.round((sleepHours % 1) * 60)}
                </span>
                <span className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>min</span>
              </div>
              <SleepBar hours={sleepHours} />
            </div>
          </div>
        </div>

        {/* ── EKG Monitor ── */}
        <div className="rounded-2xl overflow-hidden" style={{
          background: 'linear-gradient(135deg, rgba(3,105,161,0.15) 0%, rgba(14,165,233,0.07) 100%)',
          border: '1px solid rgba(56,189,248,0.18)',
          boxShadow: '0 4px 32px rgba(0,0,0,0.5), 0 0 60px rgba(56,189,248,0.05)',
        }}>
          {/* Monitor header */}
          <div className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: '1px solid rgba(56,189,248,0.1)' }}>
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"
                style={{ boxShadow: '0 0 6px #4ade80' }} />
              <span className="text-sm font-bold text-white">ECG Monitor</span>
              <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', color: '#38bdf8' }}>
                Lead II
              </span>
            </div>
            <div className="flex items-center gap-6 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
              <span>25 mm/s</span>
              <span>10 mm/mV</span>
              <span className="font-semibold" style={{ color: '#ff453a' }}>
                {bpm} <span style={{ color: 'rgba(255,255,255,0.4)' }}>BPM</span>
              </span>
            </div>
          </div>

          {/* Canvas */}
          <EKGCanvas bpm={bpm} />
        </div>

        {/* Bottom disclaimer */}
        <p className="mt-4 text-center text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Data for informational purposes only — not for medical use.
        </p>

      </div>
    </div>
  );
}
