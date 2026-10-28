// const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const getHeaders = (isFormData = false) => {
  const token = localStorage.getItem('gym_access_token');
  const activeBranchId = localStorage.getItem('gym_active_branch_id');

  const headers = {
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(activeBranchId && { 'x-branch-id': activeBranchId }),
  };

  // FormData ke waqt Content-Type explicitly NAHI lagate (browser automatically boundary set karta hai)
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
};

export function saveSession(data) {
  if (data?.token) {
    localStorage.setItem('gym_access_token', data.token);
  }
  if (data?.user) {
    localStorage.setItem('gym_user', JSON.stringify(data.user));
    const activeBranch = data.user.active_branch || data.user.accessible_branches?.[0];
    if (activeBranch?.id) {
      localStorage.setItem('gym_active_branch_id', String(activeBranch.id));
    }
  }
  // Dedicated SuperAdmin login response compatibility
  if (data?.admin) {
    localStorage.setItem('gym_user', JSON.stringify(data.admin));
    localStorage.removeItem('gym_active_branch_id');
  }
}

export function clearSession() {
  const rawUser = localStorage.getItem('gym_user');
  let isSuperAdmin = false;

  try {
    const user = rawUser ? JSON.parse(rawUser) : null;
    isSuperAdmin = Boolean(user?.role === 'super_admin' || user?.isSuperAdmin || user?.is_super_admin);
  } catch (e) {
    isSuperAdmin = false;
  }

  localStorage.removeItem('gym_access_token');
  localStorage.removeItem('gym_user');
  localStorage.removeItem('gym_active_branch_id');

  // Smart redirect: Admin ko admin portal par, normal user ko user portal par
  if (isSuperAdmin || window.location.pathname.startsWith('/admin')) {
    window.location.href = '/admin/login';
  } else {
    window.location.href = '/login';
  }
}

async function request(path, options = {}) {
  try {
    const isFormData = options.body instanceof FormData;

    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...getHeaders(isFormData),
        ...options.headers,
      },
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      // Agar login page par hi 401 aaya hai (wrong password), to logout loop na chalayein
      if (path.includes('/login')) {
        return { success: false, status: 401, message: data.message || 'Invalid Identifier or Secret Passkey.' };
      }
      clearSession();
      return { success: false, status: 401, message: 'Session expired. Please log in again.' };
    }

    return { status: res.status, ...data };
  } catch (err) {
    return { success: false, message: 'Network or server connection failed.' };
  }
}

export const apiGet = (path) => request(path, { method: 'GET' });
export const apiPost = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });
export const apiPut = (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) });
export const apiPatch = (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) });
export const apiDelete = (path) => request(path, { method: 'DELETE' });

// Multer & File Upload Dedicated Function
export const apiPostFormData = (path, formData) => request(path, { method: 'POST', body: formData });