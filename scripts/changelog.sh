#!/bin/bash

# Generate Changelog from Git History
# Usage: bash changelog.sh

set -e

# Get the last tag or start from first commit
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

# Determine commit range
if [ -z "$LAST_TAG" ]; then
    RANGE="--all"
    VERSION="Unreleased"
else
    RANGE="$LAST_TAG..HEAD"
    VERSION="$LAST_TAG"
fi

# Get current date
DATE=$(date +%Y-%m-%d)

# Initialize arrays
declare -a added=()
declare -a fixed=()
declare -a changed=()
declare -a removed=()

# Parse commits
while IFS= read -r commit; do
    msg=$(echo "$commit" | sed 's/^[a-f0-9]* //' | tr '[:upper:]' '[:lower:]')
    
    if echo "$msg" | grep -qE "^(feat|add|new) "; then
        added+=("$(echo "$commit" | sed 's/^[a-f0-9]* //')")
    elif echo "$msg" | grep -qE "^(fix|bug|patch) "; then
        fixed+=("$(echo "$commit" | sed 's/^[a-f0-9]* //')")
    elif echo "$msg" | grep -qE "^(refactor|update|modify|change) "; then
        changed+=("$(echo "$commit" | sed 's/^[a-f0-9]* //')")
    elif echo "$msg" | grep -qE "^(remove|delete|deprec|drop) "; then
        removed+=("$(echo "$commit" | sed 's/^[a-f0-9]* //')")
    else
        changed+=("$(echo "$commit" | sed 's/^[a-f0-9]* //')")
    fi
done < <(git log $RANGE --pretty=format:"%h %s" 2>/dev/null || echo "")

# Generate CHANGELOG.md
cat > CHANGELOG.md << EOF
# Changelog

All notable changes to this project will be documented in this file.

## [$VERSION] - $DATE

EOF

# Added
if [ ${#added[@]} -gt 0 ]; then
    echo "### Added" >> CHANGELOG.md
    echo "" >> CHANGELOG.md
    for item in "${added[@]}"; do
        echo "- $item" >> CHANGELOG.md
    done
    echo "" >> CHANGELOG.md
fi

# Fixed
if [ ${#fixed[@]} -gt 0 ]; then
    echo "### Fixed" >> CHANGELOG.md
    echo "" >> CHANGELOG.md
    for item in "${fixed[@]}"; do
        echo "- $item" >> CHANGELOG.md
    done
    echo "" >> CHANGELOG.md
fi

# Changed
if [ ${#changed[@]} -gt 0 ]; then
    echo "### Changed" >> CHANGELOG.md
    echo "" >> CHANGELOG.md
    for item in "${changed[@]}"; do
        echo "- $item" >> CHANGELOG.md
    done
    echo "" >> CHANGELOG.md
fi

# Removed
if [ ${#removed[@]} -gt 0 ]; then
    echo "### Removed" >> CHANGELOG.md
    echo "" >> CHANGELOG.md
    for item in "${removed[@]}"; do
        echo "- $item" >> CHANGELOG.md
    done
    echo "" >> CHANGELOG.md
fi

echo "CHANGELOG.md generated successfully!"
echo ""
echo "Output:"
cat CHANGELOG.md
