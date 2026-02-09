import { Router, Request, Response } from 'express';
import { sendSuccess, sendError, asyncHandler } from '@/utils/response';
import { logger } from '@/utils/logger';
import { siemFramework } from '@/security/siemFramework';
import { behavioralThreatDetection } from '@/security/behavioralThreatDetection';
import { automatedResponseSystem } from '@/security/automatedResponse';
import { mlThreatCorrelation } from '@/security/mlThreatCorrelation';

// Comprehensive Incident Response Management API
const router = Router();

// Get comprehensive security dashboard
router.get('/dashboard', asyncHandler(async (req: Request, res: Response) => {
  // Get data from all security systems
  const siemMetrics = siemFramework.getSecurityMetrics();
  const threatResults = behavioralThreatDetection.getDetectionResults(100);
  const responseExecutions = automatedResponseSystem.getExecutions(50);
  const correlations = mlThreatCorrelation.getCorrelations(50);
  const ipBlocks = automatedResponseSystem.getIPBlocks();
  const accountLocks = automatedResponseSystem.getAccountLocks();

  // Calculate summary statistics
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  const recentThreats = threatResults.filter(t => new Date(t.timestamp) >= last24h);
  const criticalThreats = recentThreats.filter(t => t.riskScore >= 90);
  const highThreats = recentThreats.filter(t => t.riskScore >= 70 && t.riskScore < 90);
  
  const recentExecutions = responseExecutions.filter(e => 
    e.executedAt && new Date(e.executedAt) >= last24h
  );
  const failedExecutions = recentExecutions.filter(e => e.status === 'failed');
  
  const recentCorrelations = correlations.filter(c => 
    new Date(c.createdAt) >= last24h
  );
  const criticalCorrelations = recentCorrelations.filter(c => 
    c.severity === 'critical' || c.severity === 'high'
  );

  const dashboard = {
    // Overview statistics
    overview: {
      totalThreats: recentThreats.length,
      criticalThreats: criticalThreats.length,
      highThreats: highThreats.length,
      activeIncidents: siemMetrics.incidentCounts.total,
      blockedIPs: ipBlocks.filter(b => b.active).length,
      lockedAccounts: accountLocks.filter(l => l.active).length
    },

    // Threat analysis
    threats: {
      recent: recentThreats,
      byType: threatResults.reduce((acc, t) => {
        acc[t.threatType] = (acc[t.threatType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      bySeverity: {
        critical: criticalThreats.length,
        high: highThreats.length,
        medium: recentThreats.filter(t => t.riskScore >= 50 && t.riskScore < 70).length,
        low: recentThreats.filter(t => t.riskScore < 50).length
      },
      averageConfidence: recentThreats.length > 0 ? 
        recentThreats.reduce((sum, t) => sum + t.confidence, 0) / recentThreats.length : 0,
      averageRiskScore: recentThreats.length > 0 ? 
        recentThreats.reduce((sum, t) => sum + t.riskScore, 0) / recentThreats.length : 0
    },

    // Response analysis
    responses: {
      total: recentExecutions.length,
      successful: recentExecutions.filter(e => e.status === 'executed').length,
      failed: failedExecutions.length,
      byAction: recentExecutions.reduce((acc, e) => {
        acc[e.action] = (acc[e.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    },

    // Correlation analysis
    correlations: {
      total: recentCorrelations.length,
      critical: criticalCorrelations.length,
      byType: recentCorrelations.reduce((acc, c) => {
        acc[c.type] = (acc[c.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      averageConfidence: recentCorrelations.length > 0 ? 
        recentCorrelations.reduce((sum, c) => sum + c.confidence, 0) / recentCorrelations.length : 0
    },

    // Active measures
    activeMeasures: {
      ipBlocks: ipBlocks.filter(b => b.active),
      accountLocks: accountLocks.filter(l => l.active),
      recentEntities: mlThreatCorrelation.getEntities().slice(0, 10)
    }
  };

  sendSuccess(res, dashboard, req.requestId);
}));

// Get detailed threat analysis
router.get('/threat-analysis', asyncHandler(async (req: Request, res: Response) => {
  const timeRange = req.query.timeRange as string || '24h';
  const threatType = req.query.threatType as string;
  
  let timeWindowMs = 24 * 60 * 60 * 1000;
  if (timeRange === '7d') timeWindowMs = 7 * 24 * 60 * 60 * 1000;
  else if (timeRange === '30d') timeWindowMs = 30 * 24 * 60 * 60 * 1000;
  
  const cutoffTime = new Date(Date.now() - timeWindowMs);
  const allThreats = behavioralThreatDetection.getDetectionResults(2000);
  
  let filteredThreats = allThreats.filter(t => 
    new Date(t.timestamp) >= cutoffTime
  );
  
  if (threatType) {
    filteredThreats = filteredThreats.filter(t => t.threatType === threatType);
  }

  // Advanced threat analysis
  const analysis = {
    summary: {
      totalThreats: filteredThreats.length,
      averageConfidence: filteredThreats.length > 0 ? 
        filteredThreats.reduce((sum, t) => sum + t.confidence, 0) / filteredThreats.length : 0,
      averageRiskScore: filteredThreats.length > 0 ? 
        filteredThreats.reduce((sum, t) => sum + t.riskScore, 0) / filteredThreats.length : 0,
      uniqueUsers: new Set(filteredThreats.filter(t => t.userId).map(t => t.userId!)).size,
      uniqueIPs: new Set(filteredThreats.filter(t => t.ipAddress).map(t => t.ipAddress!)).size
    },

    timeline: filteredThreats.reduce((acc, t) => {
      const hour = new Date(t.timestamp).getHours();
      if (!acc[hour]) acc[hour] = 0;
      acc[hour]++;
      return acc;
    }, {} as Record<number, number>),

    topAttackers: Object.entries(
      filteredThreats.reduce((acc, t) => {
        if (t.ipAddress) {
          acc[t.ipAddress] = (acc[t.ipAddress] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>)
    )
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count })),

    topVictims: Object.entries(
      filteredThreats.reduce((acc, t) => {
        if (t.userId) {
          acc[t.userId] = (acc[t.userId] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>)
    )
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([userId, count]) => ({ userId, count })),

    threatProgression: filteredThreats
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(t => ({
        timestamp: t.timestamp,
        threatType: t.threatType,
        riskScore: t.riskScore,
        confidence: t.confidence
      })),

    recommendations: generateThreatRecommendations(filteredThreats)
  };

  sendSuccess(res, analysis, req.requestId);
}));

// Get incident response workflow
router.get('/incident-response', asyncHandler(async (req: Request, res: Response) => {
  const incidentId = req.query.incidentId as string;
  
  // Get SIEM events and related data
  const siemEvents = incidentId ? 
    [siemFramework.getEvent(incidentId)] : 
    siemFramework.getActiveIncidents();

  if (incidentId && !siemEvents[0]) {
    return sendError(res, 'Incident not found', 404);
  }

  const incidents = Array.isArray(siemEvents) ? siemEvents : [siemEvents[0]];
  
  const incidentResponseData = incidents.map(incident => {
    if (!incident) return null;

    // Find related threats
    const relatedThreats = behavioralThreatDetection.getDetectionResults(100)
      .filter(t => 
        t.userId === incident.userId || 
        t.ipAddress === incident.ipAddress ||
        incident.tags.includes(t.threatType)
      );

    // Find response executions
    const relatedResponses = automatedResponseSystem.getExecutions(100)
      .filter(e => 
        e.threatId && relatedThreats.some(t => t.id === e.threatId)
      );

    // Find correlations
    const relatedCorrelations = mlThreatCorrelation.getCorrelations(50)
      .filter(c => 
        c.threatIds.some(tid => relatedThreats.some(t => t.id === tid))
      );

    return {
      incident,
      threats: relatedThreats,
      responses: relatedResponses,
      correlations: relatedCorrelations,
      workflow: generateIncidentWorkflow(incident, relatedThreats, relatedResponses),
      nextActions: getNextActions(incident, relatedThreats, relatedResponses),
      timeline: buildIncidentTimeline(incident, relatedThreats, relatedResponses, relatedCorrelations)
    };
  }).filter(Boolean);

  sendSuccess(res, {
    incidents: incidentResponseData,
    summary: {
      totalIncidents: incidentResponseData.length,
      criticalIncidents: incidentResponseData.filter(i => i!.incident.severity === 'critical').length,
      activeIncidents: incidentResponseData.filter(i => 
        i!.incident.status !== 'resolved' && i!.incident.status !== 'false_positive'
      ).length
    }
  }, req.requestId);
}));

// Execute manual response actions
router.post('/manual-response', asyncHandler(async (req: Request, res: Response) => {
  const { threatId, action, reason } = req.body;

  if (!threatId || !action || !reason) {
    return sendError(res, 'Missing required fields: threatId, action, reason', 400);
  }

  try {
    // Execute the specified action manually
    const threat = behavioralThreatDetection.getDetectionResults(1000)
      .find(t => t.id === threatId);

    if (!threat) {
      return sendError(res, 'Threat not found', 404);
    }

    // Create a manual execution record
    const manualExecution = {
      id: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      threatId,
      action,
      reason,
      executedBy: 'manual',
      executedAt: new Date().toISOString(),
      status: 'executed'
    };

    // Here you would execute the actual action
    logger.info('Manual response executed', manualExecution);

    // Log to SIEM
    siemFramework.createEvent(
      'anomalous_behavior' as any,
      'medium' as any,
      `Manual Response: ${action}`,
      `Manual response executed for threat ${threatId} - ${reason}`,
      'manual_response',
      ['manual', 'response'],
      {
        threatId,
        action,
        reason,
        manualExecutionId: manualExecution.id
      },
      threat.userId,
      threat.ipAddress,
      ['manual-response', 'security-action']
    );

    sendSuccess(res, {
      message: 'Manual response executed successfully',
      execution: manualExecution
    }, req.requestId, 201);

  } catch (error) {
    logger.error('Error executing manual response', { 
      threatId, 
      action, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    sendError(res, 'Failed to execute manual response', 500);
  }
}));

// Generate incident response procedures
router.post('/generate-procedures', asyncHandler(async (req: Request, res: Response) => {
  const { incidentId, threatType, severity } = req.body;

  try {
    const procedures = generateIncidentProcedures(incidentId, threatType, severity);
    
    sendSuccess(res, {
      procedures,
      generatedAt: new Date().toISOString()
    }, req.requestId, 201);

  } catch (error) {
    logger.error('Error generating procedures', { 
      incidentId, 
      threatType, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    sendError(res, 'Failed to generate procedures', 500);
  }
}));

// Helper functions
function generateThreatRecommendations(threats: any[]): string[] {
  const recommendations: string[] = [];
  
  const criticalCount = threats.filter(t => t.riskScore >= 90).length;
  const highCount = threats.filter(t => t.riskScore >= 70 && t.riskScore < 90).length;
  const uniqueIPs = new Set(threats.filter(t => t.ipAddress).map(t => t.ipAddress)).size;
  const uniqueUsers = new Set(threats.filter(t => t.userId).map(t => t.userId)).size;

  if (criticalCount > 0) {
    recommendations.push(`${criticalCount} critical threats detected - Immediate investigation required`);
    recommendations.push('Consider emergency response protocols');
  }

  if (highCount > 5) {
    recommendations.push(`High volume of high-severity threats (${highCount}) - Escalate to security team`);
  }

  if (uniqueIPs > 20) {
    recommendations.push('Large number of unique source IPs - Potential coordinated attack');
    recommendations.push('Consider implementing geographic blocking');
  }

  if (uniqueUsers > 10) {
    recommendations.push('Multiple users affected - Possible account compromise');
    recommendations.push('Review authentication mechanisms');
  }

  // Add specific recommendations based on threat types
  const threatTypes = threats.reduce((acc, t) => {
    acc[t.threatType] = (acc[t.threatType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (threatTypes.account_takeover > 0) {
    recommendations.push('Account takeover attempts detected - Force password resets');
    recommendations.push('Enable multi-factor authentication for all users');
  }

  if (threatTypes.card_testing > 3) {
    recommendations.push('Card testing attack detected - Block suspicious IPs');
    recommendations.push('Implement CAPTCHA challenges');
  }

  if (threatTypes.data_exfiltration > 0) {
    recommendations.push('Data exfiltration detected - Immediate containment required');
    recommendations.push('Review data access permissions');
    recommendations.push('Enable data loss prevention measures');
  }

  return recommendations;
}

function generateIncidentWorkflow(incident: any, threats: any[], responses: any[]): any[] {
  const workflow = [];

  // Detection phase
  workflow.push({
    phase: 'Detection',
    status: 'completed',
    timestamp: incident.timestamp,
    description: 'Threat detected by behavioral analysis',
    actions: ['Initial detection', 'Threat classification', 'Risk scoring']
  });

  // Analysis phase
  if (threats.length > 0) {
    workflow.push({
      phase: 'Analysis',
      status: 'in_progress',
      timestamp: new Date().toISOString(),
      description: 'Analyzing threat patterns and correlations',
      actions: ['Pattern analysis', 'Correlation check', 'Entity mapping']
    });
  }

  // Response phase
  if (responses.length > 0) {
    workflow.push({
      phase: 'Response',
      status: responses.some(r => r.status === 'executed') ? 'completed' : 'in_progress',
      timestamp: responses[0].executedAt,
      description: 'Executing automated responses',
      actions: responses.map(r => r.action)
    });
  }

  // Resolution phase
  if (incident.status === 'resolved') {
    workflow.push({
      phase: 'Resolution',
      status: 'completed',
      timestamp: incident.resolutionTime,
      description: 'Incident resolved',
      actions: ['Threat neutralized', 'Services restored', 'Documentation completed']
    });
  }

  return workflow;
}

function getNextActions(incident: any, threats: any[], responses: any[]): string[] {
  const actions: string[] = [];

  if (incident.status === 'new') {
    actions.push('Analyze threat patterns');
    actions.push('Review related entities');
    actions.push('Consider automated response');
  }

  if (incident.status === 'investigating') {
    actions.push('Continue correlation analysis');
    actions.push('Check for related threats');
    actions.push('Evaluate response options');
  }

  if (responses.length === 0 && threats.length > 0) {
    actions.push('Execute automated response');
    actions.push('Notify security team');
  }

  if (incident.status === 'in_progress') {
    actions.push('Monitor response effectiveness');
    actions.push('Update stakeholders');
    actions.push('Prepare escalation if needed');
  }

  if (incident.status === 'escalated') {
    actions.push('Notify management');
    actions.push('Implement emergency measures');
    actions.push('Prepare post-incident report');
  }

  return actions;
}

function buildIncidentTimeline(incident: any, threats: any[], responses: any[], correlations: any[]): any[] {
  const timeline = [];

  // Add incident creation
  timeline.push({
    timestamp: incident.timestamp,
    type: 'incident_created',
    description: `Incident ${incident.id} created`,
    severity: incident.severity,
    source: 'siem'
  });

  // Add threats
  threats.forEach(threat => {
    timeline.push({
      timestamp: threat.timestamp,
      type: 'threat_detected',
      description: `${threat.threatType} threat detected`,
      confidence: threat.confidence,
      riskScore: threat.riskScore,
      source: 'behavioral_detection'
    });
  });

  // Add responses
  responses.forEach(response => {
    if (response.executedAt) {
      timeline.push({
        timestamp: response.executedAt,
        type: 'response_executed',
        description: `${response.action} response executed`,
        status: response.status,
        source: 'automated_response'
      });
    }
  });

  // Add correlations
  correlations.forEach(correlation => {
    timeline.push({
      timestamp: correlation.createdAt,
      type: 'correlation_detected',
      description: `${correlation.type} correlation found`,
      confidence: correlation.confidence,
      threatCount: correlation.threatIds.length,
      source: 'ml_correlation'
    });
  });

  return timeline.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

function generateIncidentProcedures(incidentId?: string, threatType?: string, severity?: string): any {
  const baseProcedures = {
    detection: [
      'Verify threat detection accuracy',
      'Collect initial indicators',
      'Determine scope of incident',
      'Document initial findings'
    ],
    analysis: [
      'Analyze threat patterns',
      'Review related security events',
      'Identify affected systems/users',
      'Assess potential impact'
    ],
    containment: [
      'Isolate affected systems',
      'Block malicious IP addresses',
      'Lock compromised accounts',
      'Implement rate limiting'
    ],
    eradication: [
      'Remove malicious code/processes',
      'Patch vulnerabilities',
      'Reset compromised credentials',
      'Clean infected systems'
    ],
    recovery: [
      'Restore systems from clean backups',
      'Verify system integrity',
      'Enable monitoring',
      'Test system functionality'
    ],
    lessons_learned: [
      'Conduct post-incident review',
      'Document timeline and actions',
      'Identify improvement opportunities',
      'Update security procedures'
    ]
  };

  // Customize based on parameters
  if (threatType === 'account_takeover') {
    baseProcedures.containment.push('Force password reset for affected users');
    baseProcedures.containment.push('Enable multi-factor authentication');
    baseProcedures.eradication.push('Review access logs for unauthorized access');
  }

  if (threatType === 'data_exfiltration') {
    baseProcedures.analysis.push('Determine data sensitivity and volume');
    baseProcedures.containment.push('Block data transfer endpoints');
    baseProcedures.eradication.push('Check for data backup integrity');
  }

  if (severity === 'critical') {
    baseProcedures.detection.unshift('Notify management immediately');
    baseProcedures.containment.unshift('Activate incident response team');
    baseProcedures.recovery.push('Conduct full system security audit');
  }

  return baseProcedures;
}

export default router;