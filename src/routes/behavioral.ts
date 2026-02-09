import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { sendSuccess, sendError, asyncHandler } from '@/utils/response';
import { behavioralThreatDetection, ThreatType, DetectionMethod } from '@/security/behavioralThreatDetection';
import { siemFramework } from '@/security/siemFramework';

const router = Router();

// Get all behavioral patterns
router.get('/patterns', asyncHandler(async (req: Request, res: Response) => {
  const patterns = behavioralThreatDetection.getPatterns();
  
  sendSuccess(res, {
    patterns,
    total: patterns.length,
    active: patterns.filter(p => p.isActive).length
  }, req.requestId);
}));

// Add new behavioral pattern
router.post('/patterns', asyncHandler(async (req: Request, res: Response) => {
  const pattern = req.body;
  
  // Validate required fields
  if (!pattern.name || !pattern.threatType || !pattern.detectionMethod) {
    return sendError(res, 'Missing required fields: name, threatType, detectionMethod', 400);
  }
  
  const newPattern = {
    id: `pattern_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    ...pattern,
    isActive: pattern.isActive !== undefined ? pattern.isActive : true
  };
  
  behavioralThreatDetection.addPattern(newPattern);
  
  sendSuccess(res, {
    pattern: newPattern,
    message: 'Behavioral pattern added successfully'
  }, req.requestId, 201);
}));

// Remove behavioral pattern
router.delete('/patterns/:patternId', asyncHandler(async (req: Request, res: Response) => {
  const { patternId } = req.params;
  
  behavioralThreatDetection.removePattern(patternId.toString());
  
  sendSuccess(res, {
    message: 'Behavioral pattern removed successfully'
  }, req.requestId);
}));

// Get recent threat detection results
router.get('/results', asyncHandler(async (req: Request, res: Response) => {
  const limit = parseInt((req.query.limit as string) || '50') || 50;
  const results = behavioralThreatDetection.getDetectionResults(limit);
  
  sendSuccess(res, {
    results,
    total: results.length,
    highRisk: results.filter(r => r.riskScore >= 70).length,
    critical: results.filter(r => r.riskScore >= 90).length
  }, req.requestId);
}));

// Get threat detection results for specific user
router.get('/results/user/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const limit = parseInt((req.query.limit as string) || '10') || 10;
  
  const results = behavioralThreatDetection.getDetectionResultsByUser(userId.toString(), limit);
  
  sendSuccess(res, {
    userId,
    results,
    total: results.length,
    averageRiskScore: results.length > 0 ? 
      results.reduce((sum, r) => sum + r.riskScore, 0) / results.length : 0
  }, req.requestId);
}));

// Get threats by type
router.get('/results/type/:threatType', asyncHandler(async (req: Request, res: Response) => {
  const { threatType } = req.params;
  const limit = parseInt((req.query.limit as string) || '50') || 50;
  
  // Validate threat type
  if (!Object.values(ThreatType).includes(threatType as ThreatType)) {
    return sendError(res, 'Invalid threat type', 400);
  }
  
  const allResults = behavioralThreatDetection.getDetectionResults(limit * 2); // Get more to filter
  const filteredResults = allResults
    .filter(r => r.threatType === threatType)
    .slice(0, limit);
  
  sendSuccess(res, {
    threatType,
    results: filteredResults,
    total: filteredResults.length,
    averageConfidence: filteredResults.length > 0 ?
      filteredResults.reduce((sum, r) => sum + r.confidence, 0) / filteredResults.length : 0
  }, req.requestId);
}));

// Retrain ML model for a pattern
router.post('/patterns/:patternId/retrain', asyncHandler(async (req: Request, res: Response) => {
  const { patternId } = req.params;
  
  const success = await behavioralThreatDetection.retrainModel(patternId.toString());
  
  if (!success) {
    return sendError(res, 'Pattern not found or does not have ML configuration', 404);
  }
  
  sendSuccess(res, {
    message: 'Model retraining initiated',
    patternId,
    status: 'in_progress'
  }, req.requestId);
}));

// Get behavioral threat statistics
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const results = behavioralThreatDetection.getDetectionResults(1000); // Get larger sample
  const patterns = behavioralThreatDetection.getPatterns();
  
  // Calculate statistics
  const threatTypeCounts = new Map<ThreatType, number>();
  const severityCounts = { low: 0, medium: 0, high: 0, critical: 0 };
  const recentThreats = results.filter(r => 
    new Date(r.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  );
  
  results.forEach(result => {
    // Count by threat type
    threatTypeCounts.set(
      result.threatType, 
      (threatTypeCounts.get(result.threatType) || 0) + 1
    );
    
    // Count by severity
    if (result.riskScore >= 90) severityCounts.critical++;
    else if (result.riskScore >= 70) severityCounts.high++;
    else if (result.riskScore >= 50) severityCounts.medium++;
    else severityCounts.low++;
  });
  
  const stats = {
    totalThreats: results.length,
    recentThreats: recentThreats.length,
    threatsByType: Object.fromEntries(threatTypeCounts),
    threatsBySeverity: severityCounts,
    activePatterns: patterns.filter(p => p.isActive).length,
    totalPatterns: patterns.length,
    mlPatterns: patterns.filter(p => p.detectionMethod === DetectionMethod.MACHINE_LEARNING).length,
    rulePatterns: patterns.filter(p => p.detectionMethod === DetectionMethod.RULE_BASED).length,
    averageConfidence: results.length > 0 ? 
      results.reduce((sum, r) => sum + r.confidence, 0) / results.length : 0,
    averageRiskScore: results.length > 0 ? 
      results.reduce((sum, r) => sum + r.riskScore, 0) / results.length : 0,
    escalatedCount: results.filter(r => r.requiresEscalation).length
  };
  
  sendSuccess(res, stats, req.requestId);
}));

// Get SIEM events related to behavioral threats
router.get('/siem-events', asyncHandler(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;
  
  // Get events from SIEM framework that are related to behavioral threats
  const allEvents = siemFramework.getEventsByCategory('anomalous_behavior' as any);
  const filteredEvents = allEvents
    .filter(event => 
      event.tags.includes('behavioral') || 
      event.tags.includes('ml-detection')
    )
    .slice(0, limit);
  
  sendSuccess(res, {
    events: filteredEvents,
    total: filteredEvents.length,
    active: filteredEvents.filter(e => e.status !== 'resolved').length
  }, req.requestId);
}));

// Get threat intelligence summary
router.get('/intelligence', asyncHandler(async (req: Request, res: Response) => {
  const results = behavioralThreatDetection.getDetectionResults(500);
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Time-based analysis
  const threats24h = results.filter(r => new Date(r.timestamp) > last24h);
  const threats7d = results.filter(r => new Date(r.timestamp) > last7d);
  
  // Pattern analysis
  const topThreatTypes = Object.entries(
    results.reduce((acc, r) => {
      acc[r.threatType] = (acc[r.threatType] || 0) + 1;
      return acc;
    }, {} as Record<ThreatType, number>)
  )
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);
  
  // Risk trend analysis
  const hourlyTrends = Array.from({ length: 24 }, (_, i) => {
    const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
    const hourStart = new Date(hour.getTime());
    hourStart.setMinutes(0, 0, 0);
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
    
    const threatsInHour = results.filter(r => {
      const threatTime = new Date(r.timestamp);
      return threatTime >= hourStart && threatTime < hourEnd;
    });
    
    return {
      hour: hourStart.toISOString(),
      count: threatsInHour.length,
      avgRiskScore: threatsInHour.length > 0 ? 
        threatsInHour.reduce((sum, r) => sum + r.riskScore, 0) / threatsInHour.length : 0
    };
  }).reverse();
  
  const intelligence = {
    summary: {
      totalThreats: results.length,
      last24h: threats24h.length,
      last7d: threats7d.length,
      averageRiskScore: results.length > 0 ? 
        results.reduce((sum, r) => sum + r.riskScore, 0) / results.length : 0,
      criticalThreats: results.filter(r => r.riskScore >= 90).length,
      escalatedThreats: results.filter(r => r.requiresEscalation).length
    },
    topThreatTypes: topThreatTypes.map(([type, count]) => ({ type, count })),
    hourlyTrends,
    recommendations: {
      immediate: threats24h.filter(r => r.riskScore >= 90).length > 0 ? 
        'Immediate attention required for critical threats' : 'No immediate critical threats',
      monitoring: threats24h.length > 10 ? 
        'Increased monitoring recommended due to high threat volume' : 'Threat levels normal',
      review: threats7d.length > 100 ? 
        'Review security controls and patterns' : 'Security posture acceptable'
    }
  };
  
  sendSuccess(res, intelligence, req.requestId);
}));

// Cleanup old behavioral data
router.post('/cleanup', asyncHandler(async (req: Request, res: Response) => {
  const olderThanDays = parseInt(req.body.olderThanDays as string) || 30;
  
  behavioralThreatDetection.cleanupOldData(olderThanDays);
  siemFramework.cleanupOldEvents(olderThanDays);
  
  sendSuccess(res, {
    message: 'Cleanup completed successfully',
    olderThanDays,
    timestamp: new Date().toISOString()
  }, req.requestId);
}));

// Test behavioral detection with sample data
router.post('/test', asyncHandler(async (req: Request, res: Response) => {
  const testData = req.body;
  
  if (!testData.userId || !testData.actions) {
    return sendError(res, 'Missing required fields: userId, actions', 400);
  }
  
  // Simulate user behavior testing
  const testUserId = testData.userId;
  const testSessionId = `test_session_${Date.now()}`;
  const testIpAddress = testData.ipAddress || '127.0.0.1';
  const testUserAgent = testData.userAgent || 'Test Agent';
  
  // Track test actions
  testData.actions.forEach((action: any) => {
    behavioralThreatDetection.trackUserAction(
      testUserId,
      action,
      testSessionId,
      testIpAddress,
      testUserAgent
    );
  });
  
  // Get results for this test
  const testResults = behavioralThreatDetection.getDetectionResultsByUser(testUserId, 10);
  
  sendSuccess(res, {
    testId: testSessionId,
    userId: testUserId,
    actionsProcessed: testData.actions.length,
    threatsDetected: testResults.length,
    results: testResults,
    timestamp: new Date().toISOString()
  }, req.requestId);
}));

export default router;