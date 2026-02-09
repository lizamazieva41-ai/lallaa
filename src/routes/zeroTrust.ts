import { Router, Request, Response } from 'express';
import { zeroTrustManager, TrustLevel, VerificationMethod, SecurityPolicy } from '../security/zeroTrustSimplified';
import { identityManager, BehavioralPattern } from '../security/identityAgnosticModel';
import { behaviorAnalytics } from '../security/behavioralAnalytics';
import { gatewayManager, GatewayType } from '../security/secureGateways';
import { sendSuccess, sendError, asyncHandler } from '../utils/response';

const router = Router();

// Middleware để lấy context Zero-Trust
interface ZeroTrustRequest extends Request {
  zeroTrustContext?: any;
}

const getStringValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
};

const getParamValue = (value: string | string[] | undefined): string => {
  if (!value) return '';
  return Array.isArray(value) ? value[0] : value;
};

const buildIdentityBehaviorData = (
  type: string,
  data: any
): Partial<BehavioralPattern> => {
  const payload = data && typeof data === 'object' ? data : {};

  switch (type) {
    case 'typing':
      return { typingSpeed: payload.typingSpeed ?? data };
    case 'mouse':
      return { mouseMovements: payload.mouseMovements ?? data };
    case 'click':
      return { clickPatterns: payload.clickPatterns ?? data };
    case 'time':
    case 'timing':
      return { timePatterns: payload.timePatterns ?? data };
    default:
      return payload as Partial<BehavioralPattern>;
  }
};

// ===== ZERO-TRUST CONTEXT MANAGEMENT =====

// Tạo context mới
router.post('/context', asyncHandler(async (req: ZeroTrustRequest, res: Response) => {
  try {
    const body = req.body as Record<string, any>;
    const sessionId = getStringValue(body.sessionId);
    const methodValue = getStringValue(body.method);
    const userId = getStringValue(body.userId) || 'anonymous';
    const deviceFingerprint = getStringValue(body.deviceFingerprint);
    const ipAddress = getStringValue(body.ipAddress);
    const userAgent = getStringValue(body.userAgent);

    if (!sessionId || !methodValue || !Object.values(VerificationMethod).includes(methodValue as VerificationMethod)) {
      return sendError(res, 'Thiếu sessionId hoặc method', 400);
    }

    const method = methodValue as VerificationMethod;
    const context = zeroTrustManager.createContext({
      userId,
      sessionId,
      method,
      deviceFingerprint,
      ipAddress,
      userAgent,
      timestamp: Date.now()
    });

    // Tạo phiên trong behavioral analytics
    behaviorAnalytics.createSession(sessionId, ipAddress || '', userAgent || '', userId);

    sendSuccess(res, {
      message: 'Tạo context Zero-Trust thành công',
      context: {
        sessionId: context.sessionId,
        userId: context.userId,
        method: context.method,
        riskScore: context.riskScore,
        timestamp: context.timestamp
      }
    }, req.requestId);
  } catch (error) {
    sendError(res, 'Lỗi tạo context Zero-Trust', 500);
  }
}));

// Cập nhật context
router.put('/context/:sessionId', asyncHandler(async (req: ZeroTrustRequest, res: Response) => {
  try {
    const sessionId = getParamValue(req.params.sessionId);
    const updates = req.body;

    const context = zeroTrustManager.updateContext(sessionId, updates);
    if (!context) {
      return sendError(res, 'Không tìm thấy context', 404);
    }

    // Cập nhật hoạt động phiên
    behaviorAnalytics.updateSessionActivity(sessionId);

    sendSuccess(res, {
      message: 'Cập nhật context thành công',
      context: {
        sessionId: context.sessionId,
        riskScore: context.riskScore,
        lastUpdated: Date.now()
      }
    }, req.requestId);
  } catch (error) {
    sendError(res, 'Lỗi cập nhật context', 500);
  }
}));

