import { Filter, ArrowUpDown, Search } from 'lucide-react';

export interface FilterState {
  difficulty: string;
  groupFilter: 'All' | 'Grouped' | 'Ungrouped';
  hasClip: boolean;
  searchQuery: string;
}

interface GoldFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  sortBy: 'name' | 'date' | 'difficulty' | 'attempts';
  onSortChange: (sortBy: 'name' | 'date' | 'difficulty' | 'attempts') => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (order: 'asc' | 'desc') => void;
}

export function GoldFilters({
  filters,
  onFiltersChange,
  sortBy,
  onSortChange,
  sortOrder,
  onSortOrderChange,
}: GoldFiltersProps) {
  return (
    <div className="filters">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <Filter size={18} color="var(--accent)" />
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.02em' }}>Filters & Sorting</h3>
      </div>

      <div className="filters-grid">
        {/* Difficulty */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Difficulty</label>
          <select
            value={filters.difficulty}
            onChange={(e) => onFiltersChange({ ...filters, difficulty: e.target.value })}
            className="form-select"
          >
            <option value="All">All Difficulties</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
            <option value="Expert">Expert</option>
            <option value="GM (All)">GM (All Grandmaster)</option>
            <option value="GM">GM</option>
            <option value="GM+1">GM+1</option>
            <option value="GM+2">GM+2</option>
            <option value="GM+3">GM+3</option>
          </select>
        </div>

        {/* Group Filter */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Group / Standalone</label>
          <select
            value={filters.groupFilter}
            onChange={(e) => onFiltersChange({ ...filters, groupFilter: e.target.value as any })}
            className="form-select"
          >
            <option value="All">All Levels</option>
            <option value="Grouped">In a Group</option>
            <option value="Ungrouped">Not in a Group</option>
          </select>
        </div>

        {/* Sort By */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as any)}
            className="form-select"
          >
            <option value="date">Date</option>
            <option value="name">Name</option>
            <option value="difficulty">Difficulty</option>
            <option value="attempts">Attempts</option>
          </select>
        </div>

        {/* Sort Direction */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Direction</label>
          <button
            onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'center', height: '42px' }}
          >
            <ArrowUpDown size={15} />
            {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          </button>
        </div>
      </div>

      {/* Search and Checkboxes */}
      <div style={{ marginTop: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 250px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '0.9rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)',
            }}
          />
          <input
            type="text"
            placeholder="Search goldens (e.g. 7a, 1c)..."
            value={filters.searchQuery}
            onChange={(e) => onFiltersChange({ ...filters, searchQuery: e.target.value })}
            className="form-input"
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>

        <label className="form-checkbox" style={{ marginBottom: 0 }}>
          <input
            type="checkbox"
            checked={filters.hasClip}
            onChange={(e) => onFiltersChange({ ...filters, hasClip: e.target.checked })}
          />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Has Video Clip</span>
        </label>
      </div>
    </div>
  );
}
