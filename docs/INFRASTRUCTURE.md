# Loonaris Infrastructure Reference

> Single source of truth for all infrastructure. Read this before touching AWS, EKS, ECS, or deployment config.

---

## 1. AWS Accounts

| Account | ID | AWS CLI Profile | Purpose |
|---|---|---|---|
| Account 1 | `474741569968` | `default` | ECS, ECR, RDS, ALB, Nginx, Bastion, Route53, Secrets Manager |
| Account 2 | `592858827449` | `ahmed-loonaris` | EKS cluster, VPC, EC2 node groups, IAM for K8s |

**Region:** `eu-west-3` (Paris) for everything.

---

## 2. DNS & Networking

| Domain | Type | Target |
|---|---|---|
| `loonaris.tech` | A | `35.181.168.74` (Nginx EC2) |
| `www.loonaris.tech` | A | `35.181.168.74` (Nginx EC2) |
| ~~`db.loonaris.tech`~~ | — | **Decided against.** Clients connect to the NLB hostname directly: `ab571a35c49414eaab905fc43405b7fb-9f85c871b90b857f.elb.eu-west-3.amazonaws.com:5432` |

**Nginx EC2 (Account 1):**

| Property | Value |
|---|---|
| Instance ID | `i-090a4dd00c0ee23e5` |
| Public IP | `35.181.168.74` |
| OS | Ubuntu 24.04 LTS |
| IAM Role | `ec2-nginx-role` |
| Purpose | SSL termination (Let's Encrypt), reverse proxy `/api/*` → ALB, `/*` → S3 static frontend |

**ALB (Account 1):**

| Property | Value |
|---|---|
| Name | `loonaris-alb` |
| DNS | `loonaris-alb-1830888004.eu-west-3.elb.amazonaws.com` |
| Target Group | `loonaris-tg` (port 3000, health check `/api/health`) |

---

## 3. EKS Cluster (Account 2)

### Cluster

| Property | Value |
|---|---|
| Name | `loonaris-eks` |
| ARN | `arn:aws:eks:eu-west-3:592858827449:cluster/loonaris-eks` |
| Version | 1.35 |
| API endpoint | `https://45684D5E15FF1BBE7A0C64D159FFC600.sk1.eu-west-3.eks.amazonaws.com` |
| Auth mode | `API_AND_CONFIG_MAP` |
| Kubeconfig | `aws eks update-kubeconfig --region eu-west-3 --name loonaris-eks --profile ahmed-loonaris` |

### VPC — loonaris-app-vpc (Account 2)

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

### Node Groups

| Node Group | Instance | vCPU | RAM | Nodes | Label | Taints |
|---|---|---|---|---|---|---|
| `system-ng` | c5.large | 2 | 4 GB | 1 | `role=system` | None |
| `tenant-ng-xl` | c5.xlarge | 4 | 8 GB | 3 | `role=tenant` | None |

> Workloads use **nodeSelector** (`role=system` or `role=tenant`) to schedule on the right node group. **No taints are used** — this avoids conflicts with EKS managed add-ons.

### IAM Roles (Account 2)

| Role | ARN | Purpose |
|---|---|---|
| `AmazonEKSClusterRole` | `arn:aws:iam::592858827449:role/AmazonEKSClusterRole` | EKS control plane |
| `AmazonEKSAutoNodeRole2` | `arn:aws:iam::592858827449:role/AmazonEKSAutoNodeRole2` | EKS node group instances |
| `AmazonEKSPodIdentityAmazonEBSCSIDriverRole` | `arn:aws:iam::592858827449:role/AmazonEKSPodIdentityAmazonEBSCSIDriverRole` | EBS CSI driver pods |
| `loonaris-eks-access` | `arn:aws:iam::592858827449:user/loonaris-eks-access` | ECS backend cross-account EKS access (AmazonEKSClusterAdminPolicy) |

### EKS Access Entries

| Principal ARN | Type | Access Policy |
|---|---|---|
| `arn:aws:iam::592858827449:user/ahmed-idani-loonaris` | Standard | AmazonEKSClusterAdminPolicy |
| `arn:aws:iam::592858827449:user/loonaris-eks-access` | Standard | AmazonEKSClusterAdminPolicy |
| `arn:aws:iam::592858827449:role/AmazonEKSAutoNodeRole2` | EC2 Linux | — (node permissions) |
| `arn:aws:iam::592858827449:role/AmazonEKSAutoNodeRole2` | EC2 Linux | — (node permissions) |
| `arn:aws:iam::592858827449:role/aws-service-role/eks.amazonaws.com/AWSServiceRoleForAmazonEKS` | Standard | — (service role) |

### EKS Add-ons

| Add-on | Version | Notes |
|---|---|---|
| `vpc-cni` | v1.21.1-eksbuild.1 | Prefix delegation enabled (`ENABLE_PREFIX_DELEGATION=true`) |
| `coredns` | v1.13.2-eksbuild.4 | DNS for services |
| `kube-proxy` | v1.35.3-eksbuild.2 | Network proxy |
| `metrics-server` | v0.8.1-eksbuild.6 | HPA metrics |
| `aws-ebs-csi-driver` | v1.60.1-eksbuild.1 | Persistent volumes (gp3 storage class) |
| `eks-pod-identity-agent` | v1.3.10-eksbuild.3 | IAM roles for pods |

### Pod Identity Associations

| Namespace | Service Account | IAM Role |
|---|---|---|
| `kube-system` | `ebs-csi-controller-sa` | `AmazonEKSPodIdentityAmazonEBSCSIDriverRole` |

### EC2 Instance Tags

All cluster instances are tagged: `application=loonaris`, `environment=production`, `role=system` or `role=tenant`, `kubernetes.io/cluster/loonaris-eks=owned`, `eks:nodegroup-name=system-ng` or `tenant-ng`.

---

## 4. ECS (Account 1)

### Cluster & Service

| Property | Value |
|---|---|
| ECS Cluster | `loonaris-ecs-fargate-cluster` |
| ECS Service | `loonaris-backend-service-p839kjg4` |
| Task Definition | `loonaris-backend:23` (latest — includes K8S env vars + secrets) |
| Launch Type | FARGATE |
| CPU / Memory | 1024 / 3072 |
| Desired Count | 2 |

### Container Environment Variables

| Variable | Value/Source | Sensitive? |
|---|---|---|
| `NODE_ENV` | `production` | No |
| `PORT` | `3000` | No |
| `DATABASE_SSL` | `true` | No |
| `DATABASE_URL` | `postgresql://loonarispg:***@database-loonaris-app...` | Yes (plain) |
| `JWT_SECRET` | `***` | Yes (plain) |
| `JWT_REFRESH_SECRET` | `***` | Yes (plain) |
| `CORS_ORIGIN` | `https://loonaris.tech,https://www.loonaris.tech` | No |
| `K8S_CLUSTER_ENDPOINT` | `https://45684D5E...sk1.eu-west-3.eks.amazonaws.com` | No |
| `K8S_CLUSTER_CA` | Base64 CA cert | No |
| `K8S_CLUSTER_NAME` | `loonaris-eks` | No |
| `K8S_AWS_REGION` | `eu-west-3` | No |
| `K8S_AWS_ACCESS_KEY_ID` | From Secrets Manager (`loonaris/eks-access-key-id`) | Yes |
| `K8S_AWS_SECRET_ACCESS_KEY` | From Secrets Manager (`loonaris/eks-secret-access-key`) | Yes |
| `INTERNAL_GATEWAY_SECRET` | From Secrets Manager (`loonaris/internal-gateway-secret`) | Yes |

### Secrets Manager (Account 1)

| Secret Name | Contains | Used By |
|---|---|---|
| `loonaris/eks-access-key-id` | `AKIAYUCJDZK4RNX7K5JF` | ECS backend → EKS auth |
| `loonaris/eks-secret-access-key` | `5COMecjXeavJotUiMFtIz+...` | ECS backend → EKS auth |
| `loonaris/internal-gateway-secret` | `7e7dbfdcddd3fa93...` | ECS backend → `INTERNAL_GATEWAY_SECRET` |
| `loonaris/eks-credentials` | Combined JSON (all keys) | Reference/backup |
| `loonaris/gateway-secret` | Combined JSON (`INTERNAL_GATEWAY_SECRET`) | Reference/backup |

### IAM

| Role | Purpose |
|---|---|
| `ecsTaskExecutionRole` | ECS task execution + Secrets Manager read access for `loonaris/*` |
| `ec2-nginx-role` | Nginx EC2 S3 read access for frontend |

### ECS → EKS Cross-Account Auth Flow

```
ECS Task (Account 1)
  └── Reads K8S_AWS_ACCESS_KEY_ID + K8S_AWS_SECRET_ACCESS_KEY from Secrets Manager
  └── @kubernetes/client-node uses KubeConfig.loadFromOptions() with AWS auth provider
  └── Generates EKS bearer token using aws-sdk (no aws CLI needed)
  └── Calls EKS API (Account 2) as loonaris-eks-access user
  └── loonaris-eks-access has AmazonEKSClusterAdminPolicy via access entry
  └── Full cluster admin: create/read/update/delete any resource
```

---

## 5. RDS (Account 1)

| Property | Value |
|---|---|
| Endpoint | `database-loonaris-app.c3s68wa6ehdt.eu-west-3.rds.amazonaws.com:5432` |
| Engine | PostgreSQL |
| Database | `loonarisdb` |
| Username | `loonarispg` |
| VPC | `vpc-01b6ed7fa337233e6` (loonaris-app-vpc, Account 1) |
| Publicly Accessible | No (private subnet) |
| Bastion SSH | `13.39.112.107` (key: `bastion-key.pem`) |

---

## 6. Other EC2 Instances (Account 1)

| Instance ID | Type | Purpose | Public IP |
|---|---|---|---|
| `i-090a4dd00c0ee23e5` | t2.small | Nginx reverse proxy (loonaris.tech) | `35.181.168.74` |
| `i-0098c8d33fc342fb7` | t3.micro | Bastion host (SSH tunnel to RDS) | `13.39.112.107` |

---

## 7. ECR (Account 1)

| Registry | Purpose |
|---|---|
| `474741569968.dkr.ecr.eu-west-3.amazonaws.com/ahmed-aws/loonaris` | Express backend Docker image |

---

## 8. VPC (Account 1)

| Property | Value |
|---|---|
| VPC ID | `vpc-01b6ed7fa337233e6` |
| CIDR | 10.0.0.0/16 |
| Private subnets | `subnet-0190da135d58a82f5` (eu-west-3b), `subnet-0ac18267c30a9f63e` (eu-west-3a) |
| Public subnets | `subnet-0e4e33e415b3acaac` (eu-west-3a), `subnet-0c243d223e2091acc` (eu-west-3b) |

---

## 9. K8s Manifest Scheduling Strategy

All K8s resources use **nodeSelector** to schedule on the correct node group. **No taints are used.**

| Component | nodeSelector | Node Group |
|---|---|---|
| DB Gateway pod | `role: system` | system-ng (c5.large) |
| CNPG operator | `role: system` | system-ng |
| EKS add-ons (coredns, metrics-server, etc.) | none (default) | system-ng (only un-tainted node) |
| CNPG clusters (tenant DBs) | `role: tenant` | tenant-ng (t2.small) |
| PgBouncer RW | `role: tenant` | tenant-ng |
| PgBouncer RO | `role: tenant` | tenant-ng |

---

## 10. ECS Task Definition Environment Variables (Complete)

See section 4 above. The latest task definition is `loonaris-backend:23`.

Key files:
- ECS task definition JSON: registered in AWS, rev 23
- GitHub Actions workflow: `.github/workflows/backend-deploy.yml`

---

## 11. Key File Locations

| File | Purpose |
|---|---|
| `.secrets` | All infrastructure credentials (gitignored — read this for secrets) |
| `web-app/backend/src/modules/pgCluster/provisioning/provisioning.ts` | K8s client code (`KubeConfig.loadFromOptions()` with AWS auth) |
| `web-app/backend/.env` | Local dev env vars (includes K8S_* vars for local testing) |
| `db-gateway/k8s/` | K8s manifests for DB Gateway deployment |
| `db-gateway/k8s/deployment.yaml` | Uses `nodeSelector: { role: system }` |
| `web-app/docs/guide_cluster.md` | Full EKS cluster setup guide (Account 2) |
| `web-app/docs/GAPS.md` | What's not built yet |
| `web-app/AGENTS.md` | Full AWS infrastructure context (Account 1) |
| `docs/AGENTS.md` | Root-level architecture and data flow context |

---

## 12. Transition Status: Account 1 EKS → Account 2 EKS

The old EKS cluster in Account 1 (`474741569968`) has been **fully deleted**. The new cluster runs in Account 2. All references have been updated. No resources remain in Account 1 related to EKS.

---

## 13. vCPU Limits

| Account | Service | Current Limit | Requested | Status |
|---|---|---|---|---|
| 1 (`default`) | EC2 On-Demand Standard | 8 vCPU | 32 | Pending |
| 2 (`ahmed-loonaris`) | EC2 On-Demand Standard | 5 vCPU | 32 | Pending |

Current usage in Account 2: 1× c5.large (2 vCPU) + 3× t2.small (3 vCPU) = 5 vCPU (at limit).

---

## 14. Quick Commands

```bash
# ECS backend — Account 1 (default profile)
aws ecs describe-services --cluster loonaris-ecs-fargate-cluster --service loonaris-backend-service-p839kjg4 --region eu-west-3
aws ecs update-service --cluster loonaris-ecs-fargate-cluster --service loonaris-backend-service-p839kjg4 --task-definition loonaris-backend:23 --force-new-deployment --region eu-west-3

# EKS cluster — Account 2 (ahmed-loonaris profile)
aws eks update-kubeconfig --region eu-west-3 --name loonaris-eks --profile ahmed-loonaris
kubectl get nodes -o wide
kubectl get pods -A
kubectl get clusters.postgresql.cnpg.io -A

# RDS — via bastion
ssh -i ~/.ssh/bastion-key.pem -L 5433:database-loonaris-app.c3s68wa6ehdt.eu-west-3.rds.amazonaws.com:5432 ubuntu@13.39.112.107 -f -N

# Secrets Manager — Account 1
aws secretsmanager get-secret-value --secret-id loonaris/eks-access-key-id --region eu-west-3 --query SecretString --output text
aws secretsmanager get-secret-value --secret-id loonaris/internal-gateway-secret --region eu-west-3 --query SecretString --output text

# EKS add-ons status
aws eks list-addons --cluster-name loonaris-eks --region eu-west-3 --profile ahmed-loonaris
```