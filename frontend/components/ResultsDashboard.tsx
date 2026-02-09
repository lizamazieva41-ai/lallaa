/**
 * Results Dashboard Component
 * Displays generated cards in table format with statistics and export functionality
 */

import React, { useState, useMemo } from 'react';
import './ResultsDashboard.css';

export interface GeneratedCard {
  cardNumber: string;
  bin: string;
  expiryDate: string;
  cvv: string;
  bankName?: string;
  country?: string;
  cardType?: string;
  uniquenessStatus?: 'unique' | 'verified' | 'pending';
  generationTime?: string;
}

interface ResultsDashboardProps {
  cards: GeneratedCard[];
  isLoading?: boolean;
  jobId?: string; // For async jobs
  jobProgress?: number; // 0-100
  onExport?: (format: 'json' | 'csv' | 'excel') => void;
  onClear?: () => void;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
  cards,
  isLoading = false,
  jobId,
  jobProgress,
  onExport,
  onClear,
}) => {
  const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ field: keyof GeneratedCard; direction: 'asc' | 'desc' } | null>(null);
  const [filterText, setFilterText] = useState('');

  // Statistics
  const stats = useMemo(() => {
    const uniqueBins = new Set(cards.map((c) => c.bin)).size;
    const uniqueCountries = new Set(cards.filter((c) => c.country).map((c) => c.country!)).size;
    const uniqueCards = cards.filter((c) => c.uniquenessStatus === 'unique' || c.uniquenessStatus === 'verified').length;

    return {
      total: cards.length,
      uniqueBins,
      uniqueCountries,
      uniqueCards,
      uniquenessRate: cards.length > 0 ? (uniqueCards / cards.length) * 100 : 0,
    };
  }, [cards]);

  // Filtered and sorted cards
  const processedCards = useMemo(() => {
    let filtered = cards;

    // Apply text filter
    if (filterText) {
      const lowerFilter = filterText.toLowerCase();
      filtered = filtered.filter(
        (card) =>
          card.cardNumber.toLowerCase().includes(lowerFilter) ||
          card.bin.toLowerCase().includes(lowerFilter) ||
          card.expiryDate.toLowerCase().includes(lowerFilter) ||
          card.bankName?.toLowerCase().includes(lowerFilter) ||
          card.country?.toLowerCase().includes(lowerFilter)
      );
    }

    // Apply sorting
    if (sortConfig) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortConfig.field];
        const bValue = b[sortConfig.field];

        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        return sortConfig.direction === 'asc'
          ? (aValue as any) - (bValue as any)
          : (bValue as any) - (aValue as any);
      });
    }

    return filtered;
  }, [cards, filterText, sortConfig]);

  const handleSort = (field: keyof GeneratedCard) => {
    setSortConfig((prev) => {
      if (prev?.field === field) {
        return {
          field,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return { field, direction: 'asc' };
    });
  };

  const handleSelectAll = () => {
    if (selectedCards.size === processedCards.length) {
      setSelectedCards(new Set());
    } else {
      setSelectedCards(new Set(processedCards.map((_, index) => index)));
    }
  };

  const handleSelectCard = (index: number) => {
    setSelectedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleExport = (format: 'json' | 'csv' | 'excel') => {
    if (onExport) {
      onExport(format);
    } else {
      // Default export implementation
      const cardsToExport = selectedCards.size > 0
        ? Array.from(selectedCards).map((index) => processedCards[index])
        : processedCards;

      if (format === 'json') {
        const dataStr = JSON.stringify(cardsToExport, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `cards-${Date.now()}.json`;
        link.click();
      } else if (format === 'csv') {
        const headers = ['Card Number', 'BIN', 'Expiry Date', 'CVV', 'Bank Name', 'Country', 'Card Type'];
        const rows = cardsToExport.map((card) => [
          card.cardNumber,
          card.bin,
          card.expiryDate,
          card.cvv,
          card.bankName || '',
          card.country || '',
          card.cardType || '',
        ]);
        const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
        const dataBlob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `cards-${Date.now()}.csv`;
        link.click();
      }
    }
  };

  const formatCardNumber = (cardNumber: string): string => {
    // Format as XXXX XXXX XXXX XXXX
    return cardNumber.replace(/(\d{4})/g, '$1 ').trim();
  };

  return (
    <div className="results-dashboard">
      <div className="dashboard-header">
        <h2>Generated Cards</h2>
        <div className="header-actions">
          {onClear && (
            <button onClick={onClear} className="btn-secondary">
              Clear Results
            </button>
          )}
          <div className="export-buttons">
            <button onClick={() => handleExport('json')} className="btn-export" disabled={cards.length === 0}>
              Export JSON
            </button>
            <button onClick={() => handleExport('csv')} className="btn-export" disabled={cards.length === 0}>
              Export CSV
            </button>
            <button onClick={() => handleExport('excel')} className="btn-export" disabled={cards.length === 0}>
              Export Excel
            </button>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="statistics">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Cards</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.uniqueCards}</div>
          <div className="stat-label">Unique Cards</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.uniqueBins}</div>
          <div className="stat-label">Unique BINs</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.uniqueCountries}</div>
          <div className="stat-label">Countries</div>
        </div>
        <div className="stat-card highlight">
          <div className="stat-value">{stats.uniquenessRate.toFixed(1)}%</div>
          <div className="stat-label">Uniqueness Rate</div>
        </div>
      </div>

      {/* Job Progress (for async jobs) */}
      {jobId && jobProgress !== undefined && (
        <div className="job-progress">
          <div className="progress-header">
            <span>Job Progress: {jobId}</span>
            <span>{jobProgress}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${jobProgress}%` }}></div>
          </div>
        </div>
      )}

      {/* Search/Filter */}
      <div className="search-filter">
        <input
          type="text"
          placeholder="Search cards by number, BIN, expiry, bank, or country..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="search-input"
        />
        {filterText && (
          <button onClick={() => setFilterText('')} className="clear-filter">
            Clear
          </button>
        )}
      </div>

      {/* Cards Table */}
      <div className="table-container">
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading cards...</p>
          </div>
        ) : processedCards.length === 0 ? (
          <div className="empty-state">
            <p>No cards generated yet. Use the form above to generate cards.</p>
          </div>
        ) : (
          <table className="cards-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedCards.size === processedCards.length && processedCards.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th onClick={() => handleSort('cardNumber')} className="sortable">
                  Card Number {sortConfig?.field === 'cardNumber' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('bin')} className="sortable">
                  BIN {sortConfig?.field === 'bin' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('expiryDate')} className="sortable">
                  Expiry {sortConfig?.field === 'expiryDate' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('cvv')} className="sortable">
                  CVV {sortConfig?.field === 'cvv' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('bankName')} className="sortable">
                  Bank {sortConfig?.field === 'bankName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('country')} className="sortable">
                  Country {sortConfig?.field === 'country' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th>Uniqueness</th>
              </tr>
            </thead>
            <tbody>
              {processedCards.map((card, index) => (
                <tr key={index} className={selectedCards.has(index) ? 'selected' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedCards.has(index)}
                      onChange={() => handleSelectCard(index)}
                    />
                  </td>
                  <td className="card-number">{formatCardNumber(card.cardNumber)}</td>
                  <td>{card.bin}</td>
                  <td>{card.expiryDate}</td>
                  <td>{card.cvv}</td>
                  <td>{card.bankName || '-'}</td>
                  <td>{card.country || '-'}</td>
                  <td>
                    <span className={`uniqueness-badge ${card.uniquenessStatus || 'pending'}`}>
                      {card.uniquenessStatus === 'unique' ? '✓ Unique' : card.uniquenessStatus === 'verified' ? '✓ Verified' : 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Info */}
      {processedCards.length > 0 && (
        <div className="pagination-info">
          Showing {processedCards.length} of {cards.length} cards
          {filterText && ` (filtered)`}
        </div>
      )}
    </div>
  );
};

export default ResultsDashboard;
