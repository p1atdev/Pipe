import admin from "firebase-admin"
import { initializeApp } from "firebase/app"
import { getFunctions, httpsCallable } from "firebase/functions"
// import request from "request"
// import os from "os"
// import path from "path"
// import mkdirp from "mkdirp"
// import fetch from "node-fetch"
// import fs from "fs"
import line from "@line/bot-sdk"
import dotenv from "dotenv"
import DiscordBOT from "./discord.js"
// import { Webhook } from "discord.js"
import LINEBOT from "./line.js"
dotenv.config()

const lineClient = new line.Client(LINEBOT.config)

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
    storageBucket: process.env.FIREBASE_BACKET_NAME,
})

const app = initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    storageBucket: process.env.FIREBASE_BACKET_NAME,
    messagingSenderId: "63503428073",
    appId: "1:63503428073:web:3297abf85776b1fc248378",
    measurementId: "G-EY592MLTS8",
})

const db = admin.firestore()
const bucket = admin.storage().bucket()

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
     * @param { FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>[] } rooms
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
            webhook: await DiscordBOT.getWebhookURLOfChannel(message.channel),
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

    static getRevoltAddressOf(message) {
        return new Address({
            type: "revolt",
            id: message.channel_id,
            webhook: "",
            parentId: message.channel.server_id,
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

        return room
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
        const allowRef = db.collection("allow").doc(address.type)

        try {
            await Promise.all([
                allowRef.set({
                    [address.id]: {},
                }),
                roomRef.set(
                    {
                        [address.type]: admin.firestore.FieldValue.arrayUnion({
                            id: address.id,
                            webhook: address.webhook,
                            parentId: address.parentId,
                        }),
                        index: admin.firestore.FieldValue.arrayUnion(address.id),
                    },
                    { merge: true }
                ),
            ])
            return true
        } catch (err) {
            console.log(`ルーム入室エラー: ${err}`)
            return false
        }
    }

    /**
     * ルームからそこに含まれるアドレスを取得する
     * @param { * } room firebaseのアレ
     * @returns { Address[] }
     */
    static getAddressesOfRoom = (room) => {
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
                } catch (err) {
                    //スキップ
                    console.log(err)
                }
            })
            .flat()
    }

    /**
     * ポート(繋がっている場所)を返す
     * @param { Address[] } addresses 名前とSNS名を取得したいアドレス
     * @returns { Object[] }
     */
    static getPortsOf = async (addresses) => {
        return await Promise.all(
            addresses.map((address) => {
                switch (address.type) {
                    case "line": {
                        return { sns: "LINE", name: LINEBOT.getGroupName(address.id), parentName: "" }
                    }
                    case "discord": {
                        return {
                            sns: "Discord",
                            name: DiscordBOT.getChannelName(address.id),
                            parentName: DiscordBOT.getGuildName(address.parentId),
                        }
                    }
                    // case "revolt": {
                    //     return { sns: "revolt" }
                    // }
                    // case "slack": {
                    //     return { sns: "slack" }
                    // }
                    default: {
                        return {
                            sns: "不明",
                            name: "不明",
                            parentName: "不明",
                        }
                    }
                }
            })
        )
    }

    /**
     * BOTを接続する承認をする
     * @param { bool } allow 承認する(true)か否(false)か
     * @param { Address } address 参加を許可するSNSのルームとかのアドレス
     * @param { string } userId 承認操作をしたユーザー
     * @param { string } requiredNumber 接続に必要な合計の承認数
     * @returns { Object } 最終的な承認数やこの承認によって接続ができるようになったかどうか
     */
    static allowConnecting = async (allow, address, userId = "", requiredNumber) => {
        const allowRef = db.collection("allow").doc(address.type)

        if (allow) {
            await allowRef.set(
                {
                    [address.id]: {
                        allows: admin.firestore.FieldValue.arrayUnion(userId),
                        requiredNumber: requiredNumber,
                    },
                },
                { merge: true }
            )
        } else {
            await allowRef.set(
                {
                    [address.id]: {
                        allows: [],
                        requiredNumber: requiredNumber,
                    },
                },
                { merge: true }
            )
        }

        // 最終的なallowsの人数とrequiredNumberを取得して比較
        const targetQueue = (await allowRef.get()).get(address.id)
        const canConnect = targetQueue.allows.length >= targetQueue.requiredNumber

        return {
            canConnect: canConnect,
            currentAllows: targetQueue.allows.length,
            roomId: targetQueue.roomId,
        }
    }

    /**
     * 特定のルームへの接続待機状態を作成する
     * @param { Address } address 登録したいアドレス
     * @param { string } roomId 接続先のルーム
     */
    static createConnectQueue = async (address, roomId) => {
        const allowRef = db.collection("allow").doc(address.type)

        await allowRef.set(
            {
                [address.id]: {
                    roomId: roomId,
                    allows: [],
                },
            },
            { merge: true }
        )
    }
}

export class Storage {
    static showAllFiles = async () => {
        const options = {}
        const [files] = await bucket.getFiles(options)

        files.forEach((file) => {
            console.log(file.name)
        })
    }
}

export class Functions {
    /**
     * LINEのメッセージのメディアのコンテンツを取得する
     * @param { string } messageId
     * @param { string } fileName 作成するファイルの名前
     * @returns { Object } messageとurlを持ったオブジェクトを返す
     */
    static getLINEContentURL = async (messageId, fileName) => {
        const functions = getFunctions(app)
        const uploadLINEMediaContent = httpsCallable(functions, "uploadLINEMessageMediaContent")
        return await uploadLINEMediaContent({ messageId: messageId, fileName: fileName })
            .then((result) => {
                // Read result of the Cloud Function.
                /** @type {any} */
                const data = result.data
                return data
            })
            .catch((error) => {
                console.log(`エラー: ${error}`)
                return "Error"
            })
    }

    /**
     * helloを取得する
     */
    static getHello = async () => {
        console.log("get Hello")

        const functions = getFunctions(app)
        const hello = httpsCallable(functions, "hello")
        return await hello()
            .then((result) => {
                // Read result of the Cloud Function.
                /** @type {any} */
                const data = result.data
                return data
            })
            .catch((error) => {
                console.log(`エラー: ${error}`)
                return "Error"
            })
    }
}
