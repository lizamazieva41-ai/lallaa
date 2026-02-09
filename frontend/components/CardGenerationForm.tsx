/**
 * Card Generation Form Component
 * Form for BIN/vendor selection with generation options
 */

import React, { useState, FormEvent } from 'react';
import './CardGenerationForm.css';

export interface CardGenerationFormData {
  bin?: string;
  vendor?: string;
  count: number;
  expiryMonths: number;
  sequential: boolean;
  startSequence?: number;
  generate999: boolean;
  useAsync: boolean; // Use async job for bulk generation
}

interface CardGenerationFormProps {
  onSubmit: (data: CardGenerationFormData) => void;
  isLoading?: boolean;
  onUniquenessStatusChange?: (status: 'checking' | 'unique' | 'duplicate' | 'idle') => void;
}

export const CardGenerationForm: React.FC<CardGenerationFormProps> = ({
  onSubmit,
  isLoading = false,
  onUniquenessStatusChange,
}) => {
  const [formData, setFormData] = useState<CardGenerationFormData>({
    count: 1,
    expiryMonths: 12,
    sequential: false,
    generate999: false,
    useAsync: false,
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: keyof CardGenerationFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.bin && !formData.vendor) {
      errors.bin = 'Either BIN or Vendor must be selected';
      errors.vendor = 'Either BIN or Vendor must be selected';
    }

    if (formData.bin && !/^\d{6,8}$/.test(formData.bin)) {
      errors.bin = 'BIN must be 6-8 digits';
    }

    if (formData.count < 1 || formData.count > 10000) {
      errors.count = 'Count must be between 1 and 10000';
    }

    if (formData.expiryMonths < 1 || formData.expiryMonths > 120) {
      errors.expiryMonths = 'Expiry months must be between 1 and 120';
    }

    if (formData.sequential && formData.startSequence !== undefined && formData.startSequence < 0) {
      errors.startSequence = 'Start sequence must be 0 or greater';
    }

    // Auto-enable async for large batches
    if (formData.count > 100 && !formData.useAsync) {
      setFormData((prev) => ({ ...prev, useAsync: true }));
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    onSubmit(formData);
  };

  const handleBinChange = (value: string) => {
    handleInputChange('bin', value);
    if (value && onUniquenessStatusChange) {
      onUniquenessStatusChange('checking');
      // Simulate uniqueness check
      setTimeout(() => {
        onUniquenessStatusChange('unique');
      }, 500);
    }
  };

  return (
    <div className="card-generation-form">
      <h2>Generate Test Credit Cards</h2>
      <form onSubmit={handleSubmit}>
        {/* BIN or Vendor Selection */}
        <div className="form-group">
          <label htmlFor="input-type">Input Type</label>
          <div className="radio-group">
            <label>
              <input
                type="radio"
                name="input-type"
                value="bin"
                checked={!!formData.bin}
                onChange={() => {
                  setFormData((prev) => ({ ...prev, vendor: undefined }));
                }}
              />
              BIN (Bank Identification Number)
            </label>
            <label>
              <input
                type="radio"
                name="input-type"
                value="vendor"
                checked={!!formData.vendor}
                onChange={() => {
                  setFormData((prev) => ({ ...prev, bin: undefined }));
                }}
              />
              Card Vendor
            </label>
          </div>
        </div>

        {formData.bin ? (
          <div className="form-group">
            <label htmlFor="bin">
              BIN <span className="required">*</span>
            </label>
            <input
              type="text"
              id="bin"
              value={formData.bin}
              onChange={(e) => handleBinChange(e.target.value)}
              placeholder="411111"
              pattern="^\d{6,8}$"
              maxLength={8}
              className={validationErrors.bin ? 'error' : ''}
            />
            {validationErrors.bin && (
              <span className="error-message">{validationErrors.bin}</span>
            )}
            <small>6-8 digit Bank Identification Number</small>
          </div>
        ) : (
          <div className="form-group">
            <label htmlFor="vendor">
              Card Vendor <span className="required">*</span>
            </label>
            <select
              id="vendor"
              value={formData.vendor || ''}
              onChange={(e) => handleInputChange('vendor', e.target.value)}
              className={validationErrors.vendor ? 'error' : ''}
            >
              <option value="">Select vendor...</option>
              <option value="visa">Visa</option>
              <option value="mastercard">MasterCard</option>
              <option value="amex">American Express</option>
              <option value="discover">Discover</option>
              <option value="diners">Diners Club</option>
              <option value="jcb">JCB</option>
              <option value="enroute">En Route</option>
              <option value="voyager">Voyager</option>
            </select>
            {validationErrors.vendor && (
              <span className="error-message">{validationErrors.vendor}</span>
            )}
          </div>
        )}

        {/* Count */}
        <div className="form-group">
          <label htmlFor="count">
            Number of Cards <span className="required">*</span>
          </label>
          <input
            type="number"
            id="count"
            value={formData.count}
            onChange={(e) => handleInputChange('count', parseInt(e.target.value, 10) || 1)}
            min={1}
            max={10000}
            className={validationErrors.count ? 'error' : ''}
          />
          {validationErrors.count && (
            <span className="error-message">{validationErrors.count}</span>
          )}
          {formData.count > 100 && (
            <div className="info-message">
              ⓘ Large batch detected. Async processing will be used automatically.
            </div>
          )}
        </div>

        {/* Expiry Months */}
        <div className="form-group">
          <label htmlFor="expiryMonths">Expiry Months</label>
          <input
            type="number"
            id="expiryMonths"
            value={formData.expiryMonths}
            onChange={(e) => handleInputChange('expiryMonths', parseInt(e.target.value, 10) || 12)}
            min={1}
            max={120}
            className={validationErrors.expiryMonths ? 'error' : ''}
          />
          {validationErrors.expiryMonths && (
            <span className="error-message">{validationErrors.expiryMonths}</span>
          )}
          <small>Months from now for expiry date</small>
        </div>

        {/* Generation Mode */}
        <div className="form-group">
          <label>Generation Mode</label>
          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.sequential}
                onChange={(e) => handleInputChange('sequential', e.target.checked)}
              />
              Sequential (generate sequential card numbers)
            </label>
            {formData.sequential && (
              <div className="form-group nested">
                <label htmlFor="startSequence">Start Sequence</label>
                <input
                  type="number"
                  id="startSequence"
                  value={formData.startSequence || 0}
                  onChange={(e) => handleInputChange('startSequence', parseInt(e.target.value, 10) || 0)}
                  min={0}
                  className={validationErrors.startSequence ? 'error' : ''}
                />
              </div>
            )}
            <label>
              <input
                type="checkbox"
                checked={formData.generate999}
                onChange={(e) => handleInputChange('generate999', e.target.checked)}
              />
              Generate 999 cards with all CVV variants
            </label>
          </div>
        </div>

        {/* Async Processing Option */}
        {formData.count > 1 && (
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.useAsync}
                onChange={(e) => handleInputChange('useAsync', e.target.checked)}
              />
              Use async processing (recommended for {formData.count > 100 ? 'large' : 'medium'} batches)
            </label>
            <small>
              Async processing allows you to track progress in real-time and handle large batches efficiently
            </small>
          </div>
        )}

        {/* Submit Button */}
        <div className="form-actions">
          <button type="submit" disabled={isLoading} className="btn-primary">
            {isLoading ? 'Generating...' : `Generate ${formData.count} Card${formData.count > 1 ? 's' : ''}`}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CardGenerationForm;
