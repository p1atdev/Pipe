import fs from "fs"
import "dotenv/config"
import Discord, { Collection, Intents, MessageEmbed } from "discord.js"
import { SlashCommandBuilder } from "@discordjs/builders"
import { REST } from "@discordjs/rest"
import { Routes } from "discord-api-types/v9"
// const { clientId, guildId, } = require("./config.json")
import { Webhook, MessageBuilder } from "discord-webhook-node"
import { Address, DB, Room } from "./db.js"
import { Author, MediaMessage, Pipe, TextMessage } from "./pipe.js"
import e from "express"

const client = new Discord.Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_INTEGRATIONS,
        Intents.FLAGS.GUILD_WEBHOOKS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MEMBERS,
    ],
})
// const webhookClient = new Webhook(process.env.DISCORD_LINE_CHANNEL_WEBHOOK)
const token = process.env.DISCORD_TOKEN

const commands = [
    new SlashCommandBuilder().setName("neko").setDescription("にゃーん"),
    new SlashCommandBuilder().setName("webhook").setDescription("Webhook URLを生成、または確認します"),
    new SlashCommandBuilder().setName("check").setDescription("登録されているルームを確認します"),
    new SlashCommandBuilder()
        .setName("connect")
        .addStringOption((option) => option.setName("room_id").setDescription("ルームのID").setRequired(true))
        .setDescription("ルームに入室する"),
].map((command) => command.toJSON())

const rest = new REST({ version: "9" }).setToken(token)

// 以下はディスコード
client.once("ready", () => {
    console.log(`Discord: ${client.user.username} としてログインしました`)
    client.user.setPresence({
        status: "online", //You can show online, idle....
        activity: {
            name: "起動中", //The message shown
            type: "LISTENING", //PLAYING: WATCHING: LISTENING: STREAMING:
        },
    })
})

// サーバーに参加した時
client.on("guildCreate", async (guild) => {
    // スラッシュコマンドを登録する
    await DiscordBOT.registerSlashCommand(guild.id)
})

