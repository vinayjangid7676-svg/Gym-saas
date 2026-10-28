import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { InvNav, useInventoryData } from './InventoryShared';

export default function StockPage() {
  const navigate = useNavigate();
  const { products, loading, refresh } = useInventoryData();

  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'low' | 'out' | 'available'
  const [selectedTaxSlab, setSelectedTaxSlab] = useState('all'); // 'all' | '0' | '5' | '12' | '18' | '28'

  // ─── Financial & Statutory Stock Audit Metrics ───
  const stats = useMemo(() => {
    let units = 0;
    let baseValuation = 0;
    let taxValuation = 0;
    let retailPotential = 0;
    let low = 0;
    let out = 0;

    products.forEach((p) => {
      const stock = parseFloat(p.current_stock || 0);
      const buyPrice = parseFloat(p.purchase_price || 0);
      const mrp = parseFloat(p.selling_price || 0);
      const taxRate = parseFloat(p.tax_rate !== undefined && p.tax_rate !== null ? p.tax_rate : 18);
      const reorder = parseFloat(p.reorder_level || 5);

      if (stock > 0) {
        const lineBase = stock * buyPrice;
        const lineTax = lineBase * (taxRate / 100);

        units += stock;
        baseValuation += lineBase;
        taxValuation += lineTax;
        retailPotential += stock * mrp;
      }

      if (stock <= 0) {
        out += 1;
      } else if (stock <= reorder) {
        low += 1;
      }
    });

    const totalCostValuation = baseValuation + taxValuation;
    const projectedMargin = retailPotential > totalCostValuation ? retailPotential - totalCostValuation : 0;
    const marginPercent = retailPotential > 0 ? (projectedMargin / retailPotential) * 100 : 0;

    return {
      skus: products.length,
      units,
      baseValuation,
      taxValuation,
      totalCostValuation,
      retailPotential,
      projectedMargin,
      marginPercent,
      low,
      out,
    };
  }, [products]);

  // ─── Search, Tax Slab & Stock Health Filtering ───
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const stock = parseFloat(p.current_stock || 0);
      const reorder = parseFloat(p.reorder_level || 5);
      const taxRate = String(p.tax_rate !== undefined && p.tax_rate !== null ? p.tax_rate : 18);

      // Search match (Name, SKU, Barcode, HSN)
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.hsn_code?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // GST Slab filter
      if (selectedTaxSlab !== 'all' && taxRate !== selectedTaxSlab) {
        return false;
      }

      // Stock status filter
      if (filterMode === 'low') return stock > 0 && stock <= reorder;
      if (filterMode === 'out') return stock <= 0;
      if (filterMode === 'available') return stock > reorder;

      return true;
    });
  }, [products, search, filterMode, selectedTaxSlab]);

  // ─── Export Stock Audit CSV for CA / Tax Auditing ───
  const exportStockAuditCSV = () => {
    if (!filteredProducts.length) return;

    const headers = [
      'SKU',
      'Product Name',
      'HSN Code',
      'GST Rate (%)',
      'Stock In-Hand',
      'Unit',
      'Base Buy Cost (INR)',
      'Sell MRP (INR)',
      'Total Base Valuation (INR)',
      'Embedded GST Value (INR)',
      'Total Landed Valuation (INR)',
      'Stock Status',
    ];

    const rows = filteredProducts.map((p) => {
      const stock = parseFloat(p.current_stock || 0);
      const buyPrice = parseFloat(p.purchase_price || 0);
      const mrp = parseFloat(p.selling_price || 0);
      const taxRate = parseFloat(p.tax_rate || 0);
      const lineBase = stock * buyPrice;
      const lineTax = lineBase * (taxRate / 100);
      const lineTotal = lineBase + lineTax;
      const reorder = parseFloat(p.reorder_level || 5);

      const status = stock <= 0 ? 'Out of Stock' : stock <= reorder ? 'Low Stock' : 'Healthy';

      return [
        `"${p.sku}"`,
        `"${p.name?.replace(/"/g, '""') || ''}"`,
        `"${p.hsn_code || 'N/A'}"`,
        taxRate,
        stock,
        p.unit || 'piece',
        buyPrice.toFixed(2),
        mrp.toFixed(2),
        lineBase.toFixed(2),
        lineTax.toFixed(2),
        lineTotal.toFixed(2),
        status,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Stock_Audit_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* ─── Header & Top Actions ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Stock Audit & Warehouse Monitor</h1>
          <p className="text-sm text-zinc-400">
            Real-time physical stock counts, statutory tax valuations, HSN audits aur automated reorder thresholds
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={exportStockAuditCSV}
            disabled={filteredProducts.length === 0}
            className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shadow-sm disabled:opacity-40"
          >
            📊 Export Audit CSV
          </button>
          <button
            onClick={() => refresh()}
            className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-lime-400 border border-lime-500/20 text-xs font-semibold rounded-xl transition shadow-sm flex items-center gap-1.5"
          >
            🔄 Sync Quantities
          </button>
          <button
            onClick={() => navigate('/inventory/purchases')}
            className="px-4 py-2 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-[0_0_15px_rgba(163,230,53,0.2)] flex items-center gap-1.5"
          >
            📥 Restock (GRN)
          </button>
        </div>
      </div>

      <InvNav />

      {/* ─── Metric KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Catalog SKUs"
          value={stats.skus}
          sub={`${stats.units} physical units in warehouse`}
          color="text-white"
        />
        <StatCard
          label="Holding Cost Valuation"
          value={`₹${Math.round(stats.totalCostValuation).toLocaleString('en-IN')}`}
          sub={`Base: ₹${Math.round(stats.baseValuation).toLocaleString('en-IN')} + GST: ₹${Math.round(stats.taxValuation).toLocaleString('en-IN')}`}
          color="text-lime-400"
        />
        <StatCard
          label="Retail Realization (MRP)"
          value={`₹${Math.round(stats.retailPotential).toLocaleString('en-IN')}`}
          sub={`Projected Margin: ₹${Math.round(stats.projectedMargin).toLocaleString('en-IN')} (${stats.marginPercent.toFixed(1)}%)`}
          color="text-emerald-400"
        />
        <StatCard
          label="Critical / Restock Alerts"
          value={`${stats.low + stats.out} SKUs`}
          sub={`${stats.out} out of stock, ${stats.low} approaching threshold`}
          color={stats.low + stats.out > 0 ? 'text-red-400' : 'text-zinc-200'}
          alert={stats.low + stats.out > 0}
        />
      </div>

      {/* ─── Search Bar & Multi-Dimensional Filter Controls ─── */}
      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:w-96">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500 text-xs">🔍</span>
            <input
              type="text"
              placeholder="Search by SKU, Product Name, HSN, Barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:border-lime-400 focus:outline-none transition"
            />
          </div>

          {/* Stock Health Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: `All Items (${products.length})` },
              { id: 'available', label: 'Healthy Stock' },
              { id: 'low', label: `Low Stock (${stats.low})` },
              { id: 'out', label: `Out of Stock (${stats.out})` },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterMode(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  filterMode === f.id
                    ? 'bg-lime-400 text-zinc-950 font-bold shadow-sm'
                    : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* GST Slab Selector Bar */}
        <div className="pt-2 border-t border-zinc-800/80 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">
            Tax Slab Filter:
          </span>
          {['all', '0', '5', '12', '18', '28'].map((slab) => (
            <button
              key={slab}
              onClick={() => setSelectedTaxSlab(slab)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition whitespace-nowrap ${
                selectedTaxSlab === slab
                  ? 'bg-zinc-800 text-lime-400 border border-zinc-700 font-bold'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {slab === 'all' ? 'All Slabs' : `${slab}% GST`}
            </button>
          ))}
          {selectedTaxSlab !== 'all' && (
            <button
              onClick={() => setSelectedTaxSlab('all')}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 underline ml-2"
            >
              Reset Slab
            </button>
          )}
        </div>
      </div>

      {/* ─── Main Stock Audit Table ─── */}
      {loading ? (
        <div className="p-16 text-center text-zinc-500 bg-zinc-900 rounded-2xl border border-zinc-800 text-xs">
          Loading live product stock and inventory ledger...
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto shadow-xl">
          <table className="w-full text-left text-xs text-zinc-300 min-w-[1100px]">
            <thead className="bg-zinc-950 text-zinc-500 uppercase border-b border-zinc-800 tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-semibold">SKU & HSN Code</th>
                <th className="py-3.5 px-4 font-semibold min-w-[220px]">Product Master</th>
                <th className="py-3.5 px-4 font-semibold text-right">Base Buy Cost</th>
                <th className="py-3.5 px-4 font-semibold text-center">GST Slab</th>
                <th className="py-3.5 px-4 font-semibold text-right">Selling MRP</th>
                <th className="py-3.5 px-4 font-semibold text-right">Landed Valuation</th>
                <th className="py-3.5 px-4 font-semibold">Stock In-Hand</th>
                <th className="py-3.5 px-4 font-semibold">Audit Status</th>
                <th className="py-3.5 px-4 text-center font-semibold">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredProducts.map((p) => {
                const stock = parseFloat(p.current_stock || 0);
                const reorder = parseFloat(p.reorder_level || 5);
                const cost = parseFloat(p.purchase_price || 0);
                const mrp = parseFloat(p.selling_price || 0);
                const taxRate = parseFloat(p.tax_rate !== undefined && p.tax_rate !== null ? p.tax_rate : 18);

                const lineBaseValuation = stock * cost;
                const lineLandedValuation = lineBaseValuation + (lineBaseValuation * (taxRate / 100));

                return (
                  <tr key={p.product_id} className="hover:bg-zinc-800/30 transition duration-150">
                    {/* SKU & HSN */}
                    <td className="py-3 px-4 font-mono">
                      <span className="font-bold text-lime-400 block">{p.sku}</span>
                      <span className="text-[10.5px] text-zinc-500">
                        {p.hsn_code ? `HSN: ${p.hsn_code}` : 'No HSN'}
                      </span>
                    </td>

                    {/* Product Details */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white leading-snug">{p.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-zinc-500 uppercase font-mono">{p.unit || 'piece'}</span>
                        {p.barcode && (
                          <span className="text-[10px] text-zinc-500 font-mono">🏷️ {p.barcode}</span>
                        )}
                      </div>
                    </td>

                    {/* Base Cost */}
                    <td className="py-3 px-4 font-mono text-right">
                      {cost > 0 ? (
                        <span className="text-zinc-200">₹{cost.toFixed(2)}</span>
                      ) : (
                        <span className="text-zinc-500 italic text-[11px]">Unpurchased</span>
                      )}
                    </td>

                    {/* Tax Slab */}
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded font-mono text-[10.5px] font-bold bg-zinc-800 text-lime-400 border border-zinc-700/60">
                        {taxRate}%
                      </span>
                    </td>

                    {/* Selling MRP */}
                    <td className="py-3 px-4 font-mono font-bold text-right">
                      {mrp > 0 ? (
                        <span className="text-white">₹{mrp.toFixed(2)}</span>
                      ) : (
                        <span className="text-amber-500/80 text-[11px] font-normal italic">Unpriced</span>
                      )}
                    </td>

                    {/* Landed Stock Valuation */}
                    <td className="py-3 px-4 font-mono text-right">
                      <div className="font-bold text-zinc-200">
                        ₹{lineLandedValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <span className="text-[9.5px] text-zinc-500 block">
                        Base: ₹{lineBaseValuation.toFixed(2)}
                      </span>
                    </td>

                    {/* Stock Counts */}
                    <td className="py-3 px-4">
                      <div className="flex items-baseline gap-1 font-mono">
                        <span
                          className={`text-sm font-bold ${
                            stock <= 0 ? 'text-red-400' : stock <= reorder ? 'text-amber-400' : 'text-lime-400'
                          }`}
                        >
                          {stock}
                        </span>
                        <span className="text-zinc-500 text-[10.5px]">/ min {reorder}</span>
                      </div>
                    </td>

                    {/* Audit Badge */}
                    <td className="py-3 px-4">
                      <StockBadge stock={stock} reorder={reorder} />
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3 px-4 text-center space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => navigate('/inventory/purchases')}
                        className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-lime-400 border border-zinc-700 text-[11px] font-bold rounded-lg transition"
                        title="Restock via Purchase Order"
                      >
                        📥 Restock
                      </button>
                      
                    </td>
                  </tr>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan="9" className="py-16 text-center text-zinc-500 text-xs">
                    <span className="text-2xl block mb-2">🔍</span>
                    Diye gaye filters ya search criteria se koi product stock match nahi hua.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Reusable Metric Card ───
function StatCard({ label, value, sub, color, alert }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
      <div>
        <p className="text-xs text-zinc-400 mb-1 flex items-center justify-between">
          <span>{label}</span>
          {alert && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-wider">
              Action Req.
            </span>
          )}
        </p>
        <h3 className={`text-2xl font-bold mt-1 font-mono ${color}`}>{value}</h3>
      </div>
      {sub && <p className="text-[11px] text-zinc-500 mt-2 font-medium leading-relaxed">{sub}</p>}
    </div>
  );
}

// ─── Reusable Stock Status Badge ───
export function StockBadge({ stock, reorder }) {
  if (stock <= 0) {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-wider whitespace-nowrap">
        Out of Stock
      </span>
    );
  }
  if (stock <= reorder) {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider whitespace-nowrap">
        Low Stock Alert
      </span>
    );
  }
  return (
    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider whitespace-nowrap">
      Healthy Stock
    </span>
  );
}