// Đánh giá truy cập
router.post('/context/:sessionId/evaluate', asyncHandler(async (req: ZeroTrustRequest, res: Response) => {
  try {
    const sessionId = getParamValue(req.params.sessionId);

    const decision = zeroTrustManager.evaluateAccess(sessionId);
    if (!decision) {
      return sendError(res, 'Không tìm thấy context', 404);
    }

    // Ghi lại điểm truy cập
    behaviorAnalytics.recordAccess(
      sessionId,
      req.path,
      req.method,
      0, // duration sẽ được cập nhật sau
      decision.allowed
    );

    sendSuccess(res, {
      message: 'Đánh giá truy cập hoàn tất',
      decision: {
        allowed: decision.allowed,
        trustLevel: decision.trustLevel,
        riskScore: decision.riskScore,
        reason: decision.reason,
        policies: decision.policies,
        requiredActions: decision.requiredActions,
        expiresAt: decision.expiresAt
      }
    }, req.requestId);
  } catch (error) {
    sendError(res, 'Lỗi đánh giá truy cập', 500);
  }
}));

// Lấy thông tin context
router.get('/context/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  try {
    const sessionId = getParamValue(req.params.sessionId);

    const context = zeroTrustManager.getContext(sessionId);
    if (!context) {
      return sendError(res, 'Không tìm thấy context', 404);
    }

    const session = behaviorAnalytics.getSession(sessionId);
    const analysis = behaviorAnalytics.getAnalysis(sessionId);

    sendSuccess(res, {
      message: 'Lấy thông tin context thành công',
      context: {
        sessionId: context.sessionId,
        userId: context.userId,
        method: context.method,
        riskScore: context.riskScore,
        timestamp: context.timestamp
      },
      session: session ? {
        sessionId: session.sessionId,
        userId: session.userId,
        isActive: session.isActive,
        eventCount: session.events.length,
        riskScore: session.riskScore
      } : null,
      analysis: analysis ? {
        overallRiskScore: analysis.overallRiskScore,
        riskFactors: analysis.riskFactors,
        anomalies: analysis.anomalies.length,
        recommendations: analysis.recommendations
      } : null
    }, req.requestId);
  } catch (error) {
    sendError(res, 'Lỗi lấy thông tin context', 500);
  }
}));

// Xóa context
router.delete('/context/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  try {
    const sessionId = getParamValue(req.params.sessionId);

    const removed = zeroTrustManager.removeContext(sessionId);
    if (!removed) {
      return sendError(res, 'Không tìm thấy context', 404);
    }

    // Kết thúc phiên trong behavioral analytics
    behaviorAnalytics.endSession(sessionId);

    sendSuccess(res, {
      message: 'Xóa context thành công',
      sessionId
    }, req.requestId);
  } catch (error) {
    sendError(res, 'Lỗi xóa context', 500);
  }
}));

// ===== IDENTITY VERIFICATION =====

// Tạo bằng chứng xác thực
router.post('/identity/proof', asyncHandler(async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, any>;
    const sessionId = getStringValue(body.sessionId);
    const typeValue = getStringValue(body.type);
    const data = body.data;
    const confidence = typeof body.confidence === 'number' ? body.confidence : undefined;

    if (!sessionId || !typeValue || !data) {
      return sendError(res, 'Thiếu sessionId, type hoặc data', 400);
    }

    if (!Object.values(VerificationMethod).includes(typeValue as VerificationMethod)) {
      return sendError(res, 'Type không hợp lệ', 400);
    }

    const proof = identityManager.createProof(
      sessionId,
      typeValue as VerificationMethod,
      data,
      confidence
    );

    sendSuccess(res, {
      message: 'Tạo bằng chứng xác thực thành công',
      proof: {
        id: proof.id,
        type: proof.type,
        sessionId: proof.sessionId,
        confidence: proof.confidence,
        isValid: proof.isValid,
        timestamp: proof.timestamp
      }
    }, req.requestId);
  } catch (error) {
    sendError(res, 'Lỗi tạo bằng chứng xác thực', 500);
  }
}));

// Xác minh bằng chứng
router.post('/identity/proof/:proofId/verify', asyncHandler(async (req: Request, res: Response) => {
  try {
    const proofId = getParamValue(req.params.proofId);

    const isValid = identityManager.verifyProof(proofId);

    sendSuccess(res, {
      message: 'Xác minh bằng chứng hoàn tất',
      proofId,
      isValid
    }, req.requestId);
  } catch (error) {
    sendError(res, 'Lỗi xác minh bằng chứng', 500);
  }
}));

