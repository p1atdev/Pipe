import "dotenv/config"
import line from "@line/bot-sdk"

// botを読み込む
import DiscordBOT from "./discord"
import LINEBOT from "./line"

// route用
import express from "express"
import path from "path"
const PORT = process.env.PORT || 80

// const { send } = require("process")
// const { profile } = require("console")

express()
    .use(express.static(path.join(__dirname, "public")))
    .set("views", path.join(__dirname, "views"))
    .set("view engine", "ejs")
    .post("/line/", line.middleware(config), (req, res) => lineBot(req, res))
    .listen(PORT, () => console.log(`Listening on ${PORT}`))

function lineBot(req, res) {
    res.status(200).end()
    const events = req.body.events
    const promises = []
    for (let i = 0, l = events.length; i < l; i++) {
        const event = events[i]
        promises.push(LINEBOT.eventHandler(event))
    }
    Promise.all(promises).then(console.log("pass"))
}

// discordの起動
DiscordBOT.start()
