#!/bin/bash

# Weekly Tracking Script
# Run this script weekly to track project completion
# Can be scheduled with cron: 0 0 * * 0 (every Sunday)

echo "📊 Running Weekly Completion Tracking..."
echo ""

# Run tracking
npm run track-completion

# Check if successful
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Weekly tracking completed successfully!"
    echo "📄 Check reports/completion-trend.md for trends"
    echo ""
else
    echo ""
    echo "❌ Tracking failed. Check errors above."
    exit 1
fi
