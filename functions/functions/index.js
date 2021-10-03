import functions from "firebase-functions"
import express from "express"
import cors from "cors"
import os from "os"
import path from "path"
import mkdirp from "mkdirp"
import fetch from "node-fetch"
import admin from "firebase-admin"
import fs from "fs"
import line from "@line/bot-sdk"

const config = {
    channelAccessToken: functions.config().line.access_token,
    channelSecret: functions.config().line.secret_key,
}

const lineClient = new line.Client(config)

admin.initializeApp()

const app = express()

// Automatically allow cross-origin requests
app.use(cors({ origin: true }))

app.get("/hello", (req, res) => {
    // レスポンスの設定
    res.send("Hello Express!")
})

app.post("/uploadFile", async (req, res) => {
    // res.send(`upload media of message id: ${req.query.id}, url: ${req.query.url}`)
    const url = await uploadFile(req.query.id, req.query.url)
    // const url = "uploadFile"
    // res.send(JSON.stringify({ url: url }))
    res.json({ url: url })
    return { url: url }
})

app.post("/uploadLINEMediaContent", async (req, res) => {
    // res.send(`upload media of message id: ${req.query.id}, url: ${req.query.url}`)
    const url = await uploadLINEMediaContent(req.query.messageId, req.query.fileName)
    // const url = "uploadLINEMediaContent"
    // res.send(JSON.stringify({ url: url }))
    res.json({ url: url })
    return { url: url }
})

/**
 * LINEのメッセージIDを指定してコンテントをダウンロードする
 * @param { string } messageIdd
 * @param { string } filePath
 * @returns
 */
const downloadLINEContent = async (messageId, filePath) => {
    return lineClient.getMessageContent(messageId).then(
        (stream) =>
            new Promise((resolve, reject) => {
                const writable = fs.createWriteStream(filePath)
                stream.pipe(writable)
                stream.on("end", () => resolve(filePath))
                stream.on("error", reject)
            })
    )
}

/**
 *
 * @param { string } id messageIdなどの一意のid
 * @param { string } url ダウンロードしたいファイルのあるurl
 */
const uploadFile = async (id, url) => {
    try {
        const blobApi = await fetch(url) // blobApi.blob()
        const buff = await blobApi.buffer()
        const metadata = {
            cacheControl: "public,max-age=300", // 1年キャッシュする
            contentType: "image/png",
        }
        const bucket = admin.storage().bucket()
        const fileName = url.split("/").reverse()[0]
        const tempLocalFile = `${os.tmpdir()}/${id}/${fileName}`
        const tempLocalDir = path.dirname(tempLocalFile)
        fs.writeFile(tempLocalFile, buff, (err) => {
            if (err) {
                return `Error fs.writeFile: ${err}`
            }
        })
        await mkdirp(tempLocalDir)
        await bucket.upload(tempLocalFile, {
            destination: `${id}/${fileName}`,
            metadata,
        })
        fs.unlinkSync(tempLocalFile)
        const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${id}%2F${fileName}?alt=media`
        return downloadURL
    } catch (err) {
        return `404 ${err}`
    }
}

/**
 *
 * @param { string } messageId messageIdなどの一意のid
 * @param { string } url ダウンロードしたいファイルのあるurl
 */
const uploadLINEMediaContent = async (messageId, fileName) => {
    try {
        const metadata = {
            cacheControl: "public,max-age=300",
            contentType: "image/png",
        }
        const bucket = admin.storage().bucket()
        const tempLocalFile = `${os.tmpdir()}/${messageId}/${fileName}`
        const tempLocalDir = path.dirname(tempLocalFile)
        await mkdirp(tempLocalDir)
        await downloadLINEContent(messageId, tempLocalFile)
        await bucket.upload(tempLocalFile, {
            destination: `line/${messageId}/${fileName}`,
            metadata,
        })
        fs.unlinkSync(tempLocalFile)
        const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/line%2F${messageId}%2F${fileName}?alt=media`
        return downloadURL
    } catch (err) {
        return `404 ${err}`
    }
}

export const api = functions.https.onCall(app)

export const hello = functions.https.onCall(async (data, context) => {
    return {
        message: "hello!",
    }
})

export const uploadLINEMessageMediaContent = functions.https.onCall(async (data, context) => {
    if (data.messageId != null && data.fileName != null) {
        const url = await uploadLINEMediaContent(data.messageId, data.fileName)
        return { message: "成功", url: url }
    } else {
        return { message: "不正なパラメータ", url: "" }
    }
})
