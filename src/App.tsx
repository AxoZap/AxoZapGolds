import { useState, useEffect, useMemo } from 'react';
import { GoldList } from './components/GoldList';
import { GoldFilters, FilterState } from './components/GoldFilters';
import { AddGoldModal } from './components/AddGoldModal';
import { EditGoldModal } from './components/EditGoldModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { adminHeaders, getCFAccessToken, getStoredAdminPassword, setStoredAdminPassword } from './adminAuth';
import { Sparkles, Plus, Lock, Unlock, Loader2 } from 'lucide-react';

export interface Gold {
  id?: number | string;
  placement?: number;
  name: string;
  difficulty: string;
  date: string;
  attempts?: number | null;
  clip?: string | null;
  hidden?: boolean;
  created_at?: string;
}

const API_URL = "https://axozap-golds-backend.peteystillwell.workers.dev/api";

export default function App() {
  const isUrlAdmin = typeof window !== 'undefined' && window.location.pathname.toLowerCase().startsWith('/admin');
  const [isAdmin, setIsAdmin] = useState(isUrlAdmin || !!getCFAccessToken() || !!getStoredAdminPassword());

  const [golds, setGolds] = useState<Gold[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGold, setEditingGold] = useState<Gold | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    difficulty: 'All',
    side: 'All',
    hasClip: false,
    searchQuery: '',
  });

  const [sortBy, setSortBy] = useState<'order' | 'name' | 'date' | 'difficulty' | 'attempts'>('order');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showFilteredRanks, setShowFilteredRanks] = useState(false);

  useEffect(() => {
    loadGolds();
  }, [isAdmin]);

  const loadGolds = async () => {
    try {
      setLoading(true);
      const headers: Record<string, string> = {};
      if (isAdmin) {
        const cfToken = getCFAccessToken();
        if (cfToken) headers['cf-access-jwt-assertion'] = cfToken;
        const pw = getStoredAdminPassword();
        if (pw) headers['x-admin-password'] = pw;
      }

      const response = await fetch(`${API_URL}/golds`, { headers });
      if (response.ok) {
        const data = await response.json();
        setGolds(data);
      } else {
        console.error('Failed to load golds:', await response.text());
      }
    } catch (error) {
      console.error('Error loading golds:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddGold = async (gold: Omit<Gold, 'id'>) => {
    try {
      const response = await fetch(`${API_URL}/golds`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ gold }),
      });

      if (response.ok) {
        const newGold = await response.json();
        setGolds([...golds, newGold]);
        setShowAddModal(false);
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to add golden strawberry. Please check admin permissions.');
      }
    } catch (error) {
      console.error('Error adding gold:', error);
      alert('Failed to add golden strawberry. Please try again.');
    }
  };

  const handleSaveEdit = async (updatedGold: Gold) => {
    try {
      const response = await fetch(`${API_URL}/golds/${updatedGold.id}`, {
        method: 'PUT',
        headers: adminHeaders(),
        body: JSON.stringify({ gold: updatedGold }),
      });

      if (response.ok) {
        const saved = await response.json();
        setGolds(golds.map((g) => (g.id === saved.id ? saved : g)));
        setEditingGold(null);
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to update gold.');
      }
    } catch (error) {
      console.error('Error updating gold:', error);
      alert('Failed to update gold.');
    }
  };

  const handleDeleteGold = async (id: string | number) => {
    if (!isAdmin) {
      alert('You must be in Admin mode to delete.');
      return;
    }

    if (!confirm('Are you sure you want to delete this golden strawberry?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/golds/${id}`, {
        method: 'DELETE',
        headers: adminHeaders(),
      });

      if (response.ok) {
        setGolds(golds.filter((g) => g.id !== id));
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to delete gold.');
      }
    } catch (error) {
      console.error('Error deleting gold:', error);
      alert('Failed to delete gold.');
    }
  };

  const handleLogout = () => {
    setStoredAdminPassword(null);
    setIsAdmin(false);
    if (isUrlAdmin) {
      window.location.href = '/';
    }
  };

  // Filter and Sort Logic
  const filteredGolds = useMemo(() => {
    return golds
      .filter((gold) => {
        // Difficulty filter
        if (filters.difficulty !== 'All' && gold.difficulty.toLowerCase() !== filters.difficulty.toLowerCase()) {
          return false;
        }

        // Side filter (A, B, C)
        if (filters.side !== 'All') {
          const nameLower = gold.name.toLowerCase();
          const targetSide = filters.side.toLowerCase();
          if (!nameLower.endsWith(targetSide)) {
            return false;
          }
        }

        // Clip filter
        if (filters.hasClip && !gold.clip) {
          return false;
        }

        // Search query
        if (filters.searchQuery.trim()) {
          const q = filters.searchQuery.toLowerCase().trim();
          const matchesName = gold.name.toLowerCase().includes(q);
          const matchesDate = gold.date.toLowerCase().includes(q);
          const matchesDiff = gold.difficulty.toLowerCase().includes(q);
          if (!matchesName && !matchesDate && !matchesDiff) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'order') {
          diff = (a.placement || 0) - (b.placement || 0);
        } else if (sortBy === 'name') {
          diff = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        } else if (sortBy === 'date') {
          if (a.date.toLowerCase() === 'initial') return -1;
          if (b.date.toLowerCase() === 'initial') return 1;
          diff = a.date.localeCompare(b.date);
        } else if (sortBy === 'attempts') {
          diff = (a.attempts || 0) - (b.attempts || 0);
        } else if (sortBy === 'difficulty') {
          const diffRank: Record<string, number> = {
            easy: 1,
            medium: 2,
            hard: 3,
            insane: 4,
            extreme: 5,
          };
          const rA = diffRank[a.difficulty.toLowerCase()] || 0;
          const rB = diffRank[b.difficulty.toLowerCase()] || 0;
          diff = rA - rB;
        }

        return sortOrder === 'asc' ? diff : -diff;
      });
  }, [golds, filters, sortBy, sortOrder]);

  return (
    <div className="container">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <Sparkles size={36} className="logo-icon" />
          <h1>AxoZap's Golds</h1>
          {isAdmin && (
            <span className="admin-pill">
              <Unlock size={12} /> Admin
            </span>
          )}
        </div>
        <p className="subtitle">Celeste Golden Strawberries</p>
      </header>

      {/* Admin Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {isAdmin && (
            <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
              <Plus size={18} />
              Add Golden
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isAdmin ? (
            <button onClick={handleLogout} className="btn btn-secondary btn-sm" title="Log out of Admin">
              <Lock size={14} /> Exit Admin
            </button>
          ) : (
            <button onClick={() => setShowLoginModal(true)} className="btn btn-secondary btn-sm" title="Admin Login">
              <Lock size={14} /> Admin
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddGoldModal onAdd={handleAddGold} onCancel={() => setShowAddModal(false)} />
      )}

      {editingGold && (
        <EditGoldModal gold={editingGold} onSave={handleSaveEdit} onCancel={() => setEditingGold(null)} />
      )}

      {showLoginModal && (
        <AdminLoginModal
          apiUrl={API_URL}
          onSuccess={() => {
            setIsAdmin(true);
            setShowLoginModal(false);
          }}
          onCancel={() => setShowLoginModal(false)}
        />
      )}

      {/* Filters and Sorting */}
      <GoldFilters
        filters={filters}
        onFiltersChange={setFilters}
        sortBy={sortBy}
        onSortChange={setSortBy}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
      />

      {/* Counter */}
      <div style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem' }}>
        Showing {filteredGolds.length} golden strawberr{filteredGolds.length === 1 ? 'y' : 'ies'}
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary)' }}>
          <Loader2 size={40} className="loading-spinner" style={{ margin: '0 auto 1rem', color: 'var(--accent)' }} />
          <p style={{ fontWeight: 600 }}>Loading golden strawberries...</p>
        </div>
      ) : (
        <GoldList
          golds={filteredGolds}
          allGolds={golds}
          onDelete={handleDeleteGold}
          onEdit={(gold) => setEditingGold(gold)}
          isAdmin={isAdmin}
          showFilteredRanks={showFilteredRanks}
          onToggleRanks={() => setShowFilteredRanks((prev) => !prev)}
        />
      )}
    </div>
  );
}
