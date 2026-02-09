# Card Generation from BIN

Tính năng tạo số thẻ, ngày hết hạn và CVV từ BIN đầu vào với logic nâng cao.

## API Endpoint

```http
POST /api/v1/cards/generate-from-bin
```

### Authentication
- Yêu cầu: JWT Bearer Token hoặc API Key
- Feature Flag: `FEATURE_CARD_GENERATION` phải enabled

### Request Body

#### Basic Request
```json
{
  "bin": "453212",
  "expiryMonths": 12,
  "count": 1
}
```

#### Advanced Request (Sequential Generation)
```json
{
  "bin": "453212",
  "expiryMonths": 12,
  "sequential": true,
  "startSequence": 0,
  "cvv": "123"
}
```

#### Generate 999 Cards with CVV 001-999
```json
{
  "bin": "453212",
  "expiryMonths": 12,
  "generate999": true
}
```

**Parameters:**
- `bin` (required): BIN 6-8 chữ số
- `expiryMonths` (optional): Số tháng từ hiện tại đến ngày hết hạn (default: 12, max: 120)
- `count` (optional): Số lượng thẻ cần tạo (default: 1, max: 10)
- `sequential` (optional): Nếu `true`, generate số thẻ theo thứ tự tự nhiên thay vì random (default: false)
- `startSequence` (optional): Số bắt đầu cho sequential generation (default: 0)
- `cvv` (optional): CVV cụ thể (001-999 cho 3-digit, 0001-9999 cho 4-digit Amex). Nếu không có, sẽ generate random
- `generate999` (optional): Nếu `true`, generate 999 cards với CVV từ 001-999 (hoặc 0001-9999 cho Amex)

### Response

**Success (200):**
```json
{
  "success": true,
  "data": {
    "cards": [
      {
        "cardNumber": "4532123456789012",
        "bin": "453212",
        "expiryDate": "12/25",
        "expiryMonth": "12",
        "expiryYear": "25",
        "cvv": "123",
        "bank": {
          "name": "JPMORGAN CHASE BANK NA",
          "nameLocal": null
        },
        "country": {
          "code": "US",
          "name": "United States"
        },
        "card": {
          "type": "credit",
          "network": "visa"
        }
      }
    ],
    "count": 1
  },
  "meta": {
    "timestamp": "2026-01-26T10:30:00.000Z",
    "requestId": "req-abc123"
  }
}
```

**Error (400):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_BIN",
    "message": "BIN must be 6-8 digits"
  }
}
```

## Tính năng

### 1. BIN Lookup
- Tự động lookup thông tin BIN từ database
- Lấy thông tin: bank name, country, card type, network
- Nếu BIN không tìm thấy, vẫn generate card nhưng không có thông tin bank/country

### 2. Card Number Generation

#### Random Generation (default)
- Generate số thẻ bắt đầu bằng BIN với các số ngẫu nhiên
- Tự động tính Luhn checksum để đảm bảo số thẻ hợp lệ

#### Sequential Generation (`sequential: true`)
- **Logic quan trọng**: Nếu BIN có 6 hoặc 8 số, các số sau sẽ là dãy số tự nhiên ngẫu nhiên và theo thứ tự lần lượt
- Generate số thẻ theo thứ tự tăng dần (sequential/incremental)
- Bắt đầu từ `startSequence` (default: 0)
- Ví dụ với BIN "453212" (6 digits):
  - Sequence 0: `453212000000000` → `453212000000000X` (X = Luhn checksum)
  - Sequence 1: `453212000000001` → `453212000000001Y`
  - Sequence 2: `453212000000002` → `453212000000002Z`
  - ...
- Độ dài thẻ được xác định từ BIN info hoặc default 16 digits
- Tất cả số thẻ đều pass Luhn validation

### 3. Expiry Date Generation
- Format: MM/YY (ví dụ: "12/25")
- Mặc định: 12 tháng từ hiện tại
- Có thể tùy chỉnh qua `expiryMonths` parameter (1-120 tháng)
- Tất cả cards trong cùng batch có cùng expiry date

### 4. CVV Generation

#### Random CVV (default)
- 3 digits cho hầu hết thẻ (Visa, MasterCard, etc.): 000-999
- 4 digits cho American Express (BIN bắt đầu bằng 34 hoặc 37): 0000-9999
- Random generation

#### Specific CVV
- Có thể chỉ định CVV cụ thể qua parameter `cvv`
- Format: "001"-"999" (3-digit) hoặc "0001"-"9999" (4-digit Amex)

#### Generate 999 Cards with CVV 001-999 (`generate999: true`)
- **Logic quan trọng**: Mỗi một dãy số thẻ nếu để tạo ngẫu nhiên sẽ phải tạo 999 thông tin để tương ứng với số CVV từ 001 đến 999
- Generate 999 cards (hoặc 9999 cho Amex) với:
  - Số thẻ sequential (tăng dần)
  - CVV từ 001-999 (hoặc 0001-9999 cho Amex)
  - Cùng expiry date
- Mỗi card number có CVV tương ứng theo thứ tự:
  - Card 1: CVV "001"
  - Card 2: CVV "002"
  - ...
  - Card 999: CVV "999"

## Ví dụ sử dụng

### 1. Generate 1 card (random)
```bash
curl -X POST http://localhost:8080/api/v1/cards/generate-from-bin \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bin": "453212",
    "expiryMonths": 12
  }'
```

### 2. Generate sequential cards
```bash
curl -X POST http://localhost:8080/api/v1/cards/generate-from-bin \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bin": "453212",
    "expiryMonths": 12,
    "sequential": true,
    "startSequence": 0,
    "count": 5
  }'
```

### 3. Generate card with specific CVV
```bash
curl -X POST http://localhost:8080/api/v1/cards/generate-from-bin \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bin": "453212",
    "expiryMonths": 12,
    "sequential": true,
    "cvv": "123"
  }'
```

### 4. Generate 999 cards with CVV 001-999
```bash
curl -X POST http://localhost:8080/api/v1/cards/generate-from-bin \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bin": "453212",
    "expiryMonths": 12,
    "generate999": true
  }'
```

### JavaScript/TypeScript
```typescript
const response = await fetch('http://localhost:8080/api/v1/cards/generate-from-bin', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    bin: '453212',
    expiryMonths: 12,
    count: 1,
  }),
});

const data = await response.json();
console.log(data.data.cards[0]);
```

### Python
```python
import requests

url = "http://localhost:8080/api/v1/cards/generate-from-bin"
headers = {
    "Authorization": "Bearer YOUR_JWT_TOKEN",
    "Content-Type": "application/json"
}
payload = {
    "bin": "453212",
    "expiryMonths": 12,
    "count": 1
}

response = requests.post(url, json=payload, headers=headers)
data = response.json()
print(data["data"]["cards"][0])
```

## Rate Limiting

- Default: 5 requests/hour (free tier)
- Có thể điều chỉnh theo user tier
- Window: 1 hour

## Security

- Authentication required
- Feature flag protection
- Rate limiting
- Max count limit: 10 cards per request
- BIN validation: chỉ chấp nhận 6-8 digits

## Validation

- BIN: Phải là 6-8 chữ số
- ExpiryMonths: 1-120 tháng
- Count: 1-10 thẻ

## Error Codes

- `MISSING_BIN`: BIN không được cung cấp
- `INVALID_BIN`: BIN không đúng format hoặc quá dài
- `INVALID_EXPIRY_MONTHS`: Expiry months ngoài phạm vi 1-120
- `GENERATION_FAILED`: Lỗi khi generate (Luhn validation failed, etc.)
