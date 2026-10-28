// import { useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { apiPost, saveSession } from '../api';

// export default function Login({ onSwitch, onSuccess }) {
//   const navigate = useNavigate();
//   const [mode, setMode] = useState('phone'); // 'phone' | 'email'
//   const [phone, setPhone] = useState('');
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [showPassword, setShowPassword] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState('');
//   const [lockoutSeconds, setLockoutSeconds] = useState(0);

//   // Status popup state: { show: boolean, type: 'success' | 'error', title: '', message: '' }
//   const [popup, setPopup] = useState({
//     show: false,
//     type: '',
//     title: '',
//     message: '',
//   });

//   // Live countdown timer for lockout cooldown
//   useEffect(() => {
//     if (lockoutSeconds <= 0) return;

//     const timer = setInterval(() => {
//       setLockoutSeconds((prev) => {
//         if (prev <= 1) {
//           setError('');
//           return 0;
//         }
//         return prev - 1;
//       });
//     }, 1000);

//     return () => clearInterval(timer);
//   }, [lockoutSeconds]);

//   const formatTimer = (seconds) => {
//     const mins = Math.floor(seconds / 60);
//     const secs = seconds % 60;
//     return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
//   };

//   const handleRegisterRedirect = () => {
//     if (typeof onSwitch === 'function') {
//       onSwitch();
//     }
//     navigate('/register');
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     if (lockoutSeconds > 0) return;
//     setError('');

//     if (mode === 'phone' && !/^[6-9]\d{9}$/.test(phone)) {
//       const msg = 'Kripya ek valid 10-digit mobile number daalein.';
//       setError(msg);
//       setPopup({
//         show: true,
//         type: 'error',
//         title: 'Invalid Phone Number',
//         message: msg,
//       });
//       return;
//     }

//     if (mode === 'email' && !/^\S+@\S+\.\S+$/.test(email)) {
//       const msg = 'Kripya ek valid email address enter karein.';
//       setError(msg);
//       setPopup({
//         show: true,
//         type: 'error',
//         title: 'Invalid Email Address',
//         message: msg,
//       });
//       return;
//     }

//     if (!password) {
//       const msg = 'Password field empty nahi ho sakta.';
//       setError(msg);
//       setPopup({
//         show: true,
//         type: 'error',
//         title: 'Password Required',
//         message: msg,
//       });
//       return;
//     }

//     setLoading(true);

//     try {
//       const res = await apiPost('/api/v1/auth/login', {
//         phone: mode === 'phone' ? phone : undefined,
//         email: mode === 'email' ? email : undefined,
//         password,
//       });

//       setLoading(false);

//       if (res.success && res.token) {
//         saveSession(res.token);

//         // Show professional success modal
//         setPopup({
//           show: true,
//           type: 'success',
//           title: 'Authentication Successful',
//           message: 'Workspace synchronize ho raha hai...',
//         });

//         // 1200ms smooth delay for micro-interactions and session sync
//         setTimeout(() => {
//           if (typeof onSuccess === 'function') {
//             onSuccess({ token: res.token, user: res.user });
//           }
//           navigate('/dashboard');
//         }, 1250);
//       } else {
//         if (res.code === 'ACCOUNT_LOCKED' && res.remaining_seconds) {
//           setLockoutSeconds(res.remaining_seconds);
//         }
//         const errMsg = res.message || 'Credentials match nahi ho rahe. Kripya check karein.';
//         setError(errMsg);
//         setPopup({
//           show: true,
//           type: 'error',
//           title: res.code === 'ACCOUNT_LOCKED' ? 'Account Temporarily Locked' : 'Login Failed',
//           message: errMsg,
//         });
//       }
//     } catch (err) {
//       setLoading(false);
//       const networkErr = 'Server se connect karne me problem aayi. Check your connection.';
//       setError(networkErr);
//       setPopup({
//         show: true,
//         type: 'error',
//         title: 'Connection Error',
//         message: networkErr,
//       });
//     }
//   };

//   const closePopup = () => {
//     setPopup((prev) => ({ ...prev, show: false }));
//   };

//   const inputCls =
//     'w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20 transition disabled:opacity-50 disabled:cursor-not-allowed';

