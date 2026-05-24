const authResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        username: { type: 'string' },
        email: { type: 'string', format: 'email' },
        country: { type: 'string', nullable: true },
        photoUrl: { type: 'string', nullable: true },
        accessToken: { type: 'string' },
      },
    },
  },
};

const errorResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string' },
  },
};

export const openApiSpec = {
  openapi: '3.0.0',
  info: { title: 'Loonaris API', version: '1.0.0' },
  tags: [
    { name: 'Auth', description: 'Authentication — signup, login, token refresh, profile' },
    { name: 'Clusters', description: 'PostgreSQL cluster management (requires JWT)' },
    { name: 'TestApp', description: 'CRUD smoke-test endpoints (no auth)' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          country: { type: 'string', nullable: true },
          photoUrl: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      SignupRequest: {
        type: 'object',
        required: ['username', 'email', 'password'],
        properties: {
          username: { type: 'string', minLength: 3 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          country: { type: 'string', nullable: true },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      AuthResponse: authResponse,
      ErrorResponse: errorResponse,
    },
  },
  paths: {
    '/auth/signup': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SignupRequest' } } },
        },
        responses: {
          '201': { description: 'User created', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login with email and password',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          '200': { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          '400': { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/auth/refresh-token': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh access token (reads refreshToken cookie)',
        responses: {
          '200': { description: 'New access token returned' },
          '401': { description: 'Refresh token missing or revoked' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout and revoke refresh token',
        responses: { '200': { description: 'Logged out' } },
      },
    },
    '/auth/profile': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Profile data', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          '401': { description: 'Unauthorized' },
        },
      },
      patch: {
        tags: ['Auth'],
        summary: 'Update current user profile',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  username: { type: 'string' },
                  country: { type: 'string' },
                  photoUrl: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Updated profile' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/auth/account': {
      delete: {
        tags: ['Auth'],
        summary: 'Delete account',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Account deleted' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/test': {
      get: {
        tags: ['TestApp'],
        summary: 'List all test entries',
        responses: { '200': { description: 'Array of TestApp objects' } },
      },
      post: {
        tags: ['TestApp'],
        summary: 'Create a test entry',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } } },
        },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/test/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      get: {
        tags: ['TestApp'],
        summary: 'Get a test entry by id',
        responses: { '200': { description: 'TestApp object' }, '404': { description: 'Not found' } },
      },
      put: {
        tags: ['TestApp'],
        summary: 'Update a test entry',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } } },
        },
        responses: { '200': { description: 'Updated' }, '404': { description: 'Not found' } },
      },
      delete: {
        tags: ['TestApp'],
        summary: 'Delete a test entry',
        responses: { '204': { description: 'Deleted' }, '404': { description: 'Not found' } },
      },
    },
  },
};
