import {
  cacheSize,
  binLookupDuration,
  binLookupTotal,
  updateCacheMetrics,
  recordBinLookup,
  metricsHandler,
  register,
} from '../../src/services/metrics';

describe('Metrics service', () => {
  it('should update cache metrics', () => {
    const spy = jest.spyOn(cacheSize, 'set');
    updateCacheMetrics(42);
    expect(spy).toHaveBeenCalledWith(42);
  });

  it('should record BIN lookup metrics', () => {
    const incSpy = jest.spyOn(binLookupTotal, 'inc');
    const observeSpy = jest.spyOn(binLookupDuration, 'observe');

    recordBinLookup('hit', 0.25);
    expect(incSpy).toHaveBeenCalledWith({ status: 'hit' });
    expect(observeSpy).toHaveBeenCalledWith({ source: 'database' }, 0.25);
  });

  it('should return metrics content', async () => {
    const metricsSpy = jest.spyOn(register, 'metrics').mockResolvedValue('metrics');
    const res = {
      set: jest.fn(),
      end: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await metricsHandler({} as any, res as any);
    expect(res.set).toHaveBeenCalledWith('Content-Type', register.contentType);
    expect(res.end).toHaveBeenCalledWith('metrics');
    metricsSpy.mockRestore();
  });

  it('should handle metrics errors', async () => {
    const metricsSpy = jest.spyOn(register, 'metrics').mockRejectedValue(new Error('fail'));
    const res = {
      set: jest.fn(),
      end: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await metricsHandler({} as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
    metricsSpy.mockRestore();
  });
});
