# AGENTS.md - Development Guidelines for BIN Check API

This document contains essential guidelines, commands, and conventions for agentic coding agents working on this repository.

## Build, Test, and Lint Commands

### Development Commands
```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Start production server (requires build first)
npm start
```

### Testing Commands
```bash
# Run all tests with coverage
npm test

# Run specific test types
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only

# Run single test file
npx jest tests/unit/bin.test.ts

# Run tests with coverage and specific pattern
npm test -- --testPathPattern=bin --coverage

# Run tests in watch mode
npx jest --watch
```

### Linting and Type Checking
```bash
# Lint all TypeScript files
npm run lint

# Auto-fix lint issues
npm run lint -- --fix

# Type checking (build validates types)
npm run build
```

### Database Commands
```bash
# Run database migrations
npm run migrate

# Production migration
npm run migrate:prod

# Seed database with initial data
npm run seed

# Force seed (overwrite existing data)
npm run seed:force
```

### ETL and Data Processing
```bash
# Run ETL pipeline
npm run etl

# Test cards ETL
npm run etl:test-cards

# Dry run ETL (no database changes)
npm run etl -- --dry-run

# Process specific source
npm run etl -- --source=binlist/data
```

## Project Structure and Architecture

This is a TypeScript Express.js REST API with the following structure:

```
src/
├── config/           # Configuration management
├── controllers/      # Request handlers
├── middleware/       # Express middleware
├── models/          # Database models
├── routes/          # API routes
├── services/        # Business logic
├── utils/           # Utilities
├── types/           # TypeScript definitions
└── index.ts         # Application entry point
```

### Database Architecture
- **PostgreSQL**: Primary database
- **Redis**: Caching and rate limiting
- **Connection Pooling**: Configurable pool settings
- **Migrations**: SQL files in `src/database/migrations/`

### Key Services
- **BIN Service**: Bank Identification Number lookup with LRU caching
- **IBAN Service**: International Bank Account Number validation/generation
- **Auth Service**: JWT-based authentication with refresh tokens
- **2FA Service**: Two-factor authentication support

## Code Style Guidelines

### TypeScript Conventions
- Use **strict mode** (enabled in tsconfig.json)
- **Explicit return types** for all functions and methods
- **Interface definitions** for data structures
- **Enum usage** for fixed sets of values

```typescript
// ✅ Good - explicit return type
export async function getUserById(id: string): Promise<User | null> {
  return await this.userRepository.findById(id);
}

// ❌ Bad - implicit return type
export async function getUserById(id: string) {
  return await this.userRepository.findById(id);
}
```

### Naming Conventions
- **Files**: kebab-case (`user-service.ts`)
- **Variables/Functions**: camelCase (`getUserById`)
- **Classes/Interfaces**: PascalCase (`UserService`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_REQUESTS`)
- **Database tables**: snake_case (`user_profiles`)
- **API endpoints**: kebab-case (`/api/v1/user-profile`)

### Import Organization
```typescript
// 1. Node.js imports
import fs from 'fs';
import path from 'path';

// 2. External libraries
import express from 'express';
import { Router, Request, Response } from 'express';

// 3. Internal imports (use path aliases)
import { User, UserRole } from '@/types';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { UserModel } from '@/models/user';
```

### Error Handling Patterns
- Use custom error classes extending `AppError`
- Always use `asyncHandler` for route handlers
- Implement proper error logging with context
- Never expose sensitive information in error responses

```typescript
// ✅ Good error handling
export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.id;
  const user = await userService.getUserById(userId);
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  sendSuccess(res, user, req.requestId);
});

// ❌ Bad - no error handling
export const getUser = async (req: Request, res: Response) => {
  const user = await userService.getUserById(req.params.id);
  res.json(user);
};
```

### Database Operations
- Use async/await for all database operations
- Implement proper transaction handling for multi-step operations
- Use parameterized queries to prevent SQL injection
- Handle connection errors gracefully

```typescript
// ✅ Good database operation
export async function createUser(userData: CreateUserDto): Promise<User> {
  const hashedPassword = await bcrypt.hash(userData.password, config.security.bcryptRounds);
  
  return await db.transaction(async (trx) => {
    const user = await trx('users').insert({
      ...userData,
      password: hashedPassword,
    }).returning('*');
    
    await trx('user_profiles').insert({
      user_id: user.id,
      // ... profile data
    });
    
    return user;
  });
}
```

## API Design Principles

### Response Format
All API responses must follow the standardized format:

```typescript
// Success response
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "uuid",
    "rateLimit": {
      "limit": 1000,
      "remaining": 999,
      "resetAt": "2024-01-01T00:01:00.000Z"
    }
  }
}

