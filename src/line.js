import fs from "fs"
import "dotenv/config"
import line from "@line/bot-sdk"
import { Address, DB } from "./db.js"
import { Author, Message, Pipe, TextMessage } from "./pipe.js"
const config = {
    channelAccessToken: process.env.ACCESS_TOKEN,
    channelSecret: process.env.SECRET_KEY,
}

const client = new line.Client(config)

async function downloadContent(messageId, downloadPath) {
    return client.getMessageContent(messageId).then(
        (stream) =>
            new Promise((resolve, reject) => {
                const writable = fs.createWriteStream(downloadPath)
                stream.pipe(writable)
                stream.on("end", () => resolve(downloadPath))
                stream.on("error", reject)
            })
    )
}

/**
 * LINEのイベントを捌く
 * @param {*} event
 * @returns
 */
const eventHandler = async (event) => {
    /**
     * ユーザーid
     * @type { string }
     */
    const uid = event.source.userId
    /**
     * グループid
     * @type { string }
     */
    const gid = event.source.groupId || null
    /**
     * ルームid
     * @type { string }
     */
    const rid = event.source.roomId || null

    const addressId = rid || gid || uid
    const prof = (await client.getProfile(uid)) || (await client.getGroupMemberProfile(gid, uid))
    const userName = prof.displayName
    const iconURL = prof.pictureUrl

    function replyText(text, sender = {}) {
        client.replyMessage(event.replyToken, {
            type: "text",
            text: text,
            sender: sender,
        })
    }

    async function DSendFiles(filesURLs) {
        webhookClient.setAvatar(iconURL)
        webhookClient.setUsername(userName)

        for (const url of filesURLs) {
            if (url.startsWith("https://")) {
                const embed = new MessageBuilder().setImage(url).setColor("#2F3137")
                await webhookClient.send(embed)
            } else {
                await webhookClient.sendFile(url)
            }
        }
    }

    const message = event.message
    const type = message.type //メッセージの種類
    const messageAddress = Address.getLineAddressOf(event)

    switch (type) {
        case "text": {
            const messageText = message.text
            const args = messageText.split(" ")
            const command = args[0]

            console.log(args)

            if (command.startsWith("/")) {
                switch (command) {
                    case "/neko": {
                        // replyText("にゃーん")
                        replyText(`にゃーん`, {
                            name: userName,
                            iconUrl: iconURL,
                        })
                        return
                    }
                    case "/addressId": {
                        replyText(`アドレスID: ${addressId}`)
                        return
                    }
                    case "/uid": {
                        replyText(`ユーザーID: ${uid}`)
                        return
                    }
                    case "/rid": {
                        replyText(`トークルームID: ${rid || "ここはトークルームではありません"}`)
                        return
                    }
                    case "/gid": {
                        replyText(`グループID: ${gid || "ここはグループではありません"}`)
                        return
                    }
                    case "/check": {
                        // ルームを確認する
                        const roomId = await DB.getRoomId(messageAddress)
                        replyText(`ルームアドレス: ${roomId || "ルームはありません"}`)
                        return
                    }
                }
            } else {
                // コマンドではないのでメッセージをシェアする
                const pipe = new Pipe(
                    new TextMessage(message.text, new Author(prof.displayName, prof.pictureUrl)),
                    messageAddress
                )
                await pipe.sendTextMessage()
            }

            break
        }

        case "sticker": {
            const stickerUrl =
                "https://stickershop.line-scdn.net/stickershop/v1/sticker/" +
                event.message.stickerId +
                "/android/sticker.png"

            await DSendFiles([stickerUrl])

            break
        }

        case "image": {
            const downloadPath = "./image.png"

            await downloadContent(event.message.id, downloadPath)

            await DSendFiles([downloadPath])
            break
        }

        case "video": {
            const downloadPath = "./video.mp4"

            await downloadContent(event.message.id, downloadPath)

            await DSendFiles([downloadPath])

            break
        }
    }
}

// LINEのBOT
export default class LINEBOT {
    /**
     * LINEのトークンなど
     */
    static config = config

    /**
     * LINEにPOSTがきた時に実行される
     * @param {*} req
     * @param {*} res
     */
    static posted(req, res) {
        res.status(200).end()
        console.log("LINEにリクエストがきた")
        const events = req.body.events
        const promises = []
        for (let i = 0, l = events.length; i < l; i++) {
            const event = events[i]
            promises.push(eventHandler(event))
        }
        Promise.all(promises).then(console.log("pass"))
    }

    /**
     * テキストメッセージを指定のアドレスに送信する
     * @param { Address } address
     * @param { TextMessage } message
     */
    static sendTextMessage = async (address, message) => {
        try {
            await client.pushMessage(address.id, message.generateLINEMessage())
        } catch (err) {
            console.log(`LINEプッシュ送信エラー: ${err}`)
        }
    }
}
