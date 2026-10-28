// import React, { Suspense, lazy, useState } from 'react';
// import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// import { clearSession, saveSession } from './api';

// // Core Essential Providers (Direct Import to eliminate cascading Suspense waterfalls)
// import { SubscriptionProvider } from './context/SubscriptionContext';
// import { BranchProvider } from './context/BranchContext';

// import LoginPage from './pages/LoginPage';
// import Register from './pages/Register';

// // Public Landing Website (Lazy Loaded)
// const HomePage = lazy(() => import('./pages/landing/HomePage'));
// const FeaturesPage = lazy(() => import('./pages/landing/FeaturesPage'));
// const HardwarePage = lazy(() => import('./pages/landing/HardwarePage'));
// const PricingPage = lazy(() => import('./pages/landing/PricingPage'));
// const ContactPage = lazy(() => import('./pages/landing/ContactPage'));
// const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));

// // Heavy Workspace Pages: Code-Splitting Lazy Loading
// const Layout = lazy(() => import('./Layout'));
// const Dashboard = lazy(() => import('./pages/Dashboard'));
// const BranchesPage = lazy(() => import('./pages/BranchesPage'));
// const Members = lazy(() => import('./pages/Members'));
// const AddMember = lazy(() => import('./pages/AddMember'));
// const MemberDetail = lazy(() => import('./pages/MemberDetail'));
// const Plans = lazy(() => import('./pages/Plans'));
// const Billing = lazy(() => import('./pages/Billing'));
// const CreateInvoice = lazy(() => import('./pages/CreateInvoice'));
// const RecordPayment = lazy(() => import('./pages/RecordPayment'));
// const AddonsManagement = lazy(() => import('./pages/AddonsManagement'));
// const Promotions = lazy(() => import('./pages/Promotions'));
// const Expenses = lazy(() => import('./pages/Expenses'));
// const Equipment = lazy(() => import('./pages/Equipment'));
// const ViewInvoice = lazy(() => import('./pages/ViewInvoice'));
// const ClassesPage = lazy(() => import('./pages/ClassesPage'));
// const FitnessPage = lazy(() => import('./pages/FitnessPage'));
// const PersonalTrainingPage = lazy(() => import('./pages/PersonalTrainingPage'));
// const StaffPage = lazy(() => import('./pages/StaffPage'));

// // Profile Page Lazy Import
// const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));

// // Inventory Sub-pages
// const StockPage = lazy(() => import('./pages/inventory/StockPage'));
// const ProductsPage = lazy(() => import('./pages/inventory/ProductsPage'));
// const VendorsPage = lazy(() => import('./pages/inventory/VendorsPage'));
// const PurchasePage = lazy(() => import('./pages/inventory/PurchasePage'));
// const PurchaseHistoryPage = lazy(() => import('./pages/inventory/PurchaseHistoryPage'));
// const PurchaseReturnHistoryPage = lazy(() => import('./pages/inventory/PurchaseReturnHistoryPage'));
// const CreatePurchaseReturnPage = lazy(() => import('./pages/inventory/CreatePurchaseReturnPage'));
// const PosPage = lazy(() => import('./pages/inventory/PosPage'));
// const LockersPage = lazy(() => import('./pages/LockersPage'));

// // Dedicated Super Admin Lazy Imports
// const SuperAdminLogin = lazy(() => import('./pages/SuperAdminLogin'));
// const SuperAdminPage = lazy(() => import('./pages/SuperAdminPage'));

// function PageLoader() {
//   return (
//     <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-3">
//       <div className="w-10 h-10 border-4 border-lime-400 border-t-transparent rounded-full animate-spin"></div>
//       <p className="text-zinc-500 text-sm font-medium tracking-wide">Loading workspace...</p>
//     </div>
//   );
// }

// function ProtectedRoute({ session, children }) {
//   if (!session) {
//     return <Navigate to="/login" replace />;
//   }
//   return (
//     <SubscriptionProvider>
//       <BranchProvider>{children}</BranchProvider>
//     </SubscriptionProvider>
//   );
// }

// function PublicRoute({ session, children }) {
//   if (session) {
//     return <Navigate to="/dashboard" replace />;
//   }
//   return children;
// }

