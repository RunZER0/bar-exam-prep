# Deployment Guide for Render# Deployment Guide for Render















































































































































































































Good luck with your deployment! 🚀---- Firebase Support: https://firebase.google.com/support- Neon Support: https://neon.tech/docs- Render Support: https://render.com/docsFor deployment issues:## Support**Total**: Approximately $30-100/month depending on traffic- **Anthropic API**: Pay-per-use (~$0.015 per 1K tokens)- **Firebase**: Free tier covers most needs- **Neon Database**: $19-69/month (depends on usage)- **Render Web Service**: $7-25/month## Cost Estimate- Track user analytics- Monitor error rates- Set up uptime monitoring (e.g., UptimeRobot)### Monitoring- Keep Firebase backup- Export user data regularly- Neon provides automatic backups### Backups- Test updates in staging before production- Monitor security advisories- Update dependencies monthly: `npm update`### Regular Updates## Maintenance- [ ] No secrets in source code- [ ] Database connection uses SSL- [ ] HTTPS is enabled (automatic on Render)- [ ] Admin email is configured correctly- [ ] Firebase service account key is kept secure- [ ] All environment variables are set## Security Checklist- Review API logs in Anthropic console- Check API quota and billing- Verify ANTHROPIC_API_KEY is valid### AI Features Not Working- Ensure NEXT_PUBLIC_* variables are set correctly- Check Firebase authorized domains- Verify all Firebase credentials### Authentication Issues- Check if IP restrictions are set in Neon- Ensure Neon database is active- Verify DATABASE_URL is correct### Database Connection Issues- Check build logs for specific errors- Verify all dependencies are in package.json- Check Node version (should be 18+)### Build Failures## Troubleshooting5. Update Firebase authorized domains4. Update DNS records as shown3. Add your domain2. In Render Dashboard, go to Settings > Custom Domains1. Purchase a domain (e.g., kenyabarprep.com)## Custom Domain (Optional)4. Monitor database performance and upgrade Neon plan if needed3. Consider adding a CDN (Cloudflare)2. Enable auto-scaling1. Upgrade Render instance typeAs your user base grows:## Scaling- Set up alerts for downtime- Monitor performance under "Metrics"- View logs in Render Dashboard under "Logs" tab## Monitoring and Logs5. Test admin access with ADMIN_EMAIL4. Try accessing different features3. Test Google Sign-In2. Test user registration with email1. Visit your Render URL## Step 6: Test Your Deployment   - Add authorized redirect URIs   - Add authorized JavaScript origins3. If using Google Sign-In, configure OAuth:   - `kenya-bar-exam-prep.onrender.com`2. Add your Render URL to Authorized Domains:1. In Firebase Console, go to Authentication > Settings## Step 5: Configure Firebase Authentication4. This will create all necessary tables3. Run: `npm run db:push`2. Go to "Shell" tab1. In Render Dashboard, go to your serviceAfter deployment, you need to push the database schema:## Step 4: Initialize Database3. Wait for deployment to complete (usually 3-5 minutes)   - Start the server   - Build the application   - Install dependencies   - Clone your repository2. Render will automatically:1. Click "Create Web Service"### Deploy- Make sure to escape newlines properly with `\n`- For `FIREBASE_ADMIN_PRIVATE_KEY`, copy the entire private key from your Firebase service account JSON, including the BEGIN and END lines**Important Notes:**```ADMIN_EMAIL=admin@yourdomain.com# AdminNODE_ENV=productionNEXT_PUBLIC_APP_URL=https://kenya-bar-exam-prep.onrender.com# App ConfigANTHROPIC_API_KEY=your_anthropic_api_key# AIFIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Private_Key_Here\n-----END PRIVATE KEY-----\n"FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project_id.iam.gserviceaccount.comFIREBASE_ADMIN_PROJECT_ID=your_project_id# Firebase AdminNEXT_PUBLIC_FIREBASE_APP_ID=your_app_idNEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_idNEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.comNEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_idNEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.comNEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key# Firebase ClientDATABASE_URL=your_neon_connection_string# Database```bashAdd these environment variables in Render Dashboard:### Environment Variables   - **Instance Type**: Start with "Starter" ($7/month)   - **Start Command**: `npm start`   - **Build Command**: `npm install && npm run build`   - **Branch**: `main`   - **Region**: Choose closest to Kenya (e.g., Frankfurt)   - **Environment**: `Node`   - **Name**: `kenya-bar-exam-prep`4. Configure the service:3. Connect your GitHub/GitLab repository2. Click "New +" → "Web Service"1. Log in to Render Dashboard### Create Web Service## Step 3: Deploy to Render   - Keep this JSON file secure   - Generate new private key   - Go to Project Settings > Service Accounts5. Create a service account for admin:4. Get your Firebase config from Project Settings   - Enable Email/Password provider   - Enable Google provider   - Go to Authentication > Sign-in method3. Enable Authentication:2. Create a new project or select existing1. Go to Firebase Console (https://console.firebase.google.com)## Step 2: Configure Firebase3. Copy the connection string (it should look like: `postgresql://user:password@ep-xxx.neon.tech/barexamdb?sslmode=require`)2. Create a database named `barexamdb`1. Create a new project on Neon.tech## Step 1: Set Up Neon Database4. Anthropic API key (https://console.anthropic.com)3. A Firebase project with Auth enabled2. A Neon PostgreSQL database (https://neon.tech)1. A Render account (https://render.com)Before deploying, ensure you have:## Prerequisites
## Prerequisites

