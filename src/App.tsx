import { useState, useEffect, useMemo } from 'react';
import { GoldList } from './components/GoldList';
import { GoldFilters, FilterState } from './components/GoldFilters';
import { AddGoldModal } from './components/AddGoldModal';
import { EditGoldModal } from './components/EditGoldModal';
import { adminHeaders, getCFAccessToken } from './adminAuth';
import { Sparkles, Plus, Unlock, Loader2 } from 'lucide-react';

export interface Gold {
  id?: number | string;
  placement?: number;
  name: string;
  difficulty: string;
  date: string;
  attempts?: number | null;
  clip?: string | null;
  hidden?: boolean;
  group_name?: string | null;
  completed?: boolean;
  created_at?: string;
}

const API_URL = "https://axozap-golds-backend.peteystillwell.workers.dev/api";

export default function App() {
  // Check if current URL path is /admin or /Admin (protected by Cloudflare Zero Trust)
  const isAdmin = typeof window !== 'undefined' && window.location.pathname.toLowerCase().startsWith('/admin');

  const [golds, setGolds] = useState<Gold[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGold, setEditingGold] = useState<Gold | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    difficulty: 'All',
    groupFilter: 'All',
    hasClip: false,
    searchQuery: '',
  });

  const [sortBy, setSortBy] = useState<'name' | 'date' | 'difficulty' | 'attempts'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadGolds();
  }, []);

  const loadGolds = async () => {
    try {
      setLoading(true);
      const headers: Record<string, string> = {};
      if (isAdmin) {
        const token = getCFAccessToken();
        if (token) headers['cf-access-jwt-assertion'] = token;
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
        alert(err.error || 'Failed to add golden strawberry.');
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

  // Filter and Sort Logic
  const filteredGolds = useMemo(() => {
    return golds
      .filter((gold) => {
        // Difficulty filter
        if (filters.difficulty !== 'All') {
          if (filters.difficulty === 'GM (All)') {
            if (!gold.difficulty.toUpperCase().startsWith('GM')) return false;
          } else if (gold.difficulty.toLowerCase() !== filters.difficulty.toLowerCase()) {
            return false;
          }
        }

        // Group filter (All, In a Group, Not in a Group)
        if (filters.groupFilter === 'Grouped') {
          if (!gold.group_name || !gold.group_name.trim()) return false;
        } else if (filters.groupFilter === 'Ungrouped') {
          if (gold.group_name && gold.group_name.trim()) return false;
        }

        // Clip filter
        if (filters.hasClip && !gold.clip) {
          return false;
        }

        // Search query
        if (filters.searchQuery.trim()) {
          const q = filters.searchQuery.toLowerCase().trim();
          const matchesName = gold.name.toLowerCase().includes(q);
          const matchesGroup = (gold.group_name || '').toLowerCase().includes(q);
          const matchesDate = gold.date.toLowerCase().includes(q);
          const matchesDiff = gold.difficulty.toLowerCase().includes(q);
          if (!matchesName && !matchesGroup && !matchesDate && !matchesDiff) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'name') {
          diff = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        } else if (sortBy === 'date') {
          if (a.date.toLowerCase() === 'initial' && b.date.toLowerCase() !== 'initial') return -1;
          if (b.date.toLowerCase() === 'initial' && a.date.toLowerCase() !== 'initial') return 1;
          diff = a.date.localeCompare(b.date);
        } else if (sortBy === 'attempts') {
          diff = (a.attempts || 0) - (b.attempts || 0);
        } else if (sortBy === 'difficulty') {
          const getDiffScore = (raw: string) => {
            const s = (raw || '').trim().toLowerCase();
            if (s.startsWith('beg')) return 10;
            if (s.startsWith('int')) return 20;
            if (s.startsWith('adv')) return 30;
            if (s.startsWith('exp')) return 40;
            if (s.startsWith('gm')) {
              const num = parseInt(s.replace(/[^0-9]/g, ''), 10);
              return 50 + (isNaN(num) ? 0 : num);
            }
            return 0;
          };
          diff = getDiffScore(a.difficulty) - getDiffScore(b.difficulty);
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

      {/* Admin Action Bar (only shown on /admin) */}
      {isAdmin && (
        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '1.25rem' }}>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            <Plus size={18} />
            Add Golden
          </button>
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddGoldModal
          onAdd={handleAddGold}
          onCancel={() => setShowAddModal(false)}
          existingGroups={Array.from(new Set(golds.map((g) => g.group_name?.trim()).filter(Boolean) as string[]))}
        />
      )}

      {editingGold && (
        <EditGoldModal
          gold={editingGold}
          onSave={handleSaveEdit}
          onCancel={() => setEditingGold(null)}
          existingGroups={Array.from(new Set(golds.map((g) => g.group_name?.trim()).filter(Boolean) as string[]))}
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
        />
      )}
    </div>
  );
}
