# Kenya Bar Exam Prep Platform

A professional, AI-powered platform for Kenyan law students preparing for the bar examination. This application is aligned with the Council of Legal Education (CLE) requirements and based on the Kenyan Constitution 2010 and current Advocate Training Programme (ATP).

## Features

### Core Competencies
- **Legal Drafting**: Practice contracts, pleadings, legal opinions, and memoranda
- **Legal Research**: Master case law analysis and statutory interpretation
- **Oral Advocacy**: Practice court arguments and client counseling

### AI-Powered Learning
- Advanced AI assistance with comprehensive guardrails
- Hallucination detection and filtering
- Kenya-specific legal context
- Real-time feedback and evaluation

### Technology Stack
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL (Neon.tech)
- **Authentication**: Firebase Auth (Google & Email)
- **AI**: Anthropic Claude 3.5 Sonnet (with OpenAI fallback)
- **Deployment**: Render

## Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL database (Neon.tech)
- Firebase project
- Anthropic API key

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd "Bar Exam Prep"
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

Required environment variables:
- `DATABASE_URL`: Neon PostgreSQL connection string
- Firebase configuration (API key, auth domain, etc.)
- `ANTHROPIC_API_KEY`: Your Anthropic API key
- `ADMIN_EMAIL`: Email address for admin access

4. Set up the database
```bash
npm run db:push
```

5. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── api/                 # API routes
│   │   ├── ai/             # AI chat endpoints
│   │   ├── admin/          # Admin management endpoints
│   │   ├── topics/         # Topics endpoints
│   │   ├── questions/      # Questions endpoints
│   │   └── ...
│   ├── dashboard/          # Student dashboard
│   ├── study/              # Study modules (drafting, research, oral)
│   ├── admin/              # Admin dashboard
│   └── ...
├── components/
│   └── ui/                 # Reusable UI components
├── contexts/               # React contexts (Auth)
├── lib/
│   ├── db/                 # Database schema and queries
│   ├── firebase/           # Firebase configuration
│   ├── ai/                 # AI guardrails system
│   └── auth/               # Auth middleware
└── ...
```

## Database Schema

The platform uses PostgreSQL with Drizzle ORM. Key tables:
- `users`: User accounts and profiles
- `topics`: Study topics based on Kenyan ATP
- `questions`: Question bank for practice
- `user_progress`: Track student progress
- `user_responses`: Store student submissions
- `chat_history`: AI interaction logs
- `content_updates`: Admin audit log

## AI Guardrails

The platform implements comprehensive AI safety measures:
- **Hallucination Detection**: Validates legal citations and facts
- **Context Filtering**: Ensures responses are relevant to Kenyan law
- **Confidence Scoring**: Filters low-confidence responses
- **Response Validation**: Cross-checks AI outputs for accuracy

## Deployment on Render

1. Create a new Web Service on Render
2. Connect your repository
3. Configure environment variables
4. Set build command: `npm install && npm run build`
5. Set start command: `npm start`
6. Deploy

## Admin Access

Admin users (identified by the `ADMIN_EMAIL` environment variable) have access to:
- Analytics dashboard
- Content management (topics, questions)
- User management
- System monitoring

## Contributing

This platform is designed for Kenyan legal education. Contributions should maintain alignment with:
- CLE requirements
- Kenyan legal standards
- ATP curriculum

## License

Copyright © 2026. All rights reserved.

## Support

For support or questions about the platform, please contact the development team.