Before deploying, ensure you have:
1. A GitHub repository with your code
2. Neon.tech PostgreSQL database
3. Firebase project configured
4. Anthropic API key

## Step-by-Step Deployment

### 1. Database Setup (Neon.tech)

1. Go to [Neon.tech](https://neon.tech)
2. Create a new project
3. Copy your connection string
4. It should look like: `postgresql://user:password@ep-xxx.neon.tech/dbname?sslmode=require`

### 2. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Enable Authentication (Google and Email/Password)
4. Go to Project Settings > General
5. Copy your Firebase config values
6. Go to Project Settings > Service Accounts
7. Generate a new private key
8. Save the JSON file securely

### 3. Deploy to Render

1. **Create New Web Service**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" > "Web Service"
   - Connect your GitHub repository

2. **Configure Build Settings**
   ```
   Name: kenya-bar-exam-prep
   Environment: Node
   Region: Choose closest to Kenya (e.g., Frankfurt or Singapore)
   Branch: main
   Build Command: npm install && npm run build
   Start Command: npm start
   ```

3. **Set Environment Variables**

   Click "Advanced" > "Add Environment Variable" and add:

   ```bash
   # Database
   DATABASE_URL=your_neon_connection_string

   # Firebase Client Config
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

   # Firebase Admin (from service account JSON)
   FIREBASE_ADMIN_PROJECT_ID=your_project_id
   FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk@your_project.iam.gserviceaccount.com
   FIREBASE_ADMIN_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYour_Private_Key_Here\n-----END PRIVATE KEY-----

   # AI API Keys
   ANTHROPIC_API_KEY=your_anthropic_key
   OPENAI_API_KEY=your_openai_key (optional)

   # App Config
   NEXT_PUBLIC_APP_URL=https://your-app.onrender.com
   NODE_ENV=production

   # Admin
   ADMIN_EMAIL=admin@yourdomain.com
   ```

   **Important**: For `FIREBASE_ADMIN_PRIVATE_KEY`, replace actual newlines with `\n`

4. **Deploy**
   - Click "Create Web Service"
   - Render will automatically build and deploy
   - Wait for deployment to complete (5-10 minutes)

### 4. Post-Deployment Setup

1. **Initialize Database**
   - The migrations will run automatically on first deploy
   - Or manually run: 
   ```bash
   npm run db:push
   ```

2. **Configure Firebase Authentication**
   - Go to Firebase Console > Authentication > Settings
   - Add your Render URL to Authorized Domains:
     `your-app.onrender.com`

3. **Test the Application**
   - Visit your Render URL
   - Try creating an account
   - Test Google Sign-In
   - Verify AI features work

### 5. Custom Domain (Optional)

1. In Render Dashboard, go to your service
2. Click "Settings" > "Custom Domain"
3. Add your domain
4. Update DNS records as instructed
5. Update `NEXT_PUBLIC_APP_URL` environment variable
6. Add domain to Firebase Authorized Domains

## Environment Variables Checklist

- [ ] DATABASE_URL
- [ ] NEXT_PUBLIC_FIREBASE_API_KEY
- [ ] NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- [ ] NEXT_PUBLIC_FIREBASE_PROJECT_ID
- [ ] NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
- [ ] NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- [ ] NEXT_PUBLIC_FIREBASE_APP_ID
- [ ] FIREBASE_ADMIN_PROJECT_ID
- [ ] FIREBASE_ADMIN_CLIENT_EMAIL
- [ ] FIREBASE_ADMIN_PRIVATE_KEY
- [ ] ANTHROPIC_API_KEY
- [ ] NEXT_PUBLIC_APP_URL
- [ ] ADMIN_EMAIL

## Troubleshooting

### Build Fails
- Check that all dependencies are in package.json
- Verify Node version compatibility (18+)
- Check build logs for specific errors

### Database Connection Issues
- Verify DATABASE_URL is correct
- Ensure Neon database is active
- Check if database migrations ran

### Authentication Not Working
- Verify all Firebase env variables are set
- Check Firebase Authorized Domains includes your Render URL
- Ensure FIREBASE_ADMIN_PRIVATE_KEY newlines are properly escaped

### AI Features Not Working
- Verify ANTHROPIC_API_KEY is valid
- Check API quota/billing
- Review server logs for error messages

## Monitoring

1. **Logs**: View real-time logs in Render Dashboard
2. **Metrics**: Monitor CPU, Memory usage
3. **Alerts**: Set up email notifications for downtime

## Scaling

For production use:
1. Upgrade Render plan for better performance
2. Enable auto-scaling
3. Consider CDN for static assets
4. Implement caching strategy

## Security Checklist

- [ ] All environment variables are set as secrets
- [ ] Firebase security rules are configured
- [ ] Database has proper access controls
- [ ] HTTPS is enabled (automatic on Render)
- [ ] Admin email is properly configured
- [ ] API rate limiting is considered

## Maintenance

- Regular database backups (Neon automatic)
- Monitor AI API usage and costs
- Update dependencies regularly
- Review error logs weekly
- Test new features in staging first

## Support

If you encounter issues:
1. Check Render logs
2. Review Firebase Auth logs
3. Check database connectivity
4. Contact support with specific error messages
