# Frontend Components

This directory contains React/TypeScript components for the Credit Card Generation Service frontend.

## Components

### 1. CardGenerationForm
Form component for generating test credit cards with options for:
- BIN or Vendor selection
- Card count
- Expiry months
- Generation mode (sequential, batch_999)
- Async processing option

**Usage:**
```tsx
import { CardGenerationForm } from './components/CardGenerationForm';

<CardGenerationForm
  onSubmit={(data) => {
    // Handle form submission
    console.log(data);
  }}
  isLoading={false}
  onUniquenessStatusChange={(status) => {
    // Handle uniqueness status updates
  }}
/>
```

### 2. ResultsDashboard
Dashboard component for displaying generated cards with:
- Statistics (total, unique, BINs, countries, uniqueness rate)
- Search and filter functionality
- Sortable table
- Export functionality (JSON, CSV, Excel)
- Job progress tracking (for async jobs)

**Usage:**
```tsx
import { ResultsDashboard } from './components/ResultsDashboard';

<ResultsDashboard
  cards={generatedCards}
  isLoading={false}
  jobId="job-123"
  jobProgress={75}
  onExport={(format) => {
    // Handle export
  }}
  onClear={() => {
    // Clear results
  }}
/>
```

### 3. UniquenessVisualization
Visualization component showing:
- System-wide uniqueness statistics
- 5-layer architecture visualization
- Card-level uniqueness status
- Confidence levels
- Layer-by-layer check details

**Usage:**
```tsx
import { UniquenessVisualization } from './components/UniquenessVisualization';

<UniquenessVisualization
  cards={cardUniquenessInfo}
  systemStats={uniquenessStats}
  realTimeUpdates={true}
/>
```

## Installation

These components require:
- React 18+
- TypeScript 5+
- CSS support

To use these components in your frontend application:

1. Copy the `components` directory to your React project
2. Install dependencies (if using any external libraries)
3. Import and use components as shown above

## Styling

Each component has its own CSS file:
- `CardGenerationForm.css`
- `ResultsDashboard.css`
- `UniquenessVisualization.css`

You can customize the styles to match your application's design system.

## Integration with Backend

These components are designed to work with the backend API:

- **Card Generation**: `POST /api/v1/cards/generate-from-bin` or `POST /api/v1/cards/generate-async`
- **Job Status**: `GET /api/v1/cards/jobs/:jobId/status`
- **Job Result**: `GET /api/v1/cards/jobs/:jobId/result`
- **WebSocket**: Connect to WebSocket server for real-time updates

## Example Integration

```tsx
import React, { useState } from 'react';
import { CardGenerationForm, ResultsDashboard, UniquenessVisualization } from './components';
import { io } from 'socket.io-client';

function App() {
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [jobId, setJobId] = useState(null);

  const handleGenerate = async (formData) => {
    setIsLoading(true);
    
    if (formData.useAsync || formData.count > 100) {
      // Use async endpoint
      const response = await fetch('/api/v1/cards/generate-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      setJobId(data.data.jobId);
      
      // Connect to WebSocket for updates
      const socket = io();
      socket.on(`job:${data.data.jobId}:progress`, (progress) => {
        // Update progress
      });
      socket.on(`job:${data.data.jobId}:completed`, (result) => {
        setCards(result.cards);
        setIsLoading(false);
      });
    } else {
      // Use sync endpoint
      const response = await fetch('/api/v1/cards/generate-from-bin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      setCards(data.data.cards || [data.data]);
      setIsLoading(false);
    }
  };

  return (
    <div>
      <CardGenerationForm onSubmit={handleGenerate} isLoading={isLoading} />
      <ResultsDashboard cards={cards} jobId={jobId} />
      <UniquenessVisualization cards={cards} />
    </div>
  );
}
```

## Notes

- These components are framework-agnostic React components
- They can be adapted for other frameworks (Vue, Angular) if needed
- All components are fully typed with TypeScript
- Components are responsive and mobile-friendly
