#!/usr/bin/env bash
# Finishes the Supabase half of the deployment.
# Run this after: supabase login
set -euo pipefail

ORG="odauvusfpljcduluopxj"
PROJECT_NAME="bigtexas"
REGION="${REGION:-us-east-1}"
VERCEL_SCOPE="guns-0e95291c"

echo "==> Creating Supabase project '$PROJECT_NAME' in org $ORG"
echo "    You will be prompted for a database password. Choose a strong one and save it."
supabase projects create "$PROJECT_NAME" --org-id "$ORG" --region "$REGION"

echo
echo "==> Projects in this org:"
supabase projects list

echo
read -r -p "Paste the project REF shown above: " REF

echo "==> Applying schema to $REF"
supabase link --project-ref "$REF"
supabase db push --linked || {
  echo "If db push is not usable, paste supabase/schema.sql into the SQL editor instead."
}

echo
echo "==> Now add the two secrets to Vercel."
echo "    Get them from: Supabase dashboard > Project Settings > Data API"
echo
echo "    vercel env add SUPABASE_URL production --scope $VERCEL_SCOPE"
echo "    vercel env add SUPABASE_SERVICE_ROLE_KEY production --scope $VERCEL_SCOPE"
echo "    vercel env add ADMIN_PASSWORD production --scope $VERCEL_SCOPE"
echo
echo "    Then redeploy:  vercel deploy --prod --scope $VERCEL_SCOPE"
