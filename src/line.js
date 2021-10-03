import fs from "fs"
import "dotenv/config"
import line from "@line/bot-sdk"
import { Address, DB, Functions } from "./db.js"
import { Author, MediaMessage, Message, Pipe, TextMessage } from "./pipe.js"
import request from "request"

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
    const author = new Author(userName, iconURL)

    function replyText(text, sender = {}) {
        client.replyMessage(event.replyToken, {
            type: "text",
            text: text,
            sender: sender,
        })
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
                const pipe = new Pipe(new TextMessage(message.text, author), messageAddress)
                await pipe.sendTextMessage()
            }

            break
        }

        case "sticker": {
            const stickerUrl =
                "https://stickershop.line-scdn.net/stickershop/v1/sticker/" +
                event.message.stickerId +
                "/android/sticker.png"

            const imageMessage = new MediaMessage(stickerUrl, stickerUrl, "image", author)

            const pipe = new Pipe(imageMessage, messageAddress)
            await pipe.sendMediaMessage()

            break
        }

        case "image": {
            console.log("LINEのメッセージから画像を生成するよ")
            const imageURL = await LINEBOT.generateMediaURL(event.message.id, "image0.png")

            const imageMessage = new MediaMessage(imageURL, imageURL, "image", author)

            const pipe = new Pipe(imageMessage, messageAddress)
            await pipe.sendMediaMessage()
            break
        }

        case "video": {
            const videoURL = await LINEBOT.generateMediaURL(event.message.id, "video0.mp4")

            const videoMessage = new MediaMessage(videoURL, videoURL, author)

            const pipe = new Pipe(videoMessage, messageAddress)
            await pipe.sendMediaMessage()
            break
        }
    }
}

// LINEのBOT
export default class LINEBOT {
    /**
     * LINEのトークンなど
     */
    static config = {
        channelAccessToken: process.env.ACCESS_TOKEN,
        channelSecret: process.env.SECRET_KEY,
    }

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

    /**
     * 画像メッセージを送る
     * @param { Address } address
     * @param { MediaMessage } message
     */
    static sendMediaMessage = async (address, message) => {
        try {
            await client.pushMessage(address.id, message.generateLINEMessage())
        } catch (err) {
            console.log(`LINEメディア送信エラー: ${err}`)
        }
    }

    /**
     * メディアのURLを生成して取得する
     */
    static generateMediaURL = async (messageId, fileName) => {
        const response = await Functions.getLINEContentURL(messageId, fileName)
        console.log(`LINEの画像のURLの生成: ${response.message}, url: ${response.url}`)
        return response.url
    }
}

const client = new line.Client(LINEBOT.config)