// Error response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "uuid"
  }
}
```

### Authentication
- All endpoints require authentication except `/health` and `/metrics`
- Support both Bearer tokens (JWT) and API keys
- Implement rate limiting based on user tier
- Use middleware for authentication and authorization

### Validation
- Use **Zod** for request body validation
- Use **express-validator** for query parameter validation
- Provide clear error messages with field-specific details

## Testing Guidelines

### Test Structure
```
tests/
├── unit/           # Unit tests for individual functions/classes
├── integration/    # Integration tests for API endpoints
├── fixtures/       # Test data and mock objects
└── setup.ts        # Test configuration and global setup
```

### Writing Tests
- Use **Jest** testing framework
- Follow Arrange-Act-Assert pattern
- Mock external dependencies (database, external APIs)
- Test both success and failure scenarios
- Maintain 80%+ code coverage

```typescript
describe('UserService', () => {
  describe('getUserById', () => {
    it('should return user when found', async () => {
      // Arrange
      const userId = 'user123';
      const expectedUser = { id: userId, name: 'Test User' };
      jest.spyOn(userRepository, 'findById').mockResolvedValue(expectedUser);

      // Act
      const result = await userService.getUserById(userId);

      // Assert
      expect(result).toEqual(expectedUser);
    });
  });
});
```

## Security Guidelines

### Authentication & Authorization
- Use **bcrypt** for password hashing with 12+ rounds
- Implement JWT tokens with short expiration and refresh tokens
- Validate all inputs and sanitize outputs
- Implement rate limiting to prevent abuse
- Use HTTPS in production
- Never commit secrets to the repository

### Data Protection
- Log security events (failed logins, suspicious activity)
- Implement proper CORS configuration
- Use helmet.js for security headers
- Validate all user inputs
- Parameterize all database queries

## Performance Optimization

### Caching Strategy
- **LRU Cache**: For BIN lookups (24-hour TTL)
- **Redis**: For session storage and distributed caching
- Cache invalidation after ETL runs
- Implement cache warming for frequently accessed data

### Database Optimization
- Use connection pooling (min: 2, max: 10)
- Implement proper indexing
- Use read replicas for read-heavy operations
- Monitor slow queries and optimize

## Monitoring and Observability

### Logging
- Use structured JSON logging in production
- Include request IDs for tracing
- Log at appropriate levels (error, warn, info, debug)
- Never log sensitive information

### Metrics
- Prometheus metrics exposed at `/metrics`
- Track request duration, error rates, cache hit/miss
- Monitor database connection pool usage
- Track business metrics (BIN lookups, IBAN validations)

## Environment Configuration

### Required Environment Variables
- `NODE_ENV`: Environment (development/staging/production)
- `JWT_SECRET`: JWT signing secret
- `JWT_REFRESH_SECRET`: Refresh token secret
- `DATABASE_URL` or individual DB parameters
- Redis configuration (URL or host/port)

### Feature Flags
- `FEATURE_CARD_GENERATION`: Enable/disable card generation
- `FEATURE_TEST_CARDS_ACCESS`: Control test card access
- `FEATURE_ADMIN_PANEL`: Enable admin panel features

## Common Patterns

### Service Layer Pattern
```typescript
export class UserService {
  constructor(private userRepository: UserModel) {}

  async getUserById(id: string): Promise<User | null> {
    return await this.userRepository.findById(id);
  }
}
```

### Controller Pattern
```typescript
export const getUserController = {
  async getUser(req: Request, res: Response): Promise<void> {
    const user = await userService.getUserById(req.params.id);
    sendSuccess(res, user, req.requestId);
  }
};
```

### Middleware Pattern
```typescript
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    const payload = await jwt.verify(token, config.jwt.secret);
    req.user = payload;
    next();
  } catch (error) {
    throw new UnauthorizedError('Invalid token');
  }
};
```

## Best Practices

1. **Always use path aliases** (`@/`, `@config/`, etc.) instead of relative imports
2. **Handle all async operations** with proper error handling
3. **Use TypeScript strict mode** and resolve all type errors
4. **Write tests for new features** before submitting PRs
5. **Follow semantic versioning** for API changes
6. **Document breaking changes** in CHANGELOG.md
7. **Run full test suite** before committing changes
8. **Use environment-specific configurations**
9. **Implement proper logging** for debugging and monitoring
10. **Follow REST conventions** for API design

## Deployment Considerations

### Production Checklist
- [ ] All environment variables configured
- [ ] Database migrations run successfully
- [ ] SSL certificates installed
- [ ] Monitoring and logging configured
- [ ] Backup procedures tested
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Performance benchmarks met

### PM2 Process Management
```bash
# Start application
npm run start:pm2

# Restart application
npm run restart:pm2

# View logs
npm run logs:pm2

# Check status
npm run status:pm2
```

Remember: This is a production-ready API handling sensitive financial data. Always prioritize security, performance, and reliability in your implementations.