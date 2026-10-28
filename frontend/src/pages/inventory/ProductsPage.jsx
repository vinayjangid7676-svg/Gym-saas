import React, { useState, useMemo } from 'react';
import { apiPost } from '../../api';
import { InvNav, ModalWrapper, Feedback, useInventoryData, inputCls, labelCls } from './InventoryShared';

const GST_RATES = [0, 5, 12, 18, 28];

const emptyProduct = {
  name: '',
  sku: '',
  barcode: '',
  hsn_code: '',
  tax_rate: '18',
  unit: 'piece',
  reorder_level: '5',
};

function StockBadge({ stock, reorder }) {
  const isLow = stock <= reorder;
  if (stock <= 0) {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-wider">
        Out of Stock (0)
      </span>
    );
  }
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
        isLow
          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          : 'bg-lime-400/10 text-lime-400 border border-lime-400/20'
      }`}
    >
      {isLow ? `Low Stock (${stock})` : `In Stock (${stock})`}
    </span>
  );
}

export default function ProductsPage() {
  const { products, loading, refresh } = useInventoryData();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyProduct);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTax, setFilterTax] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // ─── Live Search & Filter Logic ───
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm.trim() ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.hsn_code && p.hsn_code.toLowerCase().includes(q));

      const matchesTax = filterTax === 'all' || String(p.tax_rate) === String(filterTax);

      return matchesSearch && matchesTax;
    });
  }, [products, searchTerm, filterTax]);

  // ─── Submit Form to Controller ───
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim() || !form.sku.trim()) {
      setError('Product Name aur SKU code daalna zaroori hai.');
      return;
    }

    setSubmitting(true);
    setSuccess('');
    setError('');

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim().toUpperCase(),
      barcode: form.barcode.trim() || null,
      hsn_code: form.hsn_code.trim() || null,
      tax_rate: parseFloat(form.tax_rate || 0),
      unit: form.unit,
      reorder_level: parseInt(form.reorder_level || '5', 10),
    };

    const res = await apiPost('/api/v1/inventory/products', payload);

    if (res?.success) {
      setSuccess(`"${res.product?.name || form.name}" master catalog me GST (${form.tax_rate}%) ke sath register ho gaya!`);
      setForm(emptyProduct);
      setShowModal(false);
      refresh();
    } else {
      setError(res?.message || 'Product catalog me add nahi ho paya.');
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Product Catalog Master</h1>
          <p className="text-sm text-zinc-400">Gym supplements, merchandise identity, HSN & GST rates config (Statutory Compliant)</p>
        </div>
        <button
          onClick={() => {
            setForm(emptyProduct);
            setShowModal(true);
          }}
          className="px-5 py-2.5 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-sm font-bold rounded-xl transition shadow-[0_0_15px_rgba(163,230,53,0.25)] flex items-center gap-2 self-start sm:self-auto"
        >
          <span>+</span> Register New Product
        </button>
      </div>

      <InvNav />
      <Feedback success={success} error={error} onDismiss={() => { setSuccess(''); setError(''); }} />

      {/* ─── Search & Slabs Filter Bar ─── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl shadow-sm">
        <div className="relative w-full sm:w-96">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Search by Name, SKU, HSN, or Barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-400 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">GST Slab:</span>
          {['all', '0', '5', '12', '18', '28'].map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => setFilterTax(rate)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                filterTax === rate
                  ? 'bg-lime-400 text-zinc-950 shadow-sm'
                  : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              {rate === 'all' ? 'All Rates' : `${rate}%`}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Products Display Grid ─── */}
      {loading ? (
        <div className="p-16 text-center text-zinc-500 bg-zinc-900 rounded-2xl border border-zinc-800 text-sm">
          Loading catalog master records...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => {
            const cost = parseFloat(p.purchase_price || 0);
            const mrp = parseFloat(p.selling_price || 0);
            const stock = parseFloat(p.current_stock || 0);
            const reorder = parseFloat(p.reorder_level || 5);
            const gstRate = p.tax_rate !== undefined && p.tax_rate !== null ? p.tax_rate : 18;

            return (
              <div
                key={p.product_id}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition rounded-2xl p-5 space-y-3.5 flex flex-col justify-between shadow-lg relative overflow-hidden group"
              >
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-lime-400 font-bold uppercase tracking-wider">{p.sku}</span>
                        {p.hsn_code && (
                          <span className="text-[9.5px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700/50">
                            HSN: {p.hsn_code}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-white text-sm mt-1 leading-snug line-clamp-2" title={p.name}>
                        {p.name}
                      </h3>
                    </div>
                    <StockBadge stock={stock} reorder={reorder} />
                  </div>

                  <div className="flex items-center gap-3 mt-3 text-[11px] text-zinc-400">
                    <span className="bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 font-medium">
                      Unit: <strong className="text-zinc-200 capitalize">{p.unit || 'piece'}</strong>
                    </span>
                    <span className="bg-lime-400/10 text-lime-400 border border-lime-400/20 px-2 py-0.5 rounded font-mono font-bold">
                      GST: {gstRate}%
                    </span>
                    {p.barcode && (
                      <span className="font-mono text-zinc-500 text-[10px] truncate max-w-[100px]" title={p.barcode}>
                        🏷️ {p.barcode}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-800/80 flex justify-between items-center text-xs">
                  <div>
                    <span className="block text-[9.5px] text-zinc-500 uppercase tracking-wide">Last Purchase Rate</span>
                    <span className="font-mono">
                      {cost > 0 ? (
                        <strong className="text-zinc-200">₹{cost.toFixed(2)}</strong>
                      ) : (
                        <span className="text-zinc-500 italic text-[11px]">No Inward</span>
                      )}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="block text-[9.5px] text-lime-500/80 uppercase tracking-wide">Selling MRP (POS)</span>
                    <span className="font-mono">
                      {mrp > 0 ? (
                        <strong className="text-lime-400 font-bold text-sm">₹{mrp.toFixed(2)}</strong>
                      ) : (
                        <span className="text-amber-500 italic text-[11px]">Unpriced</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="col-span-full py-16 text-center text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30 space-y-2">
              <span className="text-3xl block">📦</span>
              <p className="font-semibold text-zinc-400">Koi matching product nahi mila</p>
              <p className="text-xs text-zinc-600">Search keywords badal kar dekhein ya naya product register karein.</p>
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL: Register New Product Identity ─── */}
      {showModal && (
        <ModalWrapper title="Register New Catalog Identity (GST Enabled)" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>Product Name *</label>
              <input
                type="text"
                name="name"
                required
                placeholder="e.g. Optimum Nutrition (ON) Gold Standard 100% Whey 2kg"
                value={form.name}
                onChange={handleChange}
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>SKU Code *</label>
                <input
                  type="text"
                  name="sku"
                  required
                  placeholder="e.g. ON-WHEY-2KG"
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>Barcode / EAN (Optional)</label>
                <input
                  type="text"
                  name="barcode"
                  placeholder="Scan or Enter barcode"
                  value={form.barcode}
                  onChange={handleChange}
                  className={`${inputCls} font-mono`}
                />
              </div>
            </div>

            {/* GST & Statutory Compliance Row */}
            <div className="grid grid-cols-2 gap-3 bg-zinc-950/80 p-3 rounded-xl border border-zinc-800">
              <div>
                <label className={labelCls}>HSN / SAC Code</label>
                <input
                  type="text"
                  name="hsn_code"
                  placeholder="e.g. 21069099"
                  value={form.hsn_code}
                  onChange={(e) => setForm({ ...form, hsn_code: e.target.value.toUpperCase() })}
                  className={`${inputCls} font-mono`}
                />
                <p className="text-[9px] text-zinc-500 mt-1">Supplements standard: 2106</p>
              </div>
              <div>
                <label className={labelCls}>Statutory GST Rate (%) *</label>
                <select
                  name="tax_rate"
                  value={form.tax_rate}
                  onChange={handleChange}
                  className={`${inputCls} font-bold text-lime-400`}
                >
                  {GST_RATES.map((rate) => (
                    <option key={rate} value={rate}>
                      {rate}% GST Slab
                    </option>
                  ))}
                </select>
                <p className="text-[9px] text-zinc-500 mt-1">Default supplement rate: 18%</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Unit of Measurement</label>
                <select name="unit" value={form.unit} onChange={handleChange} className={inputCls}>
                  <option value="piece">Piece / Container</option>
                  <option value="kg">Kilogram (kg)</option>
                  <option value="pack">Packet / Box</option>
                  <option value="scoop">Single Scoop</option>
                  <option value="bottle">Bottle / Shaker</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Low Stock Alert Threshold</label>
                <input
                  type="number"
                  name="reorder_level"
                  min="1"
                  required
                  placeholder="5"
                  value={form.reorder_level}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl text-[11px] text-zinc-400 space-y-1">
              <p className="text-amber-400 font-semibold mb-0.5">💡 ERP Best Practice Note:</p>
              <p>
                Khareed cost aur Retail selling MRP yahan set nahi hoti. Jab aap <strong>Purchases (GRN)</strong> tab se supplier ka stock receive karenge, tab lot/batch ke according Cost Price aur MRP auto-lock aur update ho jayegi.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-sm uppercase tracking-wider rounded-xl transition disabled:opacity-50 shadow-[0_0_15px_rgba(163,230,53,0.3)]"
            >
              {submitting ? 'Registering...' : '✅ Save Product to Catalog'}
            </button>
          </form>
        </ModalWrapper>
      )}
    </div>
  );
}