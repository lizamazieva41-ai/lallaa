# Frontend Integration Guide

This guide explains how to integrate the frontend components with the backend API.

## Quick Start

1. **Install Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Set Environment Variables**
   ```env
   REACT_APP_API_URL=http://localhost:3000/api/v1
   REACT_APP_WS_URL=http://localhost:3000
   ```

3. **Use Components**
   ```tsx
   import { CardGenerationForm, ResultsDashboard, UniquenessVisualization } from './components';
   ```

## Component Integration

### 1. Card Generation Form

The form handles user input and triggers card generation:

```tsx
<CardGenerationForm
  onSubmit={async (formData) => {
    // Call backend API
    const response = await fetch('/api/v1/cards/generate-from-bin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    const data = await response.json();
    // Handle response
  }}
  isLoading={isGenerating}
  onUniquenessStatusChange={(status) => {
    // Update UI based on uniqueness status
  }}
/>
```

### 2. Results Dashboard

Displays generated cards with statistics and export options:

```tsx
<ResultsDashboard
  cards={generatedCards}
  isLoading={false}
  jobId={activeJobId}
  jobProgress={jobProgress}
  onExport={(format) => {
    // Handle export (JSON, CSV, Excel)
  }}
  onClear={() => {
    setGeneratedCards([]);
  }}
/>
```

### 3. Uniqueness Visualization

Shows uniqueness statistics and layer-by-layer analysis:

```tsx
<UniquenessVisualization
  cards={cardUniquenessInfo}
  systemStats={uniquenessStats}
  realTimeUpdates={true}
/>
```

## WebSocket Integration

For real-time job progress updates:

```tsx
import { getWebSocketClient } from './services/websocketClient';

const wsClient = getWebSocketClient();

// Connect
await wsClient.connect('http://localhost:3000', authToken);

// Subscribe to job
wsClient.subscribeToJob(jobId, {
  onProgress: (update) => {
    setJobProgress(update.progress);
  },
  onCompleted: (event) => {
    setCards(event.result.cards);
  },
  onError: (event) => {
    console.error('Job error:', event.error);
  },
});
```

## API Client Usage

Use the API client for HTTP requests:

```tsx
import { getApiClient } from './services/apiClient';

const apiClient = getApiClient();

// Set auth token
apiClient.setToken(userToken);

// Generate cards
const response = await apiClient.generateCards({
  bin: '411111',
  count: 10,
  expiryMonths: 12,
});

// Create async job
const jobResponse = await apiClient.createGenerationJob({
  bin: '411111',
  count: 1000,
});

// Get job status
const statusResponse = await apiClient.getJobStatus(jobId);

// Get job result
const resultResponse = await apiClient.getJobResult(jobId);
```

## Complete Example

See `App.example.tsx` for a complete integration example showing:
- Form submission
- Async job handling
- WebSocket real-time updates
- Results display
- Uniqueness visualization

## Authentication

Components require authentication token. Set it using:

```tsx
apiClient.setToken(token);
```

Or include in fetch requests:
```tsx
headers: {
  'Authorization': `Bearer ${token}`,
}
```

## Error Handling

All API calls return standardized error responses:

```tsx
if (!response.success) {
  console.error('Error:', response.error?.message);
  // Handle error
}
```

## Styling

Components include CSS files. You can:
1. Use as-is
2. Customize CSS variables
3. Override with your own styles
4. Use CSS-in-JS solutions

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile browsers: iOS Safari, Chrome Mobile

## Performance Considerations

- Large card lists (>1000) should use virtualization
- WebSocket connections are automatically managed
- Export operations are handled client-side for small datasets
- For large exports, consider server-side generation