// メッセージが送られた時
client.on("messageCreate", async (message) => {
    if (message.author.bot) {
        return
    }

    //サクッと返信する関数
    const reply = function (replyText) {
        message.channel.send(replyText)
    }

    const args = message.content.split(" ")
    const command = args[0]

    console.log(command)

    // もしサーバーなら
    if (message.guildId) {
        // スラッシュコマンドを登録
        DiscordBOT.registerSlashCommand(message.guildId)
    }

    if (command.startsWith("/")) {
        switch (command) {
            case "/neko": {
                reply("にゃーん")
                break
            }
            case "/commands": {
                await DiscordBOT.registerSlashCommand(message.guildId)
                reply("スラッシュコマンドが登録されました")
                break
            }
        }
    } else {
        // テキストメッセージがあれば
        if (message.content != "") {
            // 発言者の情報と共有するメッセージを作成する
            try {
                // 対象のアドレスに一斉送信
                const author = new Author(
                    message.member.nickname || message.author.username,
                    message.author.avatarURL()
                )
                const pipeMessage = new TextMessage(message.content, author)
                const messageAddress = await Address.getDiscordAddressOf(message)
                const pipe = new Pipe(pipeMessage, messageAddress)
                await pipe.sendTextMessage()
            } catch (err) {
                console.log(`転送されません: ${err}`)
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

// スラッシュコマンドが実行された時
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return

    const { commandName } = interaction

    switch (commandName) {
        case "neko": {
            await interaction.reply("にゃーん")
            break
        }
        case "webhook": {
            // まずはチャンネルwebhookを全て取得
            /**
             * @type { Collection }
             */
            const webhooks = (await interaction.channel.fetchWebhooks()) || []
            // このbotが作成したwebhook
            const myWebhooks = webhooks.filter((webhook) => {
                return webhook.owner.id == client.user.id
            })

            // もしこのbotが作成したwebhookが存在していれば
            if (myWebhooks.size == 0) {
                await DiscordBOT.generateWebhookURLOf(interaction.channel)
                await interaction.reply("Webhookを登録しました")
            } else {
                await interaction.reply(`すでに登録されているWebhookが見つかりました\nID: ${myWebhooks.first().id}`)
                const webhook = await client.fetchWebhook(myWebhooks.first().id)
            }

            break
        }
        case "check": {
            // ルームを確認する
            // const channelId = interaction.channel.id
            const room = (await DB.getRoomId(await Address.getDiscordAddressOf(interaction))) || "ルームはありません"
            await interaction.reply(`ルーム: ${room}`)
            break
        }
        case "connect": {
            // ユーザーがサーバーの管理者かどうか確認する

            // ルームに入る
            const roomId = interaction.options.getString("room_id")

            // ルームにaddressを追加
            const isSuccess = await DB.addAddressTo(roomId, await Address.getDiscordAddressOf(interaction))
            await interaction.reply(
                isSuccess
                    ? `ルーム[${roomId}] と接続しました`
                    : `ルーム[${roomId}] と接続できませんでした。\nルームIDが正しいかお確かめください。`
            )
        }
        default: {
            break
        }
    }
})

export default class DiscordBOT {
    /**
     * DiscordのBOTを起動する
     * @param { string } token ディスコードのトークン
     */
    static start = (token) => {
        client.login(token)
    }

    /**
     * 指定のチャンネルのWebhookを作成して保存する
     */
    static generateWebhookURLOf = async (channel) => {
        await channel.createWebhook("パイプBOT", {
            avatar: process.env.ICON_URL,
        })
    }

    /**
     * 指定のwebhookにテキストメッセージを送信する
     * @param { Address } address パイプ先のディスコードアドレス
     * @param { TextMessage } textMessage 発言者の情報
     */
    static sendTextMessage = async (address, textMessage) => {
        if (address.webhook == "") {
            //webhookが空であれば帰る
            return
        }
        const webhookClient = new Webhook(address.webhook)
        webhookClient.setAvatar(textMessage.author.iconURL)
        webhookClient.setUsername(textMessage.author.userName)
        await webhookClient.send(textMessage.text)
    }

    /**
     * メディアのメッセージを送る
     * @param { Address } address
     * @param { MediaMessage } mediaMessage
     * @returns
     */
    static sendMediaMessage = async (address, mediaMessage) => {
        if (address.webhook == "") {
            //webhookが空であれば帰る
            return
        }
        const webhookClient = new Webhook(address.webhook)
        webhookClient.setAvatar(mediaMessage.author.iconURL)
        webhookClient.setUsername(mediaMessage.author.userName)

        switch (mediaMessage.type) {
            case "image": {
                console.log("discordの画像を送るためのやつを生成する")
                await webhookClient.send(mediaMessage.generateDiscordMessage())
                break
            }
            case "video": {
                await webhookClient.sendFile(mediaMessage.url)
                break
            }
            default: {
                console.log("DiscordBOT.sendMediaMessage default")
                break
            }
        }
    }

    /**
     * メッセージを複数まとめて送信する
     * @param { Address } address 送信元のアドレス
     * @param { Author } author 発言者
     * @param { MessageBuilders[] } messages 送信するメッセージ全て
     */
    static sendMessages = async (address, author, messages) => {
        const webhookClient = new Webhook(address.webhook)
        webhookClient.setAvatar(author.iconURL)
        webhookClient.setUsername(author.userName)
        messages.forEach(async (message) => {
            await webhookClient.send(message)
        })
    }

    /**
     * スラッシュコマンドを登録する
     */
    static registerSlashCommand = async (guildId) => {
        try {
            await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands })
            console.log("正常にスラッシュコマンドを登録した")
        } catch (err) {
            console.error(`スラッシュコマンド登録エラー: ${err}`)
        }
    }

    /**
     * webhook urlを取得する
     */
    static getWbhookURLOfChannel = async (channel) => {
        const webhooks = (await channel.fetchWebhooks()) || []
        // このbotが作成したwebhook
        const myWebhooks = webhooks.filter((webhook) => {
            return webhook.owner.id == client.user.id
        })

        // もしこのbotが作成したwebhookが存在していれば
        if (myWebhooks.length != 0) {
            const webhook = await client.fetchWebhook(myWebhooks.first().id)
            return webhook.url
        } else {
            await DiscordBOT.generateWebhookURLOf(interaction.channel)
            // 再び実行
            await this.getWbhookURLOfChannel(channel)
        }
    }

    /**
     * 画像用のEmbedを生成する
     * @param { MediaMessage } mediaMessage 画像のメッセージ
     * @param { Bool } isReply リプライかどうか
     * @returns { (MessageBuilder) }
     */
    static generateImageEmbed = (mediaMessage, isReply = false) => {
        const color = "#2F3137"
        const embed = new MessageBuilder().setColor(color).setImage(mediaMessage.url)

        if (isReply) {
            embed.setAuthor(mediaMessage.author.userName, mediaMessage.author.iconURL)
        }

        return embed
    }

    /**
     * テキスト用のEmbedを生成する
     * @param { TextMessage } textMessage
     * @param { Bool } isReply リプライかどうか
     * @returns { (MessageBuilder) }
     */
    static generateTextEmbed = (textMessage, isReply = false) => {
        const color = "#2F3137"

        const embed = new MessageBuilder().setColor(color).setDescription(textMessage.text)

        if (isReply) {
            embed.setAuthor(textMessage.author.userName, textMessage.author.iconURL)
        }

        return embed
    }

    /**
     * チャンネル名を取得する
     * @param { string } channelId
     */
    static getChannelName = (channelId) => {
        const channel = client.channels.cache.get(channelId)
        return channel.name
    }

    static getGuildName = (guildId) => {
        return client.guilds.cache.get(guildId).name
    }
}