// function SuperAdminRoute({ children }) {
//   const token = localStorage.getItem('gym_access_token');
//   const user = localStorage.getItem('gym_user');
//   let parsedUser = null;

//   try {
//     parsedUser = user ? JSON.parse(user) : null;
//   } catch (e) {
//     parsedUser = null;
//   }

//   const isSuper = Boolean(parsedUser?.isSuperAdmin || parsedUser?.is_super_admin || parsedUser?.role === 'super_admin');

//   if (!token || !isSuper) {
//     return <Navigate to="/admin/login" replace />;
//   }

//   return children;
// }

// export default function App() {
//   const [session, setSession] = useState(() => {
//     const token = localStorage.getItem('gym_access_token');
//     const user = localStorage.getItem('gym_user');
//     return token ? { token, user: user ? JSON.parse(user) : null } : null;
//   });

//   const handleLogout = () => {
//     clearSession();
//     setSession(null);
//   };

//   const handleLoginSuccess = (data) => {
//     saveSession(data);
//     setSession(data);
//   };

//   return (
//     <BrowserRouter>
//       <Suspense fallback={<PageLoader />}>
//         <Routes>
//           {/* 1. PUBLIC MARKETING WEBSITE */}
//           <Route path="/" element={<HomePage />} />
//           <Route path="/features" element={<FeaturesPage />} />
//           <Route path="/hardware" element={<HardwarePage />} />
//           <Route path="/pricing" element={<PricingPage />} />
//           <Route path="/contact" element={<ContactPage />} />
//           <Route path="/checkout" element={<CheckoutPage />} />
//           <Route path="/register" element={<Navigate to="/pricing" replace />} />

//           {/* 2. SUPER ADMIN ROUTES */}
//           <Route path="/admin/login" element={<SuperAdminLogin />} />
//           <Route
//             path="/admin/dashboard"
//             element={
//               <SuperAdminRoute>
//                 <SuperAdminPage />
//               </SuperAdminRoute>
//             }
//           />
//           <Route path="/super-admin" element={<Navigate to="/admin/dashboard" replace />} />

//           {/* 3. TENANT PUBLIC ROUTES */}
//           <Route path="/login" element={<PublicRoute session={session}><LoginPage onSuccess={handleLoginSuccess} /></PublicRoute>} />
//           <Route path="/register" element={<PublicRoute session={session}><Register /></PublicRoute>} />

//           {/* 4. TENANT PROTECTED ROUTES */}
//           <Route
//             element={
//               <ProtectedRoute session={session}>
//                 <Layout user={session?.user} onLogout={handleLogout} />
//               </ProtectedRoute>
//             }
//           >
//             <Route path="/dashboard" element={<Dashboard />} />
//             <Route path="/profile" element={<ProfilePage />} />
//             <Route path="/branches" element={<BranchesPage />} />
//             <Route path="/members" element={<Members />} />
//             <Route path="/members/add" element={<AddMember />} />
//             <Route path="/members/:hashId" element={<MemberDetail />} />
//             <Route path="/plans" element={<Plans />} />
//             <Route path="/addons" element={<AddonsManagement />} />
//             <Route path="/expenses" element={<Expenses />} />
//             <Route path="/billing" element={<Billing />} />
//             <Route path="/billing/create-invoice" element={<CreateInvoice />} />
//             <Route path="/billing/record-payment" element={<RecordPayment />} />
//             <Route path="/memberships/assign" element={<Navigate to="/billing/create-invoice" replace />} />
//             <Route path="/promotions" element={<Promotions />} />
//             <Route path="/equipment" element={<Equipment />} />
//             <Route path="/billing/invoices/:id" element={<ViewInvoice />} />

//             {/* Inventory Routes */}
//             <Route path="/inventory" element={<Navigate to="/inventory/stock" replace />} />
//             <Route path="/inventory/stock" element={<StockPage />} />
//             <Route path="/inventory/products" element={<ProductsPage />} />
//             <Route path="/inventory/vendors" element={<VendorsPage />} />
//             <Route path="/inventory/purchases" element={<PurchasePage />} />
//             <Route path="/inventory/purchase-history" element={<PurchaseHistoryPage />} />
//             <Route path="/inventory/purchases/history" element={<Navigate to="/inventory/purchase-history" replace />} />
//             <Route path="/inventory/returns" element={<PurchaseReturnHistoryPage />} />
//             <Route path="/inventory/returns/new" element={<CreatePurchaseReturnPage />} />
//             <Route path="/inventory/pos" element={<PosPage />} />

