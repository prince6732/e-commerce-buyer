"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FileSpreadsheet, Download, ChevronDown, RotateCcw,
  TrendingUp, Receipt, FileText, X, Info, Loader2, Check, Search
} from "lucide-react";
import {
  INDIAN_STATES, GSTReportFilters,
} from "../../../../../utils/gstReportUtils";
import axios from "../../../../../utils/axios";

const PAGE_SIZE = 10;
const ORDER_STATUSES = ["All", "Processing", "Shipped", "Delivered", "Cancelled", "Returned"];
const DOCUMENT_TYPES = ["All", "Invoices Only (Sales)", "Credit Notes Only (Returns)"];
const PAYMENT_TYPES = ["All", "Prepaid", "COD"];
const PAYMENT_METHODS = ["All", "UPI", "Credit Card", "Debit Card", "Net Banking", "Cash"];

const todayStr = () => new Date().toISOString().split("T")[0];
const monthStartStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};
const fmtRs = (n: number) => `₹${Math.abs(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
const fmtSign = (n: number) => {
  if (!n || n === 0) return "₹0.00";
  return `${n > 0 ? "+" : "-"}₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
};
const fmtCell = (n: number) => {
  if (!n || n === 0) return { text: "₹0.00", cls: "" };
  if (n < 0) return { text: `-₹${Math.abs(n).toFixed(2)}`, cls: "neg" };
  return { text: `₹${n.toFixed(2)}`, cls: "pos" };
};
const fmtRound = (n: number) => {
  if (!n || n === 0) return { text: "0.00", cls: "" };
  if (n > 0) return { text: `+₹${n.toFixed(2)}`, cls: "pos" };
  return { text: `-₹${Math.abs(n).toFixed(2)}`, cls: "neg" };
};

