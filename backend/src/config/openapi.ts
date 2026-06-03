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
      ClusterDto: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          k8sNamespace: { type: 'string' },
          region: { type: 'string' },
          pgVersion: { type: 'string', enum: ['16', '17', '18'] },
          size: {
            type: 'string',
            enum: ['starter', 'pro', 'scale'],
            description: 'Inferred from cpu — display only',
          },
          deploymentOption: {
            type: 'string',
            enum: ['SINGLE_AZ_INSTANCE', 'MULTI_AZ_INSTANCE', 'MULTI_AZ_CLUSTER'],
          },
          status: {
            type: 'string',
            enum: ['provisioning', 'running', 'stopped', 'error', 'deleting'],
          },
          cpu: { type: 'string', example: '2' },
          ram: { type: 'string', example: '4Gi' },
          storage: { type: 'string', example: '50Gi' },
          readReplicas: { type: 'integer' },
          backup: { type: 'boolean' },
          autoscale: { type: 'boolean' },
          storageUsedGb: { type: 'number' },
          provisionedStorageGb: { type: 'number' },
          estimatedPrice: { type: 'number' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateClusterRequest: {
        type: 'object',
        required: ['name', 'region', 'pgVersion', 'size', 'deploymentOption'],
        properties: {
          name: { type: 'string', example: 'my-db' },
          region: { type: 'string', example: 'eu-west-1' },
          pgVersion: { type: 'string', enum: ['16', '17', '18'], example: '17' },
          size: { type: 'string', enum: ['starter', 'pro', 'scale'], example: 'starter' },
          deploymentOption: {
            type: 'string',
            enum: ['SINGLE_AZ_INSTANCE', 'MULTI_AZ_INSTANCE', 'MULTI_AZ_CLUSTER'],
            example: 'SINGLE_AZ_INSTANCE',
          },
          readReplicas: { type: 'integer', minimum: 0, example: 1 },
          backup: { type: 'boolean', example: true },
        },
      },
      UpdateClusterRequest: {
        type: 'object',
        description: 'All fields optional — send only the value(s) you want to change',
        properties: {
          name: { type: 'string' },
          region: { type: 'string' },
          pgVersion: { type: 'string', enum: ['16', '17', '18'] },
          deploymentOption: {
            type: 'string',
            enum: ['SINGLE_AZ_INSTANCE', 'MULTI_AZ_INSTANCE', 'MULTI_AZ_CLUSTER'],
          },
          cpu: { type: 'string', example: '4', description: 'Number of vCPUs' },
          ram: { type: 'string', example: '8Gi', description: 'RAM in Gi' },
          storage: { type: 'string', example: '100Gi', description: 'Disk size in Gi' },
          readReplicas: { type: 'integer', minimum: 0 },
          backup: { type: 'boolean' },
        },
      },
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
    '/api/auth/signup': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/SignupRequest' } },
          },
        },
        responses: {
          '201': {
            description: 'User created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } },
            },
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login with email and password',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } },
            },
          },
          '400': {
            description: 'Invalid credentials',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/api/auth/refresh-token': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh access token (reads refreshToken cookie)',
        responses: {
          '200': { description: 'New access token returned' },
          '401': { description: 'Refresh token missing or revoked' },
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout and revoke refresh token',
        responses: { '200': { description: 'Logged out' } },
      },
    },
    '/api/auth/profile': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Profile data',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
          },
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
        responses: {
          '200': { description: 'Updated profile' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/auth/account': {
      delete: {
        tags: ['Auth'],
        summary: 'Delete account',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Account deleted' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/clusters': {
      get: {
        tags: ['Clusters'],
        summary: 'List all clusters for the authenticated tenant',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Array of clusters',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/ClusterDto' } },
              },
            },
          },
          '401': { description: 'Unauthorized' },
        },
      },
      post: {
        tags: ['Clusters'],
        summary: 'Create a new cluster (async — returns 202)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateClusterRequest' } },
          },
        },
        responses: {
          '202': {
            description: 'Cluster accepted for provisioning',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ClusterDto' } },
            },
          },
          '400': { description: 'Validation error' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/clusters/{id}': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      get: {
        tags: ['Clusters'],
        summary: 'Get a cluster by id',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Cluster',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ClusterDto' } },
            },
          },
          '401': { description: 'Unauthorized' },
          '404': { description: 'Cluster not found' },
        },
      },
      patch: {
        tags: ['Clusters'],
        summary: 'Update a cluster',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/UpdateClusterRequest' } },
          },
        },
        responses: {
          '200': {
            description: 'Updated cluster',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ClusterDto' } },
            },
          },
          '400': { description: 'No fields provided' },
          '401': { description: 'Unauthorized' },
          '404': { description: 'Cluster not found' },
        },
      },
      delete: {
        tags: ['Clusters'],
        summary: 'Delete a cluster (async deprovisioning)',
        security: [{ bearerAuth: [] }],
        responses: {
          '204': { description: 'Cluster queued for deletion' },
          '401': { description: 'Unauthorized' },
          '404': { description: 'Cluster not found' },
        },
      },
    },
    '/api/test': {
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
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { name: { type: 'string' } },
                required: ['name'],
              },
            },
          },
        },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/api/test/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      get: {
        tags: ['TestApp'],
        summary: 'Get a test entry by id',
        responses: {
          '200': { description: 'TestApp object' },
          '404': { description: 'Not found' },
        },
      },
      put: {
        tags: ['TestApp'],
        summary: 'Update a test entry',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { name: { type: 'string' } },
                required: ['name'],
              },
            },
          },
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
