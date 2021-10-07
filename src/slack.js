import { WebClient, WebClientEvent } from "@slack/web-api"

// Read a token from the environment variables
const token = process.env.SLACK_TOKEN

// Initialize
const client = new WebClient(token)

client.on()
