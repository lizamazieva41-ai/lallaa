import fs from 'fs';
import path from 'path';
import { cardGatewayModel, testCardModel } from '../models/testCard';
import { logger } from '../utils/logger';
import database from '../database/connection';

interface ParsedTestCard {
  gatewaySlug: string;
  brand: string;
  pan: string;
  cvc?: string;
  expiryHint?: string;
  expectedResult?: string;
  testScenario?: string;
  notes?: string;
  sourceLink?: string;
  is3dsEnrolled: boolean;
  cardType: 'credit' | 'debit' | 'prepaid';
  region?: string;
}

export class TestCardsETL {
  private dataDir: string;

  constructor(dataDir: string = '/root/9/payment-sandbox-platform/data/test-payment-cards') {
    this.dataDir = dataDir;
  }

  public async run(): Promise<void> {
    logger.info('Starting Test Cards ETL process');

    try {
      await database.connect();
      
      // Parse the readme.md file
      const readmePath = path.join(this.dataDir, 'readme.md');
      const markdownContent = fs.readFileSync(readmePath, 'utf-8');
      
      const parsedCards = this.parseMarkdown(markdownContent);
      logger.info(`Parsed ${parsedCards.length} test cards from markdown`);

      // Load into database
      await this.loadToDatabase(parsedCards);
      
      logger.info('Test Cards ETL completed successfully');
    } catch (error) {
      logger.error('Test Cards ETL failed', { error });
      throw error;
    } finally {
      await database.disconnect();
    }
  }

  private parseMarkdown(content: string): ParsedTestCard[] {
    const cards: ParsedTestCard[] = [];
    const lines = content.split('\n');
    let currentGateway = '';
    let currentGatewayDocs = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Detect gateway headers
      if (line.startsWith('### ') && !line.includes('Further Resources') && !line.includes('License')) {
        currentGateway = line.replace('### ', '').toLowerCase().replace(/\s+/g, '-');
        currentGatewayDocs = this.extractDocsLink(lines, i + 1);
        continue;
      }

      // Parse table rows
      if (line.includes('|') && this.isTableRow(line)) {
        const card = this.parseTableRow(line, currentGateway, currentGatewayDocs);
        if (card) {
          cards.push(card);
        }
      }
    }

