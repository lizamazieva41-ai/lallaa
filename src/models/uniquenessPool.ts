import { QueryResult } from 'pg';
import database from '../database/connection';
import { logger } from '../utils/logger';

export interface UniquenessPoolReservation {
  cardHash: string;
  reservedUntil: Date;
  reservedBy: string;
  createdAt: Date;
}

interface UniquenessPoolRow {
  card_hash: string;
  reserved_until: Date;
  reserved_by: string;
  created_at: Date;
}

const mapRowToReservation = (row: UniquenessPoolRow): UniquenessPoolReservation => ({
  cardHash: row.card_hash,
  reservedUntil: row.reserved_until,
  reservedBy: row.reserved_by,
  createdAt: row.created_at,
});

export class UniquenessPoolModel {
  private tableName = 'card_uniqueness_pool';

  /**
   * Reserve a card hash in the uniqueness pool
   */
  public async reserve(
    cardHash: string,
    reservedBy: string,
    ttlSeconds: number = 300
  ): Promise<boolean> {
    const query = `SELECT reserve_card_hash($1, $2, $3) as reserved`;
    
    try {
      const result = await database.query<{ reserved: boolean }>(query, [
        cardHash,
        reservedBy,
        ttlSeconds,
      ]);
      return result.rows[0]?.reserved || false;
    } catch (error) {
      logger.error('Failed to reserve card hash in uniqueness pool', {
        error,
        cardHash,
        reservedBy,
      });
      throw error;
    }
  }

  /**
   * Release a card hash reservation
   */
  public async release(cardHash: string): Promise<boolean> {
    const query = `SELECT release_card_hash($1) as released`;
    
    try {
      const result = await database.query<{ released: boolean }>(query, [cardHash]);
      return result.rows[0]?.released || false;
    } catch (error) {
      logger.error('Failed to release card hash from uniqueness pool', { error, cardHash });
      throw error;
    }
  }

  /**
   * Check if a card hash is reserved
   */
  public async isReserved(cardHash: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM ${this.tableName}
      WHERE card_hash = $1
      AND reserved_until > CURRENT_TIMESTAMP
      LIMIT 1
    `;
    
    try {
      const result = await database.query(query, [cardHash]);
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Failed to check reservation status', { error, cardHash });
      throw error;
    }
  }

  /**
   * Get reservation details
   */
  public async getReservation(cardHash: string): Promise<UniquenessPoolReservation | null> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE card_hash = $1
      AND reserved_until > CURRENT_TIMESTAMP
      LIMIT 1
    `;
    
    try {
      const result: QueryResult<UniquenessPoolRow> = await database.query(query, [cardHash]);
      if (result.rows.length === 0) {
        return null;
      }
      return mapRowToReservation(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get reservation', { error, cardHash });
      throw error;
    }
  }

  /**
   * Cleanup expired reservations
   */
  public async cleanupExpired(): Promise<number> {
    const query = `SELECT cleanup_expired_reservations() as deleted_count`;
    
    try {
      const result = await database.query<{ deleted_count: number }>(query);
      const deletedCount = result.rows[0]?.deleted_count || 0;
      
      if (deletedCount > 0) {
        logger.info('Cleaned up expired uniqueness pool reservations', { deletedCount });
      }
      
      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired reservations', { error });
      throw error;
    }
  }

  /**
   * Get all active reservations for a process
   */
  public async getReservationsByProcess(reservedBy: string): Promise<UniquenessPoolReservation[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE reserved_by = $1
      AND reserved_until > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
    `;
    
    try {
      const result: QueryResult<UniquenessPoolRow> = await database.query(query, [reservedBy]);
      return result.rows.map(mapRowToReservation);
    } catch (error) {
      logger.error('Failed to get reservations by process', { error, reservedBy });
      throw error;
    }
  }

  /**
   * Get statistics about the uniqueness pool
   */
  public async getStatistics(): Promise<{
    totalReservations: number;
    activeReservations: number;
    expiredReservations: number;
    byProcess: Record<string, number>;
  }> {
    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE reserved_until > CURRENT_TIMESTAMP) as active,
        COUNT(*) FILTER (WHERE reserved_until <= CURRENT_TIMESTAMP) as expired,
        reserved_by,
        COUNT(*) as process_count
      FROM ${this.tableName}
      GROUP BY reserved_by
    `;
    
    try {
      const result = await database.query<{
        total: string;
        active: string;
        expired: string;
        reserved_by: string;
        process_count: string;
      }>(query);
      
      let totalReservations = 0;
      let activeReservations = 0;
      let expiredReservations = 0;
      const byProcess: Record<string, number> = {};
      
      for (const row of result.rows) {
        totalReservations += parseInt(row.total, 10);
        activeReservations += parseInt(row.active, 10);
        expiredReservations += parseInt(row.expired, 10);
        byProcess[row.reserved_by] = parseInt(row.process_count, 10);
      }
      
      return {
        totalReservations,
        activeReservations,
        expiredReservations,
        byProcess,
      };
    } catch (error) {
      logger.error('Failed to get uniqueness pool statistics', { error });
      throw error;
    }
  }
}

export const uniquenessPoolModel = new UniquenessPoolModel();
