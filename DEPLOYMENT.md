# Deployment Guide for Render

## Quick Deploy Steps

### 1. Push Code to GitHub
```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### 2. Create Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository: `RunZER0/bar-exam-prep`
4. Configure:
   - **Name:** `bar-exam-prep` (or your choice)
   - **Region:** Oregon (or nearest)
   - **Branch:** `main`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
   - **Plan:** Free (or Starter for better performance)

### 3. Add Environment Variables

In Render Dashboard → Your Service → **Environment** tab, add these variables:

#### Database (Neon PostgreSQL)
| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql://user:pass@host/dbname?sslmode=require` |

#### AI APIs
| Key | Value |
|-----|-------|
| `OPENAI_API_KEY` | `sk-...` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` *(optional fallback)* |

#### Admin
| Key | Value |
|-----|-------|
| `ADMIN_EMAIL` | `your-admin@email.com` |

#### Firebase Client (Public - these are safe to expose)
| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIza...` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `your-project-id` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `123456789` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:123456789:web:abc123` |

#### Firebase Admin (Server-side - keep secret!)
| Key | Value |
|-----|-------|
| `FIREBASE_ADMIN_PROJECT_ID` | `your-project-id` |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | `firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com` |
| `FIREBASE_ADMIN_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n` |

> **Important:** For `FIREBASE_ADMIN_PRIVATE_KEY`, paste the entire private key including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` parts. Render handles the newlines automatically.

### 4. Deploy

Click **"Create Web Service"** — Render will:
1. Clone your repo
2. Run `npm install && npm run build`
3. Start `npm run start`
4. Assign a URL like `https://bar-exam-prep.onrender.com`

### 5. Post-Deploy: Run Database Migrations

After first deploy, you may need to push the schema to Neon:

```bash
# Locally, with DATABASE_URL set
npm run db:push
```

Or use Render Shell:
1. Go to your service → **Shell** tab
2. Run: `npm run db:push`

---

## Firebase Configuration

### Get Firebase Client Config
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project → Project Settings (gear icon)
3. Scroll to "Your apps" → Select web app
4. Copy the config values

### Get Firebase Admin Credentials
1. Firebase Console → Project Settings → **Service Accounts**
2. Click **"Generate new private key"**
3. Open the downloaded JSON
4. Extract:
   - `project_id` → `FIREBASE_ADMIN_PROJECT_ID`
   - `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY`

### Enable Firebase Auth Providers
1. Firebase Console → Authentication → Sign-in method
2. Enable: **Email/Password** and/or **Google**
3. Add your Render domain to authorized domains:
   - `bar-exam-prep.onrender.com`

---

## Neon Database Setup

### Get Connection String
1. Go to [Neon Console](https://console.neon.tech)
2. Select your project → Connection Details
3. Copy the connection string (pooled recommended for serverless):
   ```
   postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

---

## Troubleshooting

### Build Fails
- Check Render logs for specific error
- Ensure all env vars with `NEXT_PUBLIC_` prefix are set (required at build time)

### Auth Not Working
- Verify Firebase domain authorization
- Check `FIREBASE_ADMIN_PRIVATE_KEY` format (should include literal `\n` or be properly escaped)

### Database Connection Issues
- Ensure `DATABASE_URL` includes `?sslmode=require`
- Try pooled connection string from Neon

### 500 Errors on API Routes
- Check Render logs
- Verify all server-side env vars are set
- Ensure OpenAI API key is valid

---

## Environment Variables Checklist

```env
# Database
DATABASE_URL=postgresql://...

# AI
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...  # Optional

# Admin
ADMIN_EMAIL=admin@example.com

# Firebase Client (NEXT_PUBLIC_ = exposed to browser)
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Firebase Admin (server-only)
FIREBASE_ADMIN_PROJECT_ID=project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk@....iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

---

## Useful Links
- [Render Dashboard](https://dashboard.render.com)
- [Firebase Console](https://console.firebase.google.com)
- [Neon Console](https://console.neon.tech)
- [OpenAI API Keys](https://platform.openai.com/api-keys)
