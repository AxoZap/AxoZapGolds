import { useState } from 'react';
import { Gold } from '../App';
import { Plus, X } from 'lucide-react';

interface AddGoldModalProps {
  onAdd: (gold: Omit<Gold, 'id'>) => void;
  onCancel: () => void;
}

export function AddGoldModal({ onAdd, onCancel }: AddGoldModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    difficulty: 'Medium',
    date: 'Initial',
    attempts: '',
    clip: '',
    hidden: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) {
      errs.name = 'Name is required (e.g. 7c, 6b)';
    }
    if (formData.attempts && (isNaN(Number(formData.attempts)) || Number(formData.attempts) < 0)) {
      errs.attempts = 'Attempts must be a non-negative number';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      const attemptsNum =
        formData.attempts.trim() === '' ? null : Number(formData.attempts);

      onAdd({
        name: formData.name.trim(),
        difficulty: formData.difficulty,
        date: formData.date.trim() || 'Initial',
        attempts: attemptsNum,
        clip: formData.clip.trim() || null,
        hidden: formData.hidden,
      });
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={22} color="var(--accent)" />
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Add New Golden Strawberry</h2>
          </div>
          <button
            onClick={onCancel}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            {/* Name */}
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="form-input"
                placeholder="e.g. 7a, 7b, 1c"
                autoFocus
              />
              {errors.name && <p style={{ color: 'var(--red)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.name}</p>}
            </div>

            {/* Difficulty */}
            <div className="form-group">
              <label className="form-label">Difficulty</label>
              <select
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                className="form-select"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
                <option value="Insane">Insane</option>
                <option value="Extreme">Extreme</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            {/* Date */}
            <div className="form-group">
              <label className="form-label">Date (or Initial)</label>
              <input
                type="text"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="form-input"
                placeholder="Initial or YYYY-MM-DD"
              />
            </div>

            {/* Attempts */}
            <div className="form-group">
              <label className="form-label">Attempts (Optional / Blank)</label>
              <input
                type="number"
                min="0"
                value={formData.attempts}
                onChange={(e) => setFormData({ ...formData, attempts: e.target.value })}
                className="form-input"
                placeholder="Leave blank if uncounted"
              />
              {errors.attempts && <p style={{ color: 'var(--red)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.attempts}</p>}
            </div>
          </div>

          {/* Clip */}
          <div className="form-group">
            <label className="form-label">YouTube Clip / Video URL (Optional)</label>
            <input
              type="url"
              value={formData.clip}
              onChange={(e) => setFormData({ ...formData, clip: e.target.value })}
              className="form-input"
              placeholder="https://youtu.be/..."
            />
          </div>

          {/* Hidden */}
          <div className="form-group">
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={formData.hidden}
                onChange={(e) => setFormData({ ...formData, hidden: e.target.checked })}
              />
              <span style={{ color: formData.hidden ? 'var(--red)' : 'var(--text-primary)', fontWeight: 600 }}>
                Hidden (only visible to admin)
              </span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Add Golden
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
