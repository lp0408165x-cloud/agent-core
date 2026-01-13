#!/bin/bash
# ============================================
# Agent Core - Setup Script
# ============================================
# Run this script to configure your package name and repository
# Usage: ./setup.sh @your-scope your-github-org
# Example: ./setup.sh @mycompany mycompany

set -e

SCOPE=${1:-"@your-scope"}
ORG=${2:-"your-org"}

echo "🔧 Configuring Agent Core..."
echo "   Package scope: $SCOPE"
echo "   GitHub org: $ORG"
echo ""

# Replace in package.json
sed -i.bak "s/<your-scope>/$SCOPE/g" package.json
sed -i.bak "s/<your-org>/$ORG/g" package.json
rm -f package.json.bak

# Replace in README.md
sed -i.bak "s/<your-scope>/$SCOPE/g" README.md
rm -f README.md.bak

# Replace in PUBLISHING.md
sed -i.bak "s/<your-scope>/$SCOPE/g" PUBLISHING.md
rm -f PUBLISHING.md.bak

echo "✅ Configuration complete!"
echo ""
echo "Next steps:"
echo "  1. Review package.json and README.md"
echo "  2. Run: npm install"
echo "  3. Run: npm run build"
echo "  4. Run: npm run test:run"
echo "  5. Run: npm run release:dry"
echo ""
echo "To publish:"
echo "  npm login"
echo "  npm run release"
