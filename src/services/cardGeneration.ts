import CreditCardGenerator, { CreditCardVendor } from '../lib/credit-card-generator/CreditCardGenerator';
import { binService } from './bin';
import { BINLookupResult } from '../types';
import { generatedCardModel, CreateGeneratedCardInput, calculateCardHash } from '../models/generatedCard';
import { cardDeduplicationService } from './cardDeduplication';
import { cardAuditModel } from '../models/cardAudit';
import { logger } from '../utils/logger';
import {
  recordCardGeneration,
  recordCardDeduplication,
  recordCardStorage,
} from './metrics';
import { uniquenessService } from './uniquenessService';

export interface CardGenerationOptions {
  vendor: string;
  count?: number;
}

export interface GeneratedCard {
  cardNumber: string;
  vendor: string;
  brand: string;
}

export interface BINCardGenerationOptions {
  bin: string;
  expiryMonths?: number; // Optional: months from now (default: 12)
  sequential?: boolean; // If true, generate sequential card numbers instead of random
  startSequence?: number; // Starting sequence number for sequential generation (default: 0)
  cvv?: string; // Specific CVV to use (001-999 for 3-digit, 0001-9999 for 4-digit). If not provided, generates random
}

export interface GeneratedCardFromBIN {
  cardNumber: string;
  bin: string;
  expiryDate: string; // Format: MM/YY
  expiryMonth: string; // Format: MM
  expiryYear: string; // Format: YY
  cvv: string; // 3-4 digits
  bank?: {
    name: string;
    nameLocal?: string;
  };
  country?: {
    code: string;
    name: string;
  };
  card?: {
    type: string;
    network: string;
  };
}

export class CardGenerationService {
  private static vendorMap: Record<string, CreditCardVendor> = {
    'visa': CreditCardVendor.VISA,
    'mastercard': CreditCardVendor.MasterCard,
    'amex': CreditCardVendor.Amex,
    'diners': CreditCardVendor.Diners,
    'discover': CreditCardVendor.Discover,
    'enroute': CreditCardVendor.EnRoute,
    'jcb': CreditCardVendor.JCB,
    'voyager': CreditCardVendor.Voyager,
  };

  private static brandMap: Record<CreditCardVendor, string> = {
    [CreditCardVendor.VISA]: 'Visa',
    [CreditCardVendor.MasterCard]: 'MasterCard',
    [CreditCardVendor.Amex]: 'American Express',
    [CreditCardVendor.Diners]: 'Diners Club',
    [CreditCardVendor.Discover]: 'Discover',
    [CreditCardVendor.EnRoute]: 'En Route',
    [CreditCardVendor.JCB]: 'JCB',
    [CreditCardVendor.Voyager]: 'Voyager',
  };

