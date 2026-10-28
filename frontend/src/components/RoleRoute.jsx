import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

export default function RoleRoute({ allowedRoles = [] }) {
  let currentUser = null;
  try {
    const raw = localStorage.getItem('gym_user');
    if (raw) currentUser = JSON.parse(raw);
  } catch (e) {
    currentUser = null;
  }

  // Agar user logged in nahi hai toh login page par bhejein
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const userRole = (currentUser.role || 'trainer').toLowerCase().trim();

  // Super admin ko har page ka access ho
  if (currentUser.isSuperAdmin || currentUser.is_super_admin) {
    return <Outlet />;
  }

  // Agar user ka role allowedRoles array me nahi hai toh dashboard par redirect karein
  const isAllowed = allowedRoles.map((r) => r.toLowerCase().trim()).includes(userRole);

  if (!isAllowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}