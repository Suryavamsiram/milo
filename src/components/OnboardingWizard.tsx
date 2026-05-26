import { useState } from 'react';
import { MapPin, Clock, DollarSign, Tag, ChevronRight, Sparkles, User } from 'lucide-react';
import type { UserProfile } from '../lib/supabase';

const SKILL_TAGS = [
  'Tech/AI', 'Programming', 'Web Development', 'Fitness', 'Indie Music', 'Gamer',
  'Culinary Arts', 'Photography', 'Graphic Design', 'Tutoring', 'Pet Care',
  'Event Planning', 'Tech Support', 'Cleaning', 'Errands', 'Moving & Lifting',
  'Streaming', 'Robotics', 'Music Production', 'Creative Writing', 'Dance',
  'Car Maintenance', 'Video Editing', 'Sports Training', 'Nutrition',
];

const WALK_TIMES: { label: string; value: 10 | 20 | 40 }[] = [
  { label: '< 10 min walk', value: 10 },
  { label: '10-20 min walk', value: 20 },
  { label: '20+ min walk', value: 40 },
];

const ROLES: { label: string; value: 'poster' | 'finder' | 'both'; desc: string }[] = [
  { label: 'Post Gigs', value: 'poster', desc: 'I need help' },
  { label: 'Find Gigs', value: 'finder', desc: 'I want to earn' },
  { label: 'Both', value: 'both', desc: 'I do both' },
];

type Props = {
  onComplete: (data: Omit<UserProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => void;
};

export function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [role, setRole] = useState<'poster' | 'finder' | 'both'>('both');
  const [location, setLocation] = useState('');
  const [walkTime, setWalkTime] = useState<10 | 20 | 40>(10);
  const [payMin, setPayMin] = useState(15);
  const [payMax, setPayMax] = useState(40);
  const [skills, setSkills] = useState<string[]>([]);

  const toggleSkill = (tag: string) => {
    setSkills((prev) => prev.includes(tag) ? prev.filter((s) => s !== tag) : [...prev, tag]);
  };

  const canAdvance = () => {
    if (step === 0) return name.trim().length > 0;
    if (step === 2) return location.trim().length > 0;
    if (step === 3) return payMin > 0 && payMax >= payMin;
    return true;
  };

  const handleFinish = () => {
    onComplete({
      name: name.trim(), role, campus_location: location.trim(), max_walk_time_mins: walkTime,
      pay_min: payMin, pay_max: payMax, skills_interests: skills, onboarding_complete: true,
      avatar_url: null, bio: '', latitude: null, longitude: null, skills: [], availability: 'flexible',
    });
  };

  const steps = [
    { icon: <User className="w-5 h-5 text-brand-500" />, title: 'Welcome', subtitle: 'Set up in 60 seconds', content: (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Your Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex Chen"
            className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all" autoFocus />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">I want to...</label>
          <div className="grid grid-cols-3 gap-1.5">
            {ROLES.map((r) => (
              <button key={r.value} onClick={() => setRole(r.value)}
                className={`p-2.5 rounded-lg border text-left transition-all ${role === r.value ? 'border-brand-400 bg-brand-50 dark:bg-brand-500/10 text-gray-900 dark:text-white' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-400 hover:border-gray-300'}`}>
                <div className="font-medium text-xs">{r.label}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{r.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )},
    { icon: <Clock className="w-5 h-5 text-cyan-500" />, title: 'Proximity', subtitle: 'How far will you go?', content: (
      <div className="space-y-2">
        {WALK_TIMES.map((wt) => (
          <button key={wt.value} onClick={() => setWalkTime(wt.value)}
            className={`w-full p-3 rounded-lg border text-left transition-all flex items-center justify-between text-sm ${walkTime === wt.value ? 'border-brand-400 bg-brand-50 dark:bg-brand-500/10 text-gray-900 dark:text-white' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-400'}`}>
            {wt.label} {walkTime === wt.value && <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
          </button>
        ))}
      </div>
    )},
    { icon: <MapPin className="w-5 h-5 text-brand-500" />, title: 'Location', subtitle: 'Where are you based?', content: (
      <div className="space-y-3">
        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. East Hall, North Campus..."
          className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all" autoFocus />
        <div className="flex flex-wrap gap-1.5">
          {['East Hall', 'North Campus', 'Student Union', 'Library', 'Engineering Quad', 'South Dorms'].map((loc) => (
            <button key={loc} onClick={() => setLocation(loc)}
              className="px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-800 hover:bg-brand-50 dark:hover:bg-brand-500/10 border border-gray-200 dark:border-gray-700 rounded text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">{loc}</button>
          ))}
        </div>
      </div>
    )},
    { icon: <DollarSign className="w-5 h-5 text-amber-500" />, title: 'Pay Range', subtitle: 'Expected hourly rates', content: (
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1"><label className="text-xs text-gray-500">Minimum</label><span className="text-xs text-brand-600 dark:text-brand-400 font-mono font-semibold">${payMin}/hr</span></div>
          <input type="range" min={5} max={100} step={5} value={payMin} onChange={(e) => setPayMin(Number(e.target.value))} className="w-full accent-brand-500" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1"><label className="text-xs text-gray-500">Maximum</label><span className="text-xs text-brand-600 dark:text-brand-400 font-mono font-semibold">${payMax}/hr</span></div>
          <input type="range" min={5} max={200} step={5} value={payMax} onChange={(e) => setPayMax(Math.max(Number(e.target.value), payMin))} className="w-full accent-brand-500" />
        </div>
        <div className="p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
          <span className="text-xs text-gray-400">Range: </span><span className="text-sm text-gray-900 dark:text-white font-bold">${payMin} - ${payMax}</span>
        </div>
      </div>
    )},
    { icon: <Tag className="w-5 h-5 text-amber-500" />, title: 'Skills & Interests', subtitle: 'What are you into?', content: (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto pr-1">
          {SKILL_TAGS.map((tag) => (
            <button key={tag} onClick={() => toggleSkill(tag)}
              className={`px-2 py-1 text-xs rounded-md border transition-all ${skills.includes(tag) ? 'border-brand-400 bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-400 hover:border-gray-300'}`}>
              {tag}
            </button>
          ))}
        </div>
        {skills.length > 0 && <p className="text-[10px] text-gray-400">{skills.length} selected</p>}
      </div>
    )},
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md my-6">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div><h1 className="text-lg font-bold text-gray-900 dark:text-white">Milo</h1><p className="text-[10px] text-gray-400">Campus Gig Marketplace</p></div>
        </div>
        <div className="flex gap-1 mb-6">{steps.map((_, i) => (<div key={i} className={`h-1 rounded-full flex-1 transition-all duration-300 ${i <= step ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-700'}`} />))}</div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">{current.icon}</div>
            <div><h2 className="text-base font-bold text-gray-900 dark:text-white">{current.title}</h2><p className="text-xs text-gray-400">{current.subtitle}</p></div>
          </div>
          {current.content}
          <div className="flex items-center justify-between mt-6">
            <button onClick={() => setStep((s) => s - 1)} disabled={step === 0} className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 disabled:opacity-0 transition-all">Back</button>
            <button onClick={isLast ? handleFinish : () => setStep((s) => s + 1)} disabled={!canAdvance()}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white disabled:text-gray-400 font-medium rounded-lg transition-all text-sm">
              {isLast ? 'Start Using Milo' : 'Continue'} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className="text-center text-[10px] text-gray-300 dark:text-gray-600 mt-3">Step {step + 1} of {steps.length}</p>
      </div>
    </div>
  );
}
