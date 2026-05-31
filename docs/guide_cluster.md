# EKS Cluster Setup — Loonaris DBaaS

This guide documents the production EKS cluster for the Loonaris DBaaS platform.

## Cluster Overview

```
Node Group    Nodes   Instance Type  vCPU/Node  Label         Runs
──────────────────────────────────────────────────────────────────────────
system-ng     1       c5.large       2 vCPU      role=system   DB Gateway + CNPG Operator
tenant-ng     3       t2.small       1 vCPU      role=tenant   CNPG clusters + PgBouncers
```

> **Taint strategy:** Neither node group uses taints. System workloads (CNPG operator, DB gateway, add-ons) schedule using the `role=system` nodeSelector. Tenant workloads (CNPG clusters, PgBouncers) use the `role=tenant` nodeSelector. This avoids scheduling conflicts with EKS managed add-ons that don't tolerate custom taints.

**AWS Account:** 592858827449 (profile: `ahmed-loonaris`)
**Region:** eu-west-3
**Kubernetes version:** 1.35
**VPC CNI Prefix Delegation:** Enabled (allows high pod density even on small instances)

---

## AWS Resources

### VPC — loonaris-app-vpc

| Resource | ID | CIDR | AZ |
|---|---|---|---|
| VPC | `vpc-0d09d93701e88a49d` | 10.0.0.0/16 | — |
| Private subnet 1 | `subnet-0725acfd553347c73` | 10.0.0.0/20 | eu-west-3a |
| Private subnet 2 | `subnet-065aa704f43466ec7` | 10.0.16.0/20 | eu-west-3b |
| Public subnet 1 | `subnet-0357d6d0f35412ce9` | 10.0.128.0/20 | eu-west-3a |
| Public subnet 2 | `subnet-0d2da20103fa50a8b` | 10.0.144.0/20 | eu-west-3b |
| Internet Gateway | `igw-030a607b9ee6f8990` | — | — |
| NAT Gateway | `nat-0fe22e5d155ef1cc6` | — | eu-west-3a |
| Elastic IP | `eipalloc-0c3b35c8800a3422c` | — | — |
| Public route table | `rtb-039d05d03a5a83df6` | → IGW | — |
| Private route table | `rtb-02356eea3c28db06e` | → NAT GW | — |

Private subnets have tag `kubernetes.io/role/internal-elb=1` for internal load balancers.
Public subnets have tag `kubernetes.io/role/elb=1` for public load balancers.

### EKS Cluster

| Property | Value |
|---|---|
| Name | `loonaris-eks` |
| ARN | `arn:aws:eks:eu-west-3:592858827449:cluster/loonaris-eks` |
| Version | 1.35 |
| Cluster role | `arn:aws:iam::592858827449:role/AmazonEKSClusterRole` |
| Node role | `arn:aws:iam::592858827449:role/AmazonEKSAutoNodeRole2` |
| Auth mode | CONFIG_MAP |

### IAM Roles (Account 592858827449)

| Role | ARN | Policies |
|---|---|---|
| AmazonEKSClusterRole | `arn:aws:iam::592858827449:role/AmazonEKSClusterRole` | AmazonEKSClusterPolicy |
| AmazonEKSAutoNodeRole2 | `arn:aws:iam::592858827449:role/AmazonEKSAutoNodeRole2` | AmazonEKSWorkerNodePolicy, AmazonEKS_CNI_Policy, AmazonEC2ContainerRegistryReadOnly |
| AmazonEKSPodIdentityAmazonEBSCSIDriverRole | `arn:aws:iam::592858827449:role/AmazonEKSPodIdentityAmazonEBSCSIDriverRole` | EBS CSI driver |

### Node Groups

#### system-ng

| Property | Value |
|---|---|
| Instance type | `c5.large` (2 vCPU, 4 GB RAM) |
| AMI | AL2023_x86_64_STANDARD |
| Disk size | 20 GiB |
| Min/Max/Desired | 1/1/1 |
| Capacity type | ON_DEMAND |
| Label | `role=system` |
| Taint | None (system workloads use nodeSelector) |
| Subnets | Private subnets only |

#### tenant-ng

| Property | Value |
|---|---|
| Instance type | `t2.small` (1 vCPU, 2 GB RAM) |
| AMI | AL2023_x86_64_STANDARD |
| Disk size | 20 GiB |
| Min/Max/Desired | 3/3/3 |
| Capacity type | ON_DEMAND |
| Label | `role=tenant` |
| Taint | None (tenant workloads use nodeSelector) |
| Subnets | Private subnets only |

> **vCPU budget:** 1×c5.large (2) + 3×t2.small (3) = 5 vCPUs total. Current account limit is 5 vCPUs. A quota increase to 32 vCPUs has been requested. Once approved, `tenant-ng` can be upgraded to `c5.large` instances.

### EKS Add-ons

