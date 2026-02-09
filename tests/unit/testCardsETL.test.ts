/**
 * Unit Tests for Test Cards ETL Markdown Parsing
 */

import { TestCardsETL } from '../../src/services/testCardsETL';
import { cardGatewayModel, testCardModel } from '../../src/models/testCard';

describe('TestCardsETL markdown parsing', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should parse simple, medium, and complex table formats', () => {
    const etl = new TestCardsETL('/tmp');
    const markdown = `
### Stripe
[docs](https://stripe.com/docs/testing)
| Card Type | Card Number | CVC | Result | Scenario |
| --- | --- | --- | --- | --- |
| Visa | 4242 4242 4242 4242 | 123 | Success | default |
| Visa (debit) | 4000 0050 0000 0000 | - | Decline | 3DS required |

### Braintree
[documentation](https://example.com/braintree)
| Card Type | Card Number | CVC |
| --- | --- | --- |
| MasterCard | 5555 5555 5555 4444 | 999 |

### Adyen
[Testing Guide](https://example.com/adyen)
| Card Type | Card Number |
| --- | --- |
| Amex | 3782 822463 10005 |
`;

    const cards = (etl as any).parseMarkdown(markdown) as Array<any>;

    expect(cards).toHaveLength(4);

    const stripeCard = cards.find((c) => c.pan === '4242424242424242');
    expect(stripeCard.gatewaySlug).toBe('stripe');
    expect(stripeCard.brand).toBe('Visa');
    expect(stripeCard.cvc).toBe('123');
    expect(stripeCard.expectedResult).toBe('Success');
    expect(stripeCard.testScenario).toBe('default');
    expect(stripeCard.sourceLink).toBe('https://stripe.com/docs/testing');
    expect(stripeCard.is3dsEnrolled).toBe(false);
    expect(stripeCard.cardType).toBe('credit');

    const stripeDebit = cards.find((c) => c.pan === '4000005000000000');
    expect(stripeDebit.cardType).toBe('debit');
    expect(stripeDebit.expectedResult).toBe('Decline');
    expect(stripeDebit.testScenario).toBe('3DS required');
    expect(stripeDebit.is3dsEnrolled).toBe(true);

    const braintreeCard = cards.find((c) => c.pan === '5555555555554444');
    expect(braintreeCard.gatewaySlug).toBe('braintree');
    expect(braintreeCard.cvc).toBe('999');
    expect(braintreeCard.sourceLink).toBeUndefined();

    const adyenCard = cards.find((c) => c.pan === '378282246310005');
    expect(adyenCard.gatewaySlug).toBe('adyen');
    expect(adyenCard.brand).toBe('American Express');
    expect(adyenCard.cvc).toBeUndefined();
  });

  it('should normalize PANs and select the first number in a cell', () => {
    const etl = new TestCardsETL('/tmp');
    const markdown = `
### Stripe
[docs](https://stripe.com/docs/testing)
| Card Type | Card Number |
| --- | --- |
| Visa | 4242 4242 4242 4242 and 4000 0000 0000 0002 |
`;

    const cards = (etl as any).parseMarkdown(markdown) as Array<any>;

    expect(cards).toHaveLength(1);
    expect(cards[0].pan).toBe('4242424242424242');
  });

  it('should mask PANs before loading into the database', async () => {
    const etl = new TestCardsETL('/tmp');
    const cards = [
      {
        gatewaySlug: 'stripe',
        brand: 'Visa',
        pan: '4242424242424242',
        is3dsEnrolled: false,
        cardType: 'credit' as const,
      },
    ];

    jest.spyOn(cardGatewayModel, 'findBySlug').mockResolvedValue({
      id: 1,
      name: 'Stripe',
      slug: 'stripe',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const bulkCreateSpy = jest
      .spyOn(testCardModel, 'bulkCreate')
      .mockResolvedValue([]);

    await (etl as any).loadToDatabase(cards);

    expect(bulkCreateSpy).toHaveBeenCalledWith([
      expect.objectContaining({
        pan: '424242******4242',
      }),
    ]);
  });
});
