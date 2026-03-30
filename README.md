# Claude PR Review Agent

A Node.js CLI tool that reviews GitHub Pull Requests using AI and posts structured Markdown review comments.

## Features

- 📥 Accepts PR URL as input
- 🔍 Fetches PR diff, files, and commit history
- 🤖 Uses MiniMax AI for intelligent code analysis
- 📤 Posts structured Markdown review to PR
- ⚡️ Works as CLI or GitHub Action

## Installation

```bash
git clone https://github.com/lunchfang/claude-builders-bounty
cd claude-builders-bounty
npm install
```

## CLI Usage

```bash
# Set your GitHub token
export GITHUB_TOKEN=ghp_xxxxx

# Run on a PR
node claude-review.js --pr https://github.com/owner/repo/pull/123

# Or specify token directly
node claude-review.js --pr https://github.com/owner/repo/pull/123 --token ghp_xxxxx
```

## GitHub Action Usage

```yaml
name: Claude PR Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Claude Review
        uses: lunchfang/claude-builders-bounty/feature/pr-review-agent@v1
        with:
          pr-url: ${{ github.event.pull_request.html_url }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Output Format

The review includes:

- **Summary**: 2-3 sentence overview of changes
- **Risks**: Identified potential issues
- **Suggestions**: Improvement recommendations  
- **Confidence Score**: Low / Medium / High

## Example

```bash
$ node claude-review.js --pr https://github.com/facebook/react/pull/12345

🔍 Fetching PR details...
📝 PR: Add use hooks
📁 Files: 3, +150 -20
🤖 Analyzing with AI...
✅ Review posted to PR!
```

## License

MIT