// Đăng ký thiết bị
router.post('/identity/device', asyncHandler(async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, any>;
    const sessionId = getStringValue(body.sessionId);
    const deviceInfo = body.deviceInfo;

    if (!sessionId) {
      return sendError(res, 'Thiếu sessionId', 400);
    }

    const device = identityManager.registerDevice(sessionId, deviceInfo || {});

    sendSuccess(res, {
      message: 'Đăng ký thiết bị thành công',
      device: {
        deviceId: device.deviceId,
        fingerprint: device.fingerprint,
        platform: device.platform,
        isKnown: device.isKnown,
        trustLevel: device.trustLevel
      }
    }, req.requestId);
  } catch (error) {
    sendError(res, 'Lỗi đăng ký thiết bị', 500);
  }
}));

// Phân tích hành vi
router.post('/identity/behavior', asyncHandler(async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, any>;
    const sessionId = getStringValue(body.sessionId);
    const typeValue = getStringValue(body.type);
    const data = body.data;

    if (!sessionId || !typeValue) {
      return sendError(res, 'Thiếu sessionId hoặc type', 400);
    }

    const behaviorData = buildIdentityBehaviorData(typeValue, data);
    const pattern = identityManager.analyzeBehavior(sessionId, behaviorData);

    sendSuccess(res, {
      message: 'Phân tích hành vi thành công',
      pattern: {
        patternId: pattern.patternId,
        type: typeValue,
        riskScore: pattern.riskScore,
        confidence: pattern.confidence,
        timestamp: pattern.timestamp
      }
    }, req.requestId);
  } catch (error) {
    sendError(res, 'Lỗi phân tích hành vi', 500);
  }
}));

// Tính điểm tin cậy
router.get('/identity/trust-score/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  try {
    const sessionId = getParamValue(req.params.sessionId);

    const trustScore = identityManager.calculateTrustScore(sessionId);
    const proofs = identityManager.getProofs(sessionId);

    sendSuccess(res, {
      message: 'Tính điểm tin cậy thành công',
      trustScore,
      proofCount: proofs.length,
      validProofs: proofs.filter(p => p.isValid).length
    }, req.requestId);
  } catch (error) {
    sendError(res, 'Lỗi tính điểm tin cậy', 500);
  }
}));

// ===== BEHAVIORAL ANALYTICS =====

// Thêm sự kiện phiên
router.post('/behavior/event', asyncHandler(async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, any>;
    const sessionId = getStringValue(body.sessionId);
    const type = getStringValue(body.type);
    const description = getStringValue(body.description) || '';
    const data = body.data;
    const riskScore = typeof body.riskScore === 'number' ? body.riskScore : 0;

    if (!sessionId || !type) {
      return sendError(res, 'Thiếu sessionId hoặc type', 400);
    }

    const allowedTypes = ['login', 'logout', 'action', 'error', 'suspicious'];
    if (!allowedTypes.includes(type)) {
      return sendError(res, 'Type không hợp lệ', 400);
    }

    behaviorAnalytics.addEvent(sessionId, type as any, description, data, riskScore);

    sendSuccess(res, {
      message: 'Thêm sự kiện thành công',
      sessionId,
      type,
      timestamp: Date.now()
    }, req.requestId);
  } catch (error) {
    sendError(res, 'Lỗi thêm sự kiện', 500);
  }
}));

// Ghi lại mẫu hành vi
router.post('/behavior/pattern', asyncHandler(async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, any>;
    const sessionId = getStringValue(body.sessionId);
    const type = getStringValue(body.type);
    const data = body.data;

    if (!sessionId || !type) {
      return sendError(res, 'Thiếu sessionId hoặc type', 400);
    }

    const allowedTypes = ['typing', 'mouse', 'navigation', 'timing'];
    if (!allowedTypes.includes(type)) {
      return sendError(res, 'Type không hợp lệ', 400);
    }

    const pattern = behaviorAnalytics.recordBehavior(sessionId, type as any, data);

    sendSuccess(res, {
      message: 'Ghi lại mẫu hành vi thành công',
      pattern: {
        patternId: pattern.patternId,
        type: pattern.type,
        riskScore: pattern.riskScore,
        confidence: pattern.confidence
      }
    }, req.requestId);
  } catch (error) {
    sendError(res, 'Lỗi ghi lại mẫu hành vi', 500);
  }
}));

