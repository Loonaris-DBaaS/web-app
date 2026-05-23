# Coding Standards

This document is the **single source of truth** for code style, naming, and structure in this project. All contributors must follow these rules.

---

## 1. Naming Conventions

### Variables & Functions
- Use **`camelCase`** for all variables, function parameters, and non-component functions.
  ```js
  const totalStorageGb = 1200;
  function getPasswordScore(password) { ... }
  ```

### React Components
- Use **`PascalCase`** for React component names and their files.
  ```jsx
  // File: DatabaseDetailPage.jsx
  export default function DatabaseDetailPage() { ... }
  ```

### Files
| Type | Convention | Example |
|------|-----------|---------|
| React component | `PascalCase.jsx` | `Sidebar.jsx` |
| React stylesheet | Match component name | `Sidebar.css` |
| Non-component JS (hooks, utils, services) | `camelCase.js` | `useAuth.js`, `auth.service.js` |
| Backend controller | `featureName.controller.js` | `database.controller.js` |
| Backend service | `featureName.service.js` | `login.service.js` |
| Backend model | `modelName.js` | `tenant.js` |
| Config files | `camelCase.js` | `db.js` |

### CSS Classes
- Use **`kebab-case`** for CSS class names.
  ```css
  .dashboard-sidebar__brand { ... }
  .status-pill.is-healthy { ... }
  ```

### Constants
- Use **`UPPER_SNAKE_CASE`** for top-level module constants that never change.
  ```js
  const PG_VERSIONS = ['18', '17', '16'];
  const REGION_OPTIONS = [...];
  ```

---

## 2. Directory Structure

### Backend

```
backend/
└── src/
    ├── config/           # Shared configuration (database connections, env)
    │   └── db.js
    ├── modules/          # One sub-folder per domain module
    │   ├── auth/
    │   │   ├── controllers/
    │   │   ├── services/
    │   │   └── models/
    │   └── pgCluster/    # CloudNativePG cluster management
    │       ├── controllers/
    │       ├── services/
    │       ├── models/
    │       └── provisioning/   # Cluster provisioning lives inside pgCluster
    └── index.js          # Entry point — wires up routes and starts the server
```

### Frontend

```
frontend/src/
├── app/                  # App bootstrap: entry component and router
│   └── router/
├── components/           # Shared, reusable components
│   ├── layout/           # Full-page structural components (Navbar, Sidebar, Footer)
│   └── ui/               # Generic UI primitives (Button, Input, Card, …)
├── features/             # One sub-folder per route/feature
│   ├── Dashboard/
│   │   ├── components/   # Components used ONLY within the Dashboard feature
│   │   ├── Database.jsx
│   │   ├── DatabaseDetailPage.jsx
│   │   ├── SettingsPage.jsx
│   │   └── Support.jsx
│   ├── Landing/
│   ├── SignIn/
│   └── SignUp/
├── hooks/                # Custom React hooks
├── layouts/              # Route-level layout wrappers (AuthLayout, DashboardLayout)
├── services/             # API/service layer
├── styles/               # Global CSS and design tokens
└── utils/                # Pure helper functions
```

**Rule:** If a component is used by exactly one feature, place it in `features/{FeatureName}/components/`. If it is used by two or more features, place it in `components/ui/` (or `components/layout/` for structural pieces).

---

## 3. Code Formatting

Formatting is enforced by Prettier. The project `.prettierrc` defines:

| Option | Value |
|--------|-------|
| `printWidth` | `100` |
| `tabWidth` | `2` |
| `useTabs` | `false` |
| `semi` | `true` |
| `singleQuote` | `true` |
| `bracketSpacing` | `true` |
| `arrowParens` | `always` |
| `trailingComma` | `all` |
| `endOfLine` | `lf` |

Run `prettier --write .` before committing.

---

## 4. Import Order

Organise imports in this order, separated by a blank line:

1. External packages (`react`, `react-router-dom`, `express`, …)
2. Internal shared modules (`../../components/ui/…`, `../../hooks/…`)
3. Feature-local modules (`./components/…`, `../services/…`)
4. CSS / asset files

```jsx
// 1. External
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// 2. Shared
import Button from '../../../components/ui/Button';
import DashboardHeader from '../../../components/ui/DashboardHeader';

// 3. Feature-local
import DatabasesTable from './components/DatabasesTable';
import CreateDatabaseForm from '../../../components/ui/CreateDatabaseForm';
```

---

## 5. JSDoc Comments

Add a JSDoc block only when the **why** or the **contract** of a function is non-obvious. Avoid re-stating what the code already says.

```js
/**
 * Hashes a plain-text password and inserts the new user into the database.
 * Throws a 23505 Postgres error if the email is already registered.
 *
 * @param {string} email
 * @param {string} password  Plain-text password — will be bcrypt-hashed internally.
 * @returns {Promise<{id: number, email: string}>}
 */
async function createUser(email, password) { ... }
```

For React components, a single-line comment above the export is sufficient when the props contract is clear from the code itself.

---

## 6. React Component Rules

- **One component per file.** Small private helpers (icon components, sub-sections) may live in the same file only when they are not exported and are 20 lines or fewer.
- **Default exports** for page/feature components; **named exports** are acceptable for utility components used with destructuring.
- Prefer **function declarations** over arrow-function component definitions at the module level.
- Keep inline styles minimal. Prefer CSS classes. Use inline styles only for **dynamic** values (e.g. `style={{ width: \`${percent}%\` }}`).

---

## 7. Backend Rules

- All database access must go through a **service** function; controllers must not query the database directly.
- Secrets and configuration live in `.env`; never hard-code credentials. Always provide a `.env.example` with placeholder values.
- Export the Express `app` separately from `server.listen()` to allow testing without starting the HTTP server.
