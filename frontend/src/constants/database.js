// Only one region is actually supported (EKS cluster + RDS live in eu-west-3).
export const REGIONS = [
  { value: 'eu-west-3', label: 'EU (Paris)' },
];

export const DEPLOYMENT_OPTIONS = [
  { id: 'multi-az-cluster',   name: 'Multi-AZ cluster',   details: 'RW + RO endpoints', description: 'Primary + read replicas across AZs.' },
  { id: 'single-az-instance', name: 'Single-AZ instance', details: 'RW endpoint only',  description: 'Single instance without standby.' },
];

export const PG_VERSIONS = ['18', '17', '16'];

// Plans differ only by storage + price; CPU/RAM are a single fixed pod limit.
export const SIZES = [
  { id: 'starter', name: 'Starter', storage: '10 GB SSD',  price: 29  },
  { id: 'pro',     name: 'Pro',     storage: '50 GB SSD',  price: 79  },
  { id: 'scale',   name: 'Scale',   storage: '200 GB SSD', price: 199 },
];

export const SIZE_DEFAULTS = {
  starter: { cpu: 1, ram: 2,  storage: 10  },
  pro:     { cpu: 2, ram: 4,  storage: 50  },
  scale:   { cpu: 4, ram: 16, storage: 200 },
};