//             <Route path="/lockers" element={<LockersPage />} />
//             <Route path="/classes" element={<ClassesPage />} />
//             <Route path="/fitness" element={<FitnessPage />} />
//             <Route path="/pt" element={<PersonalTrainingPage />} />
//             <Route path="/staff" element={<StaffPage />} />
//             <Route
//               path="/attendance"
//               element={
//                 <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl text-white">
//                   🗓️ Biometrics & Dynamic QR Attendance Hub
//                 </div>
//               }
//             />
//           </Route>

//           {/* Catch-all Fallback */}
//           <Route path="*" element={<Navigate to="/" replace />} />
//         </Routes>
//       </Suspense>
//     </BrowserRouter>
//   );
// }
import React, { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { clearSession, saveSession } from './api';

// Core Essential Providers (Direct Import to eliminate cascading Suspense waterfalls)
import { SubscriptionProvider } from './context/SubscriptionContext';
import { BranchProvider } from './context/BranchContext';

import LoginPage from './pages/LoginPage';
import Register from './pages/Register';

// Public Landing Website (Lazy Loaded)
const HomePage = lazy(() => import('./pages/landing/HomePage'));
const FeaturesPage = lazy(() => import('./pages/landing/FeaturesPage'));
const HardwarePage = lazy(() => import('./pages/landing/HardwarePage'));
const PricingPage = lazy(() => import('./pages/landing/PricingPage'));
const ContactPage = lazy(() => import('./pages/landing/ContactPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));

// Heavy Workspace Pages: Code-Splitting Lazy Loading
const Layout = lazy(() => import('./Layout'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const BranchesPage = lazy(() => import('./pages/BranchesPage'));
const Members = lazy(() => import('./pages/Members'));
const AddMember = lazy(() => import('./pages/AddMember'));
const MemberDetail = lazy(() => import('./pages/MemberDetail'));
const Plans = lazy(() => import('./pages/Plans'));
const Billing = lazy(() => import('./pages/Billing'));
const CreateInvoice = lazy(() => import('./pages/CreateInvoice'));
const RecordPayment = lazy(() => import('./pages/RecordPayment'));
const AddonsManagement = lazy(() => import('./pages/AddonsManagement'));
const Promotions = lazy(() => import('./pages/Promotions'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Equipment = lazy(() => import('./pages/Equipment'));
const ViewInvoice = lazy(() => import('./pages/ViewInvoice'));
const ClassesPage = lazy(() => import('./pages/ClassesPage'));
const FitnessPage = lazy(() => import('./pages/FitnessPage'));
const PersonalTrainingPage = lazy(() => import('./pages/PersonalTrainingPage'));
const StaffPage = lazy(() => import('./pages/StaffPage'));
const PayrollPage = lazy(() => import('./pages/PayrollPage'));

// Profile Page Lazy Import
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));

// Inventory Sub-pages
const StockPage = lazy(() => import('./pages/inventory/StockPage'));
const ProductsPage = lazy(() => import('./pages/inventory/ProductsPage'));
const VendorsPage = lazy(() => import('./pages/inventory/VendorsPage'));
const PurchasePage = lazy(() => import('./pages/inventory/PurchasePage'));
const PurchaseHistoryPage = lazy(() => import('./pages/inventory/PurchaseHistoryPage'));
const PurchaseReturnHistoryPage = lazy(() => import('./pages/inventory/PurchaseReturnHistoryPage'));
const CreatePurchaseReturnPage = lazy(() => import('./pages/inventory/CreatePurchaseReturnPage'));
const PosPage = lazy(() => import('./pages/inventory/PosPage'));
const LockersPage = lazy(() => import('./pages/LockersPage'));

// Dedicated Super Admin Lazy Imports
const SuperAdminLogin = lazy(() => import('./pages/SuperAdminLogin'));
const SuperAdminPage = lazy(() => import('./pages/SuperAdminPage'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-3">
      <div className="w-10 h-10 border-4 border-lime-400 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-zinc-500 text-sm font-medium tracking-wide">Loading workspace...</p>
    </div>
  );
}

function ProtectedRoute({ session, children }) {
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return (
    <SubscriptionProvider>
      <BranchProvider>{children}</BranchProvider>
    </SubscriptionProvider>
  );
}

function PublicRoute({ session, children }) {
  if (session) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function SuperAdminRoute({ children }) {
  const token = localStorage.getItem('gym_access_token');
  const user = localStorage.getItem('gym_user');
  let parsedUser = null;

  try {
    parsedUser = user ? JSON.parse(user) : null;
  } catch (e) {
    parsedUser = null;
  }

  const isSuper = Boolean(parsedUser?.isSuperAdmin || parsedUser?.is_super_admin || parsedUser?.role === 'super_admin');

  if (!token || !isSuper) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

export default function App() {
  const [session, setSession] = useState(() => {
    const token = localStorage.getItem('gym_access_token');
    const user = localStorage.getItem('gym_user');
    return token ? { token, user: user ? JSON.parse(user) : null } : null;
  });

  const handleLogout = () => {
    clearSession();
    setSession(null);
  };

  const handleLoginSuccess = (data) => {
    saveSession(data);
    setSession(data);
  };

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* 1. PUBLIC MARKETING WEBSITE */}
          <Route path="/" element={<HomePage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/hardware" element={<HardwarePage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/register" element={<Navigate to="/pricing" replace />} />

          {/* 2. SUPER ADMIN ROUTES */}
          <Route path="/admin/login" element={<SuperAdminLogin />} />
          <Route
            path="/admin/dashboard"
            element={
              <SuperAdminRoute>
                <SuperAdminPage />
              </SuperAdminRoute>
            }
          />
          <Route path="/super-admin" element={<Navigate to="/admin/dashboard" replace />} />

          {/* 3. TENANT PUBLIC ROUTES */}
          <Route path="/login" element={<PublicRoute session={session}><LoginPage onSuccess={handleLoginSuccess} /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute session={session}><Register /></PublicRoute>} />

          {/* 4. TENANT PROTECTED ROUTES */}
          <Route
            element={
              <ProtectedRoute session={session}>
                <Layout user={session?.user} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/branches" element={<BranchesPage />} />
            <Route path="/members" element={<Members />} />
            <Route path="/members/add" element={<AddMember />} />
            <Route path="/members/:hashId" element={<MemberDetail />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/addons" element={<AddonsManagement />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/billing/create-invoice" element={<CreateInvoice />} />
            <Route path="/billing/record-payment" element={<RecordPayment />} />
            <Route path="/memberships/assign" element={<Navigate to="/billing/create-invoice" replace />} />
            <Route path="/promotions" element={<Promotions />} />
            <Route path="/equipment" element={<Equipment />} />
            <Route path="/billing/invoices/:id" element={<ViewInvoice />} />

            {/* Inventory Routes */}
            <Route path="/inventory" element={<Navigate to="/inventory/stock" replace />} />
            <Route path="/inventory/stock" element={<StockPage />} />
            <Route path="/inventory/products" element={<ProductsPage />} />
            <Route path="/inventory/vendors" element={<VendorsPage />} />
            <Route path="/inventory/purchases" element={<PurchasePage />} />
            <Route path="/inventory/purchase-history" element={<PurchaseHistoryPage />} />
            <Route path="/inventory/purchases/history" element={<Navigate to="/inventory/purchase-history" replace />} />
            <Route path="/inventory/returns" element={<PurchaseReturnHistoryPage />} />
            <Route path="/inventory/returns/new" element={<CreatePurchaseReturnPage />} />
            <Route path="/inventory/pos" element={<PosPage />} />

            <Route path="/lockers" element={<LockersPage />} />
            <Route path="/classes" element={<ClassesPage />} />
            <Route path="/fitness" element={<FitnessPage />} />
            <Route path="/pt" element={<PersonalTrainingPage />} />
            <Route path="/staff" element={<StaffPage />} />
            <Route path="/payroll" element={<PayrollPage />} />
            <Route
              path="/attendance"
              element={
                <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl text-white">
                  🗓️ Biometrics & Dynamic QR Attendance Hub
                </div>
              }
            />
          </Route>

          {/* Catch-all Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}