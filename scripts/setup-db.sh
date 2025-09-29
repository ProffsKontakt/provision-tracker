#!/bin/bash

# Database setup script for Commission Tracker
echo "🚀 Setting up Commission Tracker Database..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create it with DATABASE_URL and other required variables."
    exit 1
fi

# Load environment variables
set -o allexport
source .env
set +o allexport

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set in .env file"
    exit 1
fi

echo "📊 Generating Prisma client..."
npx prisma generate

echo "🗄️  Resetting database and applying migrations..."
npx prisma migrate reset --force

echo "🌱 Seeding database with sample data..."
npx prisma db seed

echo "✅ Database setup complete!"
echo ""
echo "🔑 Sample login credentials:"
echo "  Admin: admin@proffskontakt.se / admin123"
echo "  Setter: erik.andersson@proffskontakt.se / setter123"
echo ""
echo "🌐 Start the development server with: npm run dev"