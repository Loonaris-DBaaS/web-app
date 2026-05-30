export const REGIONS = [
  { value: 'us-east-1',      label: 'US East (N. Virginia)' },
  { value: 'us-west-2',      label: 'US West (Oregon)' },
  { value: 'eu-west-1',      label: 'EU (Ireland)' },
  { value: 'eu-central-1',   label: 'EU (Frankfurt)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
];

export const DEPLOYMENT_OPTIONS = [
  { id: 'multi-az-cluster',   name: 'Multi-AZ cluster',   details: 'RW + RO endpoints', description: 'Primary + read replicas across AZs.' },
  { id: 'single-az-instance', name: 'Single-AZ instance', details: 'RW endpoint only',  description: 'Single instance without standby.' },
];

export const PG_VERSIONS = ['18', '17', '16'];

export const SIZES = [
  { id: 'starter', name: 'Starter', cpu: '1 vCPU', ram: '2 GB RAM',  storage: '10 GB SSD',  price: 29  },
  { id: 'pro',     name: 'Pro',     cpu: '2 vCPU', ram: '4 GB RAM',  storage: '50 GB SSD',  price: 79  },
  { id: 'scale',   name: 'Scale',   cpu: '4 vCPU', ram: '16 GB RAM', storage: '200 GB SSD', price: 199 },
];

export const SIZE_DEFAULTS = {
  starter: { cpu: 1, ram: 2,  storage: 10  },
  pro:     { cpu: 2, ram: 4,  storage: 50  },
  scale:   { cpu: 4, ram: 16, storage: 200 },
};
