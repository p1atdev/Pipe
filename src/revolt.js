import { DB, Address, User } from "./db.js"
import { Client } from "revolt.js"
import { Author, MediaMessage, Pipe, TextMessage } from "./pipe.js"
// import DiscordBOT from "./discord.js"

const client = new Client()

client.on("ready", async () => {
    console.info(`Revolt: ${client.user.username} としてログインしました`)
})

client.on("message", async (message) => {
    if (message.author.bot) {
        return
    }

    const messageAddress = Address.getRevoltAddressOf(message)
    const author = new Author(message.author.username, message.author.generateAvatarURL())

    const args = message.content.split(" ")
    const command = args[0] || ""

    if (command.startsWith("/")) {
        switch (command) {
        }
    } else {
        // テキストメッセージを転送する
        const textMessage = new TextMessage(message.content, author)
        const pipe = new Pipe(textMessage, messageAddress)
        await pipe.sendTextMessage()

        // ! わからんんんん
        // if (message.reply_ids != null) {
        // message.reply_ids.forEach(async (id) => {
        //     const repliedMessage = await message.channel.fetchMessage(id)
        //     repliedMessage.attachments.forEach((attachment) => {
        //         const fileURL = `https://autumn.revolt.chat/attachments/${attachment._id}/${attachment.filename}`
        //     })
        //     const [textEmbed, mediaEmbeds] = DiscordBOT.generateReplyingEmbed(
        //         new TextMessage(
        //             repliedMessage.content,
        //             new Author(repliedMessage.author.username, repliedMessage.author.generateAvatarURL())
        //         ),
        //         repliedMessage.attachments.map((attachment) => {
        //             const fileURL = `https://autumn.revolt.chat/attachments/${attachment._id}/${attachment.filename}`
        //             return new MediaMessage(
        //                 fileURL,
        //                 "",
        //                 attachment.metadata.type,
        //                 new Author(repliedMessage.author.username, repliedMessage.author.generateAvatarURL())
        //             )
        //         })
        //     )
        // })
        // }
    }
})

export class RevoltBOT {
    /**
     * revoltのbotを開始する
     * @param { string } token revoltのbotトークン
     */
    static start = (token) => {
        client.loginBot(token)
    }

    /**
     * 指定のアドレスにメッセージを送信する
     * @param { Address } address
     * @param { TextMessage } textMessage
     */
    static sendTextMessage = async (address, textMessage) => {
        // client.
        await client.channels.$get(address.id).sendMessage(textMessage.text)
    }

    /**
     * 指定のアドレスにメディアを送信する
     * @param { Address } address
     * @param { MediaMessage } mediaMessage
     */
    static sendMediaMessage = async (address, mediaMessage) => {
        // client.
        // await client.channels.$get(address.id).sendMessage(mediaMessage)
    }
}