/* ── Dropdown ───────────────────────────────────────────────── */
function Dropdown({ label, value, options, onChange }: {
  label: string; value: string; options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const display = value === "All" ? "All" : value.length > 16 ? value.slice(0, 16) + "…" : value;
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen(p => !p)} className="gd-btn">
        <span className="gd-val">{display}</span>
        <ChevronDown size={11} className={`gd-chev ${open ? "open" : ""}`} />
      </button>
      {open && (
        <ul className="gd-list">
          {options.map(o => (
            <li key={o} className={`gd-item ${value === o ? "sel" : ""}`}
              onClick={() => { onChange(o); setOpen(false); }}>
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Filter Group ───────────────────────────────────────────── */
function FG({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="fg">
      <span className="fg-lbl">{label}</span>
      {children}
    </div>
  );
}

/* ── KPI Card ───────────────────────────────────────────────── */
function KPI({ label, value, sub, accent, icon }: {
  label: string; value: string; sub?: string; accent: string; icon: React.ReactNode;
}) {
  return (
    <div className={`gkpi gkpi-${accent}`}>
      <div className="gkpi-ico">{icon}</div>
      <div>
        <p className="gkpi-lbl">{label}</p>
        <p className="gkpi-val">{value}</p>
        {sub && <p className="gkpi-sub">{sub}</p>}
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */
export default function GSTReportPage() {
  const [filters, setFilters] = useState<GSTReportFilters>({
    startDate: monthStartStr(), endDate: todayStr(),
    orderStatus: "All", customerState: "All",
    documentType: "All", paymentType: "All", paymentMethod: "All",
  });

  // Infinite scroll & rows state
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [totalRows, setTotalRows] = useState(0);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const isFetchingRef = useRef(false);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Summary KPIs from backend
  const [totals, setTotals] = useState({
    taxableValue: 0,
    shippingCharged: 0,
    deductedShipping: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    roundOff: 0,
    grossAmount: 0,
  });
  const [invoicesCount, setInvoicesCount] = useState(0);
  const [creditNotesCount, setCreditNotesCount] = useState(0);

  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch GST Data
  const fetchGSTData = async (pageNum: number, search: string = "", isAppend: boolean = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (isAppend) {
      setIsLoadingMore(true);
    } else {
      setIsLoadingInitial(true);
      if (search) setIsSearching(true);
    }
    setError(null);

    try {
      const qp = new URLSearchParams();
      qp.append("limit", PAGE_SIZE.toString());
      qp.append("per_page", PAGE_SIZE.toString());
      qp.append("page", pageNum.toString());
      qp.append("from_date", filters.startDate);
      qp.append("to_date", filters.endDate);
      if (filters.orderStatus !== "All") qp.append("status", filters.orderStatus.toLowerCase());
      if (filters.customerState !== "All") qp.append("customer_state", filters.customerState);
      if (filters.documentType !== "All") qp.append("document_type", filters.documentType);
      if (filters.paymentType !== "All") qp.append("payment_type", filters.paymentType);
      if (filters.paymentMethod !== "All") qp.append("payment_method", filters.paymentMethod);
      if (search) qp.append("search", search);

      const res = await axios.get(`/api/admin/gst-report?${qp}`);
      const body = res.data?.data || res.data;

      const list: any[] = body?.rows || body?.data || [];
      const paginationData = body?.pagination;

      if (body?.totals) setTotals(body.totals);
      if (body?.invoices_count !== undefined) setInvoicesCount(body.invoices_count);
      if (body?.credit_notes_count !== undefined) setCreditNotesCount(body.credit_notes_count);

      const total = paginationData?.total ?? list.length;
      const hasNext = Boolean(
        paginationData?.has_next_page ??
        paginationData?.hasNextPage ??
        paginationData?.has_more ??
        (paginationData ? pageNum < paginationData.last_page : list.length >= PAGE_SIZE)
      );

      setTotalRows(total);
      setHasNextPage(hasNext);
      setPage(pageNum);

      if (isAppend) {
        setRows((prev) => {
          const existingKeys = new Set(prev.map((r, i) => `${r.orderId}-${r.documentNumber}-${i}`));
          const newUnique = list.filter((r, i) => !existingKeys.has(`${r.orderId}-${r.documentNumber}-${i}`));
          return [...prev, ...newUnique];
        });
      } else {
        setRows(list);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to load GST records.");
      if (!isAppend) setRows([]);
      setHasNextPage(false);
    } finally {
      isFetchingRef.current = false;
      setIsLoadingInitial(false);
      setIsLoadingMore(false);
      setIsSearching(false);
    }
  };

  // Reset pagination on filter or search changes
  useEffect(() => {
    setPage(1);
    setHasNextPage(true);
    fetchGSTData(1, debouncedSearchQuery, false);
  }, [filters, debouncedSearchQuery]);

  // Load next page on scroll
  const loadNextPage = useCallback(() => {
    if (!hasNextPage || isLoadingMore || isLoadingInitial || isFetchingRef.current) return;
    fetchGSTData(page + 1, debouncedSearchQuery, true);
  }, [hasNextPage, isLoadingMore, isLoadingInitial, page, debouncedSearchQuery]);

  // Observer for bottom sentinel
  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting) {
          loadNextPage();
        }
      },
      {
        root: null,
        rootMargin: "300px",
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadNextPage]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const qp = new URLSearchParams();
      qp.append("from_date", filters.startDate);
      qp.append("to_date", filters.endDate);
      if (filters.orderStatus !== "All") qp.append("status", filters.orderStatus.toLowerCase());
      if (filters.customerState !== "All") qp.append("customer_state", filters.customerState);
      if (filters.documentType !== "All") qp.append("document_type", filters.documentType);
      if (filters.paymentType !== "All") qp.append("payment_type", filters.paymentType);
      if (filters.paymentMethod !== "All") qp.append("payment_method", filters.paymentMethod);
      const API = process.env.NEXT_PUBLIC_API_URL || "https://api.zelton.co.in";
      const resp = await fetch(`${API}/api/admin/gst-report/download?${qp}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      });
      if (!resp.ok) throw new Error(`Server error: ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `GST_Report_${filters.startDate}_to_${filters.endDate}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) { setError(e.message ?? "Download failed."); }
    finally { setDownloading(false); }
  };

  const reset = () => {
    setSearchQuery("");
    setFilters({
      startDate: monthStartStr(), endDate: todayStr(),
      orderStatus: "All", customerState: "All",
      documentType: "All", paymentType: "All", paymentMethod: "All",
    });
  };

  return (
    <>
      <style>{`
        /* ── Root ── */
        .gr-root {
          font-family: 'Inter','Segoe UI',sans-serif;
          background: #f0f2f7;
          padding: 1rem 0 3rem;
          min-height: 100vh;
          box-sizing: border-box;
          width: 100%;
          overflow-x: hidden;
        }

        /* ── Header ── */
        .gr-hdr {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: .75rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }
        .gr-hdr-l { display: flex; align-items: center; gap: .65rem; min-width: 0; }
        .gr-ico {
          width: 2.25rem; height: 2.25rem; border-radius: .65rem; flex-shrink: 0;
          background: linear-gradient(135deg,#007FFF,#0066CC);
          display: flex; align-items: center; justify-content: center; color: #fff;
          box-shadow: 0 3px 10px rgba(255,153,3,.35);
        }
        .gr-h1 { font-size: 1.1rem; font-weight: 700; color: #1a1a2e; margin: 0; }
        .gr-sub { font-size: .68rem; color: #9ca3af; margin: 0; }
        .gr-dl-btn {
          display: flex; align-items: center; gap: .4rem;
          padding: .55rem 1rem; background: linear-gradient(135deg,#16a34a,#15803d);
          color: #fff; border: none; border-radius: .55rem;
          font-size: .78rem; font-weight: 600; cursor: pointer; white-space: nowrap;
          box-shadow: 0 3px 8px rgba(22,163,74,.3); transition: all .2s; flex-shrink: 0;
        }
        .gr-dl-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 5px 14px rgba(22,163,74,.4); }
        .gr-dl-btn:disabled { opacity: .55; cursor: not-allowed; }

        /* ── Error ── */
        .gr-err {
          background: #fef2f2; border: 1px solid #fecaca; border-radius: .55rem;
          padding: .6rem .9rem; color: #dc2626; font-size: .78rem;
          display: flex; align-items: center; gap: .4rem; margin-bottom: .75rem;
        }

        /* ── Filter Card ── */
        .gr-filters {
          background: #fff; border: 1px solid #e5e7eb; border-radius: .75rem;
          padding: .85rem 1rem; margin-bottom: .85rem;
          box-shadow: 0 1px 4px rgba(0,0,0,.05);
        }
        .gr-f-row {
          display: grid;
          gap: .65rem .75rem;
          align-items: end;
        }
        .gr-f-row-1 { grid-template-columns: auto auto auto auto 1fr; }
        .gr-f-row-2 { grid-template-columns: auto auto 1fr auto; margin-top: .6rem; padding-top: .6rem; border-top: 1px solid #f3f4f6; }

        .fg { display: flex; flex-direction: column; gap: .18rem; }
        .fg-lbl {
          font-size: .6rem; font-weight: 700; color: #9ca3af;
          text-transform: uppercase; letter-spacing: .08em;
        }

        /* Date inputs */
        .gr-dates { display: flex; align-items: center; gap: .3rem; }
        .gr-date {
          border: 1.5px solid #e5e7eb; border-radius: .4rem; padding: .34rem .45rem;
          font-size: .75rem; color: #374151; background: #f9fafb; cursor: pointer;
          transition: border-color .2s; width: 120px;
        }
        .gr-date:focus { outline: none; border-color: #007FFF; background: #fff; }
        .gr-date-sep { font-size: .65rem; color: #9ca3af; }

        /* Dropdown */
        .gd-btn {
          display: inline-flex; align-items: center; gap: .28rem;
          border: 1.5px solid #e5e7eb; border-radius: .4rem; padding: .34rem .6rem;
          background: #f9fafb; cursor: pointer; font-size: .75rem; color: #374151;
          transition: border-color .2s, background .15s; white-space: nowrap;
        }
        .gd-btn:hover { border-color: #007FFF; background: #eff6ff; }
        .gd-val { font-weight: 600; color: #1f2937; max-width: 100px; overflow: hidden; text-overflow: ellipsis; }
        .gd-chev { color: #9ca3af; transition: transform .2s; flex-shrink: 0; }
        .gd-chev.open { transform: rotate(180deg); }
        .gd-list {
          position: absolute; top: calc(100% + .25rem); left: 0; z-index: 9999;
          background: #fff; border: 1.5px solid #e5e7eb; border-radius: .55rem;
          box-shadow: 0 8px 20px rgba(0,0,0,.12);
          min-width: 160px; max-height: 200px; overflow-y: auto;
          padding: .25rem 0; list-style: none; margin: 0;
        }
        .gd-item { padding: .4rem .85rem; font-size: .76rem; color: #374151; cursor: pointer; }
        .gd-item:hover { background: #eff6ff; color: #007FFF; }
        .gd-item.sel { color: #007FFF; font-weight: 700; background: #eff6ff; }

        /* Toggle pills */
        .gr-pills { display: flex; gap: .22rem; }
        .gr-pill {
          padding: .32rem .6rem; border-radius: 999px; border: 1.5px solid #e5e7eb;
          background: #f9fafb; font-size: .72rem; color: #6b7280; cursor: pointer;
          transition: all .15s; font-weight: 500; white-space: nowrap;
        }
        .gr-pill:hover { border-color: #007FFF; color: #007FFF; }
        .gr-pill.on {
          background: linear-gradient(135deg,#007FFF,#0066CC);
          border-color: #007FFF; color: #fff; font-weight: 700;
        }

        /* Reset btn */
        .gr-reset {
          display: inline-flex; align-items: center; gap: .28rem; padding: .34rem .65rem;
          border: 1.5px solid #e5e7eb; border-radius: .4rem;
          background: #f9fafb; color: #6b7280; font-size: .72rem;
          cursor: pointer; transition: all .15s; white-space: nowrap; align-self: end;
        }
        .gr-reset:hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }

        /* ── Info bar ── */
        .gr-info {
          background: #eff6ff; border: 1px solid #bfdbfe; border-radius: .55rem;
          padding: .55rem .85rem; color: #1d4ed8; font-size: .72rem;
          display: flex; align-items: flex-start; gap: .4rem; margin-bottom: .85rem;
          flex-wrap: wrap;
        }

        /* ── KPI Grid — exactly 4 per row ── */
        .gr-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: .65rem;
          margin-bottom: .85rem;
        }
        .gkpi {
          display: flex; align-items: center; gap: .65rem;
          background: #fff; border: 1px solid #e5e7eb; border-radius: .65rem;
          padding: .75rem .85rem; box-shadow: 0 1px 3px rgba(0,0,0,.04);
          transition: box-shadow .2s; min-width: 0;
        }
        .gkpi:hover { box-shadow: 0 4px 10px rgba(0,0,0,.08); }
        .gkpi-ico {
          width: 2rem; height: 2rem; border-radius: .45rem; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .gkpi-blue .gkpi-ico { background: #eff6ff; color: #2563eb; }
        .gkpi-amber .gkpi-ico { background: #eff6ff; color: #007FFF; }
        .gkpi-green .gkpi-ico { background: #f0fdf4; color: #16a34a; }
        .gkpi-purple .gkpi-ico { background: #faf5ff; color: #7c3aed; }
        .gkpi-lbl {
          font-size: .6rem; color: #9ca3af; font-weight: 700;
          text-transform: uppercase; letter-spacing: .05em; line-height: 1;
        }
        .gkpi-val { font-size: .85rem; font-weight: 700; color: #1a1a2e; margin-top: .12rem; }
        .gkpi-sub { font-size: .6rem; color: #6b7280; margin-top: .04rem; }

        /* ── Table Card ── */
        .gr-tbl-card {
          background: #fff; border: 1px solid #e5e7eb; border-radius: .75rem;
          box-shadow: 0 1px 4px rgba(0,0,0,.05); overflow: hidden;
        }
        .gr-tbl-hdr {
          display: flex; align-items: center; justify-content: space-between;
          padding: .75rem 1rem; border-bottom: 1px solid #f3f4f6; flex-wrap: wrap; gap: .4rem;
        }
        .gr-tbl-title { font-size: .85rem; font-weight: 700; color: #1a1a2e; }
        .gr-tbl-badge {
          background: #eff6ff; color: #007FFF; border-radius: 999px;
          padding: .08rem .5rem; font-size: .68rem; font-weight: 700;
        }
        .gr-tbl-date { font-size: .67rem; color: #9ca3af; }
        .gr-tbl-scroll { overflow-x: auto; }

        /* Table */
        table.gt {
          width: 100%; border-collapse: collapse; font-size: .72rem; white-space: nowrap;
        }
        .gt thead th {
          background: #1a1a2e; color: #fff; padding: .58rem .75rem;
          text-align: left; font-weight: 600; font-size: .65rem;
          text-transform: uppercase; letter-spacing: .04em;
          border-right: 1px solid rgba(255,255,255,.07);
        }
        .gt thead th:last-child { border-right: none; }
        .gt tbody tr { border-bottom: 1px solid #f3f4f6; transition: background .1s; }
        .gt tbody tr:hover { background: #fafafa; }
        .gt tbody tr.cn { background: #fffbeb; }
        .gt tbody tr.cn:hover { background: #fef3c7; }
        .gt td { padding: .55rem .75rem; color: #374151; }
        .gt td.neg { color: #dc2626; font-weight: 600; }
        .gt td.pos { color: #16a34a; font-weight: 600; }
        .gt td.mono { font-family: 'Courier New', monospace; }
        .gt td.id-col { color: #007FFF; font-weight: 600; }
        .gb {
          display: inline-flex; align-items: center; padding: .12rem .45rem;
          border-radius: 999px; font-size: .65rem; font-weight: 600;
        }
        .gb-inv { background: #eff6ff; color: #2563eb; }
        .gb-cn  { background: #fef9c3; color: #92400e; }
        .gb-pay { background: #f3f4f6; padding: .1rem .45rem; border-radius: 999px; font-size: .65rem; font-weight: 600; }
        .gt tfoot td {
          padding: .6rem .75rem; font-weight: 700; font-size: .72rem;
          background: #f8fafc; border-top: 2px solid #e5e7eb; color: #1a1a2e;
        }
        .gt tfoot td.pos { color: #16a34a; }
        .gt tfoot td.neg { color: #dc2626; }

        @media (max-width: 900px) {
          .gr-f-row-1 { grid-template-columns: 1fr 1fr; }
          .gr-f-row-2 { grid-template-columns: 1fr auto; }
          .gr-kpi-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .gr-f-row-1 { grid-template-columns: 1fr; }
          .gr-f-row-2 { grid-template-columns: 1fr; }
          .gr-kpi-grid { grid-template-columns: 1fr; }
          .gr-dates { flex-wrap: wrap; }
          .gr-date { width: 100%; }
        }
      `}</style>

      <div className="gr-root">
        <div className="px-3 md:px-6">
          {/* Header */}
          <div className="gr-hdr">
            <div className="gr-hdr-l">
              <div className="gr-ico"><FileSpreadsheet size={18} /></div>
              <div>
                <h1 className="gr-h1">GST Sales Report</h1>
                <p className="gr-sub">Home State: Delhi &nbsp;|&nbsp; GSTR-1 ready data</p>
              </div>
            </div>
            <button className="gr-dl-btn" onClick={handleDownload}
              disabled={downloading || totalRows === 0}>
              {downloading
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Preparing…</>
                : <><Download size={14} /> Download Excel Report</>}
            </button>
          </div>

          {/* Error */}
          {error && <div className="gr-err"><X size={14} />{error}</div>}

          {/* Filter Card */}
          <div className="gr-filters">
            {/* Row 1: Date | Status | State | Doc Type */}
            <div className="gr-f-row gr-f-row-1">
              <FG label="📅 Date Range">
                <div className="gr-dates">
                  <input type="date" className="gr-date" value={filters.startDate} max={filters.endDate}
                    onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} />
                  <span className="gr-date-sep">→</span>
                  <input type="date" className="gr-date" value={filters.endDate} min={filters.startDate}
                    onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </FG>

              <FG label="Order Status">
                <Dropdown label="" value={filters.orderStatus} options={ORDER_STATUSES}
                  onChange={v => setFilters(f => ({ ...f, orderStatus: v }))} />
              </FG>

              <FG label="Customer State">
                <Dropdown label="" value={filters.customerState} options={["All", ...INDIAN_STATES]}
                  onChange={v => setFilters(f => ({ ...f, customerState: v }))} />
              </FG>

              <FG label="Document Type">
                <Dropdown label="" value={filters.documentType} options={DOCUMENT_TYPES}
                  onChange={v => setFilters(f => ({ ...f, documentType: v }))} />
              </FG>

              {/* Search Bar in Row 1 */}
              <FG label="Search">
                <div className="relative w-full">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Order / Doc No / State..."
                    className="w-full rounded-md border border-gray-300 bg-white pl-8 pr-7 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all"
                  />
                  {isSearching ? (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                    </div>
                  ) : searchQuery ? (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-semibold cursor-pointer"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </FG>
            </div>

            {/* Row 2: Payment Type (pills) | Payment Method | spacer | Reset */}
            <div className="gr-f-row gr-f-row-2">
              <FG label="Payment Type">
                <div className="gr-pills">
                  {PAYMENT_TYPES.map(p => (
                    <button key={p} className={`gr-pill ${filters.paymentType === p ? "on" : ""}`}
                      onClick={() => setFilters(f => ({ ...f, paymentType: p }))}>{p}</button>
                  ))}
                </div>
              </FG>

              <FG label="Payment Method">
                <Dropdown label="" value={filters.paymentMethod} options={PAYMENT_METHODS}
                  onChange={v => setFilters(f => ({ ...f, paymentMethod: v }))} />
              </FG>

              {/* spacer fills remaining */}
              <div />

              <button className="gr-reset" onClick={reset}>
                <RotateCcw size={11} /> Reset Filters
              </button>
            </div>
          </div>

          {/* Info Bar */}
          <div className="gr-info">
            <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>CGST &amp; SGST apply for <strong>Delhi</strong> orders · IGST applies for all other states · Returned orders auto-generate a Credit Note row</span>
          </div>

          {/* KPI Grid — 4 per row (2 rows = 8 cards) */}
          <div className="gr-kpi-grid">
            <KPI label="Total Invoices" value={invoicesCount.toString()} sub="Sales docs" accent="blue" icon={<Receipt size={15} />} />
            <KPI label="Credit Notes" value={creditNotesCount.toString()} sub="Return docs" accent="amber" icon={<FileText size={15} />} />
            <KPI label="Taxable Value" value={fmtRs(totals.taxableValue)} accent="green" icon={<TrendingUp size={15} />} />
            <KPI label="Gross Revenue" value={fmtSign(totals.grossAmount)} accent="green" icon={<TrendingUp size={15} />} />
            <KPI label="Total CGST" value={fmtSign(totals.cgstAmount)} sub="Delhi only" accent="purple" icon={<FileSpreadsheet size={15} />} />
            <KPI label="Total SGST" value={fmtSign(totals.sgstAmount)} sub="Delhi only" accent="purple" icon={<FileSpreadsheet size={15} />} />
            <KPI label="Total IGST" value={fmtSign(totals.igstAmount)} sub="Out-of-state" accent="blue" icon={<FileSpreadsheet size={15} />} />
            <KPI label="Shipping Collected" value={fmtRs(totals.shippingCharged)} accent="amber" icon={<Receipt size={15} />} />
          </div>

          {/* Table */}
          <div className="gr-tbl-card">
            <div className="gr-tbl-hdr">
              <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                <span className="gr-tbl-title">GST Ledger</span>
                {totalRows > 0 && (
                  <span className="gr-tbl-badge">{rows.length} of {totalRows} rows</span>
                )}
              </div>
              <span className="gr-tbl-date">{filters.startDate} → {filters.endDate}</span>
            </div>

            {isLoadingInitial && rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-gray-500">Loading GST records…</span>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
                <FileSpreadsheet size={42} className="opacity-30" />
                <p className="font-semibold text-gray-600">No records match the selected filters</p>
                <p className="text-xs text-gray-400">Try adjusting the date range or clearing filters.</p>
              </div>
            ) : (
              <div className="gr-tbl-scroll">
                <table className="gt">
                  <thead>
                    <tr>
                      <th>S.No.</th>
                      <th>Order ID</th>
                      <th>Doc Type</th>
                      <th>Doc No.</th>
                      <th>Date &amp; Time</th>
                      <th>State (POS)</th>
                      <th>HSN Code</th>
                      <th>Taxable (₹)</th>
                      <th>Ship. (₹)</th>
                      <th>Ded.Ship (₹)</th>
                      <th>GST%</th>
                      <th>CGST (₹)</th>
                      <th>SGST (₹)</th>
                      <th>IGST (₹)</th>
                      <th>Round-Off</th>
                      <th>Gross (₹)</th>
                      <th>Payment</th>
                      <th>GSTIN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const isCN = (row.documentType || row.docType) === "Credit Note";
                      const tvC = fmtCell(row.taxableValue);
                      const cgC = fmtCell(row.cgstAmount ?? row.cgst);
                      const sgC = fmtCell(row.sgstAmount ?? row.sgst);
                      const igC = fmtCell(row.igstAmount ?? row.igst);
                      const roC = fmtRound(row.roundOff);
                      const grC = fmtCell(row.grossAmount);
                      return (
                        <tr key={`${row.documentNumber || row.docNumber}-${i}`} className={isCN ? "cn" : ""}>
                          <td className="font-semibold text-gray-500">{i + 1}</td>
                          <td className="id-col mono">{row.orderId}</td>
                          <td><span className={`gb ${isCN ? "gb-cn" : "gb-inv"}`}>{isCN ? "Credit Note" : "Invoice"}</span></td>
                          <td className="mono" style={{ fontWeight: 600 }}>{row.documentNumber || row.docNumber}</td>
                          <td>{row.documentDateTime || row.docDateTime}</td>
                          <td>{row.customerState || row.statePOS}</td>
                          <td className="mono">{row.hsnCode}</td>
                          <td className={tvC.cls}>{tvC.text}</td>
                          <td>₹{(row.shippingCharged || 0).toFixed(2)}</td>
                          <td className={row.deductedShipping > 0 ? "pos" : ""}>₹{(row.deductedShipping || 0).toFixed(2)}</td>
                          <td>{row.gstRate}%</td>
                          <td className={cgC.cls}>{cgC.text}</td>
                          <td className={sgC.cls}>{sgC.text}</td>
                          <td className={igC.cls}>{igC.text}</td>
                          <td className={roC.cls}>{roC.text}</td>
                          <td className={`mono ${grC.cls}`} style={{ fontWeight: 700 }}>{grC.text}</td>
                          <td><span className="gb-pay">{row.paymentMode || row.paymentMethod}</span></td>
                          <td className="mono" style={{ color: row.customerGSTIN ? "#7c3aed" : "#d1d5db" }}>
                            {row.customerGSTIN || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={7} style={{ textAlign: "right", fontSize: ".68rem", letterSpacing: ".08em" }}>GRAND TOTALS</td>
                      {(() => {
                        const tv = fmtCell(totals.taxableValue);
                        const cg = fmtCell(totals.cgstAmount);
                        const sg = fmtCell(totals.sgstAmount);
                        const ig = fmtCell(totals.igstAmount);
                        const ro = fmtRound(totals.roundOff);
                        const gr = fmtCell(totals.grossAmount);
                        return <>
                          <td className={tv.cls}>{tv.text}</td>
                          <td>₹{(totals.shippingCharged || 0).toFixed(2)}</td>
                          <td>₹{(totals.deductedShipping || 0).toFixed(2)}</td>
                          <td />
                          <td className={cg.cls}>{cg.text}</td>
                          <td className={sg.cls}>{sg.text}</td>
                          <td className={ig.cls}>{ig.text}</td>
                          <td className={ro.cls}>{ro.text}</td>
                          <td className={gr.cls} style={{ fontSize: ".78rem" }}>{gr.text}</td>
                          <td colSpan={2} />
                        </>;
                      })()}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Bottom Sentinel for Infinite Scroll */}
            <div ref={bottomSentinelRef} className="h-6 w-full pointer-events-none" />

            {/* Infinite Scroll Bottom Loading State */}
            {isLoadingMore && (
              <div className="flex items-center justify-center gap-2.5 py-4 text-xs font-semibold text-gray-600 bg-gray-50 border-t border-gray-100">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>Loading more GST records...</span>
              </div>
            )}

            {/* All Records Loaded Indicator */}
            {!hasNextPage && rows.length > 0 && !isLoadingInitial && (
              <div className="flex items-center justify-center py-4 text-xs text-gray-500 font-semibold bg-gray-50 border-t border-gray-100 gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>All {rows.length} records loaded</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
