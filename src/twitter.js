import "dotenv/config"
import { DB, Address, User } from "./db.js"
import { Author, MediaMessage, Pipe, TextMessage } from "./pipe.js"
import { default as Twitter } from "twitter"

const client = new Twitter({
    consumer_key: process.env.TWITTER_API_KEY,
    consumer_secret: process.env.TWITTER_API_KEY_SECRET,
    access_token_key: process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
})

const stream = client.stream("user", (data) => {
    console.log(data)
})

// ダイレクトメッセージハンドリング
// stream.on("direct_message", function (error, data, response) {
//     var message = data.direct_message

//     // 自分が送信したダイレクトメッセージは処理しない
//     if (message.sender_id_str === options.id) return

//     console.log(message)

//     // エコーで返信
//     var reply = { user_id: message.sender_id_str, text: message.text }
//     client.post("direct_messages/new", reply, function (err, data, resp) {})
// })

export default class TwitterBOT {
    static getDirectMessages() {
        client.get("direct_messages/events/list", (error, data, response) => {
            console.log(data)
            // console.log(response)
        })
    }
}
