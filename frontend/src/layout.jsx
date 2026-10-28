import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

export default function Layout({ user, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Mobile drawer (open/close) + Desktop collapse state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Desktop pe jane par mobile drawer auto-close
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Route change hone par mobile drawer band karo
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Current page ka title derive karo
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.startsWith('/inventory')) return 'Inventory';
    if (path.startsWith('/members')) return 'Members';
    if (path.startsWith('/billing')) return 'Billing & Fees';
    const map = {
      '/dashboard': 'Dashboard',
      '/plans': 'Plans & Pricing',
      '/addons': 'Add-ons',
      '/lockers': 'Lockers',
      '/attendance': 'Attendance',
      '/expenses': 'Expenses',
      '/promotions': 'Promotions',
      '/equipment': 'Equipment',
    };
    return map[path] || 'Dashboard';
  };

  const handleQuickAdd = () => {
    navigate('/members/add');
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-white">
      {/* Sidebar */}
      <Sidebar
        user={user}
        logout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
      />

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          activeTab={getActiveTab()}
          onQuickAdd={handleQuickAdd}
          onMenuClick={() => setSidebarOpen(true)}
          user={user}
          onLogout={onLogout}
        />

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}