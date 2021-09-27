import { DB, User } from "./src/db.js"

async function test() {
    console.log(await DB.getUserOf("revolt", "revoltのid"))
    console.log(await DB.getRoomOf("room1"))
    console.log(
        await DB.getForwardingAddressFrom({
            type: "discord",
            id: "testid1",
        })
    )
}

test()
