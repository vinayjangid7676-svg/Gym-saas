// import React, { useState } from 'react';
// import { NavLink, useLocation } from 'react-router-dom';
// import { useSubscription } from '../context/SubscriptionContext';
// import UpgradeModal from './UpgradeModal';

// /* ============================================================
//    Inline SVG Icons Set
//    ============================================================ */
// const Icons = {
//   dashboard: (props) => (
//     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
//       <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
//     </svg>
//   ),
//   branches: (props) => (
//     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
//       <path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-3" /><path d="M9 9h1" /><path d="M9 13h1" /><path d="M9 17h1" />
//     </svg>
//   ),
//   members: (props) => (
//     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
//       <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
//     </svg>
//   ),
//   fitness: (props) => (
//     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
//       <path d="m6.5 6.5 11 11" /><path d="m21 21-1-1" /><path d="m3 3 1 1" /><path d="m18 22 4-4" /><path d="m2 6 4-4" /><path d="m3 10 7-7" /><path d="m14 21 7-7" />
//     </svg>
//   ),
//   classes: (props) => (
//     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
//       <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
//     </svg>
//   ),
//   plans: (props) => (
//     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
//       <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h5" />
//     </svg>
//   ),
//   lockers: (props) => (
//     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
//       <rect x="4" y="3" width="16" height="18" rx="2" /><path d="M12 3v18" /><path d="M8 12h.01" /><path d="M16 12h.01" />
//     </svg>
//   ),
//   attendance: (props) => (
//     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
//       <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /><path d="m9 16 2 2 4-4" />
//     </svg>
//   ),
//   billing: (props) => (
//     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
//       <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
//     </svg>
//   ),
//   expenses: (props) => (
//     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
//       <path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
//     </svg>
//   ),
//   equipment: (props) => (
//     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
//       <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
//     </svg>
//   ),
//   inventory: (props) => (
//     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
//       <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
//     </svg>
//   ),
//   pos: (props) => (
//     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
//       <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M7 15h.01" /><path d="M11 15h2" /><rect x="6" y="8" width="12" height="4" rx="1" />
//     </svg>
//   ),
//   logout: (props) => (
//     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
//       <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
//     </svg>
//   ),
//   collapse: (props) => (
//     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
//       <path d="m11 17-5-5 5-5" /><path d="m18 17-5-5 5-5" />
//     </svg>
//   ),
//   close: (props) => (
//     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
//       <path d="M18 6 6 18" /><path d="m6 6 12 12" />
//     </svg>
//   )
// };

// /* ============================================================
//    Navigation Matrix with Role AND Plan Feature Flags
//    ============================================================ */
// const MENU_ITEMS = [
//   { path: '/dashboard', label: 'Dashboard', icon: Icons.dashboard, roles: ['owner', 'manager', 'receptionist', 'trainer'], feature: null },
//   { path: '/branches', label: 'Branches', icon: Icons.branches, roles: ['owner', 'manager'], feature: 'multi_branch' },
//   { path: '/members', label: 'Members', icon: Icons.members, roles: ['owner', 'manager', 'receptionist', 'trainer'], feature: null },
//   { path: '/billing', label: 'Billing & Fees', icon: Icons.billing, roles: ['owner', 'manager', 'receptionist'], feature: null },
//   { path: '/plans', label: 'Plans & Pricing', icon: Icons.plans, roles: ['owner', 'manager'], feature: null },
//   // { path: '/pos', label: 'POS Terminal', icon: Icons.pos, roles: ['owner', 'manager', 'receptionist'], feature: 'pos' },
//   { path: '/fitness', label: 'Workouts & Diet', icon: Icons.fitness, roles: ['owner', 'manager', 'trainer'], feature: 'fitness_diet_engine' },
//   { path: '/pt', label: 'Personal Training', icon: Icons.fitness, roles: ['owner', 'manager', 'trainer'], feature: 'pt_management' },
//   { path: '/classes', label: 'Batch Classes', icon: Icons.classes, roles: ['owner', 'manager', 'receptionist', 'trainer'], feature: 'classes' },
//   { path: '/attendance', label: 'Biometrics & QR', icon: Icons.attendance, roles: ['owner', 'manager', 'receptionist'], feature: 'biometric_attendance' },
//   { path: '/staff', label: 'Staff & Payroll', icon: Icons.members, roles: ['owner', 'manager'], feature: 'payroll' },
//   { path: '/equipment', label: 'Equipment Repair', icon: Icons.equipment, roles: ['owner', 'manager'], feature: 'equipment_maintenance' },
//   { path: '/inventory/stock', label: 'Store Inventory', icon: Icons.inventory, roles: ['owner', 'manager'], feature: 'pos' },
//   { path: '/lockers', label: 'Locker System', icon: Icons.lockers, roles: ['owner', 'manager', 'receptionist'], feature: null },
//   { path: '/expenses', label: 'Expenses', icon: Icons.expenses, roles: ['owner', 'manager'], feature: null },
// ];

