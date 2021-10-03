import fs from "fs"
import "dotenv/config"
import line from "@line/bot-sdk"
import { Address, DB, Functions } from "./db.js"
import { Author, MediaMessage, Message, Pipe, TextMessage } from "./pipe.js"
import request from "request"
import { allowButton } from "./messages/allowButton.js"
import { connectAllow } from "./messages/connectAllow.js"

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

    function replyMessages(messages) {
        client.replyMessage(event.replyToken, messages)
    }

    const message = event.message
    const messageAddress = Address.getLineAddressOf(event)

    const eventType = event.type //イベントのタイプ(message, postback...)
    switch (eventType) {
        case "message": {
            const type = message.type //メッセージの種類
            switch (type) {
                case "text": {
                    /**
                     * @type { string }
                     */
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
                            case "/connect": {
                                if (rid != null) {
                                    replyText(
                                        "トークルームではこの機能をご利用いただけません。グループを作成してお使いください。"
                                    )
                                    return
                                }
                                if (gid == null) {
                                    replyText("そのコマンドはDMでは使用できません")
                                    return
                                }
                                // 引数のroomIDを取得する
                                if (args.length != 2) {
                                    replyText("ルームIDが正しく入力されていません")
                                    return
                                }
                                const roomId = args[1]

                                // 接続する

                                // 承認に必要な人数を割り出す
                                // 接続されているポートを取得する
                                const [numberOfMembers, ports, botInfo] = await Promise.all([
                                    LINEBOT.getNumberOfAllowingToConnect(gid),
                                    DB.getPortsOf(DB.getAddressesOfRoom(await DB.getRoomOf(roomId))),
                                    client.getBotInfo(),
                                ])

                                const portText = ports
                                    .map((port) => {
                                        return port.parentName == ""
                                            ? `・${port.sns} (${port.name})`
                                            : ` ・${port.sns} (${port.parentName}/${port.name})`
                                    })
                                    .join("\n")

                                // 作成したテキスト
                                const descriptionText = connectAllow(
                                    userName,
                                    roomId,
                                    portText == "" ? "[接続されているポートはありません]" : portText,
                                    numberOfMembers
                                )

                                // ボタンのテキスト
                                const buttonMessage = allowButton(roomId)

                                replyMessages([descriptionText, buttonMessage])

                                // 他のところに、接続するよ的な感じのを通知
                                const pipe = new Pipe(
                                    new TextMessage(
                                        "新たにLINEグループをルームに接続しようとしています...",
                                        new Author(botInfo.displayName, botInfo.pictureUrl)
                                    ),
                                    messageAddress
                                )
                                await pipe.sendTextMessage()
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

                    const videoMessage = new MediaMessage(videoURL, videoURL, "video", author)

                    const pipe = new Pipe(videoMessage, messageAddress)
                    await pipe.sendMediaMessage()
                    break
                }
            }
            break
        }
        case "postback": {
            const postbackData = event.postback.data
            console.log(postbackData)
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

    /**
     * 承認に必要な人数
     */
    static getNumberOfAllowingToConnect = async (groupId) => {
        const membersCount = (await client.getGroupMembersCount(groupId)).count

        if (membersCount <= 2) {
            return 1
        } else {
            return Math.ceil(membersCount / 15)
        }
    }

    /**
     * メッセージのJSONを読み込んで返す
     */
    static getMessageJSON = async (messageName) => {
        return JSON.parse(fs.readFileSync(`./messages/${messageName}.json`, "utf8"))
    }

    /**
     * 指定したgidのグループ
     */
    static getGroupName = async (groupId) => {
        return (await client.getGroupMemberProfile(groupId)).displayName
    }
}

const client = new line.Client(LINEBOT.config)
