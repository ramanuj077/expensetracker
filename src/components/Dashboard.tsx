import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Expense } from './ExpenseForm';
import { ExpenseForm } from './ExpenseForm';
import { 
  LogOut, Sun, Moon, Plus, Trash2, Edit3, Calendar, Search, 
  Download, X, Check, AlertTriangle, Eye 
} from 'lucide-react';

const currentMonthStr = new Date().toISOString().slice(0, 7);
const categories = ['All', 'Food', 'Utilities', 'Entertainment', 'Transport', 'Healthcare', 'Shopping', 'Others'];

interface DashboardProps {
  onSignOut: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  Food: 'var(--accent-yellow)',
  Utilities: 'var(--accent-cyan)',
  Entertainment: 'var(--accent-pink)',
  Transport: 'var(--accent-green)',
  Healthcare: 'var(--accent-purple)',
  Shopping: '#fd7e14',
  Others: '#6c757d',
};

const formatMonthLabel = (monthStr: string) => {
  if (monthStr === 'All') return 'All Time';
  const [year, month] = monthStr.split('-');
  const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
  return dateObj.toLocaleDateString('default', { month: 'long', year: 'numeric' });
};

export const Dashboard: React.FC<DashboardProps> = ({ onSignOut }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  
  // Custom Modals
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);

  // Budget state (saved to localStorage)
  const [budget, setBudget] = useState<number>(() => {
    const saved = localStorage.getItem('monthly_budget');
    return saved ? parseFloat(saved) : 1000;
  });
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(budget.toString());

  // Toast stack state
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' }[]>([]);

  // Dynamic Greeting based on time
  const [greeting, setGreeting] = useState('Welcome back');

  // Theme State with localStorage persistence
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      document.documentElement.setAttribute('data-theme', savedTheme);
      return savedTheme;
    }
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', systemTheme);
    return systemTheme;
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  useEffect(() => {
    fetchExpenses();

    // Determine greeting
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning 🌅');
    else if (hour < 18) setGreeting('Good Afternoon ☀️');
    else setGreeting('Good Evening 🌙');
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Ignore if user is typing in input or select elements
      if (
        document.activeElement?.tagName === 'INPUT' || 
        document.activeElement?.tagName === 'SELECT' || 
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setEditingExpense(null);
        setIsFormOpen(true);
        showToast('Shortcut: Opened Add Form');
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, []);

  useEffect(() => {
    // Apply client filters & search
    let result = expenses;
    if (selectedMonth !== 'All') {
      result = result.filter((e) => e.date.startsWith(selectedMonth));
    }
    if (selectedCategory !== 'All') {
      result = result.filter((e) => e.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) => 
        e.title.toLowerCase().includes(q) || 
        e.category.toLowerCase().includes(q) ||
        e.amount.toString().includes(q)
      );
    }
    setFilteredExpenses(result);
  }, [expenses, selectedMonth, selectedCategory, searchQuery]);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
    showToast(`Switched to ${nextTheme} mode`);
  };

  const fetchExpenses = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user found.');

      const { data, error: fetchErr } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

      if (fetchErr) throw fetchErr;
      setExpenses(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load expenses.');
      showToast('Error loading database', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveExpense = async (expenseData: Omit<Expense, 'id'> & { id?: string }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (expenseData.id) {
        // Edit mode
        const { error: updateErr } = await supabase
          .from('expenses')
          .update({
            title: expenseData.title,
            amount: expenseData.amount,
            category: expenseData.category,
            date: expenseData.date,
          })
          .eq('id', expenseData.id);

        if (updateErr) throw updateErr;
        showToast('✓ Expense Updated');
      } else {
        // Add mode
        const { error: insertErr } = await supabase
          .from('expenses')
          .insert({
            user_id: user.id,
            title: expenseData.title,
            amount: expenseData.amount,
            category: expenseData.category,
            date: expenseData.date,
          });

        if (insertErr) throw insertErr;
        showToast('✓ Expense Added');
      }

      setIsFormOpen(false);
      setEditingExpense(null);
      await fetchExpenses();
    } catch (err: any) {
      showToast(err.message || 'Failed to save transaction', 'error');
      throw err;
    }
  };

  const handleDeleteExpense = async () => {
    if (!deletingId) return;
    try {
      const { error: deleteErr } = await supabase
        .from('expenses')
        .delete()
        .eq('id', deletingId);

      if (deleteErr) throw deleteErr;
      showToast('✓ Expense Deleted');
      setDeletingId(null);
      await fetchExpenses();
    } catch (err: any) {
      setError(err.message || 'Failed to delete expense.');
      showToast('Deletion failed', 'error');
    }
  };

  const handleEditClick = (expense: Expense) => {
    setEditingExpense(expense);
    setIsFormOpen(true);
  };

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(budgetInput);
    if (!isNaN(val) && val > 0) {
      setBudget(val);
      localStorage.setItem('monthly_budget', val.toString());
      setIsEditingBudget(false);
      showToast('Budget Limit Updated');
    } else {
      showToast('Enter a positive budget limit', 'error');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onSignOut();
  };

  const handleExportCSV = () => {
    if (expenses.length === 0) {
      showToast('No expenses to export', 'error');
      return;
    }
    const headers = ['Title', 'Amount', 'Category', 'Date', 'Created At'];
    const rows = expenses.map(e => [
      `"${e.title.replace(/"/g, '""')}"`,
      e.amount,
      `"${e.category}"`,
      e.date,
      e.created_at || ''
    ]);

    const csvContent = 
      "data:text/csv;charset=utf-8," + 
      [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `spendTime_expenses_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('✓ Ledger exported to CSV');
  };

  // Get unique months list for filter
  const monthsInExpenses = expenses.map((e) => e.date.slice(0, 7));
  const uniqueMonths = Array.from(new Set([currentMonthStr, ...monthsInExpenses])).sort((a, b) => b.localeCompare(a));

  // Compute Period Statistics
  const periodExpenses = expenses.filter((e) => selectedMonth === 'All' || e.date.startsWith(selectedMonth));
  const totalPeriodSpending = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
  const transactionsCount = periodExpenses.length;
  
  const highestExpense = periodExpenses.reduce((max, e) => e.amount > max ? e.amount : max, 0);
  
  const categoriesUsed = Array.from(new Set(periodExpenses.map(e => e.category))).length;

  // Compute category breakdown
  const categoryBreakdown = periodExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  const sortedBreakdown = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]);

  // Compute Chart Data (Day-wise bar chart for selected month, or month-wise for "All")
  let chartData: { label: string; amount: number }[] = [];
  if (selectedMonth === 'All') {
    const groups: Record<string, number> = {};
    expenses.forEach((e) => {
      const m = e.date.slice(0, 7);
      groups[m] = (groups[m] || 0) + e.amount;
    });
    chartData = Object.entries(groups)
      .map(([m, amt]) => ({ label: formatMonthLabel(m), amount: amt }))
      .slice(0, 5) // Last 5 months
      .reverse();
  } else {
    // Day wise
    const groups: Record<string, number> = {};
    periodExpenses.forEach((e) => {
      const day = e.date.slice(8, 10);
      groups[day] = (groups[day] || 0) + e.amount;
    });
    chartData = Object.entries(groups)
      .map(([d, amt]) => ({ label: `Day ${d}`, amount: amt }))
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(-10); // Show last 10 active days
  }

  const maxChartVal = Math.max(...chartData.map((d) => d.amount), 1);
  const budgetProgressPercent = Math.min(100, (totalPeriodSpending / budget) * 100);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      
      {/* Toast Notification Deck */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Header section */}
      <header className="nb-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '32px', backgroundColor: 'var(--accent-yellow)' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1, color: '#000' }}>
            SpendTime
          </h1>
          <p style={{ fontWeight: 800, textTransform: 'uppercase', color: '#000', fontSize: '0.9rem', marginTop: '6px' }}>
            {greeting}, Here's your spend summary.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={handleExportCSV} className="nb-button cyan" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Download size={18} />
            <span>Export CSV</span>
          </button>
          <button onClick={toggleTheme} className="nb-button" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }} title="Toggle Theme">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <button onClick={handleSignOut} className="nb-button pink" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* SaaS Dashboard Stat Cards */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        
        {/* Card 1: Total Spent */}
        <div className="nb-card" style={{ backgroundColor: 'var(--accent-green)', color: '#000' }}>
          <span style={{ fontWeight: 900, fontSize: '0.85rem', textTransform: 'uppercase' }}>Total Spent</span>
          <h3 style={{ fontSize: '2.2rem', fontWeight: 900, margin: '8px 0' }}>
            ${totalPeriodSpending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h3>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
            For {formatMonthLabel(selectedMonth)}
          </p>
        </div>

        {/* Card 2: Transactions count */}
        <div className="nb-card" style={{ backgroundColor: 'var(--accent-yellow)', color: '#000' }}>
          <span style={{ fontWeight: 900, fontSize: '0.85rem', textTransform: 'uppercase' }}>Transactions</span>
          <h3 style={{ fontSize: '2.2rem', fontWeight: 900, margin: '8px 0' }}>
            {transactionsCount}
          </h3>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
            Logged Entries
          </p>
        </div>

        {/* Card 3: Highest Expense */}
        <div className="nb-card" style={{ backgroundColor: 'var(--accent-pink)', color: '#000' }}>
          <span style={{ fontWeight: 900, fontSize: '0.85rem', textTransform: 'uppercase' }}>Highest Expense</span>
          <h3 style={{ fontSize: '2.2rem', fontWeight: 900, margin: '8px 0' }}>
            ${highestExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h3>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
            Single record peak
          </p>
        </div>

        {/* Card 4: Categories Used */}
        <div className="nb-card" style={{ backgroundColor: 'var(--accent-cyan)', color: '#000' }}>
          <span style={{ fontWeight: 900, fontSize: '0.85rem', textTransform: 'uppercase' }}>Categories Used</span>
          <h3 style={{ fontSize: '2.2rem', fontWeight: 900, margin: '8px 0' }}>
            {categoriesUsed}
          </h3>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
            Across ledger fields
          </p>
        </div>
      </section>

      {/* Main Grid: Left Side stats / charts, Right Side ledger */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>
        
        {/* Budget Goals & Charts Area */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          
          {/* Budget Widget Card */}
          <div className="nb-card" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase' }}>
                🎯 Period Budget
              </h3>
              {!isEditingBudget ? (
                <button onClick={() => setIsEditingBudget(true)} className="nb-button" style={{ padding: '4px 10px', fontSize: '0.75rem', boxShadow: '2px 2px 0 0 #000' }}>
                  Edit
                </button>
              ) : (
                <form onSubmit={handleSaveBudget} style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="number"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    style={{ width: '80px', padding: '4px', fontSize: '0.8rem', fontWeight: 'bold', border: '2px solid #000' }}
                    required
                  />
                  <button type="submit" className="nb-button green" style={{ padding: '4px 8px', fontSize: '0.75rem', boxShadow: '1px 1px 0 0 #000' }}>✓</button>
                  <button type="button" onClick={() => setIsEditingBudget(false)} className="nb-button pink" style={{ padding: '4px 8px', fontSize: '0.75rem', boxShadow: '1px 1px 0 0 #000' }}>✗</button>
                </form>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.9rem', marginBottom: '8px' }}>
              <span>Spent: ${totalPeriodSpending.toFixed(2)}</span>
              <span>Limit: ${budget.toFixed(2)}</span>
            </div>

            {/* Neo-brutalist progress limit meter */}
            <div className="nb-border" style={{ height: '24px', backgroundColor: 'var(--bg-primary)', overflow: 'hidden', position: 'relative' }}>
              <div style={{ 
                width: `${budgetProgressPercent}%`, 
                height: '100%', 
                backgroundColor: budgetProgressPercent > 90 ? 'var(--accent-pink)' : 'var(--accent-green)',
                transition: 'width 0.4s ease-out',
                borderRight: budgetProgressPercent > 0 ? '4px solid #000' : 'none'
              }} />
            </div>

            <div style={{ marginTop: '12px', fontWeight: 800, fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', textTransform: 'uppercase' }}>
              {budget - totalPeriodSpending >= 0 ? (
                <span style={{ color: 'var(--accent-green)' }}>Remaining: ${(budget - totalPeriodSpending).toFixed(2)}</span>
              ) : (
                <span style={{ color: 'var(--accent-pink)' }}>Over Budget By: ${(totalPeriodSpending - budget).toFixed(2)} ⚠️</span>
              )}
              <span>{budgetProgressPercent.toFixed(0)}% Used</span>
            </div>
          </div>

          {/* SVG Daily Spending Bar Chart */}
          <div className="nb-card" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '16px' }}>
              📈 Daily Spending Graph
            </h3>
            {chartData.length === 0 ? (
              <div style={{ height: '160px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-secondary)' }}>
                No chart data available for selected period.
              </div>
            ) : (
              <div style={{ display: 'flex', height: '165px', alignItems: 'flex-end', gap: '8px', padding: '0 8px', borderBottom: '3px solid var(--border-color)' }}>
                {chartData.map((d, index) => {
                  const valPercent = (d.amount / maxChartVal) * 100;
                  return (
                    <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                      <div 
                        title={`Amount: $${d.amount}`}
                        className="nb-border" 
                        style={{ 
                          width: '100%', 
                          height: `${Math.max(10, valPercent)}%`, 
                          backgroundColor: 'var(--accent-cyan)', 
                          boxShadow: '2px -2px 0px 0px var(--shadow-color)',
                          transition: 'height 0.3s ease-out' 
                        }} 
                      />
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, marginTop: '4px', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', width: '100%', textAlign: 'center' }}>
                        {d.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Budget breakdown category meters */}
        <div className="nb-card" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '16px' }}>
            📊 Category Distribution
          </h3>
          {sortedBreakdown.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>No categories in use.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              {sortedBreakdown.map(([cat, amt]) => {
                const percent = Math.min(100, totalPeriodSpending > 0 ? (amt / totalPeriodSpending) * 100 : 0);
                const catColor = CATEGORY_COLORS[cat] || '#6c757d';
                return (
                  <div key={cat} className="nb-card" style={{ padding: '12px', background: 'var(--bg-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '4px' }}>
                      <span>{cat}</span>
                      <span>${amt.toFixed(2)}</span>
                    </div>
                    <div className="nb-border" style={{ height: '12px', backgroundColor: 'var(--bg-secondary)', overflow: 'hidden', padding: 0 }}>
                      <div style={{ width: `${percent}%`, height: '100%', backgroundColor: catColor }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Search, filters, Add Button controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
            
            {/* Search */}
            <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '16px', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Search description, category, amount..."
                className="nb-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '40px' }}
              />
            </div>
            
            {/* Month Filter */}
            <div style={{ position: 'relative' }}>
              <select
                className="nb-input"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{ paddingRight: '40px', appearance: 'none', cursor: 'pointer' }}
              >
                <option value="All">📂 All Months</option>
                {uniqueMonths.map((m) => (
                  <option key={m} value={m}>
                    📅 {formatMonthLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div style={{ position: 'relative' }}>
              <select
                className="nb-input"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{ paddingRight: '40px', appearance: 'none', cursor: 'pointer' }}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'All' ? '📂 All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={() => {
              setEditingExpense(null);
              setIsFormOpen(true);
            }}
            className="nb-button green"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 28px' }}
            title="Press 'N' to open"
          >
            <Plus size={20} />
            <span>Add Expense (N)</span>
          </button>
        </div>

        {/* Expense List Card */}
        <div className="nb-card" style={{ padding: '0px', overflow: 'hidden' }}>
          <div style={{ borderBottom: '4px solid var(--border-color)', padding: '16px 24px', backgroundColor: 'var(--accent-pink)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', color: '#000' }}>
              📋 Expense Ledger ({filteredExpenses.length})
            </h3>
          </div>

          {error && (
            <div className="nb-border" style={{ margin: '16px', backgroundColor: 'var(--accent-pink)', padding: '12px', fontWeight: 800, color: '#000' }}>
              ⚠️ {error}
            </div>
          )}

          {loading ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '4px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                    <th style={{ padding: '16px 24px', fontWeight: 800 }}>TITLE</th>
                    <th style={{ padding: '16px 24px', fontWeight: 800 }}>CATEGORY</th>
                    <th style={{ padding: '16px 24px', fontWeight: 800 }}>DATE</th>
                    <th style={{ padding: '16px 24px', fontWeight: 800, textAlign: 'right' }}>AMOUNT</th>
                    <th style={{ padding: '16px 24px', fontWeight: 800, textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3].map((i) => (
                    <tr key={i} style={{ borderBottom: '2px solid var(--border-color)' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div className="skeleton-pulse" style={{ height: '18px', width: '130px' }} />
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div className="skeleton-pulse" style={{ height: '24px', width: '80px' }} />
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div className="skeleton-pulse" style={{ height: '14px', width: '90px' }} />
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <div className="skeleton-pulse" style={{ height: '18px', width: '60px', float: 'right' }} />
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <div className="skeleton-pulse" style={{ height: '28px', width: '36px' }} />
                          <div className="skeleton-pulse" style={{ height: '28px', width: '36px' }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 800, textTransform: 'uppercase' }}>
              {expenses.length === 0 ? (
                <div>
                  <p style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No expenses recorded yet.</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Start by adding your first expense entry!</p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No matching expenses found.</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Refine your filters or search keywords.</p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '4px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                    <th style={{ padding: '16px 24px', fontWeight: 800, textTransform: 'uppercase' }}>Title</th>
                    <th style={{ padding: '16px 24px', fontWeight: 800, textTransform: 'uppercase' }}>Category</th>
                    <th style={{ padding: '16px 24px', fontWeight: 800, textTransform: 'uppercase' }}>Date</th>
                    <th style={{ padding: '16px 24px', fontWeight: 800, textTransform: 'uppercase', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '16px 24px', fontWeight: 800, textTransform: 'uppercase', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((expense) => {
                    const catColor = CATEGORY_COLORS[expense.category] || '#6c757d';
                    return (
                      <tr key={expense.id} style={{ borderBottom: '2px solid var(--border-color)' }}>
                        <td style={{ padding: '16px 24px', fontWeight: 700 }}>{expense.title}</td>
                        <td style={{ padding: '16px 24px' }}>
                          <span className="badge" style={{ backgroundColor: catColor, color: '#000000' }}>
                            {expense.category}
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={14} />
                            <span>{expense.date}</span>
                          </div>
                        </td>
                        <td style={{ padding: '16px 24px', fontWeight: 900, textAlign: 'right', fontSize: '1.1rem' }}>
                          ${expense.amount.toFixed(2)}
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button onClick={() => setViewingExpense(expense)} className="nb-button" style={{ padding: '6px 12px', fontSize: '0.8rem', boxShadow: '2px 2px 0px 0px var(--shadow-color)', backgroundColor: 'var(--accent-cyan)' }} title="View details">
                              <Eye size={14} />
                            </button>
                            <button onClick={() => handleEditClick(expense)} className="nb-button" style={{ padding: '6px 12px', fontSize: '0.8rem', boxShadow: '2px 2px 0px 0px var(--shadow-color)', backgroundColor: 'var(--accent-yellow)' }} title="Edit">
                              <Edit3 size={14} />
                            </button>
                            <button onClick={() => expense.id && setDeletingId(expense.id)} className="nb-button pink" style={{ padding: '6px 12px', fontSize: '0.8rem', boxShadow: '2px 2px 0px 0px var(--shadow-color)' }} title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer style={{ marginTop: '48px', borderTop: '4px solid var(--border-color)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <p style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.85rem' }}>
           Built with love 💗
        </p>
        <p style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.85rem' }}>
          SpendTime © 2026
        </p>
      </footer>

      {/* MODAL: Add/Edit Form Overlay */}
      {isFormOpen && (
        <div className="modal-overlay" onClick={() => { setIsFormOpen(false); setEditingExpense(null); }}>
          <div className="modal-content" style={{ maxWidth: '500px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <ExpenseForm
              initialExpense={editingExpense}
              onSave={handleSaveExpense}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingExpense(null);
              }}
            />
          </div>
        </div>
      )}

      {/* MODAL: Delete Confirmation */}
      {deletingId && (
        <div className="modal-overlay" onClick={() => setDeletingId(null)}>
          <div className="modal-content nb-card" style={{ maxWidth: '400px', width: '100%', backgroundColor: 'var(--card-bg)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '12px' }}>
              Delete Expense?
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '24px' }}>
              This action cannot be undone. Are you sure you want to delete this record from the ledger?
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleDeleteExpense} className="nb-button pink" style={{ flex: 1 }}>
                Delete
              </button>
              <button onClick={() => setDeletingId(null)} className="nb-button" style={{ flex: 1 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Expense Details View */}
      {viewingExpense && (
        <div className="modal-overlay" onClick={() => setViewingExpense(null)}>
          <div className="modal-content nb-card" style={{ maxWidth: '480px', width: '100%', backgroundColor: 'var(--card-bg)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 900, textTransform: 'uppercase' }}>
                🔍 Expense Details
              </h3>
              <button onClick={() => setViewingExpense(null)} className="nb-button" style={{ padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontWeight: 700 }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Title</span>
                <p style={{ fontSize: '1.2rem', fontWeight: 900 }}>{viewingExpense.title}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Category</span>
                  <div>
                    <span className="badge" style={{ backgroundColor: CATEGORY_COLORS[viewingExpense.category] || '#6c757d', color: '#000', marginTop: '4px' }}>
                      {viewingExpense.category}
                    </span>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Amount</span>
                  <p style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--accent-green)' }}>${viewingExpense.amount.toFixed(2)}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Transaction Date</span>
                  <p style={{ fontSize: '1rem', fontWeight: 800 }}>{viewingExpense.date}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>System Timestamp</span>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    {viewingExpense.created_at ? new Date(viewingExpense.created_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
            
            <button onClick={() => setViewingExpense(null)} className="nb-button yellow" style={{ width: '100%', marginTop: '24px' }}>
              Close View
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
