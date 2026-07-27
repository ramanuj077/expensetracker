import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Expense } from './ExpenseForm';
import { ExpenseForm } from './ExpenseForm';
import { LogOut, Sun, Moon, Plus, Trash2, Edit3, DollarSign, Calendar, Search } from 'lucide-react';

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

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    fetchExpenses();
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
      result = result.filter((e) => e.title.toLowerCase().includes(q));
    }
    setFilteredExpenses(result);
  }, [expenses, selectedMonth, selectedCategory, searchQuery]);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
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
      }

      setIsFormOpen(false);
      setEditingExpense(null);
      await fetchExpenses();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to save transaction');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      const { error: deleteErr } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (deleteErr) throw deleteErr;
      await fetchExpenses();
    } catch (err: any) {
      setError(err.message || 'Failed to delete expense.');
    }
  };

  const handleEditClick = (expense: Expense) => {
    setEditingExpense(expense);
    setIsFormOpen(true);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onSignOut();
  };

  // Get unique months list for filter
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const monthsInExpenses = expenses.map((e) => e.date.slice(0, 7));
  const uniqueMonths = Array.from(new Set([currentMonthStr, ...monthsInExpenses])).sort((a, b) => b.localeCompare(a));

  // Compute stats for current selected month/period
  const totalPeriodSpending = expenses
    .filter((e) => selectedMonth === 'All' || e.date.startsWith(selectedMonth))
    .reduce((sum, e) => sum + e.amount, 0);

  // Compute category breakdown for the selected month/period
  const categoryBreakdown = expenses
    .filter((e) => selectedMonth === 'All' || e.date.startsWith(selectedMonth))
    .reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);

  const sortedBreakdown = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]);

  const categories = ['All', 'Food', 'Utilities', 'Entertainment', 'Transport', 'Healthcare', 'Shopping', 'Others'];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      {/* Header section */}
      <header className="nb-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '32px', backgroundColor: 'var(--accent-yellow)' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1, color: '#000' }}>
            SpendTime
          </h1>
          <p style={{ fontWeight: 800, textTransform: 'uppercase', color: '#000', fontSize: '0.9rem', marginTop: '4px' }}>
            Neo-Brutalist Expense tracker
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={toggleTheme} className="nb-button" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }} title="Toggle Theme">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <button onClick={handleSignOut} className="nb-button pink" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        {/* Top Summary & Budget breakdown Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {/* Spend Summary */}
          <div className="nb-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: 'var(--accent-green)', color: '#000000' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '0.9rem' }}>
                  Total Spending ({formatMonthLabel(selectedMonth)})
                </p>
                <h2 style={{ fontSize: '3rem', fontWeight: 900, margin: '8px 0' }}>
                  ${totalPeriodSpending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
              </div>
              <div style={{ border: '4px solid #000', padding: '12px', background: '#fff', borderRadius: '0px' }}>
                <DollarSign size={32} />
              </div>
            </div>
            <p style={{ fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', opacity: 0.8 }}>
              Filter by month below to see historical data.
            </p>
          </div>

          {/* Budget Breakdown Progress bars */}
          <div className="nb-card" style={{ backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '16px' }}>
              📊 Budget breakdown
            </h3>
            {sortedBreakdown.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>No expenses recorded in this period.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sortedBreakdown.map(([cat, amt]) => {
                  const percent = Math.min(100, totalPeriodSpending > 0 ? (amt / totalPeriodSpending) * 100 : 0);
                  const catColor = CATEGORY_COLORS[cat] || '#6c757d';
                  return (
                    <div key={cat}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '4px' }}>
                        <span>{cat}</span>
                        <span>${amt.toFixed(2)} ({percent.toFixed(0)}%)</span>
                      </div>
                      <div className="nb-border" style={{ height: '14px', backgroundColor: 'var(--bg-primary)', overflow: 'hidden', padding: 0 }}>
                        <div style={{ width: `${percent}%`, height: '100%', backgroundColor: catColor, borderRight: percent > 0 ? '3px solid var(--border-color)' : 'none' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Action Controls Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          {/* Filters and Search Container */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
            {/* Title Search */}
            <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '16px', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Search expense title..."
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
          >
            <Plus size={20} />
            <span>Add Expense</span>
          </button>
        </div>

        {/* Modal Overlay for Add/Edit Form */}
        {isFormOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '16px'
          }}>
            <div style={{ maxWidth: '500px', width: '100%' }}>
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
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>
              No expenses recorded. Try adding some or clearing filters!
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
                            <button onClick={() => handleEditClick(expense)} className="nb-button" style={{ padding: '6px 12px', fontSize: '0.8rem', boxShadow: '2px 2px 0px 0px var(--shadow-color)' }}>
                              <Edit3 size={14} />
                            </button>
                            <button onClick={() => expense.id && handleDeleteExpense(expense.id)} className="nb-button pink" style={{ padding: '6px 12px', fontSize: '0.8rem', boxShadow: '2px 2px 0px 0px var(--shadow-color)' }}>
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
    </div>
  );
};
