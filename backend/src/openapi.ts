export const openApiSpec = {
  openapi: '3.0.0',
  info: { title: 'Loonaris API', version: '1.0.0' },
  tags: [{ name: 'TestApp', description: 'CRUD smoke-test endpoints (no auth)' }],
  paths: {
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
        responses: { '201': { description: 'Created TestApp object' } },
      },
    },
    '/test/{id}': {
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
        responses: {
          '200': { description: 'Updated TestApp object' },
          '404': { description: 'Not found' },
        },
      },
      delete: {
        tags: ['TestApp'],
        summary: 'Delete a test entry',
        responses: { '204': { description: 'Deleted' }, '404': { description: 'Not found' } },
      },
    },
  },
};