// export default function Sidebar({ user, logout, isOpen, onClose, collapsed, onToggleCollapse }) {
//   const location = useLocation();
//   const { hasFeature, plan } = useSubscription();
//   const [lockedTarget, setLockedTarget] = useState(null);

//   let activeUser = user;
//   if (!activeUser) {
//     try {
//       const rawUser = localStorage.getItem('gym_user');
//       if (rawUser) activeUser = JSON.parse(rawUser);
//     } catch (e) {
//       activeUser = null;
//     }
//   }

//   const currentRole = (activeUser?.role || activeUser?.role_slug || 'trainer').toLowerCase().trim();
//   const isSuper = Boolean(activeUser?.isSuperAdmin || activeUser?.is_super_admin);

//   // Dynamic Gym Name & Avatar initial
//   const gymDisplayName = activeUser?.organization_name || 'My Gym';
//   const gymInitial = gymDisplayName.charAt(0).toUpperCase();

//   const visibleMenuItems = MENU_ITEMS.filter((item) => {
//     if (isSuper) return true;
//     return item.roles.map((r) => r.toLowerCase()).includes(currentRole);
//   });

//   const isItemActive = (itemPath) => {
//     if (itemPath === '/inventory/stock') return location.pathname.startsWith('/inventory');
//     return location.pathname === itemPath || location.pathname.startsWith(`${itemPath}/`);
//   };

//   return (
//     <>
//       <div
//         onClick={onClose}
//         className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
//           isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
//         }`}
//       />

//       <aside
//         className={`fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 flex-col overflow-hidden border-r border-zinc-800 bg-zinc-950 transition-[transform,width] duration-300 ease-in-out w-72 lg:sticky lg:top-0 lg:translate-x-0 ${
//           collapsed ? 'lg:w-20' : 'lg:w-72'
//         } ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
//       >
//         {/* Brand Header */}
//         <div className={`flex h-16 shrink-0 items-center gap-3 border-b border-zinc-800 px-4 ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}>
//           <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime-400 text-lg font-black text-zinc-950 shadow-lg shadow-lime-400/20">
//             {gymInitial}
//           </div>
//           <div className={`min-w-0 overflow-hidden whitespace-nowrap ${collapsed ? 'lg:hidden' : ''}`}>
//             <h1 className="text-sm font-bold leading-tight text-white truncate" title={gymDisplayName}>
//               {gymDisplayName}
//             </h1>
//             <span className="text-[10px] text-lime-400 font-mono uppercase font-bold tracking-wider truncate block">
//               {plan?.name || 'Starter Solo'}
//             </span>
//           </div>

//           <button onClick={onClose} className="ml-auto rounded-lg p-2 text-zinc-400 hover:text-white lg:hidden">
//             <Icons.close className="h-5 w-5" />
//           </button>
//         </div>

//         {/* Navigation List - Scrollbar hidden for cleaner UI */}
//         <nav className="flex-1 space-y-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-3 py-4">
//           {visibleMenuItems.map((item) => {
//             const isLocked = item.feature && !isSuper ? !hasFeature(item.feature) : false;
//             const active = isItemActive(item.path);

