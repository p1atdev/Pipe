import admin from "firebase-admin"
// import "process"
import dotenv from "dotenv"
import DiscordBOT from "./discord.js"
import { Webhook } from "discord.js"
dotenv.config()

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
})

const db = admin.firestore()

/**
 * ユーザークラス
 * @param { FirebaseFirestore.DocumentData } user
 *
 * @param { string } id
 * @param { string } discord
 * @param { string } revolt
 * @param { string } line
 * @param { string } slack
 */
export class User {
    constructor(user) {
        this.uid = user.id
        this.discord = user.data().discord
        this.revolt = user.data().revolt
        this.line = user.data().line
        this.slack = user.data().slack
    }
}

// 対応するSNS
const supportedSNS = ["line", "discord", "revolt", "slack"]

/**
 * チャットやグループの場所のクラス
 * @param { string } type SNSの名前
 * @param { string } id チャットidやグループidなど
 * @param { string? } parentId それが含まれる上位id。サーバーidやツリーのトップのidなど
 */
export class Address {
    constructor(address) {
        this.type = address.type
        this.id = address.id
        this.webhook = address.webhook
        this.parentId = address.parentId || ""
    }

    /**
     * ルームからそれぞれに含まれているアドレスを取得する
     * @param { FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData> } rooms
     * @returns { Address[] }
     */
    static convertRoomsToAdresses(rooms) {
        return rooms.docs
            .map((room) => {
                return supportedSNS
                    .map((sns) => {
                        try {
                            return room
                                .get(sns)
                                .map((port) => {
                                    return new Address({
                                        type: sns,
                                        id: port.id,
                                        webhook: port.webhook || "",
                                        parentId: port.parentId || "",
                                    })
                                })
                                .flat()
                        } catch {
                            //スキップ
                        }
                    })
                    .flat()
            })
            .flat()
    }

    /**
     * 送られたメッセージからそのアドレスを取得する
     */
    static getDiscordAddressOf = async (message) => {
        // webhookを取得して入れてる
        return new Address({
            type: "discord",
            id: message.channel.id,
            webhook: await DiscordBOT.getWbhookURLOfChannel(message.channel),
            parentId: message.guild.id,
        })
    }

    /**
     * 送られたラインのメッセージからアドレスを取得する
     */
    static getLineAddressOf(event) {
        const addressId = event.source.roomId || event.source.groupId || event.source.userId
        return new Address({
            type: "line",
            id: addressId,
            webhook: "",
            parentId: "",
        })
    }
}

/**
 * ルーム(会話を共有するチャット)のクラス
 */
export class Room {
    constructor(room) {
        this.id = room.id
        this.addresses = room.addresses
    }
}

export class DB {
    /**
     * ディスコードのuidからユーザーを取得する
     * @param { string } id ユーザーid
     * @returns { User } データベースに登録されているユーザーを返す
     */
    static getDiscordUser = async (id) => {
        const usersRef = db.collection("users")

        // idで指定して特定
        const users = await usersRef.where("discord", "==", id).get()

        // もしユーザーがなかったら間違っているのでエラー
        if (users.empty) {
            console.log("マッチするディスコードユーザーがいません")
            return null
        }

        // そうでなければユーザーを返す
        return new User(users.docs[0])
    }

    /**
     * SNSの名前とそのuidからユーザーを取得する
     * @param { string } platform ディスコやLINEのSNSの名前
     * @param { string } id そのSNSでのユーザーid
     * @returns { User } データベースに登録されているユーザーを返す
     */
    static getUserOf = async (platform, id) => {
        const usersRef = db.collection("users")

        // idで指定して特定
        const users = await usersRef.where(platform, "==", id).get()

        // もしユーザーがなかったら間違っているのでエラー
        if (users.empty) {
            console.log(`プラットフォーム ${platform} のID ${id} にマッチするユーザーがいません`)
            return null
        }

        // そうでなければユーザーを返す
        return new User(users.docs[0])
    }

    /**
     * ルームを取得する
     * @param { string } id roomのid
     * @returns
     */
    static getRoomOf = async (id) => {
        const roomRef = db.collection("rooms").doc(id)

        const room = await roomRef.get()

        return room.data()
    }

    static getRoomId = async (address) => {
        const roomRef = db.collection("rooms")

        // その発言があった場所が含まれるルームを取得
        const rooms = await roomRef.where(`index`, "array-contains", address.id).get()

        // そんなルームがなければ
        if (rooms.empty) {
            console.log(`発言されたアドレス ${address.id}(${address.type}) が含まれるルームはありません`)
            return null
        }

        const room = rooms.docs[0]
        const id = room.id

        // ルームがあるのでidを返す
        return id
    }

    /**
     * SNSの名前と、そのチャットidやサーバーid、グループidから転送先を探す
     * @param { Address } address これが含まれるルームを探す
     * @returns { Address[] } 指定されたアドレスと同じルームにある、全てのアドレスを返す
     */
    static getForwardingAddressFrom = async (address) => {
        const roomRef = db.collection("rooms")

        // その発言があった場所が含まれるルームを取得
        const rooms = await roomRef.where(`index`, "array-contains", address.id).get()

        // そんなルームがなければ
        if (rooms.empty) {
            console.log(`発言されたアドレス ${address.id}(${address.type}) が含まれるルームはありません`)
            return null
        }

        // ルームがあるので形を変換して返す
        return Address.convertRoomsToAdresses(rooms)
    }
    /**
     * ルームにアドレスとインデックスを追加する
     * @param { string } roomId ルームのid
     * @param { Address } address 追加するアドレス
     * @returns { bool } 成功したらtrue
     */
    static addAddressTo = async (roomId, address) => {
        const roomRef = db.collection("rooms").doc(roomId)

        try {
            await roomRef.set(
                {
                    [address.type]: admin.firestore.FieldValue.arrayUnion({
                        id: address.id,
                        webhook: address.webhook,
                        parentId: address.parentId,
                    }),
                    index: admin.firestore.FieldValue.arrayUnion(address.id),
                },
                { merge: true }
            )
            return true
        } catch (err) {
            console.log(`ルーム入室エラー: ${err}`)
            return false
        }
    }
}
