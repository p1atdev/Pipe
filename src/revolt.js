import { DB, Address, User } from "./db.js"
import { Client } from "revolt.js"

const client = new Client()

client.on("ready", async () => console.info(`Logged in as ${client.user.username}!`))

client.on("message", async (message) => {
    if (message.content === "sus") {
        message.channel.sendMessage("sus!")
    }
})

export class RevoltBOT {
    /**
     * revoltのbotを開始する
     * @param { string } token revoltのbotトークン
     */
    static start = (token) => {
        client.useExistingSession({ token: token })
    }
}