// Phân tích hành vi tổng thể
router.post('/behavior/analyze/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  try {
    const sessionId = getParamValue(req.params.sessionId);

    const analysis = behaviorAnalytics.analyzeBehavior(sessionId);

    sendSuccess(res, {
      message: 'Phân tích hành vi hoàn tất',
      analysis: {
        sessionId: analysis.sessionId,
        overallRiskScore: analysis.overallRiskScore,
        riskFactors: analysis.riskFactors,
        anomalies: analysis.anomalies,
        recommendations: analysis.recommendations,
        timestamp: analysis.timestamp
      }
    }, req.requestId);
  } catch (error) {
    sendError(res, 'Lỗi phân tích hành vi', 500);
  }
}));

// ===== SECURE GATEWAYS =====

// Tạo cổng bảo mật mới
router.post('/gateway', asyncHandler(async (req: Request, res: Response) => {
  try {
    const gatewayConfig = req.body;

    const gatewayId = getStringValue(gatewayConfig?.id);
    const gatewayType = getStringValue(gatewayConfig?.type);

    if (!gatewayId || !gatewayType || !Object.values(GatewayType).includes(gatewayType as GatewayType)) {
      return sendError(res, 'Thiếu id hoặc type', 400);
    }

    const gateway = gatewayManager.createGateway({
      ...gatewayConfig,
      id: gatewayId,
      type: gatewayType as GatewayType
    });

    sendSuccess(res, {
      message: 'Tạo cổng bảo mật thành công',
      gateway: {
        id: gatewayConfig.id,
        name: gatewayConfig.name,
        type: gatewayConfig.type,
        enabled: gatewayConfig.enabled
      }
    }, req.requestId);
  } catch (error) {
    sendError(res, 'Lỗi tạo cổng bảo mật', 500);
  }
}));

// Xử lý yêu cầu qua cổng
router.post('/gateway/:gatewayId/process', asyncHandler(async (req: Request, res: Response) => {
  try {
    const gatewayId = getParamValue(req.params.gatewayId);
    const requestData = req.body as Record<string, any>;

    const gateway = gatewayManager.getGateway(gatewayId);
    if (!gateway) {
      return sendError(res, 'Không tìm thấy cổng', 404);
    }

    const request = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      gatewayId,
      method: getStringValue(requestData.method) || 'GET',
      path: getStringValue(requestData.path) || '/',
      headers: requestData.headers || {},
      body: requestData.body,
      query: requestData.query || {},
      timestamp: Date.now(),
      source: requestData.source || {
        ip: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent'),
        sessionId: requestData.sessionId
      }
    };

    const response = await gateway.processRequest(request);

    sendSuccess(res, {
      message: 'Xử lý yêu cầu thành công',
      request: {
        id: request.id,
        method: request.method,
        path: request.path
      },
      response: {
        id: response.id,
        status: response.status,
        duration: response.duration,
        fromCache: response.fromCache
      }
    }, req.requestId);
  } catch (error) {
    sendError(res, 'Lỗi xử lý yêu cầu', 500);
  }
}));

// Lấy thống kê cổng
router.get('/gateway/:gatewayId/metrics', asyncHandler(async (req: Request, res: Response) => {
  try {
    const gatewayId = getParamValue(req.params.gatewayId);

    const gateway = gatewayManager.getGateway(gatewayId);
    if (!gateway) {
      return sendError(res, 'Không tìm thấy cổng', 404);
    }

    const metrics = gateway.getMetrics();

    sendSuccess(res, {
      message: 'Lấy thống kê cổng thành công',
      metrics: {
        gatewayId: metrics.gatewayId,
        totalRequests: metrics.totalRequests,
        successfulRequests: metrics.successfulRequests,
        failedRequests: metrics.failedRequests,
        averageResponseTime: metrics.averageResponseTime,
        requestsPerMinute: metrics.requestsPerMinute,
        errorRate: metrics.errorRate,
        cacheHitRate: metrics.cacheHitRate
      }
    }, req.requestId);
  } catch (error) {
    sendError(res, 'Lỗi lấy thống kê cổng', 500);
  }
}));

// ===== POLICY MANAGEMENT =====