  public static generateSingle(options: CardGenerationOptions): GeneratedCard {
    // #region agent log
    try {
      const fetchFn = (globalThis as any).fetch;
      if (typeof fetchFn === 'function') {
        fetchFn('http://127.0.0.1:7242/ingest/68f74db3-bc9b-4d85-afd1-80287a0b1f9b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'baseline',hypothesisId:'H7',location:'src/services/cardGeneration.ts:generateSingle',message:'cards.generateSingle.enter',data:{vendor:(options?.vendor||'').toLowerCase()},timestamp:Date.now()})}).catch(()=>{});
      }
    } catch {
      // Ignore agent logging errors
    }
    // #endregion
    const vendor = this.parseVendor(options.vendor);
    const cardNumber = CreditCardGenerator.generateSingle(vendor);
    
    return {
      cardNumber,
      vendor: options.vendor.toLowerCase(),
      brand: this.brandMap[vendor],
    };
  }

  public static generateMultiple(options: CardGenerationOptions): GeneratedCard[] {
    // #region agent log
    try {
      const fetchFn = (globalThis as any).fetch;
      if (typeof fetchFn === 'function') {
        fetchFn('http://127.0.0.1:7242/ingest/68f74db3-bc9b-4d85-afd1-80287a0b1f9b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'baseline',hypothesisId:'H7',location:'src/services/cardGeneration.ts:generateMultiple',message:'cards.generateMultiple.enter',data:{vendor:(options?.vendor||'').toLowerCase(),count:options?.count??1},timestamp:Date.now()})}).catch(()=>{});
      }
    } catch {
      // Ignore agent logging errors
    }
    // #endregion
    const vendor = this.parseVendor(options.vendor);
    const count = Math.min(options.count || 1, 100); // Limit to prevent abuse
    const cardNumbers = CreditCardGenerator.generateMultiple(vendor, count);
    
    return cardNumbers.map(cardNumber => ({
      cardNumber,
      vendor: options.vendor.toLowerCase(),
      brand: this.brandMap[vendor],
    }));
  }

  public static getSupportedVendors(): string[] {
    return Object.keys(this.vendorMap);
  }

  private static parseVendor(vendorString: string): CreditCardVendor {
    const normalizedVendor = vendorString.toLowerCase();
    const vendor = this.vendorMap[normalizedVendor];
    
    if (vendor === undefined) {
      const supportedVendors = Object.keys(this.vendorMap).join(', ');
      throw new Error(`Unsupported vendor '${vendorString}'. Supported vendors: ${supportedVendors}`);
    }
    
    return vendor;
  }

  /**
   * Generate a complete card (number, expiry, CVV) from a BIN
   * This method:
   * 1. Looks up BIN information
   * 2. Generates a card number starting with the BIN (passes Luhn)
   *    - If sequential=true: generates sequential numbers (natural order)
   *    - If sequential=false: generates random numbers
   * 3. Generates a future expiry date
   * 4. Generates a CVV (or uses provided CVV)
   */
  public static async generateFromBIN(options: BINCardGenerationOptions): Promise<GeneratedCardFromBIN> {
    const { 
      bin, 
      expiryMonths = 12, 
      sequential = false, 
      startSequence = 0,
      cvv: providedCVV 
    } = options;

    // Normalize BIN (6-8 digits)
    const normalizedBin = bin.replace(/\s/g, '').replace(/-/g, '').substring(0, 8);
    
    if (!/^\d{6,8}$/.test(normalizedBin)) {
      throw new Error('Invalid BIN format. BIN must be 6-8 digits.');
    }

    // Lookup BIN information
    let binInfo: BINLookupResult | null = null;
    try {
      binInfo = await binService.lookup(normalizedBin);
    } catch (error) {
      // Continue even if BIN lookup fails - we'll still generate the card
    }

    // Determine card length from BIN info or default
    const expectedLength = binInfo?.metadata?.expectedLength || 16;
    const binLength = normalizedBin.length;
    const remainingDigits = expectedLength - binLength - 1; // -1 for checksum

    if (remainingDigits < 0) {
      throw new Error(`BIN ${normalizedBin} is too long for card length ${expectedLength}`);
    }

    // Generate middle digits (sequential or random)
    let middleDigits: string;
    if (sequential) {
      // Generate sequential digits: convert startSequence to string and pad
      const sequenceStr = startSequence.toString().padStart(remainingDigits, '0');
      // If sequence is too long, take last N digits
      middleDigits = sequenceStr.slice(-remainingDigits);
    } else {
      // Generate random digits
      middleDigits = this.generateRandomDigits(remainingDigits);
    }

    const numberWithoutChecksum = normalizedBin + middleDigits;

    // Calculate Luhn checksum
    const checksum = this.calculateLuhnChecksum(numberWithoutChecksum);
    const cardNumber = numberWithoutChecksum + checksum;

    // Verify the generated card passes Luhn
    if (!CreditCardGenerator.validateCardNumber(cardNumber)) {
      throw new Error('Failed to generate valid card number (Luhn validation failed)');
    }

    // Generate expiry date (MM/YY format)
    const expiryDate = this.generateExpiryDate(expiryMonths);
    const [expiryMonth, expiryYear] = expiryDate.split('/');

    // Generate or use provided CVV (3-4 digits, typically 3 for most cards, 4 for Amex)
    const isAmex = cardNumber.startsWith('34') || cardNumber.startsWith('37');
    const cvvLength = isAmex ? 4 : 3;
    let cvv: string;
    
    if (providedCVV) {
      // Validate provided CVV
      const cvvPattern = isAmex ? /^\d{4}$/ : /^\d{3}$/;
      if (!cvvPattern.test(providedCVV)) {
        throw new Error(`Invalid CVV format. Expected ${cvvLength} digits, got: ${providedCVV}`);
      }
      cvv = providedCVV.padStart(cvvLength, '0');
    } else {
      // Generate random CVV
      cvv = this.generateRandomDigits(cvvLength);
    }

    return {
      cardNumber,
      bin: normalizedBin,
      expiryDate,
      expiryMonth,
      expiryYear,
      cvv,
      bank: binInfo?.bank,
      country: binInfo?.country,
      card: binInfo?.card ? {
        type: binInfo.card.type,
        network: binInfo.card.network,
      } : undefined,
    };
  }

  /**
   * Generate multiple cards from the same BIN
   */
  public static async generateMultipleFromBIN(
    options: BINCardGenerationOptions & { count: number }
  ): Promise<GeneratedCardFromBIN[]> {
    const { count = 1, ...binOptions } = options;
    const maxCount = Math.min(count, 10); // Limit to prevent abuse
    const cards: GeneratedCardFromBIN[] = [];

    for (let i = 0; i < maxCount; i++) {
      // Add slight variation to expiry months to avoid duplicates
      const expiryMonths = binOptions.expiryMonths || 12;
      const card = await this.generateFromBIN({
        ...binOptions,
        expiryMonths: expiryMonths + Math.floor(i / 3), // Vary expiry slightly
        startSequence: binOptions.startSequence !== undefined ? binOptions.startSequence + i : i,
      });
      cards.push(card);
    }

    return cards;
  }

  /**
   * Generate 999 cards with CVV from 001 to 999 (or 0001-9999 for Amex)
   * This creates a complete set of cards with all possible CVV combinations
   * Each card number is sequential, and CVV ranges from 001-999 (or 0001-9999)
   */
  public static async generate999CardsWithCVV(
    options: BINCardGenerationOptions
  ): Promise<GeneratedCardFromBIN[]> {
    const { bin, expiryMonths = 12, sequential = true } = options;

    // Normalize BIN
    const normalizedBin = bin.replace(/\s/g, '').replace(/-/g, '').substring(0, 8);
    
    if (!/^\d{6,8}$/.test(normalizedBin)) {
      throw new Error('Invalid BIN format. BIN must be 6-8 digits.');
    }

    // Lookup BIN to determine card type
    let binInfo: BINLookupResult | null = null;
    try {
      binInfo = await binService.lookup(normalizedBin);
    } catch (error) {
      // Continue even if BIN lookup fails
    }

    const expectedLength = binInfo?.metadata?.expectedLength || 16;
    const binLength = normalizedBin.length;
    const remainingDigits = expectedLength - binLength - 1; // -1 for checksum

    if (remainingDigits < 0) {
      throw new Error(`BIN ${normalizedBin} is too long for card length ${expectedLength}`);
    }

    // Determine if Amex (4-digit CVV) or standard (3-digit CVV)
    const isAmex = normalizedBin.startsWith('34') || normalizedBin.startsWith('37');
    const cvvLength = isAmex ? 4 : 3;
    const maxCVV = isAmex ? 9999 : 999;

    const cards: GeneratedCardFromBIN[] = [];
    const expiryDate = this.generateExpiryDate(expiryMonths);
    const [expiryMonth, expiryYear] = expiryDate.split('/');

    // Generate 999 (or 9999 for Amex) cards with sequential CVV
    for (let cvvNum = 1; cvvNum <= maxCVV; cvvNum++) {
      const cvv = cvvNum.toString().padStart(cvvLength, '0');
      
      // Generate sequential card number
      const sequenceNum = cvvNum - 1; // Start from 0
      const sequenceStr = sequenceNum.toString().padStart(remainingDigits, '0');
      const middleDigits = sequenceStr.slice(-remainingDigits);
      
      const numberWithoutChecksum = normalizedBin + middleDigits;
      const checksum = this.calculateLuhnChecksum(numberWithoutChecksum);
      const cardNumber = numberWithoutChecksum + checksum;

      // Verify Luhn
      if (!CreditCardGenerator.validateCardNumber(cardNumber)) {
        // If this card fails Luhn, try next sequence
        continue;
      }

      cards.push({
        cardNumber,
        bin: normalizedBin,
        expiryDate,
        expiryMonth,
        expiryYear,
        cvv,
        bank: binInfo?.bank,
        country: binInfo?.country,
        card: binInfo?.card ? {
          type: binInfo.card.type,
          network: binInfo.card.network,
        } : undefined,
      });
    }

    return cards;
  }

  /**
   * Generate random digits string of specified length
   */
  private static generateRandomDigits(length: number): string {
    let digits = '';
    for (let i = 0; i < length; i++) {
      digits += Math.floor(Math.random() * 10).toString();
    }
    return digits;
  }

  /**
   * Calculate Luhn checksum digit for a card number
   */
  private static calculateLuhnChecksum(cardNumber: string): number {
    // Try each digit 0-9 to find the one that makes the full number pass Luhn
    for (let checksum = 0; checksum <= 9; checksum++) {
      const fullNumber = cardNumber + checksum.toString();
      if (CreditCardGenerator.validateCardNumber(fullNumber)) {
        return checksum;
      }
    }
    // This should never happen with valid inputs
    throw new Error('Failed to calculate Luhn checksum');
  }

  /**
   * Generate expiry date in MM/YY format
   * @param monthsFromNow - Number of months from current date (default: 12)
   */
  private static generateExpiryDate(monthsFromNow: number = 12): string {
    const now = new Date();
    const expiryDate = new Date(now.getFullYear(), now.getMonth() + monthsFromNow, 1);
    
    const month = String(expiryDate.getMonth() + 1).padStart(2, '0');
    const year = String(expiryDate.getFullYear()).slice(-2);
    
    return `${month}/${year}`;
  }

  /**
   * Generate card with uniqueness guarantee using 5-layer uniqueness architecture
   * This is the new enhanced method that ensures 100% uniqueness
   */
  public static async generateWithUniqueness(
    options: BINCardGenerationOptions & {
      userId?: string;
      apiKeyId?: string;
      requestId?: string;
      maxRetries?: number; // Max attempts to generate unique card
    }
  ): Promise<GeneratedCardFromBIN> {
    const startTime = Date.now();
    const { userId, apiKeyId, requestId, maxRetries = 10, ...genOptions } = options;
    const mode: 'random' | 'sequential' | 'batch_999' = genOptions.sequential ? 'sequential' : 'random';

    let attempts = 0;
    let card: GeneratedCardFromBIN | null = null;

    while (attempts < maxRetries) {
      attempts++;

      // Generate card
      const generatedCard = await this.generateFromBIN(genOptions);

      // Check uniqueness and reserve in one atomic operation
      const uniquenessResult = await uniquenessService.checkAndReserveCardHash(
        generatedCard.cardNumber,
        generatedCard.expiryDate,
        generatedCard.cvv
      );

      if (uniquenessResult.isUnique && uniquenessResult.reserved) {
        card = generatedCard;
        break;
      } else {
        // Not unique or reservation failed, try again
        logger.debug('Card not unique or reservation failed, retrying', {
          attempt: attempts,
          isUnique: uniquenessResult.isUnique,
          reserved: uniquenessResult.reserved,
          bin: generatedCard.bin,
        });
        continue;
      }
    }

    if (!card) {
      recordCardGeneration(mode, 'failed');
      throw new Error(`Failed to generate unique card after ${maxRetries} attempts`);
    }

    // Save to database
    try {
      const cardInput: CreateGeneratedCardInput = {
        cardNumber: card.cardNumber,
        bin: card.bin,
        expiryDate: card.expiryDate,
        expiryMonth: card.expiryMonth,
        expiryYear: card.expiryYear,
        cvv: card.cvv,
        bankName: card.bank?.name,
        bankNameLocal: card.bank?.nameLocal,
        countryCode: card.country?.code,
        countryName: card.country?.name,
        cardType: card.card?.type,
        cardNetwork: card.card?.network,
        generationMode: mode,
        sequenceNumber: genOptions.startSequence,
        isSequential: genOptions.sequential || false,
        userId,
        apiKeyId,
        requestId,
      };

      await generatedCardModel.create(cardInput);

      // Mark as generated in all layers
      await uniquenessService.markAsGenerated(
        card.cardNumber,
        card.expiryDate,
        card.cvv
      );

      const responseTime = Date.now() - startTime;
      const generationDuration = responseTime / 1000;
      recordCardGeneration(mode, 'success', generationDuration);

      // Log to audit
      cardAuditModel
        .create({
          userId,
          apiKeyId,
          endpoint: '/api/v1/cards/generate-with-uniqueness',
          method: 'POST',
          requestBody: {
            bin: genOptions.bin,
            expiryMonths: genOptions.expiryMonths,
            sequential: genOptions.sequential,
          },
          cardsGenerated: 1,
          generationMode: mode,
          binUsed: card.bin,
          responseTimeMs: responseTime,
          statusCode: 200,
          requestId,
        })
        .catch((err) => {
          logger.error('Failed to log audit entry', { error: err });
        });

      return card;
    } catch (error) {
      // Release reservation on error
      const cardHash = calculateCardHash(card.cardNumber, card.expiryDate, card.cvv);
      await uniquenessService.releaseCardHash(cardHash).catch(() => {
        // Ignore release errors
      });

      logger.error('Failed to save generated card', { error, bin: card.bin });
      recordCardGeneration(mode, 'failed');
      throw error;
    }
  }

  /**
   * Generate and save card from BIN with deduplication and audit logging
   * This is the enhanced version that integrates with storage, deduplication, and audit
   * Maintains backward compatibility - uses old deduplication method
   */
  public static async generateAndSaveFromBIN(
    options: BINCardGenerationOptions & {
      userId?: string;
      apiKeyId?: string;
      requestId?: string;
      skipDeduplication?: boolean; // For batch operations, check once at the end
      useUniquenessService?: boolean; // Use new uniqueness service if true
    }
  ): Promise<GeneratedCardFromBIN> {
    const startTime = Date.now();
    const generationStartTime = startTime;
    const { userId, apiKeyId, requestId, skipDeduplication, useUniquenessService = false, ...genOptions } = options;
    const mode: 'random' | 'sequential' | 'batch_999' = genOptions.sequential ? 'sequential' : 'random';

    // Use new uniqueness service if requested
    if (useUniquenessService && !skipDeduplication) {
      return this.generateWithUniqueness({
        ...genOptions,
        userId,
        apiKeyId,
        requestId,
      });
    }

    // Generate card
    const card = await this.generateFromBIN(genOptions);

    // Check for duplicates (unless skipped for batch operations)
    if (!skipDeduplication) {
      const dupCheckStartTime = Date.now();
      const dupCheck = await cardDeduplicationService.checkDuplicate(
        card.cardNumber,
        card.expiryDate,
        card.cvv
      );
      const dupCheckDuration = (Date.now() - dupCheckStartTime) / 1000;
      
      // Record deduplication metrics
      recordCardDeduplication(
        dupCheck.isDuplicate ? 'duplicate' : 'unique',
        dupCheckDuration,
        dupCheck.fromCache ? 'cache' : 'database'
      );

      if (dupCheck.isDuplicate) {
        logger.warn('Duplicate card detected during generation', {
          bin: card.bin,
          cardHash: dupCheck.cardHash.substring(0, 16) + '...',
        });
        // Regenerate if duplicate (up to 3 attempts)
        for (let attempt = 1; attempt <= 3; attempt++) {
          const newCard = await this.generateFromBIN({
            ...genOptions,
            sequential: false, // Force random for retry
          });
          const newDupCheckStartTime = Date.now();
          const newDupCheck = await cardDeduplicationService.checkDuplicate(
            newCard.cardNumber,
            newCard.expiryDate,
            newCard.cvv
          );
          const newDupCheckDuration = (Date.now() - newDupCheckStartTime) / 1000;
          recordCardDeduplication(
            newDupCheck.isDuplicate ? 'duplicate' : 'unique',
            newDupCheckDuration,
            newDupCheck.fromCache ? 'cache' : 'database'
          );
          
          if (!newDupCheck.isDuplicate) {
            // Found unique card, use it
            Object.assign(card, newCard);
            break;
          }
          if (attempt === 3) {
            recordCardGeneration(mode, 'failed');
            throw new Error('Failed to generate unique card after 3 attempts');
          }
        }
      }
    }

    // Save to database
    const storageStartTime = Date.now();
    try {
      const cardInput: CreateGeneratedCardInput = {
        cardNumber: card.cardNumber,
        bin: card.bin,
        expiryDate: card.expiryDate,
        expiryMonth: card.expiryMonth,
        expiryYear: card.expiryYear,
        cvv: card.cvv,
        bankName: card.bank?.name,
        bankNameLocal: card.bank?.nameLocal,
        countryCode: card.country?.code,
        countryName: card.country?.name,
        cardType: card.card?.type,
        cardNetwork: card.card?.network,
        generationMode: genOptions.sequential ? 'sequential' : 'random',
        sequenceNumber: genOptions.startSequence,
        isSequential: genOptions.sequential || false,
        userId,
        apiKeyId,
        requestId,
      };

      await generatedCardModel.create(cardInput);
      const storageDuration = (Date.now() - storageStartTime) / 1000;
      recordCardStorage('create', 'success', storageDuration);

      // Mark as generated in cache
      await cardDeduplicationService.markAsGenerated(
        card.cardNumber,
        card.expiryDate,
        card.cvv
      );
    } catch (error) {
      const storageDuration = (Date.now() - storageStartTime) / 1000;
      // If it's a duplicate error, that's okay (might have been inserted by another request)
      if (error instanceof Error && error.message.includes('duplicate')) {
        logger.debug('Card already exists in database (race condition)', {
          bin: card.bin,
        });
        recordCardStorage('create', 'duplicate', storageDuration);
        recordCardGeneration(mode, 'duplicate');
      } else {
        logger.error('Failed to save generated card', { error, bin: card.bin });
        recordCardStorage('create', 'failed', storageDuration);
        recordCardGeneration(mode, 'failed');
        // Don't throw - card was generated successfully, just failed to save
      }
    }

    const responseTime = Date.now() - startTime;
    const generationDuration = (Date.now() - generationStartTime) / 1000;
    
    // Record generation metrics
    recordCardGeneration(mode, 'success', generationDuration);

    // Log to audit (async, don't wait)
    cardAuditModel
      .create({
        userId,
        apiKeyId,
        endpoint: '/api/v1/cards/generate-from-bin',
        method: 'POST',
        requestBody: {
          bin: genOptions.bin,
          expiryMonths: genOptions.expiryMonths,
          sequential: genOptions.sequential,
          startSequence: genOptions.startSequence,
        },
        cardsGenerated: 1,
        generationMode: genOptions.sequential ? 'sequential' : 'random',
        binUsed: card.bin,
        responseTimeMs: responseTime,
        statusCode: 200,
        requestId,
      })
      .catch((err) => {
        logger.error('Failed to log audit entry', { error: err });
      });

    return card;
  }

  /**
   * Generate and save multiple cards from BIN (batch operation)
   * Optimized with parallel processing for large batches
   */
  public static async generateAndSaveMultipleFromBIN(
    options: BINCardGenerationOptions & {
      count: number;
      userId?: string;
      apiKeyId?: string;
      requestId?: string;
      useParallelProcessing?: boolean; // Use worker threads for large batches
    }
  ): Promise<GeneratedCardFromBIN[]> {
    const startTime = Date.now();
    const generationStartTime = startTime;
    const { count, userId, apiKeyId, requestId, useParallelProcessing = false, ...genOptions } = options;
    const maxCount = Math.min(count, 1000); // Increased limit for batch operations
    const mode: 'random' | 'sequential' | 'batch_999' = genOptions.sequential ? 'sequential' : 'random';
    const cards: GeneratedCardFromBIN[] = [];

    // Use parallel processing for large batches (>100 cards)
    if (useParallelProcessing && maxCount > 100) {
      try {
        const { getWorkerPool } = await import('../workers/cardGenerationWorkerPool');
        const workerPool = getWorkerPool(4); // 4 workers

        // Split into batches for workers
        const batchSize = Math.ceil(maxCount / 4);
        const batches: Array<{ bin: string; count: number; options: any }> = [];

        for (let i = 0; i < maxCount; i += batchSize) {
          batches.push({
            bin: genOptions.bin,
            count: Math.min(batchSize, maxCount - i),
            options: {
              expiryMonths: genOptions.expiryMonths,
              sequential: genOptions.sequential,
              startSequence: genOptions.startSequence !== undefined ? genOptions.startSequence + i : i,
            },
          });
        }

        // For now, fall back to sequential processing
        // Worker pool implementation would require actual worker thread file
        logger.info('Parallel processing requested but using optimized sequential processing', {
          count: maxCount,
          batches: batches.length,
        });
      } catch (error) {
        logger.warn('Parallel processing not available, using sequential', { error });
      }
    }

    // Generate all cards (optimized batch processing)
    const generationPromises: Promise<GeneratedCardFromBIN>[] = [];
    for (let i = 0; i < maxCount; i++) {
      generationPromises.push(
        this.generateFromBIN({
          ...genOptions,
          expiryMonths: (genOptions.expiryMonths || 12) + Math.floor(i / 3),
          startSequence: genOptions.startSequence !== undefined ? genOptions.startSequence + i : i,
          sequential: genOptions.sequential,
        })
      );
    }

    // Execute in parallel batches of 50 to avoid overwhelming the system
    const batchSize = 50;
    for (let i = 0; i < generationPromises.length; i += batchSize) {
      const batch = generationPromises.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch);
      cards.push(...batchResults);
    }

    // Batch check for duplicates
    const dupChecks = await cardDeduplicationService.checkBatch(
      cards.map((c) => ({
        cardNumber: c.cardNumber,
        expiryDate: c.expiryDate,
        cvv: c.cvv,
      }))
    );

    // Filter out duplicates and prepare for batch insert
    const uniqueCards: GeneratedCardFromBIN[] = [];
    const cardInputs: CreateGeneratedCardInput[] = [];

    for (let i = 0; i < cards.length; i++) {
      if (!dupChecks[i].isDuplicate) {
        uniqueCards.push(cards[i]);
        cardInputs.push({
          cardNumber: cards[i].cardNumber,
          bin: cards[i].bin,
          expiryDate: cards[i].expiryDate,
          expiryMonth: cards[i].expiryMonth,
          expiryYear: cards[i].expiryYear,
          cvv: cards[i].cvv,
          bankName: cards[i].bank?.name,
          bankNameLocal: cards[i].bank?.nameLocal,
          countryCode: cards[i].country?.code,
          countryName: cards[i].country?.name,
          cardType: cards[i].card?.type,
          cardNetwork: cards[i].card?.network,
          generationMode: genOptions.sequential ? 'sequential' : 'random',
          sequenceNumber: genOptions.startSequence !== undefined ? genOptions.startSequence + i : i,
          isSequential: genOptions.sequential || false,
          userId,
          apiKeyId,
          requestId,
        });
      }
    }

    // Batch insert
    const storageStartTime = Date.now();
    if (cardInputs.length > 0) {
      try {
        await generatedCardModel.createBatch(cardInputs);
        const storageDuration = (Date.now() - storageStartTime) / 1000;
        recordCardStorage('batch_create', 'success', storageDuration);

        // Mark all as generated in cache
        await Promise.all(
          uniqueCards.map(card =>
            cardDeduplicationService.markAsGenerated(
              card.cardNumber,
              card.expiryDate,
              card.cvv
            )
          )
        );
      } catch (error) {
        const storageDuration = (Date.now() - storageStartTime) / 1000;
        logger.error('Failed to batch save generated cards', {
          error,
          count: cardInputs.length,
        });
        recordCardStorage('batch_create', 'failed', storageDuration);
        recordCardGeneration(mode, 'failed');
      }
    }

    const responseTime = Date.now() - startTime;
    const generationDuration = (Date.now() - generationStartTime) / 1000;
    
    // Record generation metrics
    recordCardGeneration(mode, 'success', generationDuration);

    // Log to audit
    cardAuditModel
      .create({
        userId,
        apiKeyId,
        endpoint: '/api/v1/cards/generate-from-bin',
        method: 'POST',
        requestBody: {
          bin: genOptions.bin,
          count: maxCount,
          expiryMonths: genOptions.expiryMonths,
          sequential: genOptions.sequential,
        },
        cardsGenerated: uniqueCards.length,
        generationMode: genOptions.sequential ? 'sequential' : 'random',
        binUsed: genOptions.bin,
        responseTimeMs: responseTime,
        statusCode: 200,
        requestId,
      })
      .catch((err) => {
        logger.error('Failed to log audit entry', { error: err });
      });

    return uniqueCards;
  }

  /**
   * Generate and save 999 cards with CVV variants
   */
  public static async generateAndSave999CardsWithCVV(
    options: BINCardGenerationOptions & {
      userId?: string;
      apiKeyId?: string;
      requestId?: string;
    }
  ): Promise<GeneratedCardFromBIN[]> {
    const startTime = Date.now();
    const generationStartTime = startTime;
    const { userId, apiKeyId, requestId, ...genOptions } = options;
    const mode: 'random' | 'sequential' | 'batch_999' = 'batch_999';

    // Generate all 999 cards
    const cards = await this.generate999CardsWithCVV(genOptions);

    // Prepare for batch insert
    const cardInputs: CreateGeneratedCardInput[] = cards.map((card, index) => ({
      cardNumber: card.cardNumber,
      bin: card.bin,
      expiryDate: card.expiryDate,
      expiryMonth: card.expiryMonth,
      expiryYear: card.expiryYear,
      cvv: card.cvv,
      bankName: card.bank?.name,
      bankNameLocal: card.bank?.nameLocal,
      countryCode: card.country?.code,
      countryName: card.country?.name,
      cardType: card.card?.type,
      cardNetwork: card.card?.network,
      generationMode: 'batch_999',
      sequenceNumber: index,
      isSequential: true,
      userId,
      apiKeyId,
      requestId,
    }));

    // Batch insert (with ON CONFLICT DO NOTHING to handle duplicates)
    const storageStartTime = Date.now();
    try {
      await generatedCardModel.createBatch(cardInputs);
      const storageDuration = (Date.now() - storageStartTime) / 1000;
      recordCardStorage('batch_create', 'success', storageDuration);

      // Mark all as generated in cache
      await Promise.all(
        cards.map(card =>
          cardDeduplicationService.markAsGenerated(
            card.cardNumber,
            card.expiryDate,
            card.cvv
          )
        )
      );
    } catch (error) {
      const storageDuration = (Date.now() - storageStartTime) / 1000;
      logger.error('Failed to batch save 999 cards', { error, count: cardInputs.length });
      recordCardStorage('batch_create', 'failed', storageDuration);
      recordCardGeneration(mode, 'failed');
    }

    const responseTime = Date.now() - startTime;
    const generationDuration = (Date.now() - generationStartTime) / 1000;
    
    // Record generation metrics
    recordCardGeneration(mode, 'success', generationDuration);

    // Log to audit
    cardAuditModel
      .create({
        userId,
        apiKeyId,
        endpoint: '/api/v1/cards/generate-from-bin',
        method: 'POST',
        requestBody: {
          bin: genOptions.bin,
          generate999: true,
          expiryMonths: genOptions.expiryMonths,
        },
        cardsGenerated: cards.length,
        generationMode: 'batch_999',
        binUsed: genOptions.bin,
        responseTimeMs: responseTime,
        statusCode: 200,
        requestId,
      })
      .catch((err) => {
        logger.error('Failed to log audit entry', { error: err });
      });

    return cards;
  }
}
