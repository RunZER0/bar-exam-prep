# Build configuration for Render deployment

# Install dependencies
npm install

# Generate database migrations
npm run db:generate

# Apply database migrations directly via SQL (reliable, idempotent)
# Each migration uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS where possible
# Required for migrations 0008-0010 (pricing tiers, custom packages, skill_node_map)
echo "Running database migrations..."
node scripts/run-migrations.mjs 2>&1 || echo "WARNING: migrations script had issues (check logs above)"

# Build Next.js application
npm run build
