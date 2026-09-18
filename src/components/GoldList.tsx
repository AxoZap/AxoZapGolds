import { Gold } from '../App';
import { Calendar, Hash, Youtube, Edit3, Trash2, EyeOff } from 'lucide-react';

interface GoldListProps {
  golds: Gold[];
  allGolds: Gold[];
  onDelete: (id: string | number) => void;
  onEdit: (gold: Gold) => void;
  isAdmin: boolean;
  showFilteredRanks: boolean;
  onToggleRanks: () => void;
}

export function GoldList({
  golds,
  allGolds,
  onDelete,
  onEdit,
  isAdmin,
  showFilteredRanks,
  onToggleRanks,
}: GoldListProps) {
  if (golds.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-secondary)' }}>
        <p style={{ fontSize: '1.1rem' }}>No golden strawberries found matching your filters.</p>
      </div>
    );
  }

  const isFiltered = golds.length !== allGolds.length;

  const thStyle: React.CSSProperties = {
    padding: '0.9rem 1.15rem',
    color: 'var(--text-secondary)',
    fontSize: '0.78rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  return (
    <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              {/* Rank */}
              <th style={thStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  Rank
                  {isFiltered && (
                    <button
                      onClick={onToggleRanks}
                      title={showFilteredRanks ? 'Showing filtered ranks — click for original' : 'Showing original ranks — click for filtered'}
                      style={{
                        background: showFilteredRanks ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.06)',
                        border: `1px solid ${showFilteredRanks ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: '4px',
                        padding: '0.1rem 0.35rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'all 0.2s',
                      }}
                    >
                      <Hash size={11} color={showFilteredRanks ? 'var(--accent)' : 'var(--text-secondary)'} />
                    </button>
                  )}
                </div>
              </th>

              {/* Name */}
              <th style={thStyle}>Name</th>

              {/* Difficulty */}
              <th style={thStyle}>Difficulty</th>

              {/* Date */}
              <th style={thStyle}>Date</th>

              {/* Attempts */}
              <th style={{ ...thStyle, textAlign: 'center', width: '110px' }}>Attempts</th>

              {/* Clip */}
              <th style={{ ...thStyle, textAlign: 'center' }}>Clip</th>

              {/* Actions (Admin only) */}
              {isAdmin && <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {golds.map((gold, index) => {
              const isHidden = Boolean(gold.hidden);
              const d = (gold.difficulty || 'beginner').trim().toLowerCase();
              let diffClass = 'tag-beginner';
              if (d.startsWith('gm')) diffClass = 'tag-gm';
              else if (d.startsWith('beg')) diffClass = 'tag-beginner';
              else if (d.startsWith('int')) diffClass = 'tag-intermediate';
              else if (d.startsWith('adv')) diffClass = 'tag-advanced';
              else if (d.startsWith('exp')) diffClass = 'tag-expert';

              return (
                <tr
                  key={gold.id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    transition: 'background 0.15s ease',
                    background: isHidden && isAdmin ? 'rgba(239, 68, 68, 0.05)' : undefined,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      isHidden && isAdmin ? 'rgba(239, 68, 68, 0.09)' : 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      isHidden && isAdmin ? 'rgba(239, 68, 68, 0.05)' : 'transparent';
                  }}
                >
                  {/* Rank */}
                  <td style={{ padding: '0.9rem 1.15rem', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                      #{showFilteredRanks ? index + 1 : (gold.placement || index + 1)}
                    </span>
                  </td>

                  {/* Name */}
                  <td style={{ padding: '0.9rem 1.15rem', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: '1.05rem', letterSpacing: '0.02em' }}>
                        {gold.name}
                      </span>
                      {isHidden && isAdmin && (
                        <span
                          style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            padding: '0.1rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <EyeOff size={11} /> Hidden
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Difficulty */}
                  <td style={{ padding: '0.9rem 1.15rem', whiteSpace: 'nowrap' }}>
                    <span className={`tag ${diffClass}`}>{gold.difficulty}</span>
                  </td>

                  {/* Date */}
                  <td style={{ padding: '0.9rem 1.15rem', whiteSpace: 'nowrap' }}>
                    <span className={`date-badge ${gold.date?.toLowerCase() === 'initial' ? 'initial' : ''}`}>
                      <Calendar size={13} />
                      {gold.date || 'Initial'}
                    </span>
                  </td>

                  {/* Attempts (Smaller box, max like 6 digits size) */}
                  <td style={{ padding: '0.9rem 1.15rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {gold.attempts != null && gold.attempts !== undefined ? (
                      <span
                        style={{
                          display: 'inline-block',
                          minWidth: '3.6rem',
                          maxWidth: '5.2rem',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--border)',
                          padding: '0.2rem 0.45rem',
                          borderRadius: '6px',
                          fontWeight: 700,
                          color: '#fff',
                          fontVariantNumeric: 'tabular-nums',
                          fontSize: '0.85rem',
                          textAlign: 'center',
                        }}
                      >
                        {gold.attempts.toLocaleString()}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', opacity: 0.35 }}>—</span>
                    )}
                  </td>

                  {/* Clip */}
                  <td style={{ padding: '0.9rem 1.15rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {gold.clip ? (
                      <a
                        href={gold.clip}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="clip-icon-link"
                        title="Watch Video"
                      >
                        <Youtube size={19} />
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', opacity: 0.35 }}>—</span>
                    )}
                  </td>

                  {/* Actions (Admin only) */}
                  {isAdmin && (
                    <td style={{ padding: '0.9rem 1.15rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                          onClick={() => onEdit(gold)}
                          className="action-btn"
                          style={{ color: '#84cc16' }}
                          title="Edit"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => onDelete(gold.id!)}
                          className="action-btn"
                          style={{ color: '#ef4444' }}
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