//   return (
//     <div className="relative min-h-screen flex bg-zinc-950">
//       {/* Dynamic Keyframes for smooth SVG stroke & scale animations */}
//       <style>{`
//         @keyframes strokeAnimation {
//           0% { stroke-dashoffset: 48; }
//           100% { stroke-dashoffset: 0; }
//         }
//         @keyframes scaleIn {
//           0% { transform: scale(0.85); opacity: 0; }
//           100% { transform: scale(1); opacity: 1; }
//         }
//         @keyframes modalShake {
//           0%, 100% { transform: translateX(0); }
//           20%, 60% { transform: translateX(-6px); }
//           40%, 80% { transform: translateX(6px); }
//         }
//         .animate-draw-check {
//           stroke-dasharray: 48;
//           stroke-dashoffset: 48;
//           animation: strokeAnimation 0.55s cubic-bezier(0.65, 0, 0.45, 1) 0.15s forwards;
//         }
//         .animate-scale-in {
//           animation: scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
//         }
//         .animate-shake {
//           animation: modalShake 0.4s ease-in-out;
//         }
//       `}</style>

//       {/* Modern Feedback Modal Overlay */}
//       {popup.show && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-opacity">
//           <div
//             className={`w-full max-w-sm rounded-2xl border p-6 text-center shadow-2xl ${
//               popup.type === 'success'
//                 ? 'bg-zinc-900 border-lime-500/30 shadow-lime-500/10 animate-scale-in'
//                 : 'bg-zinc-900 border-red-500/30 shadow-red-500/10 animate-shake'
//             }`}
//           >
//             {popup.type === 'success' ? (
//               <div className="flex flex-col items-center">
//                 {/* Outer Glow Ring */}
//                 <div className="relative flex items-center justify-center w-20 h-20 mb-4 rounded-full bg-lime-400/10 border border-lime-400/30">
//                   <div className="absolute inset-0 rounded-full bg-lime-400/20 blur-xl animate-pulse" />
//                   <svg
//                     className="w-10 h-10 text-lime-400 relative z-10"
//                     fill="none"
//                     stroke="currentColor"
//                     viewBox="0 0 24 24"
//                     strokeWidth="3"
//                     strokeLinecap="round"
//                     strokeLinejoin="round"
//                   >
//                     <polyline points="20 6 9 17 4 12" className="animate-draw-check" />
//                   </svg>
//                 </div>

//                 <h3 className="text-xl font-bold text-white tracking-tight">{popup.title}</h3>
//                 <p className="mt-1.5 text-sm text-zinc-400 leading-relaxed">{popup.message}</p>

//                 {/* Loading indicator bar */}
//                 <div className="mt-6 flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-xs font-medium text-lime-300">
//                   <span className="w-2 h-2 rounded-full bg-lime-400 animate-ping" />
//                   Redirecting to dashboard...
//                 </div>
//               </div>
//             ) : (
//               <div className="flex flex-col items-center">
//                 {/* Error Cross Icon */}
//                 <div className="relative flex items-center justify-center w-20 h-20 mb-4 rounded-full bg-red-500/10 border border-red-500/30">
//                   <div className="absolute inset-0 rounded-full bg-red-500/20 blur-xl" />
//                   <svg
//                     className="w-10 h-10 text-red-400 relative z-10"
//                     fill="none"
//                     stroke="currentColor"
//                     viewBox="0 0 24 24"
//                     strokeWidth="2.5"
//                     strokeLinecap="round"
//                     strokeLinejoin="round"
//                   >
//                     <line x1="18" y1="6" x2="6" y2="18" className="animate-draw-check" />
//                     <line x1="6" y1="6" x2="18" y2="18" className="animate-draw-check" />
//                   </svg>
//                 </div>

//                 <h3 className="text-xl font-bold text-white tracking-tight">{popup.title}</h3>
//                 <p className="mt-1.5 text-sm text-zinc-400 leading-relaxed">{popup.message}</p>

//                 <button
//                   type="button"
//                   onClick={closePopup}
//                   className="mt-6 w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-sm transition border border-zinc-700/80 hover:border-zinc-600 focus:outline-none"
//                 >
//                   Try Again
//                 </button>
//               </div>
//             )}
//           </div>
//         </div>
//       )}

//       {/* Left branding panel */}
//       <div className="hidden lg:flex w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black">
//         <div className="flex items-center gap-3">
//           <div className="w-10 h-10 rounded-xl bg-lime-400 flex items-center justify-center">
//             <span className="text-zinc-950 font-black text-xl">G</span>
//           </div>
//           <span className="text-white font-bold text-xl tracking-tight">GymManager</span>
//         </div>
//         <div>
//           <h1 className="text-5xl font-black text-white leading-tight">
//             Apne Gym ko<br />
//             <span className="text-lime-400">Digital Banao.</span>
//           </h1>
//           <p className="mt-4 text-zinc-400 text-lg max-w-md">
//             Members, payments, branches — sab kuch ek hi dashboard se manage karo.
//           </p>
//         </div>
//         <p className="text-zinc-600 text-sm">© 2026 GymManager · Trial mode available</p>
//       </div>

