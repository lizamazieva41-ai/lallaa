import { QueryResult } from 'pg';
import database from '../database/connection';
import { logger } from '../utils/logger';

export interface CardGenerationStatistics {
  id: string;
  date: Date;
  totalGenerated: number;
  totalUnique: number;
  totalDuplicates: number;
  randomCount: number;
  sequentialCount: number;
  batch999Count: number;
  binsUsed: number;
  topBins: Record<string, number>;
  countriesUsed: number;
  topCountries: Record<string, number>;
  usersActive: number;
  topUsers: Record<string, number>;
  avgGenerationTimeMs?: number;
  p95GenerationTimeMs?: number;
  p99GenerationTimeMs?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStatisticsInput {
  date: Date;
  totalGenerated: number;
  totalUnique: number;
  totalDuplicates: number;
  randomCount: number;
  sequentialCount: number;
  batch999Count: number;
  binsUsed: number;
  topBins: Record<string, number>;
  countriesUsed: number;
  topCountries: Record<string, number>;
  usersActive: number;
  topUsers: Record<string, number>;
  avgGenerationTimeMs?: number;
  p95GenerationTimeMs?: number;
  p99GenerationTimeMs?: number;
}

interface StatisticsRow {
  id: string;
  date: Date;
  total_generated: string;
  total_unique: string;
  total_duplicates: string;
  random_count: string;
  sequential_count: string;
  batch_999_count: string;
  bins_used: string;
  top_bins: Record<string, number>;
  countries_used: string;
  top_countries: Record<string, number>;
  users_active: string;
  top_users: Record<string, number>;
  avg_generation_time_ms: string | null;
  p95_generation_time_ms: string | null;
  p99_generation_time_ms: string | null;
  created_at: Date;
  updated_at: Date;
}

const mapRowToStatistics = (row: StatisticsRow): CardGenerationStatistics => ({
  id: row.id,
  date: row.date,
  totalGenerated: parseInt(row.total_generated, 10),
  totalUnique: parseInt(row.total_unique, 10),
  totalDuplicates: parseInt(row.total_duplicates, 10),
  randomCount: parseInt(row.random_count, 10),
  sequentialCount: parseInt(row.sequential_count, 10),
  batch999Count: parseInt(row.batch_999_count, 10),
  binsUsed: parseInt(row.bins_used, 10),
  topBins: row.top_bins || {},
  countriesUsed: parseInt(row.countries_used, 10),
  topCountries: row.top_countries || {},
  usersActive: parseInt(row.users_active, 10),
  topUsers: row.top_users || {},
  avgGenerationTimeMs: row.avg_generation_time_ms ? parseFloat(row.avg_generation_time_ms) : undefined,
  p95GenerationTimeMs: row.p95_generation_time_ms ? parseFloat(row.p95_generation_time_ms) : undefined,
  p99GenerationTimeMs: row.p99_generation_time_ms ? parseFloat(row.p99_generation_time_ms) : undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class CardStatisticsModel {
  private tableName = 'card_generation_statistics';

  /**
   * Create or update statistics for a date
   */
  public async upsert(input: CreateStatisticsInput): Promise<CardGenerationStatistics> {
    const query = `
      INSERT INTO ${this.tableName} (
        date, total_generated, total_unique, total_duplicates,
        random_count, sequential_count, batch_999_count,
        bins_used, top_bins,
        countries_used, top_countries,
        users_active, top_users,
        avg_generation_time_ms, p95_generation_time_ms, p99_generation_time_ms
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (date) DO UPDATE SET
        total_generated = EXCLUDED.total_generated,
        total_unique = EXCLUDED.total_unique,
        total_duplicates = EXCLUDED.total_duplicates,
        random_count = EXCLUDED.random_count,
        sequential_count = EXCLUDED.sequential_count,
        batch_999_count = EXCLUDED.batch_999_count,
        bins_used = EXCLUDED.bins_used,
        top_bins = EXCLUDED.top_bins,
        countries_used = EXCLUDED.countries_used,
        top_countries = EXCLUDED.top_countries,
        users_active = EXCLUDED.users_active,
        top_users = EXCLUDED.top_users,
        avg_generation_time_ms = EXCLUDED.avg_generation_time_ms,
        p95_generation_time_ms = EXCLUDED.p95_generation_time_ms,
        p99_generation_time_ms = EXCLUDED.p99_generation_time_ms,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      input.date,
      input.totalGenerated,
      input.totalUnique,
      input.totalDuplicates,
      input.randomCount,
      input.sequentialCount,
      input.batch999Count,
      input.binsUsed,
      JSON.stringify(input.topBins),
      input.countriesUsed,
      JSON.stringify(input.topCountries),
      input.usersActive,
      JSON.stringify(input.topUsers),
      input.avgGenerationTimeMs || null,
      input.p95GenerationTimeMs || null,
      input.p99GenerationTimeMs || null,
    ];

    try {
      const result: QueryResult<StatisticsRow> = await database.query(query, values);
      return mapRowToStatistics(result.rows[0]);
    } catch (error) {
      logger.error('Failed to upsert statistics', { error, date: input.date });
      throw error;
    }
  }

  /**
   * Get statistics for a specific date
   */
  public async findByDate(date: Date): Promise<CardGenerationStatistics | null> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE date = $1
      LIMIT 1
    `;

    try {
      const result: QueryResult<StatisticsRow> = await database.query(query, [date]);
      if (result.rows.length === 0) {
        return null;
      }
      return mapRowToStatistics(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find statistics by date', { error, date });
      throw error;
    }
  }

  /**
   * Get statistics for a date range
   */
  public async findByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<CardGenerationStatistics[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE date >= $1 AND date <= $2
      ORDER BY date DESC
    `;

    try {
      const result: QueryResult<StatisticsRow> = await database.query(query, [startDate, endDate]);
      return result.rows.map(mapRowToStatistics);
    } catch (error) {
      logger.error('Failed to find statistics by date range', { error, startDate, endDate });
      throw error;
    }
  }

  /**
   * Get latest statistics
   */
  public async getLatest(limit: number = 30): Promise<CardGenerationStatistics[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      ORDER BY date DESC
      LIMIT $1
    `;

    try {
      const result: QueryResult<StatisticsRow> = await database.query(query, [limit]);
      return result.rows.map(mapRowToStatistics);
    } catch (error) {
      logger.error('Failed to get latest statistics', { error, limit });
      throw error;
    }
  }

  /**
   * Get aggregated statistics for a date range
   */
  public async getAggregatedStatistics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalGenerated: number;
    totalUnique: number;
    totalDuplicates: number;
    randomCount: number;
    sequentialCount: number;
    batch999Count: number;
    avgGenerationTimeMs: number;
  }> {
    const query = `
      SELECT
        SUM(total_generated) as total_generated,
        SUM(total_unique) as total_unique,
        SUM(total_duplicates) as total_duplicates,
        SUM(random_count) as random_count,
        SUM(sequential_count) as sequential_count,
        SUM(batch_999_count) as batch_999_count,
        AVG(avg_generation_time_ms) as avg_generation_time_ms
      FROM ${this.tableName}
      WHERE date >= $1 AND date <= $2
    `;

    try {
      const result = await database.query<{
        total_generated: string | null;
        total_unique: string | null;
        total_duplicates: string | null;
        random_count: string | null;
        sequential_count: string | null;
        batch_999_count: string | null;
        avg_generation_time_ms: string | null;
      }>(query, [startDate, endDate]);

      const row = result.rows[0];
      return {
        totalGenerated: parseInt(row.total_generated || '0', 10),
        totalUnique: parseInt(row.total_unique || '0', 10),
        totalDuplicates: parseInt(row.total_duplicates || '0', 10),
        randomCount: parseInt(row.random_count || '0', 10),
        sequentialCount: parseInt(row.sequential_count || '0', 10),
        batch999Count: parseInt(row.batch_999_count || '0', 10),
        avgGenerationTimeMs: row.avg_generation_time_ms ? parseFloat(row.avg_generation_time_ms) : 0,
      };
    } catch (error) {
      logger.error('Failed to get aggregated statistics', { error, startDate, endDate });
      throw error;
    }
  }
}

export const cardStatisticsModel = new CardStatisticsModel();
