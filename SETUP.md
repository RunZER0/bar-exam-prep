# Setup Instructions

## Initial Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the `.env.example` file to `.env`:

```bash
cp .env.example .env
```

Then fill in all required values in the `.env` file.

### 3. Set Up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Enable Authentication (Google and Email/Password)
4. Get your configuration from Project Settings
5. Create a service account and download the JSON key
6. Extract values for `.env` file

### 4. Set Up Neon Database

1. Create account at [Neon.tech](https://neon.tech)
2. Create a new project
3. Get the connection string
4. Add to `.env` as `DATABASE_URL`

### 5. Get Anthropic API Key

1. Sign up at [Anthropic](https://console.anthropic.com)
2. Create an API key
3. Add to `.env` as `ANTHROPIC_API_KEY`

### 6. Initialize Database

Push the database schema:

```bash
npm run db:push
```

Or generate migrations:

```bash
npm run db:generate
npm run db:migrate
```

### 7. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Features to Test

1. **Authentication**
   - Sign up with email
   - Sign in with Google
   - Sign out

2. **Student Dashboard**
   - View progress statistics
   - Navigate to different competencies

3. **Legal Drafting**
   - Select document type
   - Ask AI questions
   - Receive filtered responses

4. **Admin Dashboard** (use ADMIN_EMAIL)
   - View analytics
   - Manage topics
   - Manage questions

## Database Management

### View Database (Studio)
```bash
npm run db:studio
```

### Generate Migrations
```bash
npm run db:generate
```

### Apply Migrations
```bash
npm run db:migrate
```

## Production Build

Test production build locally:

```bash
npm run build
npm start
```

## Troubleshooting

### Port Already in Use
Kill the process using port 3000:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3000 | xargs kill
```

### Database Connection Failed
- Check if DATABASE_URL is correct
- Verify Neon database is active
- Test connection with a database client

### Firebase Auth Not Working
- Verify all NEXT_PUBLIC_FIREBASE_* variables
- Check Firebase Console for authorized domains
- Ensure Authentication is enabled

### AI Responses Failing
- Verify ANTHROPIC_API_KEY
- Check API quota
- Review console logs for specific errors

## Development Tips

### Hot Reload Issues
If changes aren't reflecting:
```bash
# Clear Next.js cache
rm -rf .next
npm run dev
```

### Type Checking
```bash
npx tsc --noEmit
```

### Linting
```bash
npm run lint
```

## Next Steps

1. Populate database with sample topics and questions
2. Test all competency modules
3. Configure Firebase authorized domains for production
4. Set up monitoring and analytics
5. Deploy to Render (see DEPLOYMENT.md)

## Sample Data

To add sample topics and questions, you can use the admin API endpoints:

```bash
# Example: Create a topic
curl -X POST http://localhost:3000/api/admin/topics \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Constitutional Law Basics",
    "description": "Introduction to Constitutional Law",
    "competencyType": "research",
    "category": "Constitutional Law",
    "order": 1
  }'
```

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Auth Docs](https://firebase.google.com/docs/auth)
- [Neon Database Docs](https://neon.tech/docs)
- [Anthropic API Docs](https://docs.anthropic.com)
- [Drizzle ORM Docs](https://orm.drizzle.team)