//       {/* Right form panel */}
//       <div className="flex-1 flex items-center justify-center p-6">
//         <div className="w-full max-w-md">
//           <div className="mb-8">
//             <h2 className="text-3xl font-bold text-white">Welcome back 👋</h2>
//             <p className="text-zinc-400 mt-1">Apne dashboard me login karo</p>
//           </div>

//           {/* Phone / Email tabs */}
//           <div className="flex bg-zinc-900 rounded-xl p-1 mb-6">
//             {['phone', 'email'].map((m) => (
//               <button
//                 key={m}
//                 type="button"
//                 disabled={lockoutSeconds > 0}
//                 onClick={() => {
//                   setMode(m);
//                   setError('');
//                 }}
//                 className={`flex-1 py-2.5 rounded-lg text-sm font-semibold capitalize transition ${
//                   mode === m ? 'bg-lime-400 text-zinc-950' : 'text-zinc-400 hover:text-white'
//                 } disabled:opacity-50 disabled:cursor-not-allowed`}
//               >
//                 {m === 'phone' ? '📱 Phone' : '✉️ Email'}
//               </button>
//             ))}
//           </div>

//           {/* Cooldown Lockout Warning */}
//           {lockoutSeconds > 0 && (
//             <div className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/40 p-4 text-sm text-amber-300 flex items-start gap-3">
//               <span className="text-xl">⏱️</span>
//               <div>
//                 <p className="font-semibold text-amber-200">Security Cooldown Active</p>
//                 <p className="mt-0.5 text-xs text-amber-300/80">
//                   Multiple galat attempts detect hue hain. Agla attempt available hoga:{' '}
//                   <span className="font-mono font-bold text-white bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
//                     {formatTimer(lockoutSeconds)}
//                   </span>
//                 </p>
//               </div>
//             </div>
//           )}

//           {/* General Error Notice */}
//           {error && lockoutSeconds === 0 && !popup.show && (
//             <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
//               <span>⚠️</span>
//               <span>{error}</span>
//             </div>
//           )}

//           <form onSubmit={handleSubmit} className="space-y-4">
//             {mode === 'phone' ? (
//               <div>
//                 <label className="block text-sm font-medium text-zinc-300 mb-1.5">Phone Number</label>
//                 <input
//                   type="tel"
//                   disabled={lockoutSeconds > 0}
//                   value={phone}
//                   onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
//                   placeholder="9876543210"
//                   className={inputCls}
//                 />
//               </div>
//             ) : (
//               <div>
//                 <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email</label>
//                 <input
//                   type="email"
//                   disabled={lockoutSeconds > 0}
//                   value={email}
//                   onChange={(e) => setEmail(e.target.value)}
//                   placeholder="owner@gym.com"
//                   className={inputCls}
//                 />
//               </div>
//             )}

//             <div>
//               <label className="block text-sm font-medium text-zinc-300 mb-1.5">Password</label>
//               <div className="relative">
//                 <input
//                   type={showPassword ? 'text' : 'password'}
//                   disabled={lockoutSeconds > 0}
//                   value={password}
//                   onChange={(e) => setPassword(e.target.value)}
//                   placeholder="••••••••"
//                   className={inputCls}
//                 />
//                 <button
//                   type="button"
//                   disabled={lockoutSeconds > 0}
//                   onClick={() => setShowPassword(!showPassword)}
//                   className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs font-semibold disabled:opacity-40"
//                 >
//                   {showPassword ? 'HIDE' : 'SHOW'}
//                 </button>
//               </div>
//             </div>

