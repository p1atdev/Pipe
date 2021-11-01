import { DB, Functions, Storage, User } from "./src/db.js"
import DiscordBOT from "./src/discord.js"
// import TwitterBOT from "./src/twitter.js"

async function test() {
    // console.log(await DB.getUserOf("revolt", "revoltのid"))
    // console.log(await DB.getRoomOf("room1"))
    // console.log(
    //     await DB.getForwardingAddressFrom({
    //         type: "discord",
    //         id: "testid1",
    //     })
    // )
    // TwitterBOT.getDirectMessages()
    // await Storage.showAllFiles()
    // へラグの画像のURLを取得するテスト
    // const response = await Functions.getLINEContentURL("14845953553240", "image0.png")
    // console.log(response.url)
}

test()
