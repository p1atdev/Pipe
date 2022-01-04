import "dotenv/config"
import line from "@line/bot-sdk"

// botを読み込む
import DiscordBOT from "./discord.js"
import LINEBOT from "./line.js"
import { Address, DB } from "./db.js"
import { RevoltBOT } from "./revolt.js"

/**
 * さまざまなBOTに使いやすくするためのテキストメッセージオブジェクト
 * @param { string } text パイプするテキスト
 * @param { Author } author 発言者の情報
 */
export class TextMessage {
    /**
     *
     * @param { string } text
     * @param { Author } author
     */
    constructor(text, author) {
        this.text = text
        this.author = author
    }

    generateLINEMessage = () => {
        return {
            type: "text",
            text: this.text,
            sender: {
                // もし名前の長さが20文字を超えるなら、後半を削る
                name:
                    this.author.userName.length > 20
                        ? this.author.userName.substring(0, 19) + "…"
                        : this.author.userName,
                iconUrl: this.author.iconURL,
            },
        }
    }
}

/**
 * さまざまなBOTに使いやすくするためのメディア(画像や動画)メッセージオブジェクト
 * @param { string } url パイプするメディアのあるurl
 * @param { string } previewURL 軽量化されたメディアのurl(サムネ用など)
 * @param { MediaTypes } type そのメディアの具体的な種別(image, video...)
 * @param { Author } author 発言者の情報
 */
export class MediaMessage {
    /**
     *
     * @param { string } url
     * @param { string } previewURL プレビュー用のサイズ小さいやつ？
     * @param { string } type
     * @param { Author } author
     */
    constructor(url, previewURL, type, author) {
        this.url = url
        this.previewURL = previewURL
        this.type = type.split("/")[0].toLowerCase()
        this.author = author
    }

    generateLINEMessage = () => {
        switch (this.type) {
            case "image": {
                return {
                    type: this.type,
                    originalContentUrl: this.url,
                    previewImageUrl: this.previewURL,
                    sender: {
                        name: this.author.userName,
                        iconUrl: this.author.iconURL,
                    },
                }
            }
            case "video": {
                return {
                    // type: this.type,
                }
            }
        }
    }

    generateDiscordMessage = () => {
        return DiscordBOT.generateImageEmbed(this)
    }
}

/**
 * メッセージクラス
 * @param { Author } author 送信元の著者
 */
export const Message = TextMessage || MediaMessage

/**
 * 発言者の情報
 * @param { string } userName ユーザーネーム
 * @param { string } iconURL アイコン画像のURL
 */
export class Author {
    constructor(userName, iconURL) {
        this.userName = userName
        this.iconURL = iconURL
    }
}

/**
 * パイプするためのクラス
 * @param { Message } message 送信するメッセージ
 * @param { Address } address 送信元のアドレス
 */
export class Pipe {
    /**
     * メッセージとアドレスを指定する
     * @param { Message } message 送信するメッセージ
     * @param { Address } address 送信元のアドレス
     */
    constructor(message, address) {
        this.message = message
        this.address = address
    }

    /**
     * テキストメッセージを送る
     * @returns
     */
    sendTextMessage = async () => {
        // まずは転送先を探す
        const addresses = await DB.getForwardingAddressFrom(this.address)

        // アドレスを得られなければ帰る
        if (!addresses) {
            return
        }

        // アドレスごとに回して、転送する
        addresses.forEach(async (address) => {
            // アドレスがあれば
            if (address) {
                // もし送信元と一致したら飛ばす
                if (address.id != this.address.id) {
                    try {
                        switch (address.type) {
                            case "discord": {
                                // await DiscordBOT.sendTextMessage(address, this.message)
                                DiscordBOT.sendTextMessage(address, this.message)
                                break
                            }

                            case "line": {
                                // await LINEBOT.sendTextMessage(address, this.message)
                                LINEBOT.sendTextMessage(address, this.message)
                                break
                            }

                            case "revolt": {
                                // await RevoltBOT.sendTextMessage(address, this.message)
                                RevoltBOT.sendTextMessage(address, this.message)
                                break
                            }

                            default: {
                                // その他
                                break
                            }
                        }
                    } catch (err) {
                        console.log(err)
                    }
                }
            }
        })
    }

    /**
     * メディアメッセージを送る
     */
    sendMediaMessage = async () => {
        // まずは転送先を探す
        const addresses = await DB.getForwardingAddressFrom(this.address)

        // アドレスを得られなければ帰る
        if (!addresses) {
            return
        }

        // アドレスごとに回して、転送する
        addresses.forEach(async (address) => {
            // アドレスがあれば
            if (address) {
                // もし送信元と一致したら飛ばす
                if (address.id != this.address.id) {
                    try {
                        switch (address.type) {
                            case "discord": {
                                // await DiscordBOT.sendMediaMessage(address, this.message)
                                DiscordBOT.sendMediaMessage(address, this.message)
                                break
                            }

                            case "line": {
                                // await LINEBOT.sendMediaMessage(address, this.message)
                                LINEBOT.sendMediaMessage(address, this.message)

                                break
                            }

                            case "revolt": {
                                await RevoltBOT.sendMediaMessage(address, this.message)
                                break
                            }

                            default: {
                                // その他
                                break
                            }
                        }
                    } catch (err) {
                        console.log(err)
                    }
                }
            }
        })
    }
}
