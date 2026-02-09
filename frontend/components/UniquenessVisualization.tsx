/**
 * Uniqueness Visualization Component
 * Shows uniqueness check status per card and system-wide uniqueness statistics
 */

import React, { useEffect, useState } from 'react';
import './UniquenessVisualization.css';

export interface UniquenessStats {
  totalCards: number;
  uniqueCards: number;
  duplicateCards: number;
  uniquenessRate: number;
  layerStats: {
    layer1: { checked: number; duplicates: number };
    layer2: { checked: number; duplicates: number };
    layer3: { checked: number; duplicates: number };
    layer4: { checked: number; duplicates: number };
    layer5: { checked: number; duplicates: number };
  };
  averageCheckTime: number;
  cacheHitRate: number;
}

export interface CardUniquenessInfo {
  cardNumber: string;
  cardHash: string;
  layersChecked: number[];
  duplicateDetectedAt?: number; // Layer number where duplicate was detected
  checkTime: number; // milliseconds
  status: 'unique' | 'duplicate' | 'pending' | 'verified';
  confidence: number; // 0-100
}

interface UniquenessVisualizationProps {
  cards: CardUniquenessInfo[];
  systemStats?: UniquenessStats;
  realTimeUpdates?: boolean;
}

export const UniquenessVisualization: React.FC<UniquenessVisualizationProps> = ({
  cards,
  systemStats,
  realTimeUpdates = false,
}) => {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [animatedStats, setAnimatedStats] = useState<UniquenessStats | null>(systemStats || null);

  // Calculate stats from cards if not provided
  const calculatedStats: UniquenessStats = systemStats || {
    totalCards: cards.length,
    uniqueCards: cards.filter((c) => c.status === 'unique' || c.status === 'verified').length,
    duplicateCards: cards.filter((c) => c.status === 'duplicate').length,
    uniquenessRate: cards.length > 0
      ? (cards.filter((c) => c.status === 'unique' || c.status === 'verified').length / cards.length) * 100
      : 0,
    layerStats: {
      layer1: { checked: 0, duplicates: 0 },
      layer2: { checked: 0, duplicates: 0 },
      layer3: { checked: 0, duplicates: 0 },
      layer4: { checked: 0, duplicates: 0 },
      layer5: { checked: 0, duplicates: 0 },
    },
    averageCheckTime: cards.length > 0
      ? cards.reduce((sum, c) => sum + c.checkTime, 0) / cards.length
      : 0,
    cacheHitRate: 0,
  };

  useEffect(() => {
    if (realTimeUpdates && systemStats) {
      // Animate stats updates
      setAnimatedStats((prev) => {
        if (!prev) return systemStats;
        // Smooth transition
        return {
          ...systemStats,
          uniquenessRate: prev.uniquenessRate + (systemStats.uniquenessRate - prev.uniquenessRate) * 0.1,
        };
      });
    }
  }, [systemStats, realTimeUpdates]);

  const stats = animatedStats || calculatedStats;

  const getLayerName = (layer: number): string => {
    const names: Record<number, string> = {
      1: 'Composite Unique Constraint',
      2: 'Global Uniqueness Index',
      3: 'Uniqueness Pool',
      4: 'Bloom Filter',
      5: 'Redis Cache',
    };
    return names[layer] || `Layer ${layer}`;
  };

  const getLayerColor = (layer: number): string => {
    const colors: Record<number, string> = {
      1: '#e74c3c',
      2: '#e67e22',
      3: '#f39c12',
      4: '#3498db',
      5: '#2ecc71',
    };
    return colors[layer] || '#95a5a6';
  };

  const selectedCardInfo = cards.find((c) => c.cardHash === selectedCard);

  return (
    <div className="uniqueness-visualization">
      <h2>Uniqueness Analysis</h2>

      {/* System-wide Statistics */}
      <div className="system-stats">
        <div className="stat-grid">
          <div className="stat-item primary">
            <div className="stat-icon">✓</div>
            <div className="stat-content">
              <div className="stat-value">{stats.uniqueCards.toLocaleString()}</div>
              <div className="stat-label">Unique Cards</div>
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <div className="stat-value">{stats.uniquenessRate.toFixed(2)}%</div>
              <div className="stat-label">Uniqueness Rate</div>
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-icon">⚡</div>
            <div className="stat-content">
              <div className="stat-value">{stats.averageCheckTime.toFixed(2)}ms</div>
              <div className="stat-label">Avg Check Time</div>
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-icon">💾</div>
            <div className="stat-content">
              <div className="stat-value">{stats.cacheHitRate.toFixed(1)}%</div>
              <div className="stat-label">Cache Hit Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* 5-Layer Architecture Visualization */}
      <div className="layer-visualization">
        <h3>5-Layer Uniqueness Architecture</h3>
        <div className="layers-container">
          {[1, 2, 3, 4, 5].map((layer) => {
            const layerData = stats.layerStats[`layer${layer}` as keyof typeof stats.layerStats];
            const checked = layerData?.checked || 0;
            const duplicates = layerData?.duplicates || 0;
            const efficiency = checked > 0 ? ((checked - duplicates) / checked) * 100 : 100;

            return (
              <div key={layer} className="layer-item">
                <div className="layer-header">
                  <div className="layer-number" style={{ backgroundColor: getLayerColor(layer) }}>
                    {layer}
                  </div>
                  <div className="layer-info">
                    <div className="layer-name">{getLayerName(layer)}</div>
                    <div className="layer-metrics">
                      <span>Checked: {checked.toLocaleString()}</span>
                      <span>Duplicates: {duplicates.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="layer-bar">
                  <div
                    className="layer-fill"
                    style={{
                      width: `${efficiency}%`,
                      backgroundColor: getLayerColor(layer),
                    }}
                  ></div>
                </div>
                <div className="layer-efficiency">{efficiency.toFixed(1)}% Efficiency</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Card-level Uniqueness Status */}
      <div className="card-uniqueness-list">
        <h3>Card Uniqueness Status</h3>
        <div className="cards-grid">
          {cards.slice(0, 20).map((card, index) => (
            <div
              key={index}
              className={`card-item ${card.status} ${selectedCard === card.cardHash ? 'selected' : ''}`}
              onClick={() => setSelectedCard(card.cardHash)}
            >
              <div className="card-header">
                <div className="card-number-short">{card.cardNumber.substring(0, 6)}...{card.cardNumber.slice(-4)}</div>
                <div className={`status-badge ${card.status}`}>
                  {card.status === 'unique' ? '✓ Unique' : card.status === 'verified' ? '✓ Verified' : card.status === 'duplicate' ? '✗ Duplicate' : '⏳ Pending'}
                </div>
              </div>
              <div className="card-details">
                <div className="confidence-bar">
                  <div
                    className="confidence-fill"
                    style={{
                      width: `${card.confidence}%`,
                      backgroundColor: card.confidence > 80 ? '#2ecc71' : card.confidence > 50 ? '#f39c12' : '#e74c3c',
                    }}
                  ></div>
                </div>
                <div className="confidence-text">Confidence: {card.confidence}%</div>
                <div className="layers-indicator">
                  Layers checked: {card.layersChecked.join(', ')}
                </div>
                {card.duplicateDetectedAt && (
                  <div className="duplicate-info">
                    Duplicate detected at Layer {card.duplicateDetectedAt}
                  </div>
                )}
                <div className="check-time">Check time: {card.checkTime}ms</div>
              </div>
            </div>
          ))}
        </div>
        {cards.length > 20 && (
          <div className="more-cards-indicator">
            +{cards.length - 20} more cards
          </div>
        )}
      </div>

      {/* Selected Card Detail */}
      {selectedCardInfo && (
        <div className="card-detail-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Card Uniqueness Details</h3>
              <button onClick={() => setSelectedCard(null)} className="close-btn">×</button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <label>Card Number:</label>
                <div className="detail-value">{selectedCardInfo.cardNumber}</div>
              </div>
              <div className="detail-section">
                <label>Card Hash:</label>
                <div className="detail-value hash">{selectedCardInfo.cardHash}</div>
              </div>
              <div className="detail-section">
                <label>Status:</label>
                <div className={`detail-value status ${selectedCardInfo.status}`}>
                  {selectedCardInfo.status.toUpperCase()}
                </div>
              </div>
              <div className="detail-section">
                <label>Confidence Level:</label>
                <div className="confidence-visual">
                  <div className="confidence-bar-full">
                    <div
                      className="confidence-fill-full"
                      style={{
                        width: `${selectedCardInfo.confidence}%`,
                        backgroundColor: selectedCardInfo.confidence > 80 ? '#2ecc71' : selectedCardInfo.confidence > 50 ? '#f39c12' : '#e74c3c',
                      }}
                    ></div>
                  </div>
                  <span>{selectedCardInfo.confidence}%</span>
                </div>
              </div>
              <div className="detail-section">
                <label>Layers Checked:</label>
                <div className="layers-list">
                  {selectedCardInfo.layersChecked.map((layer) => (
                    <div
                      key={layer}
                      className="layer-badge"
                      style={{ backgroundColor: getLayerColor(layer) }}
                    >
                      Layer {layer}: {getLayerName(layer)}
                    </div>
                  ))}
                </div>
              </div>
              {selectedCardInfo.duplicateDetectedAt && (
                <div className="detail-section warning">
                  <label>Duplicate Detected:</label>
                  <div className="detail-value">
                    At Layer {selectedCardInfo.duplicateDetectedAt} ({getLayerName(selectedCardInfo.duplicateDetectedAt)})
                  </div>
                </div>
              )}
              <div className="detail-section">
                <label>Check Time:</label>
                <div className="detail-value">{selectedCardInfo.checkTime}ms</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UniquenessVisualization;
