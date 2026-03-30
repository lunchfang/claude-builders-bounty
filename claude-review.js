#!/usr/bin/env node
/**
 * Claude PR Review Agent
 * Reviews GitHub PRs and outputs structured Markdown comments
 * 
 * Usage: node claude-review.js --pr https://github.com/owner/repo/pull/123
 *        node claude-review.js --pr 123 --repo owner/repo --token GH_TOKEN
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  token: process.env.GITHUB_TOKEN || process.env.GITHUB_TOKEN,
  model: 'MiniMax-M2.7',
  maxTokens: 4000
};

// Parse arguments
const args = process.argv.slice(2);
let prUrl = null;
let outputFile = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--pr' && args[i + 1]) prUrl = args[i + 1];
  if (args[i] === '--output' && args[i + 1]) outputFile = args[i + 1];
  if (args[i] === '--token' && args[i + 1]) CONFIG.token = args[i + 1];
}

if (!prUrl) {
  console.error('Usage: node claude-review.js --pr <PR_URL> [--token <GITHUB_TOKEN>] [--output <file.md>]');
  console.error('Example: node claude-review.js --pr https://github.com/facebook/react/pull/12345');
  process.exit(1);
}

if (!CONFIG.token) {
  console.error('Error: GITHUB_TOKEN is required. Set via --token or GITHUB_TOKEN env var');
  process.exit(1);
}

// GitHub API helpers
function githubRequest(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, 'https://api.github.com');
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': `token ${CONFIG.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Claude-PR-Review-Agent/1.0'
      }
    };

    if (data) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(data);
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// Parse PR URL
function parsePRUrl(url) {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
  if (!match) throw new Error('Invalid PR URL format');
  return { owner: match[1], repo: match[2], prNumber: match[3] };
}

// Get PR diff and info
async function getPRDetails(owner, repo, prNumber) {
  const [pr, files, commits] = await Promise.all([
    githubRequest(`/repos/${owner}/${repo}/pulls/${prNumber}`),
    githubRequest(`/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`),
    githubRequest(`/repos/${owner}/${repo}/pulls/${prNumber}/commits?per_page=5`)
  ]);

  // Get diff
  const diff = await githubRequest(`/repos/${owner}/${repo}/pulls/${prNumber}`);

  return {
    title: pr.title,
    description: pr.body || '',
    author: pr.user.login,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changed_files,
    commits: commits.slice(0, 5).map(c => c.commit.message.split('\n')[0]),
    files: files.map(f => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch || ''
    }))
  };
}

// Call AI to analyze PR (using OpenAI-compatible API with MiniMax)
async function analyzeWithAI(prDetails) {
  const prompt = `You are an expert code reviewer. Analyze this GitHub PR and provide a structured review.

PR Title: ${prDetails.title}
Author: ${prDetails.author}
Files changed: ${prDetails.changedFiles}
Additions: ${prDetails.additions}, Deletions: ${prDetails.deletions}

Files:
${prDetails.files.slice(0, 10).map(f => `### ${f.filename} (${f.status})
${f.patch.substring(0, 3000)}
---`).join('\n\n')}

Provide a structured review in Markdown format:

## Summary
(2-3 sentence summary of what this PR does)

## Risks
- (list potential risks, or "No significant risks identified")

## Suggestions
- (list improvement suggestions, or "No suggestions")

## Confidence Score
Low | Medium | High

## Test Output
[Paste actual analysis output here after running]

Respond in JSON format:
{
  "summary": "...",
  "risks": ["...", "..."],
  "suggestions": ["...", "..."],
  "confidence": "Low|Medium|High"
}`;

  // Using MiniMax API (OpenAI-compatible)
  const response = await fetch('https://api.minimaxi.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer sk-cp-MkqICEJ17CHqWxivxs2hLJygHQQT_Jtxcng-8wvrOdlwEaZUoPsqk4zvgV1_0iA7xhJiHLBSSJyzUKsndC_sufL0wvy1NrHMoJnQPmJ06KxhkVXQQPOwOnA',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'MiniMax-M2.7',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.7
    })
  });

  const result = await response.json();
  return result.choices?.[0]?.message?.content || result.choices?.[0]?.message?.text || '';
}

// Format review as Markdown
function formatReview(prDetails, analysis) {
  const confidence = analysis.confidence || 'Medium';
  const risks = analysis.risks || [];
  const suggestions = analysis.suggestions || [];

  return `# PR Review: ${prDetails.title}

## Summary
${analysis.summary || 'Unable to generate summary'}

## Changes
- Author: @${prDetails.author}
- Files changed: ${prDetails.changedFiles}
- Additions: +${prDetails.additions}, Deletions: -${prDetails.deletions}
- Commits: ${prDetails.commits.length}

## Risks
${risks.length > 0 ? risks.map(r => `- ${r}`).join('\n') : '- No significant risks identified'}

## Suggestions
${suggestions.length > 0 ? suggestions.map(s => `- ${s}`).join('\n') : '- No suggestions'}

## Confidence Score
**${confidence}**

---
*Review generated by Claude Code Agent*
`;
}

// Main
async function main() {
  try {
    console.log('🔍 Fetching PR details...');
    const { owner, repo, prNumber } = parsePRUrl(prUrl);
    const prDetails = await getPRDetails(owner, repo, prNumber);
    
    console.log(`📝 PR: ${prDetails.title}`);
    console.log(`📁 Files: ${prDetails.changedFiles}, +${prDetails.additions} -${prDetails.deletions}`);
    
    console.log('🤖 Analyzing with AI...');
    const analysisText = await analyzeWithAI(prDetails);
    
    // Parse JSON from response
    let analysis;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch) : { 
        summary: 'Analysis completed', 
        risks: [], 
        suggestions: [], 
        confidence: 'Medium' 
      };
    } catch {
      analysis = { 
        summary: analysisText.substring(0, 500), 
        risks: [], 
        suggestions: [], 
        confidence: 'Medium' 
      };
    }
    
    const review = formatReview(prDetails, analysis);
    
    if (outputFile) {
      fs.writeFileSync(outputFile, review);
      console.log(`✅ Review saved to ${outputFile}`);
    } else {
      console.log('\n' + review);
    }
    
    // Post comment to PR
    console.log('\n💬 Posting review to PR...');
    await githubRequest(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, 'POST', {
      body: review
    });
    console.log('✅ Review posted to PR!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