| Add-on | Version | Purpose |
|---|---|---|
| `vpc-cni` | v1.21.1-eksbuild.1 | Pod networking with prefix delegation enabled |
| `coredns` | v1.13.2-eksbuild.4 | DNS resolution for services |
| `kube-proxy` | v1.35.3-eksbuild.2 | Network proxy for Kubernetes services |
| `metrics-server` | v0.8.1-eksbuild.6 | Resource usage metrics (required for HPA) |
| `aws-ebs-csi-driver` | v1.60.1-eksbuild.1 | Persistent volume provisioning (EBS) |
| `eks-pod-identity-agent` | v1.3.10-eksbuild.3 | IAM roles for pods via Pod Identity |

### Pod Identity Associations

| Namespace | Service Account | IAM Role |
|---|---|---|
| `kube-system` | `ebs-csi-controller-sa` | `AmazonEKSPodIdentityAmazonEBSCSIDriverRole` |

### EC2 Instance Tags

All cluster instances have these tags:

| Key | Value |
|---|---|
| `application` | `loonaris` |
| `environment` | `production` |
| `role` | `system` or `tenant` (matches node group) |
| `kubernetes.io/cluster/loonaris-eks` | `owned` |
| `eks:cluster-name` | `loonaris-eks` |
| `eks:nodegroup-name` | `system-ng` or `tenant-ng` |

---

## Access Configuration

### AWS Profile Setup

The cluster is on AWS Account 592858827449. Add the profile to `~/.aws/credentials`:

```ini
[ahmed-loonaris]
aws_access_key_id = <your-access-key-id>
aws_secret_access_key = <your-secret-access-key>
```

And to `~/.aws/config`:

```ini
[profile ahmed-loonaris]
region = eu-west-3
output = json
```

### Download Kubeconfig

```bash
aws eks update-kubeconfig \
  --region eu-west-3 \
  --name loonaris-eks \
  --profile ahmed-loonaris
```

### Verify

```bash
kubectl get nodes -o wide
```

Expected — 4 nodes, all `Ready`:

```
NAME                                        STATUS   ROLES    AGE   VERSION
ip-10-0-0-23.eu-west-3.compute.internal     Ready    <none>   5m    v1.35.5-eks-3385e9b   ← tenant-ng (t2.small)
ip-10-0-13-187.eu-west-3.compute.internal   Ready    <none>   5m    v1.35.5-eks-3385e9b   ← system-ng (c5.large)
ip-10-0-2-139.eu-west-3.compute.internal    Ready    <none>   5m    v1.35.5-eks-3385e9b   ← tenant-ng (t2.small)
ip-10-0-26-62.eu-west-3.compute.internal    Ready    <none>   5m    v1.35.5-eks-3385e9b   ← tenant-ng (t2.small)
```

Confirm labels and taints:

```bash
kubectl get nodes --show-labels
kubectl describe nodes | grep -A3 Taints
```

---

## VPC CNI Prefix Delegation

Prefix delegation is **enabled** on the VPC CNI addon. This assigns a /28 prefix (16 IPs) per ENI instead of individual secondary IPs, allowing high pod density even on small instances like `t2.small`:

```bash
aws eks describe-addon \
  --cluster-name loonaris-eks \
  --addon-name vpc-cni \
  --region eu-west-3 \
  --profile ahmed-loonaris \
  --query 'addon.configurationValues' \
  --output text
```

Expected: `{"env":{"ENABLE_PREFIX_DELEGATION":"true","WARM_PREFIX_TARGET":"1"}}`

---

## Enable OIDC (required for add-ons)

The EBS CSI driver needs an OIDC provider. This is a one-time setup via CLI:

```bash
# Get the OIDC issuer URL
aws eks describe-cluster \
  --name loonaris-eks \
  --region eu-west-3 \
  --profile ahmed-loonaris \
  --query "cluster.identity.oidc.issuer" \
  --output text

# Associate the OIDC provider
eksctl utils associate-iam-oidc-provider \
  --cluster loonaris-eks \
  --region eu-west-3 \
  --approve
```

> If you don't have `eksctl`, you can do this in the console: **EKS → cluster → Configuration tab → Authentication → Associate OIDC provider**.

---

## Install the CNPG Operator

Run from your local machine (kubectl must be configured):

```bash
helm repo add cnpg https://cloudnative-pg.github.io/charts
helm repo update

helm install cnpg cnpg/cloudnative-pg \
  --namespace cnpg-system \
  --create-namespace \
  --set nodeSelector.role=system \
  --set tolerations[0].key=dedicated \
  --set tolerations[0].value=system \
  --set tolerations[0].effect=NoSchedule
```

Check it landed on the system node:

```bash
kubectl get pods -n cnpg-system -o wide
```

The pod's `NODE` column should match the single system-ng instance.

---

## Deploy the DB Gateway

The Gateway `Deployment` in `db-gateway/k8s/` must include a toleration and node selector so it schedules on `system-ng`:

```yaml
spec:
  template:
    spec:
      nodeSelector:
        role: system
      tolerations:
        - key: dedicated
          value: system
          effect: NoSchedule
```

Apply:

```bash
kubectl apply -f db-gateway/k8s/
```

---

## Give the ECS Task Access to the Cluster

The Express backend (ECS Fargate, Account 1: `474741569968`) provisions K8s resources on the EKS cluster (Account 2: `592858827449`) via `@kubernetes/client-node`. This is **cross-account** access.

