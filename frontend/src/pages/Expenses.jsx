import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiGet, apiPost } from '../api';

const inputCls =
  'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-lime-400 focus:outline-none transition';
const labelCls = 'text-xs text-zinc-400 block mb-1 font-medium';

const PAYMENT_METHODS = ['cash', 'upi_qr', 'bank_transfer', 'cheque', 'pos_machine', 'other'];

export default function Expenses() {
  const [activeTab, setActiveTab] = useState('expenses'); // 'expenses' | 'register' | 'vendors'
  const [loading, setLoading] = useState(true);

  // Data states
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [activeRegister, setActiveRegister] = useState(null);
  const [cashMovements, setCashMovements] = useState([]);

  // Modals state
  const [openModal, setOpenModal] = useState(null); // 'recordExpense' | 'category' | 'vendor' | 'openReg' | 'cashMove' | 'closeReg'
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [expenseForm, setExpenseForm] = useState({
    branch_id: '',
    category_id: '',
    vendor_id: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    description: '',
    receipt_url: '',
    status: 'paid'
  });

  const [categoryForm, setCategoryForm] = useState({ name: '' });
  const [vendorForm, setVendorForm] = useState({ name: '', phone: '', email: '', address: '', tax_id_gst: '' });
  const [openRegForm, setOpenRegForm] = useState({ register_name: 'Main Counter Drawer', opening_balance: '1000' });
  const [cashMoveForm, setCashMoveForm] = useState({ transaction_type: 'cash_out', amount: '', notes: '' });
  const [closeRegForm, setCloseRegForm] = useState({ closing_balance: '' });

  // Get Branch ID safely
  const getBranchId = useCallback(() => {
    const rawUser = localStorage.getItem('gym_user');
    if (rawUser) {
      try {
        const u = JSON.parse(rawUser);
        return u.branch_id || localStorage.getItem('branch_id') || 1;
      } catch (err) {
        return 1;
      }
    }
    return 1;
  }, []);

  // Fetch Master Data & Lists
  const fetchData = useCallback(async () => {
    setLoading(true);
    const branchId = getBranchId();

    const [expRes, masterRes, regRes] = await Promise.all([
      apiGet(`/api/v1/expenses?branch_id=${branchId}`),
      apiGet('/api/v1/expenses/master-data'),
      apiGet(`/api/v1/expenses/registers/active?branch_id=${branchId}`)
    ]);

    if (expRes?.success) setExpenses(expRes.data || []);
    if (masterRes?.success) {
      setCategories(masterRes.data?.categories || []);
      setVendors(masterRes.data?.vendors || []);
    }
    if (regRes?.success) {
      setActiveRegister(regRes.data?.active_register || null);
      setCashMovements(regRes.data?.movements || []);
    }
    setLoading(false);
  }, [getBranchId]);

  useEffect(() => {
    fetchData();
    setExpenseForm((prev) => ({ ...prev, branch_id: getBranchId() }));
  }, [fetchData, getBranchId]);

  // Calculations
  const stats = useMemo(() => {
    const totalExpenses = expenses.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
    const thisMonthExpenses = expenses
      .filter((e) => {
        const d = new Date(e.expense_date);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);

    let drawerCashBalance = 0;
    if (activeRegister) {
      const opening = parseFloat(activeRegister.opening_balance || 0);
      const cashIn = cashMovements
        .filter((m) => m.transaction_type === 'cash_in')
        .reduce((a, b) => a + parseFloat(b.amount || 0), 0);
      const cashOut = cashMovements
        .filter((m) => m.transaction_type === 'cash_out')
        .reduce((a, b) => a + parseFloat(b.amount || 0), 0);
      drawerCashBalance = opening + cashIn - cashOut;
    }

    return { totalExpenses, thisMonthExpenses, drawerCashBalance };
  }, [expenses, activeRegister, cashMovements]);

  // Generic Submit Handler
  const handleActionSubmit = async (endpoint, payload, resetFn) => {
    setSubmitting(true);
    const res = await apiPost(endpoint, payload);
    if (res?.success) {
      alert(res.message || 'Operation successful!');
      if (resetFn) resetFn();
      setOpenModal(null);
      await fetchData();
    } else {
      alert(res?.message || 'Error occurred while processing.');
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      {/* ─── Top Header & Controls ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Expenses & Petty Cash Operations</h1>
          <p className="text-sm text-zinc-400">Track operating expenditure, vendor settlements aur daily counter drawer</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setOpenModal('category')}
            className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs rounded-xl border border-zinc-700 transition"
          >
            + Category
          </button>
          <button
            onClick={() => setOpenModal('vendor')}
            className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs rounded-xl border border-zinc-700 transition"
          >
            + Vendor
          </button>
          <button
            onClick={() => setOpenModal('recordExpense')}
            className="px-4 py-2 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm"
          >
            + Record Expense
          </button>
        </div>
      </div>

      {/* ─── Financial Metric Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <p className="text-xs text-zinc-400 mb-1 font-medium">This Month Operating Cost</p>
          <h3 className="text-2xl font-bold text-red-400">₹{stats.thisMonthExpenses.toLocaleString('en-IN')}</h3>
          <p className="text-[11px] text-zinc-500 mt-1">Gym rent, electricity & supplies</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <p className="text-xs text-zinc-400 mb-1 font-medium">Lifetime Recorded Expenses</p>
          <h3 className="text-2xl font-bold text-zinc-200">₹{stats.totalExpenses.toLocaleString('en-IN')}</h3>
          <p className="text-[11px] text-zinc-500 mt-1">{expenses.length} invoices audit ready</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-1">
            <p className="text-xs text-zinc-400 font-medium">Counter Drawer Cash</p>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                activeRegister ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {activeRegister ? 'Drawer Open' : 'Closed'}
            </span>
          </div>
          <h3 className="text-2xl font-bold text-lime-400">
            {activeRegister ? `₹${stats.drawerCashBalance.toLocaleString('en-IN')}` : '₹0.00'}
          </h3>
          <p className="text-[11px] text-zinc-500 mt-1">
            {activeRegister ? `Opening: ₹${activeRegister.opening_balance}` : 'Open register to log petty cash'}
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <p className="text-xs text-zinc-400 mb-1 font-medium">Active Vendors</p>
          <h3 className="text-2xl font-bold text-blue-400">{vendors.length}</h3>
          <p className="text-[11px] text-zinc-500 mt-1">{categories.length} configured expense categories</p>
        </div>
      </div>

      {/* ─── Navigation Tabs ─── */}
      <div className="flex gap-2 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'expenses' ? 'bg-zinc-800 text-lime-400' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Expense Vouchers ({expenses.length})
        </button>
        <button
          onClick={() => setActiveTab('register')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'register' ? 'bg-zinc-800 text-lime-400' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Petty Cash Drawer {activeRegister && <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 ml-1.5" />}
        </button>
        <button
          onClick={() => setActiveTab('vendors')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'vendors' ? 'bg-zinc-800 text-lime-400' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Vendors & Categories
        </button>
      </div>

      {/* ─── TAB 1: EXPENSES TABLE ─── */}
      {loading ? (
        <div className="p-12 text-center text-zinc-500 bg-zinc-900 rounded-2xl border border-zinc-800 text-xs">
          Loading financial vouchers & ledgers...
        </div>
      ) : activeTab === 'expenses' ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950 text-zinc-500 uppercase border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Vendor</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4">Recorded By</th>
                <th className="py-3 px-4">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {expenses.map((exp) => (
                <tr key={exp.id || exp.hash_id} className="hover:bg-zinc-800/30 transition">
                  <td className="py-3 px-4 font-mono text-zinc-400">
                    {new Date(exp.expense_date).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700 font-medium">
                      {exp.category_name || 'General Expense'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-white font-medium max-w-xs truncate">
                    {exp.description || 'No description provided'}
                  </td>
                  <td className="py-3 px-4 text-zinc-400 font-medium">{exp.vendor_name || 'Direct / Walkin'}</td>
                  <td className="py-3 px-4 font-bold text-red-400 text-sm">₹{parseFloat(exp.amount).toFixed(2)}</td>
                  <td className="py-3 px-4">
                    <span className="uppercase text-[10px] tracking-wider px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-300 border border-zinc-700">
                      {(exp.payment_method || 'cash').replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-zinc-400">{exp.recorded_by_name || 'Admin'}</td>
                  <td className="py-3 px-4">
                    {exp.receipt_url ? (
                      <a
                        href={exp.receipt_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-lime-400 hover:underline font-semibold"
                      >
                        View Slip ↗
                      </a>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-zinc-500">
                    Abhi tak koi expense log nahi hua hai.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'register' ? (
        /* ─── TAB 2: CASH REGISTER & PETTY CASH DRAWER ─── */
        <div className="space-y-6">
          {/* Register Status Banner */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{activeRegister ? '🟢' : '🔴'}</span>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {activeRegister ? activeRegister.register_name : 'No Active Cash Drawer'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {activeRegister
                      ? `Opened on ${new Date(activeRegister.opened_at).toLocaleString()} by ${activeRegister.opened_by_name || 'Front Desk'}`
                      : 'Subah counter kholne ke waqt register open karein taaki cash transactions balance rahein.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {!activeRegister ? (
                <button
                  onClick={() => setOpenModal('openReg')}
                  className="px-4 py-2 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-xs rounded-xl transition"
                >
                  + Open Daily Cash Register
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setOpenModal('cashMove')}
                    className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-lime-400 border border-zinc-700 font-bold text-xs rounded-xl transition"
                  >
                    ⇅ Cash In / Cash Out
                  </button>
                  <button
                    onClick={() => {
                      setCloseRegForm({ closing_balance: stats.drawerCashBalance.toFixed(2) });
                      setOpenModal('closeReg');
                    }}
                    className="px-3.5 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-bold text-xs rounded-xl transition"
                  >
                    🔒 Close Register (EOD)
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Cash In / Out Log Table */}
          {activeRegister && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Today's Drawer Transactions Audit
                </h4>
                <span className="text-xs font-mono text-zinc-400">
                  Opening Balance: ₹{parseFloat(activeRegister.opening_balance).toFixed(2)}
                </span>
              </div>
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-950 text-zinc-500 uppercase border-b border-zinc-800">
                  <tr>
                    <th className="p-3">Time</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Reason / Notes</th>
                    <th className="p-3">Logged By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {cashMovements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-zinc-800/30">
                      <td className="p-3 text-zinc-400 font-mono">{new Date(mov.created_at).toLocaleTimeString()}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            mov.transaction_type === 'cash_in'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}
                        >
                          {mov.transaction_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td
                        className={`p-3 font-bold ${
                          mov.transaction_type === 'cash_in' ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {mov.transaction_type === 'cash_in' ? '+' : '-'} ₹{parseFloat(mov.amount).toFixed(2)}
                      </td>
                      <td className="p-3 text-zinc-200">{mov.notes || 'Counter movement'}</td>
                      <td className="p-3 text-zinc-400">{mov.user_name || 'Staff'}</td>
                    </tr>
                  ))}
                  {cashMovements.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-zinc-500">
                        Drawer khulne ke baad koi transaction log nahi hua.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ─── TAB 3: VENDORS & CATEGORIES MASTER ─── */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Categories */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Expense Categories</h3>
                <p className="text-xs text-zinc-400">Heads for classifying gym expenses</p>
              </div>
              <button
                onClick={() => setOpenModal('category')}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-lime-400 text-xs font-bold rounded-xl border border-zinc-700"
              >
                + Add Category
              </button>
            </div>
            <div className="divide-y divide-zinc-800/60">
              {categories.map((c) => (
                <div key={c.id} className="py-3 flex justify-between items-center text-xs">
                  <span className="font-semibold text-zinc-200">{c.name}</span>
                  <span className="font-mono text-zinc-500">{c.hash_id}</span>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-xs text-zinc-500 py-6 text-center">Koi category nahi mili.</p>
              )}
            </div>
          </div>

          {/* Vendors */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Registered Vendors</h3>
                <p className="text-xs text-zinc-400">Equipment providers, electricians, maintenance agencies</p>
              </div>
              <button
                onClick={() => setOpenModal('vendor')}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-lime-400 text-xs font-bold rounded-xl border border-zinc-700"
              >
                + Add Vendor
              </button>
            </div>
            <div className="divide-y divide-zinc-800/60">
              {vendors.map((v) => (
                <div key={v.id} className="py-3 text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">{v.name}</span>
                    <span className="font-mono text-lime-400">{v.phone || 'No phone'}</span>
                  </div>
                  <p className="text-zinc-400 text-[11px]">{v.email || 'No email'} | GST: {v.tax_id_gst || 'N/A'}</p>
                </div>
              ))}
              {vendors.length === 0 && (
                <p className="text-xs text-zinc-500 py-6 text-center">Koi vendor register nahi hai.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── POPUP MODALS ────────────────── */}

      {/* 1. Record Expense Modal */}
      {openModal === 'recordExpense' && (
        <ModalWrapper title="Record New Gym Expense" onClose={() => setOpenModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleActionSubmit('/api/v1/expenses', {
                ...expenseForm,
                amount: parseFloat(expenseForm.amount),
                category_id: expenseForm.category_id ? parseInt(expenseForm.category_id, 10) : null,
                vendor_id: expenseForm.vendor_id ? parseInt(expenseForm.vendor_id, 10) : null,
                branch_id: parseInt(expenseForm.branch_id, 10)
              }, () => setExpenseForm({
                branch_id: getBranchId(),
                category_id: '',
                vendor_id: '',
                amount: '',
                expense_date: new Date().toISOString().split('T')[0],
                payment_method: 'cash',
                description: '',
                receipt_url: '',
                status: 'paid'
              }));
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Expense Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 3500"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Expense Date *</label>
                <input
                  type="date"
                  required
                  value={expenseForm.expense_date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Category</label>
                <select
                  value={expenseForm.category_id}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category_id: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Vendor (Optional)</label>
                <select
                  value={expenseForm.vendor_id}
                  onChange={(e) => setExpenseForm({ ...expenseForm, vendor_id: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Select Vendor</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Payment Method</label>
                <select
                  value={expenseForm.payment_method}
                  onChange={(e) => setExpenseForm({ ...expenseForm, payment_method: e.target.value })}
                  className={inputCls}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{m.replace(/_/g, ' ').toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Receipt Slip URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={expenseForm.receipt_url}
                  onChange={(e) => setExpenseForm({ ...expenseForm, receipt_url: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Description / Notes</label>
              <textarea
                rows="2"
                placeholder="e.g. AC servicing and gas refill in cardio room"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                className={inputCls}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-bold rounded-xl transition disabled:opacity-50 mt-2"
            >
              {submitting ? 'Recording...' : 'Record Expense Voucher'}
            </button>
          </form>
        </ModalWrapper>
      )}

      {/* 2. Create Category Modal */}
      {openModal === 'category' && (
        <ModalWrapper title="Create Expense Category" onClose={() => setOpenModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleActionSubmit('/api/v1/expenses/categories', categoryForm, () => setCategoryForm({ name: '' }));
            }}
            className="space-y-3"
          >
            <div>
              <label className={labelCls}>Category Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Electricity, Gym Maintenance, Staff Refreshment"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ name: e.target.value })}
                className={inputCls}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-bold rounded-xl transition disabled:opacity-50 mt-2"
            >
              {submitting ? 'Saving...' : 'Save Category'}
            </button>
          </form>
        </ModalWrapper>
      )}

      {/* 3. Create Vendor Modal */}
      {openModal === 'vendor' && (
        <ModalWrapper title="Register Vendor / Agency" onClose={() => setOpenModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleActionSubmit('/api/v1/expenses/vendors', vendorForm, () => setVendorForm({ name: '', phone: '', email: '', address: '', tax_id_gst: '' }));
            }}
            className="space-y-3"
          >
            <div>
              <label className={labelCls}>Vendor Agency / Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Acme Fitness Equipment Repair"
                value={vendorForm.name}
                onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Phone</label>
                <input
                  type="text"
                  placeholder="+91..."
                  value={vendorForm.phone}
                  onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>GST Number</label>
                <input
                  type="text"
                  placeholder="GSTIN..."
                  value={vendorForm.tax_id_gst}
                  onChange={(e) => setVendorForm({ ...vendorForm, tax_id_gst: e.target.value.toUpperCase() })}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Address / City</label>
              <input
                type="text"
                placeholder="Office or workshop address"
                value={vendorForm.address}
                onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
                className={inputCls}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-bold rounded-xl transition disabled:opacity-50 mt-2"
            >
              {submitting ? 'Registering...' : 'Save Vendor'}
            </button>
          </form>
        </ModalWrapper>
      )}

      {/* 4. Open Cash Register Modal */}
      {openModal === 'openReg' && (
        <ModalWrapper title="Open Daily Cash Drawer" onClose={() => setOpenModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleActionSubmit('/api/v1/expenses/registers/open', {
                branch_id: getBranchId(),
                register_name: openRegForm.register_name,
                opening_balance: parseFloat(openRegForm.opening_balance || 0)
              }, () => setOpenRegForm({ register_name: 'Main Counter Drawer', opening_balance: '1000' }));
            }}
            className="space-y-3"
          >
            <div>
              <label className={labelCls}>Drawer Name</label>
              <input
                type="text"
                required
                value={openRegForm.register_name}
                onChange={(e) => setOpenRegForm({ ...openRegForm, register_name: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Opening Cash Balance in Drawer (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={openRegForm.opening_balance}
                onChange={(e) => setOpenRegForm({ ...openRegForm, opening_balance: e.target.value })}
                className={inputCls}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-bold rounded-xl transition disabled:opacity-50 mt-2"
            >
              {submitting ? 'Opening...' : 'Start Drawer Session'}
            </button>
          </form>
        </ModalWrapper>
      )}

      {/* 5. Cash In / Cash Out Modal */}
      {openModal === 'cashMove' && activeRegister && (
        <ModalWrapper title="Log Counter Petty Cash Movement" onClose={() => setOpenModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleActionSubmit('/api/v1/expenses/registers/transaction', {
                register_id: activeRegister.id,
                transaction_type: cashMoveForm.transaction_type,
                amount: parseFloat(cashMoveForm.amount),
                notes: cashMoveForm.notes
              }, () => setCashMoveForm({ transaction_type: 'cash_out', amount: '', notes: '' }));
            }}
            className="space-y-3"
          >
            <div>
              <label className={labelCls}>Movement Type *</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCashMoveForm({ ...cashMoveForm, transaction_type: 'cash_in' })}
                  className={`py-2 text-xs font-bold rounded-xl transition ${
                    cashMoveForm.transaction_type === 'cash_in'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  ↓ Cash In (Deposit)
                </button>
                <button
                  type="button"
                  onClick={() => setCashMoveForm({ ...cashMoveForm, transaction_type: 'cash_out' })}
                  className={`py-2 text-xs font-bold rounded-xl transition ${
                    cashMoveForm.transaction_type === 'cash_out'
                      ? 'bg-red-500 text-white'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  ↑ Cash Out (Withdraw)
                </button>
              </div>
            </div>

            <div>
              <label className={labelCls}>Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 200"
                value={cashMoveForm.amount}
                onChange={(e) => setCashMoveForm({ ...cashMoveForm, amount: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Reason / Details *</label>
              <input
                type="text"
                required
                placeholder="e.g. Purchased cleaning items / Tea for clients"
                value={cashMoveForm.notes}
                onChange={(e) => setCashMoveForm({ ...cashMoveForm, notes: e.target.value })}
                className={inputCls}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-bold rounded-xl transition disabled:opacity-50 mt-2"
            >
              {submitting ? 'Logging...' : 'Confirm Cash Movement'}
            </button>
          </form>
        </ModalWrapper>
      )}

      {/* 6. Close Cash Register Modal */}
      {openModal === 'closeReg' && activeRegister && (
        <ModalWrapper title="Close Daily Cash Drawer (EOD)" onClose={() => setOpenModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleActionSubmit('/api/v1/expenses/registers/close', {
                register_id: activeRegister.id,
                closing_balance: parseFloat(closeRegForm.closing_balance)
              }, () => setCloseRegForm({ closing_balance: '' }));
            }}
            className="space-y-3"
          >
            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-xs space-y-1">
              <p className="text-zinc-400">System Calculated Balance: <span className="text-lime-400 font-bold">₹{stats.drawerCashBalance.toFixed(2)}</span></p>
              <p className="text-[11px] text-zinc-500">Physical drawer me cash gin kar actual amount enter karein.</p>
            </div>

            <div>
              <label className={labelCls}>Actual Physical Cash Count (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={closeRegForm.closing_balance}
                onChange={(e) => setCloseRegForm({ closing_balance: e.target.value })}
                className={inputCls}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-red-500 hover:bg-red-400 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 mt-2"
            >
              {submitting ? 'Closing Drawer...' : 'Lock & Close Register'}
            </button>
          </form>
        </ModalWrapper>
      )}
    </div>
  );
}

function ModalWrapper({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in fade-in">
        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-base">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}