//             if (isLocked) {
//               return (
//                 <button
//                   key={item.label}
//                   type="button"
//                   onClick={() => setLockedTarget(item.label)}
//                   title={collapsed ? `${item.label} (Locked)` : undefined}
//                   className={`w-full group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-500 hover:bg-zinc-900/60 transition ${
//                     collapsed ? 'lg:justify-center lg:px-0' : ''
//                   }`}
//                 >
//                   <item.icon className="h-5 w-5 shrink-0 text-zinc-600 group-hover:text-zinc-400" />
//                   <span className={`truncate text-zinc-500 ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
//                   <span className={`ml-auto text-[9px] bg-zinc-800/80 text-zinc-400 px-1.5 py-0.5 rounded font-mono font-bold ${collapsed ? 'lg:hidden' : ''}`}>
//                     🔒 PRO
//                   </span>
//                 </button>
//               );
//             }

//             return (
//               <NavLink
//                 key={item.path}
//                 to={item.path}
//                 onClick={onClose}
//                 title={collapsed ? item.label : undefined}
//                 className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
//                   collapsed ? 'lg:justify-center lg:px-0' : ''
//                 } ${
//                   active ? 'bg-lime-400 font-bold text-zinc-950 shadow-md shadow-lime-400/20' : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-white'
//                 }`}
//               >
//                 <item.icon className={`h-5 w-5 shrink-0 ${active ? 'text-zinc-950' : 'text-zinc-400 group-hover:text-white'}`} />
//                 <span className={`truncate ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
//               </NavLink>
//             );
//           })}
//         </nav>

//         {/* Footer: User Details & Collapse */}
//         <div className="shrink-0 border-t border-zinc-800 p-3">
//           <button
//             onClick={onToggleCollapse}
//             type="button"
//             className="mb-2 hidden w-full items-center justify-center gap-2 rounded-lg border border-zinc-800 py-2 text-xs font-medium text-zinc-500 hover:border-zinc-700 hover:text-zinc-300 lg:flex"
//           >
//             <Icons.collapse className={`h-4 w-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
//             <span className={collapsed ? 'lg:hidden' : ''}>Collapse</span>
//           </button>

//           <div className={`items-center gap-2 ${collapsed ? 'lg:hidden' : 'flex'}`}>
//             <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-sm font-bold text-lime-400">
//               {(activeUser?.name || 'G').charAt(0).toUpperCase()}
//             </div>
//             <div className="min-w-0 flex-1">
//               <p className="truncate text-sm font-semibold text-white">{activeUser?.name || 'User'}</p>
//               <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-lime-400 font-mono uppercase">
//                 {currentRole}
//               </span>
//             </div>
//             <button
//               onClick={logout}
//               type="button"
//               className="shrink-0 rounded-lg bg-zinc-800/80 p-2 text-zinc-400 hover:bg-red-500/15 hover:text-red-400 transition"
//             >
//               <Icons.logout className="h-5 w-5" />
//             </button>
//           </div>
//         </div>
//       </aside>

//       {/* Upgrade Plan Trigger Popup */}
//       <UpgradeModal
//         isOpen={Boolean(lockedTarget)}
//         onClose={() => setLockedTarget(null)}
//         requiredFeature={lockedTarget}
//       />
//     </>
//   );
// }
import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSubscription } from '../context/SubscriptionContext';
import UpgradeModal from './UpgradeModal';

/* ============================================================
   Inline SVG Icons Set
   ============================================================ */
const Icons = {
  dashboard: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  branches: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-3" /><path d="M9 9h1" /><path d="M9 13h1" /><path d="M9 17h1" />
    </svg>
  ),
  members: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  fitness: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m6.5 6.5 11 11" /><path d="m21 21-1-1" /><path d="m3 3 1 1" /><path d="m18 22 4-4" /><path d="m2 6 4-4" /><path d="m3 10 7-7" /><path d="m14 21 7-7" />
    </svg>
  ),
  classes: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  plans: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h5" />
    </svg>
  ),
  lockers: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" /><path d="M12 3v18" /><path d="M8 12h.01" /><path d="M16 12h.01" />
    </svg>
  ),
  attendance: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /><path d="m9 16 2 2 4-4" />
    </svg>
  ),
  billing: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
    </svg>
  ),
  payroll: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <path d="M6 15h2" />
      <path d="M12 15h6" />
    </svg>
  ),
  expenses: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  equipment: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  inventory: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
    </svg>
  ),
  pos: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M7 15h.01" /><path d="M11 15h2" /><rect x="6" y="8" width="12" height="4" rx="1" />
    </svg>
  ),
  logout: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
    </svg>
  ),
  collapse: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m11 17-5-5 5-5" /><path d="m18 17-5-5 5-5" />
    </svg>
  ),
  close: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  )
};

