const gcm = require("node-gcm");
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert({
    type: "service_account",
    project_id: "intelehealth-unicef",
    private_key_id: "299a8d7f8a9b9d3baac30967bfcda70a60cc6e8a",
    private_key:
      "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC3wfq2y3hSrwU9\nqqAZfq7M0BilvhgNAuYV63o7uzoY+YagIGWk7WPveZq2r2MpdX6mc1PtpjfVadKW\nONXAO3dWTl9AC/02UQP10LlU2aMJ759mC+K+Se5k284X++f7xUWGXuaFGoPm9itf\nwL0Khwv4ph9vaIdlyKREWBq+icOnCoPX8RkdrWVaKSLsC5+BB7kYRnrqi2greFRS\nIj+qAyc1fEr9VfJFMMNTi0lQwr4egGanNvU9x/oyHT6xpnDVxrsrnXDjVvVRnKSv\nd8/msu9LvMjwQr1GtXLuIKhwFqlVnMSFPt+S8GdHPBpXm+65JnFbWmTgjFWF62v4\nCqwHdbRLAgMBAAECggEAJ54NQTLN/rmYPirWuJhs9GBbKAS7Z7a7x3cM0+ryRCcs\nBMLnVy8NMDi+B+v5S5t20kkkC6Ud/YeCrPuU7gyEFpnwBD1xeq/t1CYLhwUjFwXQ\nDm66lH8ZBCq1nMslQU1PR4CXX5QPYxCo2kySFT53cMTUGy9knaer7sY2AeVuxsjq\nYVsgyeasBNaGeHZCmC1jRcMYxVSdiujY6dRtd/dJCP3p1q/wv3al1flhy9NBRNFz\n8UkHguRVOD+gq1E9gmbbSHQhkeJs0FY7rxFnJ/3DA1VS0lVHVfbxUoWtcfhDWDag\n+Lpi4bl1SEwitin++bpny5wMQWmG56wX4KjDh2CuJQKBgQDmZD3DQT6k+EibIEVq\n2TFA4cS0DRbqfzkqm/CyNLDkurSN3HIraURHgXU+82oRUmlCH9tkIcUxP43TaZzN\nz9veiQh3odakrCYvh9XvX2BGVCYMvfKTQc6X7WsJoQjecRBrA5+aJX2afDv0Omyc\n6SsS2EgFIGiHcXFqPEvbNYw/PwKBgQDMLsdvUQYAxiIFmXJtLR1wbbAj92JWvt/I\nhdt3zMzR1+GRuYVUBOQGsZ+f5heMNeDK69dfJBzM8OoMIpR/SqakzrpxBoI7YUY6\nEPAUcrAWBwdF5oXx2TtoVXT8Cr/TF3Xs0877uJQAVZsPBFv4GwUwVCFsbxemq2Ho\npO6d8RST9QKBgCP+n0OlKuNdQwKxbQb/fdl0LGYw8Vabn9PPXzCIWOazYMgVG+U6\nYgeF60p1fynLpVRGY+FmAUfrdP4FrxDcm65N3HvMVhuOJb0hTMREM2dpeDRfbMmi\n62MDHcj4VsliAr2laEcN+myrYjaK9jMhnrAoCEB8yrf2elCtsPBDknDDAoGATLOJ\n8bQjKClF4IqbJI4dD/30fB5TT7jWQfKe1isWCgIp1180ybIooqcZCq0ZzW7z6eac\nej4Ln6UklrhqxkKZxTFvckP6qinJgsiYF2ZZ5Xxwa/7D9G0hVvk7P+8dzkNy5itP\nBtp4poOCAyslDVfBJD2GbMByxwZ8ejNy+9vzWf0CgYEAuorZkFgXjzwEVrGaL8Gf\nFuvW/afxkps49VDaOSRgn5hxor+q/zHPeHYmHahys5Li8jC0PqC6D7/ORb9+fft/\nZDadMFNZRsNzTIlxiUNyBQU20R1xL/dGAgI52nigybJczw2nPRhTmP8DDB07rpDm\n2r/JELlJX8QaEzqUw3lJAvI=\n-----END PRIVATE KEY-----\n",
    client_email:
      "firebase-adminsdk-xiz7j@intelehealth-unicef.iam.gserviceaccount.com",
    client_id: "116314458649162738909",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url:
      "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xiz7j%40intelehealth-unicef.iam.gserviceaccount.com",
  }),
  databaseURL: "https://intelehealth-unicef.firebaseio.com",
  authDomain: "intelehealth-unicef.firebaseapp.com",
});

module.exports = (function () {
  this.validateParams = (params, keysAndTypeToCheck = []) => {
    try {
      keysAndTypeToCheck.forEach((obj) => {
        if (!params[obj.key] && typeof params[obj.key] !== obj.type) {
          if (!params[obj.key]) {
            throw `Invalid request, ${obj.key} is missing.`;
            return false;
          }
          if (!params[obj.key]) {
            throw `Wrong param type for ${obj.key}(${typeof params[
              obj.key
            ]}), required type is ${obj.type}.`;
            return false;
          }
        }
      });
      return true;
    } catch (error) {
      throw error;
    }
  };

  this.sendCloudNotification = async ({
    title,
    body,
    icon = "ic_launcher",
    data = {},
    regTokens,
    android = {},
    webpush = {},
    apns = {},
    click_action = "FCM_PLUGIN_HOME_ACTIVITY",
  }) => {
    var sender = new gcm.Sender(
      "AAAAteo0mXw:APA91bHx0MLvtnLAAaCyNWYui4yqiLSnmVdvZvlDUihdbAkDn_RB-hphY4ULkw2KFCKv3xb8B90leutiq5J6AXNckx7Wsy1xSM8tvwo-Nlkip_wckr_Oxin1mGd3JHqB0SDSHqAKGskq"
    );

    var message = new gcm.Message({
      data,
      notification: {
        title,
        icon,
        body,
        click_action,
      },
      android: {
        ttl: "10s",
        priority: "high",
      },
      webpush: {
        headers: {
          TTL: "10",
          Urgency: "high",
        },
      },
      apns: {
        headers: {
          "apns-priority": "5",
        },
      },
    });

    return new Promise((res, rej) => {
      sender.send(
        message,
        { registrationTokens: regTokens },
        function (err, response) {
          if (err) {
            console.log("err: ", err);
            console.error(err);
            rej(err);
          } else {
            console.log(response);
            res(response);
          }
        }
      );
    });
  };

  this.RES = (res, data, statusCode = 200) => {
    res.status(statusCode).json(data);
  };
  return this;
})();