    return cards;
  }

  private extractDocsLink(lines: string[], startIndex: number): string {
    // Look for documentation link in the next few lines
    for (let i = startIndex; i < Math.min(startIndex + 10, lines.length); i++) {
      const line = lines[i].trim();
      if (line.includes('[docs]') || line.includes('[documentation]') || line.includes('[Testing Guide]')) {
        const match = line.match(/\[.*?\]\((.*?)\)/);
        return match ? match[1] : '';
      }
    }
    return '';
  }

  private isTableRow(line: string): boolean {
    // Skip header rows and separator rows
    const cleaned = line.replace(/\s+/g, ' ').trim();
    return cleaned.includes('|') && 
           !cleaned.includes('Card Type') && 
           !cleaned.includes('Card Number') &&
           !cleaned.includes('---') &&
           !cleaned.includes(':---');
  }

  private parseTableRow(line: string, gatewaySlug: string, docsUrl: string): ParsedTestCard | null {
    try {
      const columns = line.split('|').map(col => col.trim()).filter(col => col);
      
      if (columns.length < 2) {
        return null;
      }

      // Different table formats require different parsing strategies
      let card: ParsedTestCard;

      // Simple format: Card Type | Card Number
      if (columns.length === 2) {
        card = this.parseSimpleFormat(columns, gatewaySlug, docsUrl);
      }
      // Medium format: Card Type | Card Number | CVC
      else if (columns.length === 3) {
        card = this.parseMediumFormat(columns, gatewaySlug, docsUrl);
      }
      // Complex format: Card Type | Card Number | Response | ...
      else if (columns.length >= 4) {
        card = this.parseComplexFormat(columns, gatewaySlug, docsUrl);
      } else {
        return null;
      }

      return card;
    } catch (error) {
      logger.warn('Failed to parse table row', { line, error });
      return null;
    }
  }

  private parseSimpleFormat(columns: string[], gatewaySlug: string, docsUrl: string): ParsedTestCard {
    const cardType = columns[0];
    const cardNumbers = this.extractCardNumbers(columns[1]);

    // Take the first card number for now
    const pan = cardNumbers[0] || columns[1];

    return {
      gatewaySlug,
      brand: this.normalizeBrand(cardType),
      pan: this.normalizePAN(pan),
      is3dsEnrolled: false,
      cardType: this.inferCardType(cardType),
    };
  }

  private parseMediumFormat(columns: string[], gatewaySlug: string, docsUrl: string): ParsedTestCard {
    const cardType = columns[0];
    const pan = this.extractCardNumbers(columns[1])[0] || columns[1];
    const cvc = columns[2];

    return {
      gatewaySlug,
      brand: this.normalizeBrand(cardType),
      pan: this.normalizePAN(pan),
      cvc: cvc !== '-' ? cvc : undefined,
      is3dsEnrolled: false,
      cardType: this.inferCardType(cardType),
    };
  }

  private parseComplexFormat(columns: string[], gatewaySlug: string, docsUrl: string): ParsedTestCard {
    const cardType = columns[0];
    const pan = this.extractCardNumbers(columns[1])[0] || columns[1];
    
    // Try to extract additional information from other columns
    let cvc: string | undefined;
    let expectedResult: string | undefined;
    let testScenario: string | undefined;

    // Look for CVC in column 2 or 3
    if (columns.length > 2) {
      if (columns[2].match(/^\d{3,4}$/)) {
        cvc = columns[2];
      }
    }

    // Look for expected result in later columns
    for (let i = 2; i < columns.length; i++) {
      const column = columns[i].toLowerCase();
      if (column.includes('success') || column.includes('decline') || 
          column.includes('approved') || column.includes('failed')) {
        expectedResult = columns[i];
        break;
      }
    }

    // Extract test scenario from column content
    if (columns.length > 3) {
      testScenario = columns[columns.length - 1];
    }

    return {
      gatewaySlug,
      brand: this.normalizeBrand(cardType),
      pan: this.normalizePAN(pan),
      cvc,
      expectedResult,
      testScenario,
      sourceLink: docsUrl,
      is3dsEnrolled: this.infer3DSStatus(columns),
      cardType: this.inferCardType(cardType),
    };
  }

  private extractCardNumbers(text: string): string[] {
    // Extract all card numbers from text (handles multiple numbers separated by 'and', ',', etc.)
    const numbers: string[] = [];
    const parts = text.split(/\s+(?:and|,)\s+/);
    
    for (const part of parts) {
      const cleaned = part.replace(/[^\d\s]/g, '').trim();
      if (cleaned.length >= 12 && cleaned.length <= 19) {
        numbers.push(cleaned);
      }
    }
    
    return numbers;
  }

  private normalizeBrand(cardType: string): string {
    const normalized = cardType.toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    const brandMap: Record<string, string> = {
      'visa': 'Visa',
      'mastercard': 'MasterCard',
      'master card': 'MasterCard',
      'american express': 'American Express',
      'amex': 'American Express',
      'diners club': 'Diners Club',
      'discover': 'Discover',
      'jcb': 'JCB',
      'maestro': 'Maestro',
      'laser': 'Laser',
      'solo': 'Solo',
      'switch': 'Switch',
      'uatp': 'UATP',
      'carte bleue': 'Carte Bleue',
      'dankort': 'Dankort',
      'electron': 'Visa Electron',
    };

    // Check for exact matches first
    if (brandMap[normalized]) {
      return brandMap[normalized];
    }

    // Check for partial matches
    for (const [key, value] of Object.entries(brandMap)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
    }

    // Return capitalized version as fallback
    return normalized.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  private normalizePAN(pan: string): string {
    // Remove all non-digit characters
    return pan.replace(/\D/g, '');
  }

  private inferCardType(cardType: string): 'credit' | 'debit' | 'prepaid' {
    const normalized = cardType.toLowerCase();
    
    if (normalized.includes('debit')) {
      return 'debit';
    }
    if (normalized.includes('prepaid') || normalized.includes('gift')) {
      return 'prepaid';
    }
    
    return 'credit'; // Default to credit
  }

  private infer3DSStatus(columns: string[]): boolean {
    const text = columns.join(' ').toLowerCase();
    return text.includes('3ds') || text.includes('3d secure') || text.includes('verified by visa') || text.includes('securecode');
  }

  private async loadToDatabase(cards: ParsedTestCard[]): Promise<void> {
    logger.info(`Loading ${cards.length} test cards to database`);

    // Group cards by gateway
    const cardsByGateway = cards.reduce((acc, card) => {
      if (!acc[card.gatewaySlug]) {
        acc[card.gatewaySlug] = [];
      }
      acc[card.gatewaySlug].push(card);
      return acc;
    }, {} as Record<string, ParsedTestCard[]>);

    // Process each gateway
    for (const [gatewaySlug, gatewayCards] of Object.entries(cardsByGateway)) {
      try {
        // Find or create gateway
        let gateway = await cardGatewayModel.findBySlug(gatewaySlug);
        
        if (!gateway) {
          const gatewayName = this.slugToName(gatewaySlug);
          gateway = await cardGatewayModel.create({
            name: gatewayName,
            slug: gatewaySlug,
            isActive: true,
          });
          logger.info(`Created new gateway: ${gatewayName}`);
        }

        // Prepare cards for bulk insert
        const cardsToInsert = gatewayCards.map(card => ({
          gatewayId: gateway.id,
          brand: card.brand,
          pan: this.maskPAN(card.pan), // Store masked PAN for security
          cvc: card.cvc,
          expiryHint: card.expiryHint,
          expectedResult: card.expectedResult,
          testScenario: card.testScenario,
          notes: card.notes,
          sourceLink: card.sourceLink,
          is3dsEnrolled: card.is3dsEnrolled,
          cardType: card.cardType,
          region: card.region,
        }));

        // Bulk insert cards
        if (cardsToInsert.length > 0) {
          await testCardModel.bulkCreate(cardsToInsert);
          logger.info(`Loaded ${cardsToInsert.length} test cards for gateway ${gateway.name}`);
        }
      } catch (error) {
        logger.error(`Failed to load cards for gateway ${gatewaySlug}`, { error });
        throw error;
      }
    }
  }

  private slugToName(slug: string): string {
    return slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private maskPAN(pan: string): string {
    // Mask all but first 6 and last 4 digits
    if (pan.length <= 10) {
      return '*'.repeat(pan.length);
    }
    
    const first6 = pan.substring(0, 6);
    const last4 = pan.substring(pan.length - 4);
    const middle = '*'.repeat(pan.length - 10);
    
    return first6 + middle + last4;
  }
}

// Export for standalone execution
export default TestCardsETL;

// Run if called directly
if (require.main === module) {
  const etl = new TestCardsETL();
  etl.run().catch((error) => {
    console.error('ETL failed:', error);
    process.exit(1);
  });
}