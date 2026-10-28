import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiGet, apiPost } from '../api';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function PayrollPage() {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [payrollItems, setPayrollItems] = useState([]);
  const [savedRun, setSavedRun] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Disbursement Modal State
  const [disburseModal, setDisburseModal] = useState({
    open: false,
    item: null,
    paymentMethod: 'upi_qr',
    reference: '',
    submitting: false
  });

  const activeBranchId = localStorage.getItem('gym_active_branch_id') || 1;

  // 1. Calculate / Load Payroll Run
  const handleCalculatePayroll = useCallback(async (autoCommit = false) => {
    setCalculating(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await apiPost('/api/v1/payroll/generate', {
        branch_id: parseInt(activeBranchId, 10),
        month: parseInt(selectedMonth, 10),
        year: parseInt(selectedYear, 10),
        auto_commit: autoCommit
      });

      if (res?.success) {
        setPayrollItems(res.data || []);
        if (res.summary?.salary_run) {
          setSavedRun(res.summary.salary_run);
        }
        setMessage({
          type: 'success',
          text: autoCommit 
            ? 'Payroll calculate hokar draft finalize ho gaya!' 
            : 'Month-end salary & commission calculation ready hai.'
        });
      } else {
        setMessage({ type: 'error', text: res?.message || 'Payroll calculate nahi ho paya.' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Server se payroll calculate karne me issue aaya.' });
    } finally {
      setCalculating(false);
    }
  }, [activeBranchId, selectedMonth, selectedYear]);

  useEffect(() => {
    handleCalculatePayroll(false);
  }, [handleCalculatePayroll]);

  // Aggregate Metrics
  const aggregates = useMemo(() => {
    return payrollItems.reduce(
      (acc, cur) => {
        acc.totalBase += Number(cur.basic_amount || 0);
        acc.totalCommission += Number(cur.commission_amount || 0);
        acc.totalOvertime += Number(cur.overtime_amount || 0);
        acc.totalDeductions += Number(cur.deduction_amount || 0);
        acc.grandTotal += Number(cur.net_amount || 0);
        acc.ptSessionsCount += Number(cur.completed_pt_sessions || 0);
        return acc;
      },
      { totalBase: 0, totalCommission: 0, totalOvertime: 0, totalDeductions: 0, grandTotal: 0, ptSessionsCount: 0 }
    );
  }, [payrollItems]);

  // 2. Disburse Single Staff Salary
  const handleConfirmDisbursement = async (e) => {
    e.preventDefault();
    if (!disburseModal.item) return;

    setDisburseModal(prev => ({ ...prev, submitting: true }));
    try {
      const res = await apiPost('/api/v1/payroll/disburse', {
        salary_item_id: disburseModal.item.id || disburseModal.item.salary_item_id,
        payment_method: disburseModal.paymentMethod,
        transaction_reference: disburseModal.reference
      });

      if (res?.success) {
        setMessage({ type: 'success', text: res.message || 'Salary successfully transfer ho gayi.' });
        setDisburseModal({ open: false, item: null, paymentMethod: 'upi_qr', reference: '', submitting: false });
        handleCalculatePayroll(false); // Refresh state
      } else {
        setMessage({ type: 'error', text: res?.message || 'Disbursement fail ho gaya.' });
        setDisburseModal(prev => ({ ...prev, submitting: false }));
      }
    } catch {
      setMessage({ type: 'error', text: 'Disbursement network error.' });
      setDisburseModal(prev => ({ ...prev, submitting: false }));
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 px-4 sm:px-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-wide">Staff Payroll & Commissions Desk</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-lime-400/10 text-lime-400 border border-lime-400/20">
              Automated Engine
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Biometric attendance audit, PT session completion bonuses, shift overtime and net bank transfers.
          </p>
        </div>

        {/* Month Selector & Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-400"
          >
            {MONTH_NAMES.map((m, idx) => (
              <option key={idx} value={idx + 1}>{m}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-400"
          >
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>

          <button
            onClick={() => handleCalculatePayroll(false)}
            disabled={calculating}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl border border-zinc-700 transition"
          >
            {calculating ? 'Syncing...' : '↻ Recalculate'}
          </button>

          <button
            onClick={() => handleCalculatePayroll(true)}
            disabled={calculating || payrollItems.length === 0}
            className="px-5 py-2 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-[0_0_15px_rgba(163,230,53,0.3)] disabled:opacity-50"
          >
            Lock & Finalize Run
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <span className="text-[11px] font-semibold uppercase text-zinc-400 block tracking-wider">Total Fixed Base</span>
          <span className="text-xl font-bold font-mono text-white mt-1 block">
            ₹{aggregates.totalBase.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <span className="text-[11px] font-semibold uppercase text-zinc-400 block tracking-wider">PT Commissions ({aggregates.ptSessionsCount} Sessions)</span>
          <span className="text-xl font-bold font-mono text-lime-400 mt-1 block">
            ₹{aggregates.totalCommission.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <span className="text-[11px] font-semibold uppercase text-zinc-400 block tracking-wider">Overtime & Late Adjustments</span>
          <span className="text-xl font-bold font-mono text-amber-400 mt-1 block">
            +₹{aggregates.totalOvertime.toLocaleString('en-IN')} / -₹{aggregates.totalDeductions.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <span className="text-[11px] font-semibold uppercase text-zinc-400 block tracking-wider">Net Monthly Payout</span>
          <span className="text-xl font-bold font-mono text-white mt-1 block">
            ₹{aggregates.grandTotal.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Alert Banner */}
      {message.text && (
        <div className={`p-4 rounded-xl text-xs font-bold border flex justify-between items-center ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
            : 'bg-red-500/10 text-red-400 border-red-500/30'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })}>✕</button>
        </div>
      )}

      {/* Salary Breakdown Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Workforce Payroll Breakdown for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </h2>
          <span className="text-[11px] text-zinc-500">
            {payrollItems.length} Staff Members evaluated
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-950/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-3">Payout Model</th>
                <th className="py-3 px-3 text-center">Att. / Days</th>
                <th className="py-3 px-3">Base Salary</th>
                <th className="py-3 px-3">PT Sessions Revenue</th>
                <th className="py-3 px-3">Commission</th>
                <th className="py-3 px-3">Deductions</th>
                <th className="py-3 px-4 text-right">Net Payable</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {payrollItems.map((item, idx) => {
                const isPaid = item.payment_status === 'paid';
                return (
                  <tr key={idx} className="hover:bg-zinc-850/40 transition">
                    <td className="py-3 px-4 font-sans">
                      <div className="font-bold text-white text-xs">{item.name}</div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        {item.employee_code} • {item.designation}
                      </div>
                    </td>

                    <td className="py-3 px-3 uppercase text-[10px] text-zinc-300 font-sans">
                      <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800">
                        {item.payout_type}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className="text-emerald-400 font-bold">{item.present_days}</span>
                      <span className="text-zinc-600"> / {item.total_days_in_month}d</span>
                      {item.late_days > 0 && (
                        <span className="block text-[10px] text-red-400 font-sans">
                          {item.late_days} Late
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-zinc-200">
                      ₹{Number(item.basic_amount || 0).toLocaleString('en-IN')}
                    </td>

                    <td className="py-3 px-3">
                      <div className="text-zinc-200">
                        ₹{Number(item.pt_session_revenue || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-sans">
                        {item.completed_pt_sessions} sessions
                      </div>
                    </td>

                    <td className="py-3 px-3 text-lime-400 font-bold">
                      ₹{Number(item.commission_amount || 0).toLocaleString('en-IN')}
                      <span className="text-[10px] text-zinc-500 block font-normal">
                        ({item.commission_percentage}%)
                      </span>
                    </td>

                    <td className="py-3 px-3 text-red-400">
                      -₹{Number(item.deduction_amount || 0).toLocaleString('en-IN')}
                    </td>

                    <td className="py-3 px-4 text-right font-bold text-white text-sm">
                      ₹{Number(item.net_amount || 0).toLocaleString('en-IN')}
                    </td>

                    <td className="py-3 px-4 text-center font-sans">
                      {isPaid ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Paid ✓
                        </span>
                      ) : (
                        <button
                          onClick={() => setDisburseModal({
                            open: true,
                            item,
                            paymentMethod: 'upi_qr',
                            reference: `SAL-${selectedMonth}-${selectedYear}-${item.employee_code}`,
                            submitting: false
                          })}
                          className="px-3 py-1 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-[10px] font-bold uppercase tracking-wider rounded-lg transition"
                        >
                          Disburse
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {payrollItems.length === 0 && !calculating && (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-zinc-500 text-xs font-sans">
                    Is branch aur month ke liye koi staff record calculate nahi hua.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disbursement Modal */}
      {disburseModal.open && disburseModal.item && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Confirm Salary Disbursement</h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Transfer ₹{Number(disburseModal.item.net_amount).toLocaleString('en-IN')} to {disburseModal.item.name}
                </p>
              </div>
              <button 
                onClick={() => setDisburseModal(prev => ({ ...prev, open: false }))} 
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmDisbursement} className="space-y-4">
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between text-zinc-400">
                  <span>Base Pay:</span>
                  <span className="text-white">₹{disburseModal.item.basic_amount}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>PT Commission:</span>
                  <span className="text-lime-400 font-bold">+₹{disburseModal.item.commission_amount}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Late Deductions:</span>
                  <span className="text-red-400">-₹{disburseModal.item.deduction_amount}</span>
                </div>
                <div className="flex justify-between text-zinc-300 pt-1.5 border-t border-zinc-800 font-bold">
                  <span>Net Disbursed:</span>
                  <span className="text-white text-sm">₹{disburseModal.item.net_amount}</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1 uppercase font-semibold">Payment Method</label>
                <select
                  value={disburseModal.paymentMethod}
                  onChange={(e) => setDisburseModal(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-400"
                >
                  <option value="upi_qr">UPI / QR Code</option>
                  <option value="bank_transfer">Bank Transfer (NEFT/IMPS)</option>
                  <option value="cash">Cash in Hand</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1 uppercase font-semibold">Transaction / UTR Reference</label>
                <input
                  type="text"
                  required
                  value={disburseModal.reference}
                  onChange={(e) => setDisburseModal(prev => ({ ...prev, reference: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-400"
                />
              </div>

              <button
                type="submit"
                disabled={disburseModal.submitting}
                className="w-full py-2.5 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-xs uppercase tracking-wider rounded-xl transition disabled:opacity-50 mt-2"
              >
                {disburseModal.submitting ? 'Recording Payout...' : 'Mark as Paid & Record Expense'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}