// Lấy tất cả chính sách
router.get('/policies', asyncHandler(async (req: Request, res: Response) => {
  try {
    const policies = zeroTrustManager.getPolicyEngine().getAllPolicies();

    sendSuccess(res, {
      message: 'Lấy danh sách chính sách thành công',
      policies: policies.map(policy => ({
        id: policy.id,
        name: policy.name,
        description: policy.description,
        enabled: policy.enabled,
        priority: policy.priority,
        conditions: policy.conditions.length,
        actions: policy.actions.length
      }))
    }, req.requestId);
  } catch (error) {
    sendError(res, 'Lỗi lấy danh sách chính sách', 500);
  }
}));

// Thêm chính sách mới
router.post('/policies', asyncHandler(async (req: Request, res: Response) => {
  try {
    const policy = req.body as SecurityPolicy;

    if (!policy.id || !policy.name) {
      return sendError(res, 'Thiếu id hoặc name', 400);
    }

    zeroTrustManager.getPolicyEngine().addPolicy(policy);

    sendSuccess(res, {
      message: 'Thêm chính sách thành công',
      policy: {
        id: policy.id,
        name: policy.name,
        description: policy.description,
        enabled: policy.enabled
      }
    }, req.requestId);
  } catch (error) {
    sendError(res, 'Lỗi thêm chính sách', 500);
  }
}));

// Xóa chính sách
router.delete('/policies/:policyId', asyncHandler(async (req: Request, res: Response) => {
  try {
    const policyId = getParamValue(req.params.policyId);

    const removed = zeroTrustManager.getPolicyEngine().removePolicy(policyId);
    if (!removed) {
      return sendError(res, 'Không tìm thấy chính sách', 404);
    }

    sendSuccess(res, {
      message: 'Xóa chính sách thành công',
      policyId
    }, req.requestId);
  } catch (error) {
    sendError(res, 'Lỗi xóa chính sách', 500);
  }
}));

// ===== DASHBOARD =====

// Lấy tổng quan Zero-Trust
router.get('/dashboard', asyncHandler(async (req: Request, res: Response) => {
  try {
    const contexts = zeroTrustManager.getAllContexts();
    const policies = zeroTrustManager.getPolicyEngine().getAllPolicies();
    const sessions = behaviorAnalytics.getAllSessions();
    const gateways = gatewayManager.getAllGateways();
    const allMetrics = gatewayManager.getAllMetrics();

    // Tính toán thống kê
    const activeContexts = contexts.length;
    const activeSessions = sessions.filter(s => s.isActive).length;
    const enabledPolicies = policies.filter(p => p.enabled).length;
    const activeGateways = gateways.length;

    // Tính rủi ro trung bình
    const avgRiskScore = contexts.length > 0 
      ? contexts.reduce((sum, ctx) => sum + ctx.riskScore, 0) / contexts.length 
      : 0;

    // Tính tổng requests
    const totalRequests = allMetrics.reduce((sum, metrics) => sum + metrics.totalRequests, 0);
    const totalErrors = allMetrics.reduce((sum, metrics) => sum + metrics.failedRequests, 0);
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    sendSuccess(res, {
      message: 'Lấy tổng quan Zero-Trust thành công',
      dashboard: {
        contexts: {
          active: activeContexts,
          averageRiskScore: Math.round(avgRiskScore * 100) / 100
        },
        sessions: {
          active: activeSessions,
          total: sessions.length
        },
        policies: {
          enabled: enabledPolicies,
          total: policies.length
        },
        gateways: {
          active: activeGateways,
          totalRequests,
          errorRate: Math.round(errorRate * 100) / 100
        },
        timestamp: Date.now()
      }
    }, req.requestId);
  } catch (error) {
    sendError(res, 'Lỗi lấy tổng quan', 500);
  }
}));

// Cleanup dữ liệu cũ
router.post('/cleanup', asyncHandler(async (req: Request, res: Response) => {
  try {
    zeroTrustManager.getRiskAssessment().cleanup?.();
    identityManager.cleanup();
    behaviorAnalytics.cleanup();
    gatewayManager.getAllGateways().forEach(gateway => gateway.cleanup());

    sendSuccess(res, {
      message: 'Dọn dẹp dữ liệu thành công',
      timestamp: Date.now()
    }, req.requestId);
  } catch (error) {
    sendError(res, 'Lỗi dọn dẹp dữ liệu', 500);
  }
}));

export default router;