//             <button
//               type="submit"
//               disabled={loading || lockoutSeconds > 0}
//               className="w-full py-3.5 rounded-xl bg-lime-400 text-zinc-950 font-bold text-sm hover:bg-lime-300 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-lime-400/10"
//             >
//               {loading ? (
//                 <span className="flex items-center justify-center gap-2">
//                   <svg
//                     className="animate-spin h-4 w-4 text-zinc-950"
//                     viewBox="0 0 24 24"
//                     fill="none"
//                   >
//                     <circle
//                       className="opacity-25"
//                       cx="12"
//                       cy="12"
//                       r="10"
//                       stroke="currentColor"
//                       strokeWidth="4"
//                     />
//                     <path
//                       className="opacity-75"
//                       fill="currentColor"
//                       d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
//                     />
//                   </svg>
//                   Verifying Credentials…
//                 </span>
//               ) : lockoutSeconds > 0 ? (
//                 `Locked (${formatTimer(lockoutSeconds)})`
//               ) : (
//                 'Login →'
//               )}
//             </button>
//           </form>

//           <p className="mt-6 text-center text-sm text-zinc-500">
//             Naya gym register karna hai?{' '}
//             <button
//               type="button"
//               onClick={handleRegisterRedirect}
//               className="text-lime-400 font-semibold hover:underline"
//             >
//               Register karo — free trial
//             </button>
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// }
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost, saveSession } from '../api';

// Background chunk prefetch function
const prefetchDashboard = () => import('../pages/Dashboard');

