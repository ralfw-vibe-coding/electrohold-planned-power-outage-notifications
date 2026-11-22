#!/bin/zsh
# Version hochzählen und auf Netlify veröffentlichen
set -e
cd "$(dirname "$0")"
node tools/bump-version.mjs
npx netlify-cli deploy --prod --dir public --functions netlify/functions 2>&1 | grep -E "Deploy complete|Production URL|Error|error"
