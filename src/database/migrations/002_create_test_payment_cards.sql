-- Migration: Create test payment cards tables
-- Version: 002_create_test_payment_cards.sql

-- Create card gateways table
CREATE TABLE IF NOT EXISTS card_gateways (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    docs_url TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create test cards table
CREATE TABLE IF NOT EXISTS test_cards (
    id SERIAL PRIMARY KEY,
    gateway_id INTEGER REFERENCES card_gateways(id) ON DELETE CASCADE,
    brand VARCHAR(50) NOT NULL,
    pan VARCHAR(19) NOT NULL, -- Primary Account Number (masked/stored securely)
    cvc VARCHAR(4),
    expiry_hint VARCHAR(50),
    expected_result VARCHAR(100),
    test_scenario VARCHAR(100),
    notes TEXT,
    source_link TEXT,
    is_3ds_enrolled BOOLEAN DEFAULT false,
    card_type VARCHAR(20) DEFAULT 'credit', -- credit, debit, prepaid
    region VARCHAR(50), -- US, EU, UK, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(gateway_id, pan)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_test_cards_gateway_id ON test_cards(gateway_id);
CREATE INDEX IF NOT EXISTS idx_test_cards_brand ON test_cards(brand);
CREATE INDEX IF NOT EXISTS idx_test_cards_expected_result ON test_cards(expected_result);
CREATE INDEX IF NOT EXISTS idx_test_cards_is_3ds_enrolled ON test_cards(is_3ds_enrolled);
CREATE INDEX IF NOT EXISTS idx_test_cards_card_type ON test_cards(card_type);
CREATE INDEX IF NOT EXISTS idx_card_gateways_slug ON card_gateways(slug);
CREATE INDEX IF NOT EXISTS idx_card_gateways_is_active ON card_gateways(is_active);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_card_gateways_updated_at 
    BEFORE UPDATE ON card_gateways 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_test_cards_updated_at 
    BEFORE UPDATE ON test_cards 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial gateways
INSERT INTO card_gateways (name, slug, docs_url, description) VALUES
('Stripe', 'stripe', 'https://stripe.com/docs/testing', 'Stripe payment gateway test cards'),
('Braintree', 'braintree', 'https://developers.braintreepayments.com/reference/general/testing', 'Braintree payment gateway test cards'),
('CyberSource', 'cybersource', 'https://www.cybersource.com/developers/', 'CyberSource payment gateway test cards'),
('Authorize.Net', 'authorizenet', 'http://developer.authorize.net/hello_world/testing_guide/', 'Authorize.Net payment gateway test cards'),
('GlobalPayments', 'globalpayments', 'https://developer.realexpayments.com/#!/resources/test-card-numbers', 'GlobalPayments test cards'),
('PayPal', 'paypal', 'https://developer.paypal.com/docs/classic/lifecycle/sb_about-accounts/', 'PayPal test cards'),
('WorldPay', 'worldpay', 'https://docs.worldpay.com/', 'WorldPay test cards'),
('SagePay', 'sagepay', 'http://www.sagepay.co.uk/support/12/36/test-card-details-for-your-test-transactions', 'SagePay test cards')
ON CONFLICT (name) DO NOTHING;