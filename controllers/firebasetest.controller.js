const { RES, sendCloudNotification } = require("../handlers/helper");
module.exports = (function () {
    /**
  * Declare functions here.
  */
    this.generateUUID = function () {
        let d = new Date().getTime();
        if (
            typeof performance !== "undefined" &&
            typeof performance.now === "function"
        ) {
            d += performance.now(); //use high-precision timer if available
        }
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
            /[xy]/g,
            function (c) {
                let r = (d + Math.random() * 16) % 16 | 0;
                d = Math.floor(d / 16);
                return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
            }
        );
    }

    this.sendAppNotification = async (req, res) => {
        sendCloudNotification({
            title: "",
            body: "",
            regTokens: ["czJjvJpNTFaeMOCFohJQuI:APA91bGd52G8Y3gqJCT7Jyn5Hd1-bmtqRerYlmUR-cAvW3oVkmyxdu7Z7gEwfM4UJiEX7SGQrFGv9ZPiLLXE-Udr59idmBr8VvNyU1RsznyQJsnL5uqt37yR5mNYs3H2snQy7xPCLesS"],
            opts: {
                timeToLive: 60,
            },
            data: {
                id: this.generateUUID(),
                // ...dataIds,
                appToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ2aWRlbyI6eyJyb29tSm9pbiI6dHJ1ZSwicm9vbSI6IjhmNTc1NWQzLTEyZmQtNDA3NS1iOTAxLTQ5YjljODg3ZDI4MiIsImNhblB1Ymxpc2giOnRydWUsImNhblN1YnNjcmliZSI6dHJ1ZSwiZXhwIjoiMTAgZGF5cyJ9LCJpYXQiOjE3MDI5NzA1ODEsIm5iZiI6MTcwMjk3MDU4MSwiZXhwIjoxNzAyOTkyMTgxLCJpc3MiOiJkZXZrZXkiLCJzdWIiOiJkZmY3ZTU3Mi0xY2M3LTQ1OGQtYWY4Yy1kMTE5NTlmZDYzMzIiLCJqdGkiOiJkZmY3ZTU3Mi0xY2M3LTQ1OGQtYWY4Yy1kMTE5NTlmZDYzMzIifQ.1LOIott_pkwVRrql0coAIZ_Nl6iUvKpXc7bTT7ARmbw",
                doctorId: "67bfd7f0-0508-11e3-8ffd-0800200c9a66",
                initiator: "dr",
                socketId: "v0_llU3Kdo1XQrn9AAAC",
                visitId: "07341f8c-e8ae-4479-9d50-58e6672c80c1",
                doctorName: "doctorName",
                nurseId: "dff7e572-1cc7-458d-af8c-d11959fd6332",
                roomId: "8f5755d3-12fd-4075-b901-49b9c887d282",
                type: "video_call",
                timestamp: Date.now().toString(),
                device_token: "czJjvJpNTFaeMOCFohJQuI:APA91bGd52G8Y3gqJCT7Jyn5Hd1-bmtqRerYlmUR-cAvW3oVkmyxdu7Z7gEwfM4UJiEX7SGQrFGv9ZPiLLXE-Udr59idmBr8VvNyU1RsznyQJsnL5uqt37yR5mNYs3H2snQy7xPCLesS",
            },
        });
        RES(
            res,
            {
                success: true,
                message: "Notification sent successfully!",
                data: null,
            },
            200
        );
    };

    return this;
})();