import fs from "fs"
import "dotenv/config"
import line from "@line/bot-sdk"
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

// LINEのBOT
export default class LINEBOT {
    static eventHandler = async (event) => {
        const prof = await client.getGroupMemberProfile(gid, event.source.userId)
        const userName = prof.displayName
        const iconURL = prof.pictureUrl

        function LSendText(text, sender = {}) {
            client.replyMessage(event.replyToken, {
                type: "text",
                text: text,
                sender: sender,
            })
        }

        async function DSendText(content) {
            webhookClient.setAvatar(iconURL)
            webhookClient.setUsername(userName)
            await webhookClient.send(content)
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

        if (event.source.userId === uid || event.source.groupId === gid) {
            var message = event.message.text
            const type = event.message.type

            switch (type) {
                case "text": {
                    const args = message.split(" ")
                    const command = args[0]

                    console.log(args)

                    if (command.startsWith("/")) {
                        switch (command) {
                            case "/neko": {
                                // LSendText("にゃーん")
                                LSendText(`にゃーん`, {
                                    name: userName,
                                    iconUrl: iconURL,
                                })
                                break
                            }

                            case "/gid": {
                                LSendText(`gid: ${gid}`, {
                                    name: userName,
                                    iconUrl: iconURL,
                                })
                                await DSendText(`gid: ${gid}`)
                                break
                            }
                        }
                    } else {
                        await DSendText(message)
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
    }
}
