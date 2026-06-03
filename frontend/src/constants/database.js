// Only one region is actually supported (EKS cluster + RDS live in eu-west-3).
export const REGIONS = [{ value: 'eu-west-3', label: 'EU (Paris)' }];

export const DEPLOYMENT_OPTIONS = [
  {
    id: 'multi-az-cluster',
    name: 'Multi-AZ cluster',
    details: 'RW + RO endpoints',
    description: 'Primary + read replicas across AZs.',
  },
  {
    id: 'single-az-instance',
    name: 'Single-AZ instance',
    details: 'RW endpoint only',
    description: 'Single instance without standby.',
  },
];

export const PG_VERSIONS = ['18', '17', '16'];

export const SIZES = [
  { id: 'starter', name: 'Starter', storage: '5 GB SSD' },
  { id: 'standard', name: 'Standard', storage: '10 GB SSD' },
  { id: 'pro', name: 'Pro', storage: '20 GB SSD' },
];

export const SIZE_DEFAULTS = {
  starter: { storage: 5 },
  standard: { storage: 10 },
  pro: { storage: 20 },
};
