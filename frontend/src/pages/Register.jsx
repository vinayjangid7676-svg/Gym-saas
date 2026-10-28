import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../api';

const STEPS = [
  { id: 1, title: 'Gym Details', sub: 'Organization ki basic info' },
  { id: 2, title: 'Owner Account', sub: 'Admin login credentials' },
  { id: 3, title: 'Branch Address', sub: 'Main branch ka address' },
];

const initialForm = {
  gym_name: '', legal_name: '', tax_id_gst: '',
  owner_name: '', phone: '', email: '', password: '', confirm_password: '',
  branch_name: '', address: '', city: '', state: '', pincode: '',
};

const Field = ({ label, children }) => (
  <div>
    <label className="block text-sm font-medium text-zinc-300 mb-1.5">{label}</label>
    {children}
  </div>
);

export default function Register({ onSwitch }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState(null);

  const handleLoginRedirect = () => {
    if (typeof onSwitch === 'function') {
      onSwitch();
    }
    navigate('/login');
  };

  const set = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
    if (errors[field]) setErrors({ ...errors, [field]: '' });
  };

  const validateStep = () => {
    const e = {};
    if (step === 1 && !form.gym_name.trim()) e.gym_name = 'Gym name zaroori hai';
    if (step === 2) {
      if (!form.owner_name.trim()) e.owner_name = 'Owner name zaroori hai';
      if (!/^[6-9]\d{9}$/.test(form.phone)) e.phone = 'Valid 10-digit phone daalo';
      if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Valid email daalo';
      if (form.password.length < 6) e.password = 'Min 6 characters ka password';
      if (form.password !== form.confirm_password) e.confirm_password = 'Passwords match nahi kar rahe';
    }
    if (step === 3 && form.pincode && !/^\d{6}$/.test(form.pincode)) {
      e.pincode = '6-digit pincode daalo';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => validateStep() && setStep(step + 1);
  const back = () => setStep(step - 1);

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setLoading(true);
    setApiError('');
    const { confirm_password, ...payload } = form;
    const res = await apiPost('/api/v1/auth/register-gym', payload);
    setLoading(false);
    if (res.success) setSuccess(res.data);
    else setApiError(res.message || 'Registration fail ho gaya.');
  };

  const inputCls =
    'w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20 transition';
  const errCls = 'mt-1 text-xs text-red-400';

  // ---------- SUCCESS SCREEN ----------
  if (success) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <div className="w-16 h-16 mx-auto rounded-full bg-lime-400/10 border border-lime-400/40 flex items-center justify-center text-3xl">✅</div>
          <h2 className="mt-4 text-2xl font-bold text-white">Registration Complete!</h2>
          <p className="mt-1 text-zinc-400 text-sm">Trial mode activate ho gaya hai 🎉</p>
          <div className="mt-6 text-left space-y-2 text-sm bg-zinc-950 rounded-xl p-4 border border-zinc-800">
            <p className="text-zinc-400">Gym: <span className="text-white font-semibold">{success.organization.name}</span></p>
            <p className="text-zinc-400">Slug: <span className="text-lime-400 font-mono">{success.organization.slug}</span></p>
            <p className="text-zinc-400">Status: <span className="text-amber-400 capitalize">{success.organization.status}</span></p>
            <p className="text-zinc-400">Branch: <span className="text-white">{success.default_branch.name}</span></p>
          </div>
          <button
            type="button"
            onClick={handleLoginRedirect}
            className="mt-6 w-full py-3.5 rounded-xl bg-lime-400 text-zinc-950 font-bold text-sm hover:bg-lime-300 transition"
          >
            Login karke Dashboard kholo →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-lime-400 flex items-center justify-center mb-3">
            <span className="text-zinc-950 font-black text-2xl">G</span>
          </div>
          <h2 className="text-3xl font-bold text-white">Gym Register karo</h2>
          <p className="text-zinc-400 mt-1">3 simple steps · Free trial ke saath</p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition ${
                  step > s.id ? 'bg-lime-400 border-lime-400 text-zinc-950'
                  : step === s.id ? 'border-lime-400 text-lime-400 bg-zinc-900'
                  : 'border-zinc-700 text-zinc-600 bg-zinc-900'
                }`}>
                  {step > s.id ? '✓' : s.id}
                </div>
                <span className={`mt-1.5 text-[11px] font-medium whitespace-nowrap ${step >= s.id ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  {s.title}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mb-5 rounded transition ${step > s.id ? 'bg-lime-400' : 'bg-zinc-800'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8">
          <h3 className="text-lg font-bold text-white">{STEPS[step - 1].title}</h3>
          <p className="text-sm text-zinc-500 mb-6">{STEPS[step - 1].sub}</p>

          {apiError && (
            <div className="mb-5 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
              ⚠️ {apiError}
            </div>
          )}

          {/* ---------- STEP 1: Gym ---------- */}
          {step === 1 && (
            <div className="space-y-4">
              <Field label="Gym Name *">
                <input className={inputCls} placeholder="e.g. Iron Fitness Club" value={form.gym_name} onChange={set('gym_name')} />
                {errors.gym_name && <p className={errCls}>{errors.gym_name}</p>}
              </Field>
              <Field label="Legal Name (optional)">
                <input className={inputCls} placeholder="Registered business name" value={form.legal_name} onChange={set('legal_name')} />
              </Field>
              <Field label="GST / Tax ID (optional)">
                <input className={inputCls} placeholder="22AAAAA0000A1Z5" value={form.tax_id_gst} onChange={set('tax_id_gst')} />
              </Field>
            </div>
          )}

          {/* ---------- STEP 2: Owner ---------- */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Owner Name *">
                  <input className={inputCls} placeholder="Full name" value={form.owner_name} onChange={set('owner_name')} />
                  {errors.owner_name && <p className={errCls}>{errors.owner_name}</p>}
                </Field>
                <Field label="Phone Number *">
                  <input className={inputCls} placeholder="9876543210" value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
                  {errors.phone && <p className={errCls}>{errors.phone}</p>}
                </Field>
              </div>
              <Field label="Email (optional)">
                <input type="email" className={inputCls} placeholder="owner@gym.com" value={form.email} onChange={set('email')} />
                {errors.email && <p className={errCls}>{errors.email}</p>}
              </Field>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Password *">
                  <input type="password" className={inputCls} placeholder="Min 6 characters" value={form.password} onChange={set('password')} />
                  {errors.password && <p className={errCls}>{errors.password}</p>}
                </Field>
                <Field label="Confirm Password *">
                  <input type="password" className={inputCls} placeholder="Repeat password" value={form.confirm_password} onChange={set('confirm_password')} />
                  {errors.confirm_password && <p className={errCls}>{errors.confirm_password}</p>}
                </Field>
              </div>
            </div>
          )}

          {/* ---------- STEP 3: Branch ---------- */}
          {step === 3 && (
            <div className="space-y-4">
              <Field label="Branch Name (optional)">
                <input className={inputCls} placeholder={`${form.gym_name || 'Gym'} Main Branch`} value={form.branch_name} onChange={set('branch_name')} />
              </Field>
              <Field label="Address (optional)">
                <input className={inputCls} placeholder="Shop / Building, Street" value={form.address} onChange={set('address')} />
              </Field>
              <div className="grid md:grid-cols-3 gap-4">
                <Field label="City">
                  <input className={inputCls} placeholder="Mumbai" value={form.city} onChange={set('city')} />
                </Field>
                <Field label="State">
                  <input className={inputCls} placeholder="Maharashtra" value={form.state} onChange={set('state')} />
                </Field>
                <Field label="Pincode">
                  <input className={inputCls} placeholder="400001" value={form.pincode}
                    onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
                  {errors.pincode && <p className={errCls}>{errors.pincode}</p>}
                </Field>
              </div>
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button 
                type="button" 
                onClick={back}
                className="px-6 py-3.5 rounded-xl border border-zinc-700 text-zinc-300 font-semibold text-sm hover:bg-zinc-800 transition"
              >
                ← Back
              </button>
            )}
            {step < 3 ? (
              <button 
                type="button" 
                onClick={next}
                className="flex-1 py-3.5 rounded-xl bg-lime-400 text-zinc-950 font-bold text-sm hover:bg-lime-300 transition"
              >
                Continue →
              </button>
            ) : (
              <button 
                type="button" 
                onClick={handleSubmit} 
                disabled={loading}
                className="flex-1 py-3.5 rounded-xl bg-lime-400 text-zinc-950 font-bold text-sm hover:bg-lime-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Registering…' : '🚀 Register Gym'}
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Already registered?{' '}
          <button 
            type="button" 
            onClick={handleLoginRedirect} 
            className="text-lime-400 font-semibold hover:underline"
          >
            Login karo
          </button>
        </p>
      </div>
    </div>
  );
}