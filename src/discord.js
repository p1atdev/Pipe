import fs from "fs"
import "dotenv/config"
import Discord from "discord.js"
import { Webhook, MessageBuilder } from "discord-webhook-node"
import { Address, DB } from "./db"
import { Author, TextMessage } from "./pipe"

const client = new Discord.Client()
const webhookClient = new Webhook(process.env.DISCORD_LINE_CHANNEL_WEBHOOK)

// 以下はディスコード
client.once("ready", () => {
    console.log(`ディスコードBOt ${discordClient.user.username} でログインしました`)
    discordClient.user.setPresence({
        status: "online", //You can show online, idle....
        activity: {
            name: "起動中", //The message shown
            type: "LISTENING", //PLAYING: WATCHING: LISTENING: STREAMING:
        },
    })
})

client.on("message", async (message) => {
    if (message.author.bot) {
        return
    }

    //サクッと返信する関数
    const reply = function (replyText) {
        msg.channel.send(replyText)
    }

    const args = message.content.split(" ")
    const command = args[0]

    console.log(command)

    if (command.startsWith("/")) {
        switch (command) {
            case "/neko": {
                reply("にゃーん")
            }
        }
    } else {
        // テキストメッセージがあれば
        if (message.content != "") {
            // 発言者の情報と共有するメッセージを作成する
            const author = new Author(message.member.nickname || message.author.username, message.author.avatarURL())
            const pipeMessage = new TextMessage(message.content, author)

            try {
                // 対象のアドレスに一斉送信
                const targetAddresses = await DB.getForwardingAddressFrom(Address.getDiscordAddressOf(message))
            } catch {
                console.log("送信失敗")
                return
            }
        }

        // 画像とかがあるか確認
        // msg.attachments.flatMap(async (fileMessage) => {
        //     console.log(fileMessage.attachment)
        //     const fileName = fileMessage.name
        //     const stream = fs.createReadStream(fileMessage.attachment)
        //     const fileType = (await FileType.fromStream(stream)).mime.toString().split("/")[0]

        //     console.log(fileType)

        //     const supportedType = ["image", "video", "audio"]

        //     // 返信に使うオブジェクトを生成
        //     const replyMessage = () => {
        //         switch (fileName) {
        //             case supportedType[0]: {
        //                 // image
        //                 return {
        //                     type: "image",
        //                     originalContentUrl: fileMessage.attachment,
        //                     previewImageUrl: "",
        //                 }
        //             }

        //             case supportedType[1]: {
        //                 // video
        //                 return {
        //                     type: "video",
        //                     originalContentUrl: fileMessage.attachment,
        //                     previewImageUrl: "",
        //                 }
        //             }

        //             // case supportedType[2]: {
        //             //     // audio
        //             //     return {
        //             //         type: "audio",
        //             //         originalContentUrl: fileMessage.attachment,
        //             //         duration: 0
        //             //     }
        //             // }

        //             default: {
        //                 return {
        //                     type: "text",
        //                     text: `ファイル: ${fileMessage.attachment}`,
        //                 }
        //             }
        //         }
        //     }

        //     try {
        //         client.pushMessage(gid, replyMessage())
        //     } catch {
        //         msg.channel.send(`送信できませんでした\n月の送信制限に達した可能性があります`)
        //         return
        //     }
        // })
    }
})

export default class DiscordBOT {
    /**
     * DiscordのBOTを起動する
     */
    static start = () => {
        discordClient.login(process.env.DISCORD_TOKEN)
    }

    /**
     * 指定のチャンネルのWebhookを作成して保存する
     */
    static generateWebhookURLOf = (channel) => {
        await channel.createWebhook("パイプBOT", {
            avatar: process.env.ICON_URL,
        })
    }

    /**
     * 指定のchannelに送信する
     */
    static sendMessage = () => {}
}
