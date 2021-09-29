import "dotenv/config"
import line from "@line/bot-sdk"
import { dirname } from "path"
import { fileURLToPath } from "url"

// botを読み込む
import DiscordBOT from "./discord.js"
import LINEBOT from "./line.js"

// route用
import express from "express"
import path from "path"
const PORT = process.env.PORT || 80
const __dirname = dirname(fileURLToPath(import.meta.url))

// const { send } = require("process")
// const { profile } = require("console")

express()
    .use(express.static(path.join(__dirname, "public")))
    .set("views", path.join(__dirname, "views"))
    .set("view engine", "ejs")
    .post("/line/", line.middleware(LINEBOT.config), (req, res) => LINEBOT.posted(req, res))
    .listen(PORT, () => console.log(`Listening on ${PORT}`))

// discordの起動
DiscordBOT.start()