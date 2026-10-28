import React from 'react';

export default function UpgradeModal({ isOpen, onClose, requiredFeature, targetPlan = 'Pro Fitness' }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative text-center">
        <div className="w-14 h-14 bg-lime-400/10 text-lime-400 border border-lime-400/20 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">
          ⚡
        </div>

        <h3 className="text-xl font-bold text-white tracking-tight">Unlock {requiredFeature || 'Feature'}</h3>
        <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
          Ye module aapke current plan me shamil nahi hai. Apne gym ko scale karne ke liye aur advanced automation tools pane ke liye <strong>{targetPlan}</strong> me upgrade karein.
        </p>

        <div className="my-6 p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-left space-y-2 text-xs text-zinc-300">
          <p className="flex items-center gap-2">✓ Multi-Branch sync & terminal POS</p>
          <p className="flex items-center gap-2">✓ Biometric & Dynamic QR Access integration</p>
          <p className="flex items-center gap-2">✓ Automated WhatsApp reminders & Payroll</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-xs font-semibold hover:bg-zinc-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onClose();
              window.location.href = '/subscription';
            }}
            className="flex-1 py-2.5 rounded-xl bg-lime-400 text-zinc-950 text-xs font-bold hover:bg-lime-300 transition shadow-lg shadow-lime-400/10"
          >
            Upgrade Now →
          </button>
        </div>
      </div>
    </div>
  );
}