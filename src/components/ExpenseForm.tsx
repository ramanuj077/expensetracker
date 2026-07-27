import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';

export interface Expense {
  id?: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  created_at?: string;
}

interface ExpenseFormProps {
  initialExpense?: Expense | null;
  onSave: (expense: Omit<Expense, 'id'> & { id?: string }) => Promise<void>;
  onCancel: () => void;
}

const CATEGORIES = ['Food', 'Utilities', 'Entertainment', 'Transport', 'Healthcare', 'Shopping', 'Others'];

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ initialExpense, onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close form on Esc press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  useEffect(() => {
    if (initialExpense) {
      setTitle(initialExpense.title);
      setAmount(initialExpense.amount.toString());
      setCategory(initialExpense.category);
      setDate(initialExpense.date);
    }
  }, [initialExpense]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Title is required.');
      return;
    }

    // Title validation: Prevent only digits/symbols
    if (!/[a-zA-Z]/.test(trimmedTitle)) {
      setError('Title must contain at least one alphabetical letter (no pure numbers/symbols).');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be a positive number.');
      return;
    }

    if (!date) {
      setError('Date is required.');
      return;
    }

    setLoading(true);
    try {
      await onSave({
        id: initialExpense?.id,
        title: trimmedTitle,
        amount: parsedAmount,
        category,
        date,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to save expense.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nb-card" style={{ width: '100%' }}>
      <h3 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '20px', textTransform: 'uppercase' }}>
        {initialExpense ? '✏️ Edit Expense' : '➕ Add Expense'}
      </h3>

      {error && (
        <div className="nb-border" style={{ backgroundColor: 'var(--accent-pink)', padding: '10px', fontWeight: 800, marginBottom: '16px', color: '#000000' }}>
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 800, marginBottom: '6px', textTransform: 'uppercase' }}>Expense Title</label>
          <input
            type="text"
            className="nb-input"
            placeholder="e.g. Grocery Shopping"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 800, marginBottom: '6px', textTransform: 'uppercase' }}>Amount ($)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="nb-input"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 800, marginBottom: '6px', textTransform: 'uppercase' }}>Date</label>
            <input
              type="date"
              className="nb-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 800, marginBottom: '6px', textTransform: 'uppercase' }}>Category</label>
          <select
            className="nb-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ appearance: 'none', cursor: 'pointer' }}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          <button type="submit" disabled={loading} className="nb-button green" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Check size={18} />
            <span>{loading ? 'Saving...' : 'Save'}</span>
          </button>
          <button type="button" onClick={onCancel} className="nb-button" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <X size={18} />
            <span>Cancel</span>
          </button>
        </div>
      </form>
    </div>
  );
};
