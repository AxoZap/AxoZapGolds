import { useState } from 'react';
import { Lock, X, KeyRound } from 'lucide-react';
import { setStoredAdminPassword } from '../adminAuth';

interface AdminLoginModalProps {
  onSuccess: () => void;
  onCancel: () => void;
  apiUrl: string;
}

export function AdminLoginModal({ onSuccess, onCancel, apiUrl }: AdminLoginModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter a password');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      const res = await fetch(`${apiUrl}/admin/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password.trim(),
        },
      });

      if (res.ok) {
        setStoredAdminPassword(password.trim());
        onSuccess();
      } else {
        setError('Incorrect admin password');
      }
    } catch (err) {
      setError('Failed to reach backend server');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lock size={20} color="var(--accent)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Admin Login</h2>
          </div>
          <button
            onClick={onCancel}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          If accessing outside Cloudflare Zero Trust, enter the admin password to unlock management features.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <KeyRound
                size={16}
                style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="Enter admin password..."
                autoFocus
              />
            </div>
            {error && <p style={{ color: 'var(--red)', fontSize: '0.8rem', marginTop: '0.35rem' }}>{error}</p>}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={verifying}>
              {verifying ? 'Verifying...' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
