# Authentication Implementation

1. Sessions (Common)
2. Tokens (Modern APIs) - this project used

## Token

After login:

```Plain text
User → login
Server → gives token
```

Then every request from browser includes the token:

```Plain text
(example)
GET /profile
Authorization: Bearer TOKEN
```

the server checks the token to verify the user.

## Details

https://chatgpt.com/g/g-p-69b35eb7f6688191b37ac24fe36c17a3/c/69b35f2a-086c-83a0-9c13-6765fbec2ded
https://chatgpt.com/share/69b34758-8acc-8010-b9a8-a9a4d04b664e

# prisma

## Schema.prisma: Manual vs Generated

### What You Write Manually:

The `schema.prisma` file itself is **written by you**. This includes:

1. **Database configuration**
2. **Model definitions**
3. **Field types and constraints**
4. **Relationships between models**
5. **Indexes and mappings**

### What Gets Generated:

Based on your `schema.prisma` file, Prisma **generates**:

1. **Prisma Client** - The JavaScript/TypeScript client code
2. **Type definitions** - TypeScript types for your models
3. **Database migrations** - SQL files to update your database

## How It Works:

### 1. You Write the Schema (Manual)

```prisma
model User {
  id              String        @id @default(uuid())
  email           String        @unique
  passwordHash    String        @map("password_hash")
  fullName        String?       @map("full_name")
  // ... rest of your fields
}
```

### 2. Prisma Generates Client Code (Automatic)

When you run `npx prisma generate`, Prisma creates:

```javascript
// Generated in node_modules/@prisma/client
export class PrismaClient {
  user: {
    create: (args) => Promise<User>
    findMany: (args) => Promise<User[]>
    findUnique: (args) => Promise<User | null>
    // ... all CRUD operations
  }
}
```

### 3. You Use the Generated Client

```javascript
// Your code using the generated client
const prisma = new PrismaClient();
const user = await prisma.user.create({
  data: {
    email: "test@example.com",
    passwordHash: "hash123",
  },
});
```

## Different Ways to Create Schema:

### Method 1: Write from Scratch (What you did)

```bash
npx prisma init  # Creates basic schema template
# Then you manually write your models
```

### Method 2: Generate from Existing Database

If you have an existing database, you can generate the schema:

```bash
npx prisma db pull  # Generates schema from existing database
```

### Method 3: Use Prisma Studio

You can use the visual editor:

```bash
npx prisma studio  # Opens browser-based database editor
```

## Your Current Workflow:

Looking at your files, you're following the correct approach:

1. **Manual Schema** (`schema.prisma`) - You wrote this yourself ✅
2. **Generated Client** - Created when you run `npx prisma generate`
3. **Your Usage** (`prisma.js`) - You import and use the generated client ✅

## Key Commands to Remember:

```bash
# After changing schema.prisma, run these:
npx prisma generate        # Regenerates the client code
npx prisma migrate dev     # Creates and applies database migration
npx prisma db push         # Quick sync for development (no migration files)
```

## Summary:

- **Schema.prisma = Manual** (you write it)
- **Prisma Client = Generated** (Prisma creates it)
- **Your app code = Manual** (you write it using the generated client)

Your current setup is perfect! You manually defined your User, AuthSession, and AuthAuditLog models, and Prisma generates all the client code to interact with them.
