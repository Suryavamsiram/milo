import { useState } from 'react';
import { ArrowLeft, User, MapPin, DollarSign, Tag, Clock, Camera, Save, Loader2, Check, X } from 'lucide-react';
import type { UserProfile } from '../lib/supabase';
import { LocationMap } from './LocationMap';

const SKILL_OPTIONS = [
  'Tech/AI', 'Programming', 'Web Development', 'Fitness', 'Indie Music', 'Gamer',
  'Culinary Arts', 'Photography', 'Graphic Design', 'Tutoring', 'Pet Care',
  'Event Planning', 'Tech Support', 'Cleaning', 'Errands', 'Moving & Lifting',
  'Streaming', 'Robotics', 'Music Production', 'Creative Writing', 'Dance',
  'Car Maintenance', 'Video Editing', 'Sports Training', 'Nutrition',
];

const AVATARS = [
  'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?w=150&h=150&fit=crop',
  'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?w=150&h=150&fit=crop',
  'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?w=150&h=150&fit=crop',
  'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?w=150&h=150&fit=crop',
  'https://images.pexels.com/photos/1137511/pexels-photo-1137511.jpeg?w=150&h=150&fit=crop',
  'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?w=150&h=150&fit=crop',
];

type Props = {
  profile: UserProfile;
  onSave: (data: Partial<UserProfile>) => Promise<void>;
  onBack: () => void;
};