export default function Login({ onSwitch, onSuccess }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('phone'); // 'phone' | 'email'
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Status popup state
  const [popup, setPopup] = useState({
    show: false,
    type: '',
    title: '',
    message: '',
  });

  // 🚀 PREFETCH: Login page load hote hi Dashboard ka code background me fetch hoga
  useEffect(() => {
    prefetchDashboard();
  }, []);

  // Live countdown timer for lockout cooldown
  useEffect(() => {
    if (lockoutSeconds <= 0) return;

    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          setError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleRegisterRedirect = () => {
    if (typeof onSwitch === 'function') {
      onSwitch();
    }
    navigate('/register');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lockoutSeconds > 0 || loading) return;
    setError('');

    if (mode === 'phone' && !/^[6-9]\d{9}$/.test(phone)) {
      const msg = 'Kripya ek valid 10-digit mobile number daalein.';
      setError(msg);
      setPopup({
        show: true,
        type: 'error',
        title: 'Invalid Phone Number',
        message: msg,
      });
      return;
    }

    if (mode === 'email' && !/^\S+@\S+\.\S+$/.test(email)) {
      const msg = 'Kripya ek valid email address enter karein.';
      setError(msg);
      setPopup({
        show: true,
        type: 'error',
        title: 'Invalid Email Address',
        message: msg,
      });
      return;
    }

    if (!password) {
      const msg = 'Password field empty nahi ho sakta.';
      setError(msg);
      setPopup({
        show: true,
        type: 'error',
        title: 'Password Required',
        message: msg,
      });
      return;
    }

    setLoading(true);

    try {
      const res = await apiPost('/api/v1/auth/login', {
        phone: mode === 'phone' ? phone : undefined,
        email: mode === 'email' ? email : undefined,
        password,
      });

      setLoading(false);

      if (res.success && res.token) {
        const sessionPayload = { token: res.token, user: res.user };

        // 1. LocalStorage update
        saveSession(sessionPayload);

        // 2. React Root Session State sync
        if (typeof onSuccess === 'function') {
          onSuccess(sessionPayload);
        }

        // 3. Instant Zero-Latency Navigation
        navigate('/dashboard', { replace: true });
      } else {
        if (res.code === 'ACCOUNT_LOCKED' && res.remaining_seconds) {
          setLockoutSeconds(res.remaining_seconds);
        }
        const errMsg = res.message || 'Credentials match nahi ho rahe. Kripya check karein.';
        setError(errMsg);
        setPopup({
          show: true,
          type: 'error',
          title: res.code === 'ACCOUNT_LOCKED' ? 'Account Temporarily Locked' : 'Login Failed',
          message: errMsg,
        });
      }
    } catch (err) {
      setLoading(false);
      const networkErr = 'Server se connect karne me problem aayi. Check your connection.';
      setError(networkErr);
      setPopup({
        show: true,
        type: 'error',
        title: 'Connection Error',
        message: networkErr,
      });
    }
  };

  const closePopup = () => {
    setPopup((prev) => ({ ...prev, show: false }));
  };

  const inputCls =
    'w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20 transition disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="relative min-h-screen flex bg-zinc-950">
      <style>{`
        @keyframes strokeAnimation {
          0% { stroke-dashoffset: 48; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes scaleIn {
          0% { transform: scale(0.85); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes modalShake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .animate-draw-check {
          stroke-dasharray: 48;
          stroke-dashoffset: 48;
          animation: strokeAnimation 0.55s cubic-bezier(0.65, 0, 0.45, 1) 0.15s forwards;
        }
        .animate-scale-in {
          animation: scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-shake {
          animation: modalShake 0.4s ease-in-out;
        }
      `}</style>

      {/* Error / Warning Modal */}
      {popup.show && popup.type === 'error' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-opacity">
          <div className="w-full max-w-sm rounded-2xl border p-6 text-center shadow-2xl bg-zinc-900 border-red-500/30 shadow-red-500/10 animate-shake">
            <div className="flex flex-col items-center">
              <div className="relative flex items-center justify-center w-20 h-20 mb-4 rounded-full bg-red-500/10 border border-red-500/30">
                <div className="absolute inset-0 rounded-full bg-red-500/20 blur-xl" />
                <svg
                  className="w-10 h-10 text-red-400 relative z-10"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" className="animate-draw-check" />
                  <line x1="6" y1="6" x2="18" y2="18" className="animate-draw-check" />
                </svg>
              </div>

              <h3 className="text-xl font-bold text-white tracking-tight">{popup.title}</h3>
              <p className="mt-1.5 text-sm text-zinc-400 leading-relaxed">{popup.message}</p>

              <button
                type="button"
                onClick={closePopup}
                className="mt-6 w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-sm transition border border-zinc-700/80 hover:border-zinc-600 focus:outline-none"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Left branding panel */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-lime-400 flex items-center justify-center">
            <span className="text-zinc-950 font-black text-xl">G</span>
          </div>
          <span className="text-white font-bold text-xl tracking-tight">GymManager</span>
        </div>
        <div>
          <h1 className="text-5xl font-black text-white leading-tight">
            Apne Gym ko<br />
            <span className="text-lime-400">Digital Banao.</span>
          </h1>
          <p className="mt-4 text-zinc-400 text-lg max-w-md">
            Members, payments, branches — sab kuch ek hi dashboard se manage karo.
          </p>
        </div>
        <p className="text-zinc-600 text-sm">© 2026 GymManager · Trial mode available</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white">Welcome back 👋</h2>
            <p className="text-zinc-400 mt-1">Apne dashboard me login karo</p>
          </div>

          {/* Phone / Email tabs */}
          <div className="flex bg-zinc-900 rounded-xl p-1 mb-6">
            {['phone', 'email'].map((m) => (
              <button
                key={m}
                type="button"
                disabled={lockoutSeconds > 0}
                onClick={() => {
                  setMode(m);
                  setError('');
                }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold capitalize transition ${
                  mode === m ? 'bg-lime-400 text-zinc-950' : 'text-zinc-400 hover:text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {m === 'phone' ? '📱 Phone' : '✉️ Email'}
              </button>
            ))}
          </div>

          {/* Cooldown Lockout Warning */}
          {lockoutSeconds > 0 && (
            <div className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/40 p-4 text-sm text-amber-300 flex items-start gap-3">
              <span className="text-xl">⏱️</span>
              <div>
                <p className="font-semibold text-amber-200">Security Cooldown Active</p>
                <p className="mt-0.5 text-xs text-amber-300/80">
                  Multiple galat attempts detect hue hain. Agla attempt available hoga:{' '}
                  <span className="font-mono font-bold text-white bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                    {formatTimer(lockoutSeconds)}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* General Error Notice */}
          {error && lockoutSeconds === 0 && !popup.show && (
            <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'phone' ? (
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  disabled={lockoutSeconds > 0}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  className={inputCls}
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email</label>
                <input
                  type="email"
                  disabled={lockoutSeconds > 0}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@gym.com"
                  className={inputCls}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  disabled={lockoutSeconds > 0}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputCls}
                />
                <button
                  type="button"
                  disabled={lockoutSeconds > 0}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs font-semibold disabled:opacity-40"
                >
                  {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || lockoutSeconds > 0}
              className="w-full py-3.5 rounded-xl bg-lime-400 text-zinc-950 font-bold text-sm hover:bg-lime-300 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-lime-400/10 cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4 text-zinc-950"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Signing in…
                </span>
              ) : lockoutSeconds > 0 ? (
                `Locked (${formatTimer(lockoutSeconds)})`
              ) : (
                'Login →'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Naya gym register karna hai?{' '}
            <button
              type="button"
              onClick={handleRegisterRedirect}
              className="text-lime-400 font-semibold hover:underline"
            >
              Register karo — free trial
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}