/* ============================================================
   Navigation Matrix with Role AND Plan Feature Flags
   ============================================================ */
const MENU_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: Icons.dashboard, roles: ['owner', 'manager', 'receptionist', 'trainer'], feature: null },
  { path: '/branches', label: 'Branches', icon: Icons.branches, roles: ['owner', 'manager'], feature: 'multi_branch' },
  { path: '/members', label: 'Members', icon: Icons.members, roles: ['owner', 'manager', 'receptionist', 'trainer'], feature: null },
  { path: '/billing', label: 'Billing & Fees', icon: Icons.billing, roles: ['owner', 'manager', 'receptionist'], feature: null },
  { path: '/plans', label: 'Plans & Pricing', icon: Icons.plans, roles: ['owner', 'manager'], feature: null },
  { path: '/fitness', label: 'Workouts & Diet', icon: Icons.fitness, roles: ['owner', 'manager', 'trainer'], feature: 'fitness_diet_engine' },
  { path: '/pt', label: 'Personal Training', icon: Icons.fitness, roles: ['owner', 'manager', 'trainer'], feature: 'pt_management' },
  { path: '/classes', label: 'Batch Classes', icon: Icons.classes, roles: ['owner', 'manager', 'receptionist', 'trainer'], feature: 'classes' },
  { path: '/attendance', label: 'Biometrics & QR', icon: Icons.attendance, roles: ['owner', 'manager', 'receptionist'], feature: 'biometric_attendance' },
  { path: '/staff', label: 'Staff Directory', icon: Icons.members, roles: ['owner', 'manager'], feature: 'payroll' },
  { path: '/payroll', label: 'Payroll & Payouts', icon: Icons.payroll, roles: ['owner', 'manager'], feature: 'payroll' },
  { path: '/equipment', label: 'Equipment Repair', icon: Icons.equipment, roles: ['owner', 'manager'], feature: 'equipment_maintenance' },
  { path: '/inventory/stock', label: 'Store Inventory', icon: Icons.inventory, roles: ['owner', 'manager'], feature: 'pos' },
  { path: '/lockers', label: 'Locker System', icon: Icons.lockers, roles: ['owner', 'manager', 'receptionist'], feature: null },
  { path: '/expenses', label: 'Expenses', icon: Icons.expenses, roles: ['owner', 'manager'], feature: null },
];

