export const allowButton = (roomId) => {
    return {
        type: "template",
        altText: "this is a confirm template",
        template: {
            type: "confirm",
            actions: [
                {
                    type: "postback",
                    label: "承認する",
                    text: "承認します",
                    data: "allow",
                },
                {
                    type: "postback",
                    label: "却下する",
                    text: "却下します",
                    data: "deny",
                },
            ],
            text: `ルーム [${roomId}] との接続を許可しますか？`,
        },
    }
}
