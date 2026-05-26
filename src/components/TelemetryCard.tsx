import { useEffect, useState } from 'react';
import { Cpu, CheckCircle, Loader2 } from 'lucide-react';

const STEPS = [
  '[MILO AGENT]: Ingesting natural language request...',
  '[MILO AGENT]: Parsing spatial and proximity vectors...',
  '[MILO AGENT]: Running deterministic matching matrix...',
  '[MILO AGENT]: Delegating to top-tier matching candidates...',
];

type Props = { onComplete?: () => void };

export function TelemetryCard({ onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => {
    const timings = [600, 1200, 900, 800];
    let step = 0;
    function advance() {
      if (step >= STEPS.length) { onComplete?.(); return; }
      setCurrentStep(step);
      setTimeout(() => { setCompletedSteps((prev) => [...prev, step]); step++; advance(); }, timings[step] ?? 800);
    }
    advance();
  }, [onComplete]);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 p-3 font-mono text-[10px]">
      <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-gray-200 dark:border-gray-700">
        <Cpu className="w-3 h-3 text-brand-500" />
        <span className="text-brand-600 dark:text-brand-400 font-semibold">MILO AGENT PIPELINE</span>
        <div className="ml-auto flex gap-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <div className="w-1.5 h-1.5 rounded-full bg-brand-400" />
        </div>
      </div>
      <div className="space-y-1.5">
        {STEPS.map((step, idx) => {
          const isComplete = completedSteps.includes(idx);
          const isActive = idx === currentStep && !isComplete;
          const isPending = idx > currentStep;
          return (
            <div key={idx} className={`flex items-start gap-1.5 transition-all ${isPending ? 'opacity-25' : 'opacity-100'}`}>
              {isComplete ? <CheckCircle className="w-3 h-3 text-brand-500 mt-0.5 flex-shrink-0" />
                : isActive ? <Loader2 className="w-3 h-3 text-brand-500 animate-spin mt-0.5 flex-shrink-0" />
                : <div className="w-3 h-3 rounded-full border border-gray-300 dark:border-gray-600 mt-0.5 flex-shrink-0" />}
              <span className={`${isComplete ? 'text-gray-500 dark:text-gray-400' : isActive ? 'text-brand-600 dark:text-brand-300' : 'text-gray-300 dark:text-gray-600'}`}>
                {step}{isActive && <span className="animate-pulse">_</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