export function SettingsPage({ profile, onSave, onBack }: Props) {
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio || '');
  const [campusLocation, setCampusLocation] = useState(profile.campus_location);
  const [lat, setLat] = useState(profile.latitude);
  const [lng, setLng] = useState(profile.longitude);
  const [payMin, setPayMin] = useState(profile.pay_min);
  const [payMax, setPayMax] = useState(profile.pay_max);
  const [walkTime, setWalkTime] = useState<10 | 20 | 40>(profile.max_walk_time_mins);
  const [availability, setAvailability] = useState(profile.availability || 'flexible');
  const [skills, setSkills] = useState<string[]>(profile.skills_interests || []);
  const [customSkills, setCustomSkills] = useState<string[]>(profile.skills || []);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || AVATARS[0]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const toggleSkill = (skill: string) => { setSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill])); };
  const addCustomSkill = () => { const skill = newSkill.trim(); if (skill && !customSkills.includes(skill) && !SKILL_OPTIONS.includes(skill)) { setCustomSkills((prev) => [...prev, skill]); setNewSkill(''); } };
  const removeCustomSkill = (skill: string) => { setCustomSkills((prev) => prev.filter((s) => s !== skill)); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ name, bio, campus_location: campusLocation, latitude: lat, longitude: lng, pay_min: payMin, pay_max: payMax, max_walk_time_mins: walkTime, availability: availability as UserProfile['availability'], skills_interests: skills, skills: customSkills, avatar_url: avatarUrl });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const inputCls = "w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all";
  const labelCls = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5";
  const sectionTitle = "flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white mb-3";

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /><span className="text-xs font-medium">Back</span>
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 rounded-lg text-white disabled:text-gray-400 text-xs font-medium transition-colors">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto p-4 space-y-5">
          <section>
            <h3 className={sectionTitle}><User className="w-4 h-4 text-brand-500" />Profile</h3>
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <img src={avatarUrl} alt="Profile" className="w-16 h-16 rounded-xl object-cover border-2 border-gray-200 dark:border-gray-700" />
                <button onClick={() => setShowAvatarPicker(!showAvatarPicker)} className="absolute -bottom-1 -right-1 w-6 h-6 bg-brand-500 rounded-md flex items-center justify-center text-white hover:bg-brand-600 transition-colors">
                  <Camera className="w-3 h-3" />
                </button>
              </div>
              <div><p className="text-sm text-gray-900 dark:text-white font-medium">{name}</p><p className="text-[10px] text-gray-400">{profile.role} - {campusLocation || 'No location'}</p></div>
            </div>
            {showAvatarPicker && (
              <div className="p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-[10px] text-gray-400 mb-2">Choose avatar:</p>
                <div className="flex flex-wrap gap-2">
                  {AVATARS.map((url) => (
                    <button key={url} onClick={() => { setAvatarUrl(url); setShowAvatarPicker(false); }}
                      className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${avatarUrl === url ? 'border-brand-400' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'}`}>
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section>
            <h3 className={sectionTitle}><User className="w-4 h-4 text-brand-500" />Info</h3>
            <div className="space-y-3">
              <div><label className={labelCls}>Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Bio</label><textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="About you..." rows={2} className={`${inputCls} resize-none`} /></div>
            </div>
          </section>

          <section>
            <h3 className={sectionTitle}><MapPin className="w-4 h-4 text-brand-500" />Location</h3>
            <div className="space-y-3">
              <div><label className={labelCls}>Campus</label><input type="text" value={campusLocation} onChange={(e) => setCampusLocation(e.target.value)} placeholder="e.g. East Hall" className={inputCls} /></div>
              <div><label className={labelCls}>Map</label><LocationMap latitude={lat} longitude={lng} campusLocation={campusLocation} editable onLocationSelect={(newLat, newLng) => { setLat(newLat); setLng(newLng); }} /></div>
              <div><label className={labelCls}>Walk Distance</label>
                <select value={walkTime} onChange={(e) => setWalkTime(Number(e.target.value) as 10 | 20 | 40)} className={inputCls}>
                  <option value={10}>Under 10 min</option><option value={20}>10-20 min</option><option value={40}>20+ min</option>
                </select>
              </div>
            </div>
          </section>

          <section>
            <h3 className={sectionTitle}><DollarSign className="w-4 h-4 text-amber-500" />Pay Range</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between"><label className="text-xs text-gray-500">Min: ${payMin}/hr</label><label className="text-xs text-gray-500">Max: ${payMax}/hr</label></div>
              <div className="flex gap-3">
                <input type="range" min={5} max={100} step={5} value={payMin} onChange={(e) => setPayMin(Number(e.target.value))} className="flex-1 accent-brand-500" />
                <input type="range" min={5} max={200} step={5} value={payMax} onChange={(e) => setPayMax(Math.max(Number(e.target.value), payMin))} className="flex-1 accent-brand-500" />
              </div>
              <div className="p-2.5 bg-white dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
                <span className="text-xs text-gray-400">Range: </span><span className="text-sm text-gray-900 dark:text-white font-bold">${payMin} - ${payMax}</span>
              </div>
            </div>
          </section>

          <section>
            <h3 className={sectionTitle}><Clock className="w-4 h-4 text-cyan-500" />Availability</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {[{ value: 'flexible', label: 'Flexible' }, { value: 'mornings', label: 'Mornings' }, { value: 'afternoons', label: 'Afternoons' }, { value: 'evenings', label: 'Evenings' }, { value: 'weekends_only', label: 'Weekends' }].map((opt) => (
                <button key={opt.value} onClick={() => setAvailability(opt.value as UserProfile['availability'])}
                  className={`p-2.5 rounded-lg border text-xs font-medium transition-colors ${availability === opt.value ? 'bg-brand-50 dark:bg-brand-500/10 border-brand-300 dark:border-brand-600 text-brand-600 dark:text-brand-400' : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className={sectionTitle}><Tag className="w-4 h-4 text-amber-500" />Skills</h3>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {SKILL_OPTIONS.map((skill) => (
                  <button key={skill} onClick={() => toggleSkill(skill)}
                    className={`px-2 py-1 text-[10px] rounded-md border transition-colors ${skills.includes(skill) ? 'border-brand-400 bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 text-gray-400 hover:border-gray-300'}`}>
                    {skill}
                  </button>
                ))}
              </div>
              <div>
                <label className={labelCls}>Custom skill</label>
                <div className="flex gap-1.5">
                  <input type="text" value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="e.g. Drone Photography" className={inputCls}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill(); } }} />
                  <button onClick={addCustomSkill} disabled={!newSkill.trim()} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 rounded-lg text-xs text-gray-500 dark:text-gray-300 font-medium transition-colors">Add</button>
                </div>
              </div>
              {customSkills.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {customSkills.map((skill) => (
                    <span key={skill} className="inline-flex items-center gap-1 px-2 py-1 bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20 rounded-md text-[10px] text-brand-600 dark:text-brand-400">
                      {skill}<button onClick={() => removeCustomSkill(skill)} className="hover:text-brand-800 dark:hover:text-brand-200"><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
