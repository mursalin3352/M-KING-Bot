#!/bin/bash
# M-KING-Bot - Only Your Repo
# Run: bash setup-git.sh

REMOTE="https://${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/mursalin3352/M-KING-Bot.git"

if [ -d ".git" ] && [ -f ".git/config" ]; then
  echo "✅ Git already initialized."
  git remote set-url origin "$REMOTE" 2>/dev/null
  git fetch origin --quiet
  echo "📌 HEAD: $(git log --oneline -1 origin/main)"
  exit 0
fi

echo "⚙️  Reinitializing git..."
rm -rf .git
git init
git remote add origin "$REMOTE"
git fetch origin
git reset origin/main
echo "✅ Done — local is now at: $(git log --oneline -1 HEAD)"