### Architecture

```
ECS Fargate (Account 1)                    EKS Cluster (Account 2)
┌──────────────────────┐                   ┌──────────────────────┐
│  Express Backend     │                   │  loonaris-eks       │
│                      │   K8S API call    │                      │
│  @kubernetes/        │──────────────────▶│  API server         │
│  client-node         │   (Bearer token   │                      │
│                      │    via aws-sdk)   │                      │
└──────────────────────┘                   └──────────────────────┘
```

### How it works

1. The ECS backend reads `K8S_CLUSTER_ENDPOINT`, `K8S_CLUSTER_CA`, `K8S_CLUSTER_NAME`, `K8S_AWS_REGION`, `K8S_AWS_ACCESS_KEY_ID`, and `K8S_AWS_SECRET_ACCESS_KEY` from environment variables
2. `provisioning.ts` uses `KubeConfig.loadFromOptions()` with the AWS auth provider
3. `@kubernetes/client-node` generates EKS bearer tokens using the Account 2 IAM user `loonaris-eks-access`
4. No `aws` CLI or kubeconfig file needed inside the ECS container

### IAM user (Account 2)

| Property | Value |
|---|---|
| Username | `loonaris-eks-access` |
| ARN | `arn:aws:iam::592858827449:user/loonaris-eks-access` |
| Access key | `AKIAYUCJDZK4RNX7K5JF` (stored in Secrets Manager) |
| EKS access | `AmazonEKSClusterAdminPolicy` on `loonaris-eks` |

### Secrets Manager (Account 1)

| Property | Value |
|---|---|
| Secret name | `loonaris/eks-credentials` |
| ARN | `arn:aws:secretsmanager:eu-west-3:474741569968:secret:loonaris/eks-credentials-YSs71q` |
| Contains | `aws_access_key_id`, `aws_secret_access_key`, `cluster_endpoint`, `cluster_ca`, `cluster_name`, `region` |

### Environment variables (ECS task definition)

| Variable | Source | Description |
|---|---|---|
| `K8S_CLUSTER_ENDPOINT` | Secrets Manager | EKS API server URL |
| `K8S_CLUSTER_CA` | Secrets Manager | Base64-encoded CA certificate |
| `K8S_CLUSTER_NAME` | Secrets Manager | `loonaris-eks` |
| `K8S_AWS_REGION` | Secrets Manager | `eu-west-3` |
| `K8S_AWS_ACCESS_KEY_ID` | Secrets Manager | Account 2 IAM user access key |
| `K8S_AWS_SECRET_ACCESS_KEY` | Secrets Manager | Account 2 IAM user secret key |

### Local development

For local development, add these to `web-app/backend/.env`:

```env
K8S_CLUSTER_ENDPOINT=https://45684D5E15FF1BBE7A0C64D159FFC600.sk1.eu-west-3.eks.amazonaws.com
K8S_CLUSTER_CA=LS0tLS1CRUdJTi...
K8S_CLUSTER_NAME=loonaris-eks
K8S_AWS_REGION=eu-west-3
K8S_AWS_ACCESS_KEY_ID=<from .secrets>
K8S_AWS_SECRET_ACCESS_KEY=<from .secrets>
```

All secrets are documented in `/secrets` (gitignored).

---

## Wire the NLB for the DB Gateway

After the Gateway pod is running, its `LoadBalancer` Service creates an NLB automatically. Get the hostname:

```bash
kubectl get svc db-gateway-svc -n db-gateway \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

Go to **Route 53 → Hosted zone for loonaris.tech** → add/update a `CNAME` record:

| Record | Type | Value |
|---|---|---|
| `db.loonaris.tech` | `CNAME` | `<NLB hostname from above>` |

---

## Quick Reference

| Task | Command |
|---|---|
| Re-download kubeconfig | `aws eks update-kubeconfig --region eu-west-3 --name loonaris-eks --profile ahmed-loonaris` |
| Check all nodes | `kubectl get nodes -o wide` |
| Check taints | `kubectl describe nodes \| grep -A3 Taints` |
| CNPG operator logs | `kubectl logs -n cnpg-system deploy/cnpg-cloudnative-pg` |
| Gateway logs | `kubectl logs -n db-gateway deploy/db-gateway` |
| All tenant pods | `kubectl get pods -A -o wide \| grep project-` |
| Cluster endpoint toggle | EKS Console → cluster → Networking tab → Manage |
| Add IAM user to cluster | `eksctl create iamidentitymapping --cluster loonaris-eks --region eu-west-3 --arn <arn> --group system:masters --username <name>` |
| Check VPC CNI config | `aws eks describe-addon --cluster-name loonaris-eks --addon-name vpc-cni --region eu-west-3 --profile ahmed-loonaris` |
| View vCPU quota | `aws service-quotas get-service-quota --service-code ec2 --quota-code L-1216C47A --region eu-west-3 --profile ahmed-loonaris` |
| Request quota increase | `aws service-quotas request-service-quota-increase --service-code ec2 --quota-code L-1216C47A --desired-value 32 --region eu-west-3 --profile ahmed-loonaris` |