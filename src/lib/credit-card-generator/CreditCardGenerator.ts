export const enum CreditCardVendor {
    VISA,
    MasterCard,
    Amex,
    Diners,
    Discover,
    EnRoute,
    JCB,
    Voyager,
}

export interface ICreditCardPreset {
    digitCount: number;
    prefixes: string[];
}

export default class CreditCardGenerator {
    private static creditCardPresets: ICreditCardPreset[] = [
        {
            digitCount: 16,
            prefixes: [
                "4539",
                "4556",
                "4916",
                "4532",
                "4929",
                "4485",
                "4716",
                "4"
            ]
        },
        {
            digitCount: 16,
            prefixes: [
                "51",
                "52",
                "53",
                "54",
                "55"
            ]
        },
        {
            digitCount: 15,
            prefixes: [
                "34",
                "37"
            ]
        },
        {
            digitCount: 16,
            prefixes: [
                "300",
                "301",
                "302",
                "303",
                "36",
                "38"
            ]
        },
        {
            digitCount: 16,
            prefixes: ["6011"]
        },
        {
            digitCount: 16,
            prefixes: [
                "2014",
                "2149"
            ]
        },
        {
            digitCount: 16,
            prefixes: [
                "35"
            ]
        },
        {
            digitCount: 16,
            prefixes: ["8699"]
        }
    ];

    public static generateSingle(vendor: CreditCardVendor): string {
        if (!this.creditCardPresets[vendor]) {
            throw new Error("[CreditCardGenerator] Unknown credit card vendor '" + vendor + "'");
        }

        return this.generateWithPreset(this.creditCardPresets[vendor]);
    }

    public static generateMultiple(vendor: CreditCardVendor, count: number): string[] {
        if (!this.creditCardPresets[vendor]) {
            throw new Error("[CreditCardGenerator] Unknown credit card vendor '" + vendor + "'");
        }

        const preset = this.creditCardPresets[vendor];
        const numbers = [];

        while (numbers.length < count) {
            numbers.push(this.generateWithPreset(preset));
        }

        return numbers;
    }

    public static generateWithPreset(preset: ICreditCardPreset): string {
        const prefix = preset.prefixes[Math.floor(Math.random() * preset.prefixes.length)];
        const digitsToGenerate = preset.digitCount - prefix.length - 1; // -1 for checksum
        const middleDigits = this.generateRandomNumber(digitsToGenerate);
        const numberWithPrefix = prefix + middleDigits;
        const checksum = this.calculateChecksum(numberWithPrefix);

        return numberWithPrefix + checksum;
    }

    private static generateRandomNumber(length: number): string {
        let cardNumber = "";

        while (cardNumber.length < length) {
            cardNumber += Math.floor(Math.random() * 10);
        }

        return cardNumber;
    }

    private static calculateChecksum(cardNumber: string): number {
        // To calculate the correct checksum, we need to find a digit (0-9)
        // that when appended to cardNumber makes the entire number pass Luhn validation
        for (let checksum = 0; checksum <= 9; checksum++) {
            const fullNumber = cardNumber + checksum.toString();
            if (this.validateCardNumber(fullNumber)) {
                return checksum;
            }
        }
        
        // This should never happen with valid inputs
        return 0;
    }

    private static reverseString(string: string): string {
        const stringParts = string.split("");
        const reverseArray = stringParts.reverse();

        return reverseArray.join("");
    }

    // Validate card number using Luhn algorithm
    public static validateCardNumber(cardNumber: string): boolean {
        if (!cardNumber || !/^\d+$/.test(cardNumber)) {
            return false;
        }

        let sum = 0;
        let isEven = false;

        // Process all digits including checksum
        for (let i = cardNumber.length - 1; i >= 0; i--) {
            let digit = parseInt(cardNumber[i]);

            if (isEven) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }

            sum += digit;
            isEven = !isEven;
        }

        return sum % 10 === 0;
    }

    // Get card vendor by BIN pattern
    public static getVendorByCardNumber(cardNumber: string): CreditCardVendor | null {
        if (!cardNumber || !/^\d+$/.test(cardNumber)) {
            return null;
        }

        for (let vendor = 0; vendor < this.creditCardPresets.length; vendor++) {
            const preset = this.creditCardPresets[vendor];
            for (const prefix of preset.prefixes) {
                if (cardNumber.startsWith(prefix) && cardNumber.length === preset.digitCount) {
                    return vendor as CreditCardVendor;
                }
            }
        }

        return null;
    }

    // Check if card number matches expected format for vendor
    public static isValidForVendor(cardNumber: string, vendor: CreditCardVendor): boolean {
        if (!cardNumber || !this.creditCardPresets[vendor]) {
            return false;
        }

        const preset = this.creditCardPresets[vendor];
        
        // Check length
        if (cardNumber.length !== preset.digitCount) {
            return false;
        }

        // Check prefix
        const hasValidPrefix = preset.prefixes.some(prefix => cardNumber.startsWith(prefix));
        if (!hasValidPrefix) {
            return false;
        }

        // Validate using Luhn algorithm
        return this.validateCardNumber(cardNumber);
    }
}
