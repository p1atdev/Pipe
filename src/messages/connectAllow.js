export const connectAllow = (userName, roomId, portText, countOfMembers) => {
    return {
        type: "text",
        text: `ユーザー [${userName}] がこのグループとルーム [${roomId}] を接続しようとしています。
ルーム [${roomId}] では以下のポートと接続されています。
${portText}

また、接続を解除するには /leave と送信することでいつでもすぐに解除できます。
接続を許可するには [${countOfMembers}人] からの承認が必要です。`,
    }
}