export default function Sidebar({ user, logout, isOpen, onClose, collapsed, onToggleCollapse }) {
  const location = useLocation();
  const { hasFeature, plan } = useSubscription();
  const [lockedTarget, setLockedTarget] = useState(null);

  let activeUser = user;
  if (!activeUser) {
    try {
      const rawUser = localStorage.getItem('gym_user');
      if (rawUser) activeUser = JSON.parse(rawUser);
    } catch (e) {
      activeUser = null;
    }
  }

  const currentRole = (activeUser?.role || activeUser?.role_slug || 'trainer').toLowerCase().trim();
  const isSuper = Boolean(activeUser?.isSuperAdmin || activeUser?.is_super_admin);

  // Dynamic Gym Name & Avatar initial
  const gymDisplayName = activeUser?.organization_name || 'My Gym';
  const gymInitial = gymDisplayName.charAt(0).toUpperCase();

  const visibleMenuItems = MENU_ITEMS.filter((item) => {
    if (isSuper) return true;
    return item.roles.map((r) => r.toLowerCase()).includes(currentRole);
  });

  const isItemActive = (itemPath) => {
    if (itemPath === '/inventory/stock') return location.pathname.startsWith('/inventory');
    return location.pathname === itemPath || location.pathname.startsWith(`${itemPath}/`);
  };

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 flex-col overflow-hidden border-r border-zinc-800 bg-zinc-950 transition-[transform,width] duration-300 ease-in-out w-72 lg:sticky lg:top-0 lg:translate-x-0 ${
          collapsed ? 'lg:w-20' : 'lg:w-72'
        } ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Brand Header */}
        <div className={`flex h-16 shrink-0 items-center gap-3 border-b border-zinc-800 px-4 ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime-400 text-lg font-black text-zinc-950 shadow-lg shadow-lime-400/20">
            {gymInitial}
          </div>
          <div className={`min-w-0 overflow-hidden whitespace-nowrap ${collapsed ? 'lg:hidden' : ''}`}>
            <h1 className="text-sm font-bold leading-tight text-white truncate" title={gymDisplayName}>
              {gymDisplayName}
            </h1>
            <span className="text-[10px] text-lime-400 font-mono uppercase font-bold tracking-wider truncate block">
              {plan?.name || 'Starter Solo'}
            </span>
          </div>

          <button onClick={onClose} className="ml-auto rounded-lg p-2 text-zinc-400 hover:text-white lg:hidden">
            <Icons.close className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 space-y-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-3 py-4">
          {visibleMenuItems.map((item) => {
            const isLocked = item.feature && !isSuper ? !hasFeature(item.feature) : false;
            const active = isItemActive(item.path);

            if (isLocked) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setLockedTarget(item.label)}
                  title={collapsed ? `${item.label} (Locked)` : undefined}
                  className={`w-full group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-500 hover:bg-zinc-900/60 transition ${
                    collapsed ? 'lg:justify-center lg:px-0' : ''
                  }`}
                >
                  <item.icon className="h-5 w-5 shrink-0 text-zinc-600 group-hover:text-zinc-400" />
                  <span className={`truncate text-zinc-500 ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
                  <span className={`ml-auto text-[9px] bg-zinc-800/80 text-zinc-400 px-1.5 py-0.5 rounded font-mono font-bold ${collapsed ? 'lg:hidden' : ''}`}>
                    🔒 PRO
                  </span>
                </button>
              );
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                title={collapsed ? item.label : undefined}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  collapsed ? 'lg:justify-center lg:px-0' : ''
                } ${
                  active ? 'bg-lime-400 font-bold text-zinc-950 shadow-md shadow-lime-400/20' : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-white'
                }`}
              >
                <item.icon className={`h-5 w-5 shrink-0 ${active ? 'text-zinc-950' : 'text-zinc-400 group-hover:text-white'}`} />
                <span className={`truncate ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer: User Details & Collapse */}
        <div className="shrink-0 border-t border-zinc-800 p-3">
          <button
            onClick={onToggleCollapse}
            type="button"
            className="mb-2 hidden w-full items-center justify-center gap-2 rounded-lg border border-zinc-800 py-2 text-xs font-medium text-zinc-500 hover:border-zinc-700 hover:text-zinc-300 lg:flex"
          >
            <Icons.collapse className={`h-4 w-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
            <span className={collapsed ? 'lg:hidden' : ''}>Collapse</span>
          </button>

          <div className={`items-center gap-2 ${collapsed ? 'lg:hidden' : 'flex'}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-sm font-bold text-lime-400">
              {(activeUser?.name || 'G').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{activeUser?.name || 'User'}</p>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-lime-400 font-mono uppercase">
                {currentRole}
              </span>
            </div>
            <button
              onClick={logout}
              type="button"
              className="shrink-0 rounded-lg bg-zinc-800/80 p-2 text-zinc-400 hover:bg-red-500/15 hover:text-red-400 transition"
            >
              <Icons.logout className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Upgrade Plan Trigger Popup */}
      <UpgradeModal
        isOpen={Boolean(lockedTarget)}
        onClose={() => setLockedTarget(null)}
        requiredFeature={lockedTarget}
      />
    </>
  );
}