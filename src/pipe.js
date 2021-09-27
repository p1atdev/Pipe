import "dotenv/config"
import line from "@line/bot-sdk"

// botを読み込む
import DiscordBOT from "./discord"
import LINEBOT from "./line"
import { text } from "express"

/**
 * さまざまなBOTに使いやすくするためのテキストメッセージオブジェクト
 * @param { string } text パイプするテキスト
 * @param { Author } author 発言者の情報
 */
export class TextMessage {
    constructor(text, author) {
        this.text = text
        this.author = author
    }

    static generateLINEMessage = () => {
        return {
            type: "text",
            text: this.text,
            sender: {
                name: this.author.userName,
                iconUrl: this.author.iconURL,
            },
        }
    }
}

/**
 * さまざまなBOTに使いやすくするためのメディア(画像や動画)メッセージオブジェクト
 * @param { string } url パイプするメディアのあるurl
 * @param { string } previewURL 軽量化されたメディアのurl(サムネ用など)
 * @param { string } type そのメディアの具体的な種別(image, video...)
 * @param { Author } author 発言者の情報
 */
export class MediaMessage {
    constructor(url, previewURL, type, author) {
        this.url = url
        this.previewURL = previewURL
        this.type = type
        this.author = author
    }

    static generateLINEMessage = () => {
        return {
            type: this.type,
            originalContentUrl: this.media,
            previewImageUrl: this.previewImageUrl,
        }
    }
}

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
