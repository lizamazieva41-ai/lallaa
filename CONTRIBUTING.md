# Contributing to BIN Check API

Thank you for your interest in contributing to the BIN Check API! This document provides guidelines and information for contributors.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Setup](#development-setup)
3. [Code Style and Guidelines](#code-style-and-guidelines)
4. [Pull Request Process](#pull-request-process)
5. [Testing](#testing)
6. [Documentation](#documentation)
7. [Issue Reporting](#issue-reporting)

## Getting Started

### Prerequisites

- Node.js 18 or higher
- PostgreSQL 15+
- Redis 7+ (optional, for rate limiting)
- Git
- A code editor (VS Code recommended)

### First Time Setup

1. Fork the repository
2. Clone your fork locally:
   ```bash
   git clone https://github.com/yourusername/bin-check-api.git
   cd bin-check-api
   ```
3. Add the original repository as upstream:
   ```bash
   git remote add upstream https://github.com/originalowner/bin-check-api.git
   ```

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Configure your local environment variables in `.env`. See the README.md for details.

4. Set up the database:
   ```bash
   npm run migrate
   npm run seed
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:8080`.

## Code Style and Guidelines

### TypeScript Guidelines

- Use TypeScript for all new code
- Enable strict mode in `tsconfig.json`
- Use interfaces for type definitions
- Prefer explicit return types for functions
- Use `const` by default, `let` only when necessary

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Use camelCase for variables and functions
- Use PascalCase for classes and interfaces
- Use kebab-case for file names

### Example Code Style

```typescript
// Import statements
import { Router, Request, Response } from 'express';
import { UserModel } from '../models/user';

// Class definition
export class UserService {
  // Private properties
  private userRepository: UserModel;

  // Constructor
  constructor(userRepository: UserModel) {
    this.userRepository = userRepository;
  }

  // Public method with explicit return type
  public async getUserById(id: string): Promise<User | null> {
    return await this.userRepository.findById(id);
  }
}
```

### Naming Conventions

- **Files**: kebab-case (e.g., `user-service.ts`)
- **Variables/Functions**: camelCase (e.g., `getUserById`)
- **Classes/Interfaces**: PascalCase (e.g., `UserService`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_REQUESTS`)
- **Endpoints**: kebab-case (e.g., `/api/v1/user-profile`)

## Pull Request Process

### Branching Strategy

1. Create a new branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following the guidelines above.

3. Commit your changes with descriptive messages:
   ```bash
   git commit -m "feat: add user profile endpoint"
   ```

4. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

5. Create a pull request to `main`.

### Commit Message Format

Use the following format:
```
<type>(<scope>): <description>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semi-colons, etc.)
- `refactor`: Code changes that neither fix a bug nor add a feature
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools

**Examples:**
```
feat(auth): add password reset functionality

- Added email template for password reset
- Implemented token generation and validation
- Added rate limiting for password reset requests

Closes #123
```

### Pull Request Requirements

- [ ] All tests pass
- [ ] Code follows style guidelines
- [ ] Self-reviewed the code
- [ ] Updated documentation if necessary
- [ ] Added tests for new functionality
- [ ] No merge conflicts

### Pull Request Template

When creating a pull request, use this template:

```markdown
## Description
Brief description of the changes made.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run tests with coverage
npm test -- --coverage
```

### Test Structure

```
tests/
├── unit/           # Unit tests for individual components
├── integration/    # Integration tests for API endpoints
├── fixtures/       # Test data and mock data
└── setup.ts        # Test configuration and setup
```

### Writing Tests

- Test files should be named `*.test.ts`
- Use Jest for all testing
- Follow the Arrange-Act-Assert pattern
- Mock external dependencies
- Test both success and failure cases
- Maintain test coverage above 80%

**Example Test:**
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

    it('should return null when user not found', async () => {
      // Arrange
      const userId = 'nonexistent';
      jest.spyOn(userRepository, 'findById').mockResolvedValue(null);

      // Act
      const result = await userService.getUserById(userId);

      // Assert
      expect(result).toBeNull();
    });
  });
});
```

## Documentation

### API Documentation

- All public endpoints must be documented in OpenAPI/Swagger format
- Include request/response examples
- Document authentication requirements
- Include error scenarios

### Code Documentation

- Use JSDoc comments for public methods
- Document parameters and return types
- Include usage examples

**Example:**
```typescript
/**
 * Retrieves a user by their unique identifier.
 * 
 * @param userId - The unique identifier of the user
 * @returns Promise resolving to the user object or null if not found
 * @throws {ValidationError} When userId is invalid
 * 
 * @example
 * ```typescript
 * const user = await userService.getUserById('user123');
 * if (user) {
 *   console.log(`Found user: ${user.name}`);
 * }
 * ```
 */
public async getUserById(userId: string): Promise<User | null> {
  // Implementation
}
```

## Issue Reporting

### Bug Reports

When reporting bugs, please include:

1. **Environment Information**:
   - Node.js version
   - Operating system
   - Database version
   - Browser (if applicable)

2. **Steps to Reproduce**:
   - Detailed steps to reproduce the issue
   - Include any relevant data or inputs

3. **Expected vs Actual Behavior**:
   - What you expected to happen
   - What actually happened

4. **Additional Context**:
   - Error messages or stack traces
   - Screenshots if applicable
   - Any other relevant information

### Feature Requests

For feature requests, please include:

1. **Problem Statement**: What problem are you trying to solve?
2. **Proposed Solution**: How do you envision the feature working?
3. **Use Cases**: Who would benefit from this feature and how?
4. **Alternatives Considered**: What other solutions have you considered?

### Security Issues

For security vulnerabilities, please do **not** open a public issue. Instead, email: security@bincheck-api.com with details of the vulnerability.

## Getting Help

If you need help with contributing:

1. Check existing issues and pull requests
2. Read the project documentation
3. Start a discussion in the repository
4. Contact maintainers at support@bincheck-api.com

## Development Tools

### Recommended VS Code Extensions

- TypeScript Importer
- Prettier - Code formatter
- ESLint
- GitLens
- Thunder Client (for API testing)

### Useful Commands

```bash
# Check TypeScript types
npm run build

# Lint code
npm run lint

# Fix auto-fixable lint issues
npm run lint -- --fix

# Database migration
npm run migrate

# Seed database
npm run seed

# Start development with auto-reload
npm run dev
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.