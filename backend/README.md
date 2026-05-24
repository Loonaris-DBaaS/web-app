# Backend

Node.js + Express + TypeScript backend for the Loonaris DBaaS platform.

---

## Stack

| Layer                  | Technology          |
| ---------------------- | ------------------- |
| Runtime                | Node.js             |
| Framework              | Express             |
| Language               | TypeScript (strict) |
| Database (platform)    | PostgreSQL via `pg` |
| ORM (cluster metadata) | Prisma              |
| Auth                   | JWT + bcrypt        |

---

## Project Structure

```
src/
├── config/           # Infrastructure setup (DB connections, env)
│   └── db.ts
├── types/            # Global type augmentations shared across modules
│   └── express.d.ts
├── modules/          # Domain modules — one folder per bounded context
│   ├── auth/
│   │   ├── dto/          # Request/response shapes for this module
│   │   ├── controllers/  # HTTP layer — parse request, call service, send response
│   │   └── services/     # Business logic
│   └── pgCluster/
│       ├── dto/
│       ├── controllers/
│       ├── services/
│       └── provisioning/ # Cluster lifecycle logic (create/delete/scale)
└── index.ts          # App entry point — registers routes, starts server
```

---

## TypeScript Conventions

### 1. Types vs Interfaces

Use **`interface`** for object shapes that describe domain entities or contracts.
Use **`type`** for unions, intersections, and aliases.

```ts
// ✅ interface for shapes
interface Cluster {
  id: string;
  name: string;
  region: string;
  status: ClusterStatus;
}

// ✅ type for unions
type ClusterStatus = 'provisioning' | 'running' | 'stopped' | 'error';
```

---

### 2. DTOs (Data Transfer Objects)

DTOs describe **what crosses a boundary** — the shape of a request body coming in, or a
response going out. They live inside the module they belong to, inside a `dto/` folder.

```
modules/auth/dto/
├── signup.dto.ts      ← request body for POST /auth/signup
└── login.dto.ts       ← request body for POST /auth/signin

modules/pgCluster/dto/
├── create-cluster.dto.ts   ← request body for POST /clusters
└── cluster.dto.ts          ← response shape for GET /clusters
```

**Naming convention:** `<action>-<resource>.dto.ts` for requests, `<resource>.dto.ts` for responses.

```ts
// modules/auth/dto/signup.dto.ts
export interface SignupDto {
  email: string;
  password: string;
}

export interface AuthResponseDto {
  token: string;
  user: { id: number; email: string };
}
```

```ts
// modules/pgCluster/dto/create-cluster.dto.ts
export interface CreateClusterDto {
  name: string;
  region: string;
  pgVersion: '16' | '17' | '18';
  size: 'starter' | 'pro' | 'scale';
  deploymentOption: 'multi-az-cluster' | 'multi-az-instance' | 'single-az-instance';
  readReplicas?: number;
  backup?: boolean;
}
```

---

### 3. Where to Put Types — Decision Tree

```
Is this type used by more than one module?
│
├── YES → src/types/
│          e.g. PaginatedResponse<T>, Express req.user augmentation
│
└── NO  → Is it crossing an HTTP boundary (req body / res body)?
           │
           ├── YES → module/dto/
           │
           └── NO  → Inline it or put it at the top of the service file
```

---

### 4. Shared Types (`src/types/`)

Only put types here that are genuinely cross-cutting — used by two or more modules.

```ts
// src/types/pagination.ts
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

```ts
// src/types/express.d.ts — augments Express globally, always goes here
import { JwtPayload } from 'jsonwebtoken';
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
```

---

### 5. Controller → Service Pattern

Controllers own the HTTP layer only. Services own the logic. Controllers never touch the
database directly.

```ts
// modules/auth/services/signup.service.ts
import { pool } from '../../../config/db';
import { SignupDto, AuthResponseDto } from '../dto/signup.dto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export async function signupUser(dto: SignupDto): Promise<AuthResponseDto> {
  const hash = await bcrypt.hash(dto.password, 10);
  const result = await pool.query(
    'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email',
    [dto.email, hash],
  );
  const user = result.rows[0] as { id: number; email: string };
  const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET!, {
    expiresIn: '7d',
  });
  return { token, user };
}
```

```ts
// modules/auth/controllers/signup.controller.ts
import { Request, Response } from 'express';
import { SignupDto } from '../dto/signup.dto';
import { signupUser } from '../services/signup.service';

export async function signup(req: Request, res: Response): Promise<void> {
  const dto = req.body as SignupDto;
  if (!dto.email || !dto.password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }
  try {
    const result = await signupUser(dto);
    res.status(201).json(result);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

---

### 6. Avoid `any`

`any` turns off the type checker — use `unknown` when the type is truly unknown, then narrow it.

```ts
// ❌
catch (err: any) {
  if (err.code === '23505') { ... }
}

// ✅
catch (err: unknown) {
  if ((err as { code?: string }).code === '23505') { ... }
}
```

---

### 7. Non-null assertion (`!`) — use sparingly

Only use `!` when you are certain a value is defined and the compiler cannot infer it.
Prefer `??` or an explicit guard.

```ts
// ❌ hides potential runtime crash
const secret = process.env.JWT_SECRET!;

// ✅ fail fast with a clear message
const secret = process.env.JWT_SECRET;
if (!secret) throw new Error('JWT_SECRET is not set');
```

---

## Running the Backend

```bash
# Development (hot-reload, no compile step)
npm run dev

# Type-check only (no output files)
npx tsc --noEmit

# Production build
npm run build     # compiles src/ → dist/
npm run start     # runs dist/index.js
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values.

| Variable     | Description                                                |
| ------------ | ---------------------------------------------------------- |
| `PORT`       | HTTP port (default `3001`)                                 |
| `JWT_SECRET` | Secret used to sign JWTs — **never commit the real value** |
| `PGHOST`     | Postgres host                                              |
| `PGPORT`     | Postgres port (default `5432`)                             |
| `PGDATABASE` | Database name                                              |
| `PGUSER`     | Postgres user                                              |
| `PGPASSWORD` | Postgres password                                          |
