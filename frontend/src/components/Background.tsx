'use client';

/**
 * Ambient animated background: a deep-space gradient with two slowly drifting
 * violet/indigo orbs and a subtle grid. Pure CSS — respects reduced motion.
 */
export function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink-950">
      <div className="absolute inset-0 bg-glow-radial" />
      <div className="absolute -left-40 top-[-10%] h-[480px] w-[480px] animate-float rounded-full bg-violet/30 blur-[120px]" />
      <div
        className="absolute -right-32 top-[30%] h-[520px] w-[520px] animate-float rounded-full bg-accentIndigo/25 blur-[130px]"
        style={{ animationDelay: '-3s' }}
      />
      <div
        className="absolute bottom-[-15%] left-1/3 h-[420px] w-[420px] animate-float rounded-full bg-accentPink/20 blur-[120px]"
        style={{ animationDelay: '-1.5s' }}
      />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage:
            'radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)',
        }}
      />
    </div>
  );
}
