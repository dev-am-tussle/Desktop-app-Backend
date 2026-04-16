import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import McpConnector from '../src/models/McpConnector.model';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const CONNECTORS = [
  {
    name: "gmail",
    title: "Gmail",
    description: "Draft replies, summarize threads, & search your inbox",
    descriptionFormat: "text",
    detailedDescription: "# Gmail Integration\n\nConnect Gmail to Claude to quickly find important emails and understand long conversations. Claude can:\n\n- Search through your messages\n- Read entire email threads to give you context\n- Help you stay on top of your inbox\n- Perfect for finding that message you remember sending\n- Catching up on email chains you missed\n- Preparing for meetings",
    detailedDescriptionFormat: "markdown",
    iconUrl: "https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg",
    category: "Productivity",
    status: "verified",
    version: "1.2.3",
    changelogUrl: "https://github.com/anthropics/google-workspace-mcp/releases",
    isPopular: true,
    tags: [
      { label: "New", type: "success" }
    ],
    developer: {
      name: "Anthropic",
      url: "https://www.anthropic.com"
    },
    tools: [
      { name: "create_draft", description: "Create a new draft email" },
      { name: "get_profile", description: "Get the user's Gmail profile" },
      { name: "list_drafts", description: "List email drafts" },
      { name: "read_message", description: "Read a specific email message" },
      { name: "read_thread", description: "Read an entire email thread" },
      { name: "search_messages", description: "Search through Gmail messages" }
    ],
    moreInfo: [
      { label: "Documentation", url: "https://docs.anthropic.com/en/docs/agents-and-tools/mcp" },
      { label: "Support", url: "https://support.anthropic.com" }
    ],
    privacy: {
      privacyPolicyUrl: "https://www.anthropic.com/privacy",
      termsOfServiceUrl: "https://www.anthropic.com/terms"
    },
    connectorUrl: "https://gmail.mcp.claude.com/mcp",
    runtime: {
      engine: "npx",
      package: "@aaronsb/google-workspace-mcp",
      args: ["--transport", "stdio"],
      envVarsMetadata: [
        {
          key: "GOOGLE_CLIENT_ID",
          label: "Google OAuth Client ID",
          placeholder: "1234567890-abc123xyz.apps.googleusercontent.com",
          description: "Obtained from Google Cloud Console (https://console.cloud.google.com/apis/credentials)",
          required: true
        },
        {
          key: "GOOGLE_CLIENT_SECRET",
          label: "Google OAuth Client Secret",
          placeholder: "GOCSPX-...",
          description: "Your Google OAuth 2.0 Client Secret from Google Cloud Console",
          required: true
        }
      ]
    },
    permissions: ["gmail:read", "gmail:send"],
    isArchived: false
  },
  {
    name: "slack",
    title: "Slack",
    description: "Read channels, search messages, and post updates to your team.",
    descriptionFormat: "text",
    detailedDescription: "# Slack Integration\n\nThe Slack MCP server allows your AI assistant to:\n\n- Browse and read channels\n- Search message history\n- Post and update messages\n- Manage reactions and threads\n- Best way to keep the AI in the loop with your team's communication",
    detailedDescriptionFormat: "markdown",
    iconUrl: "https://cdn.sovereignai.com/icons/slack.png",
    category: "Communication",
    status: "verified",
    version: "1.1.0",
    isPopular: true,
    tags: [
      { label: "Team Favorite", type: "info" }
    ],
    developer: {
      name: "SovereignAI Team",
      url: "https://sovereignai.com"
    },
    tools: [
      { name: "list_channels", description: "List available Slack channels" },
      { name: "get_channel_history", description: "Read recent messages from a channel" },
      { name: "post_message", description: "Send a message to a channel" }
    ],
    moreInfo: [
      { label: "Setup Guide", url: "https://sovereignai.com/docs/slack" }
    ],
    privacy: {
      privacyPolicyUrl: "https://api.slack.com/privacy",
      termsOfServiceUrl: "https://slack.com/terms-of-service"
    },
    runtime: {
      engine: "npx",
      package: "@modelcontextprotocol/server-slack",
      args: ["--transport", "stdio"],
      envVarsMetadata: [
        {
          key: "SLACK_BOT_TOKEN",
          label: "Slack Bot Token",
          placeholder: "xoxb-...",
          description: "Your Slack Bot token starting with xoxb- from https://api.slack.com/apps",
          required: true
        }
      ]
    },
    permissions: ["channels:read", "chat:write"],
    isArchived: false
  },
  {
    name: "github",
    title: "GitHub",
    description: "Manage issues, pull requests, and browse code repositories.",
    descriptionFormat: "text",
    detailedDescription: "# GitHub Integration\n\nFull GitHub integration for developers. Control your repositories using natural language.\n\n**Perfect for:**\n- Refactoring code\n- Issue triage and management\n- Code reviews and pull requests\n- Repository exploration and analysis",
    detailedDescriptionFormat: "markdown",
    iconUrl: "https://cdn.sovereignai.com/icons/github.png",
    category: "Development",
    status: "verified",
    version: "2.0.1",
    isPopular: false,
    tags: [
      { label: "Pro Tools", type: "warning" }
    ],
    developer: {
      name: "SovereignAI Team",
      url: "https://sovereignai.com"
    },
    tools: [
      { name: "list_repos", description: "List user repositories" },
      { name: "create_issue", description: "Create a new GitHub issue" },
      { name: "get_pull_request", description: "Read details of a pull request" }
    ],
    moreInfo: [
      { label: "API Docs", url: "https://docs.github.com/en/rest" },
      { label: "Getting Started", url: "https://sovereignai.com/docs/github" }
    ],
    privacy: {
      privacyPolicyUrl: "https://github.com/privacy",
      termsOfServiceUrl: "https://github.com/terms"
    },
    runtime: {
      engine: "npx",
      package: "@modelcontextprotocol/server-github",
      args: ["--transport", "stdio"],
      envVarsMetadata: [
        {
          key: "GITHUB_PERSONAL_ACCESS_TOKEN",
          label: "GitHub Personal Access Token",
          placeholder: "ghp_...",
          description: "Create at https://github.com/settings/tokens with repo scope",
          required: true
        }
      ]
    },
    permissions: ["repo:read", "issue:write"],
    isArchived: false
  }
];


async function seedConnectors() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/superportal';
    console.log(`Connecting to database...`);
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('🌱 Seeding MCP Connectors...');
    
    // Clear existing connectors to avoid duplicates during development
    // await McpConnector.deleteMany({}); 

    for (const connectorData of CONNECTORS) {
      await McpConnector.findOneAndUpdate(
        { name: connectorData.name },
        connectorData,
        { upsert: true, new: true }
      );
      console.log(`   - Seeded: ${connectorData.name}`);
    }

    console.log('\n✅ Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedConnectors();
