const { token } = require("morgan");
const { axiosInstance } = require("../handlers/helper");

const EncryptRsa = require('encrypt-rsa').default;

const { logStream } = require("./../logger/index");

const encryptRsa = new EncryptRsa();

const { uuid } = require('uuidv4');


 module.exports = (function () {

  /**
   * Get Initial Header
   * @param {token} string
   */
  this.getInitialHeaderrs = (token) => {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept-Language': 'en-us'
    }
  }
  
  /**
   * Generate Access Token
   * @param {*} req
   * @param {*} res
   */
  this.getAccessToken = async (req) => {
    const resposnse = await axiosInstance.post(
      process.env.SESSION_TOKEN_GEN_URL, {
        "clientId": process.env.CLIENT_ID,
        "clientSecret": process.env.CLIENT_SECRET
    }); 
    return resposnse.data;
  }

  /**
   * Get Public Key
   * @param {token} string
   */
  this.getPublicKey = async (token) => {
    const resposnse = await axiosInstance.get(
      process.env.PUBLIC_KEY_GEN_URL, {
    }, {
      headers: {
        ...this.getInitialHeaderrs(token)
      }
    });
    return resposnse.data;
  }

  /**
   * Get Encrypted Text
   * @param {publicKey} string
   * @param {str} string
   */
  this.getRSAText = (publicKey, str) => {
    return encryptRsa.encryptStringWithRsaPublicKey({ 
      text: str.toString(),   
      publicKey,
    });
  }

  /**
   * Get Current TimeStamp
   */
  this.getTimestamp = () => {
    const date = new Date();
    return date.toISOString();
  }

  /**
   * Get Token
   * @param {req} object
   * @param {res} object
   * @param {next} function
   */
  this.getToken = async (req, res, next) => {
    try {
      logStream("debug", 'API Calling', 'Get Token');
      const accessToken = await this.getAccessToken();
      logStream("debug", 'Token Got', 'Get Token');
      return res.json({
        ...accessToken
      })
    } catch (error) {
      logStream("error", error.message);
      next(error);
    }
  };

  /**
   * Get OTP
   * @param {req} object
   * @param {res} object
   * @param {next} function
   */
  this.getOTPByAadhar = async (req, res, next) => {
    try {
    
      const { aadhar, scope } = req.body;

      const accessToken = req.token

      logStream("debug", 'Calling API to Get Public Key', 'Get OTP Aadhar');

      const publicKey = await this.getPublicKey(accessToken);

      logStream("debug", 'Got Public Key', 'Get OTP Aadhar');

      const encryptedText = this.getRSAText(publicKey, aadhar);

      logStream("debug", 'Aadhar Encrypted', 'Get OTP Aadhar');
      

      const payload = {
         "txnId":"",
         "scope":["abha-enrol"],
         "loginHint":"aadhaar",
         "otpSystem":"aadhaar",
         "loginId": encryptedText
      }

      logStream("debug", JSON.stringify(payload), 'Get OTP Aadhar');

      logStream("debug", 'Calling API to get otp', 'Get OTP Aadhar');

      const apiResponse = await axiosInstance.post(
        process.env.REQ_OTP_URL, 
        payload , 
        {
          headers: {
            ...this.getInitialHeaderrs(accessToken),
            'REQUEST-ID': uuid(),
            'TIMESTAMP': this.getTimestamp(),
          }
        }
      );

      logStream("debug", 'OTP Response Recieved', 'Get OTP');


      return res.json({
        ...apiResponse.data,
      })
    
    } catch (error) {
        logStream("error", error.message);
        next(error);
    }
  };

  /**
   * Get ABHA Profile
   * @param {req} object
   * @param {res} object
   * @param {next} function
   */
  this.enrollByAadhar = async (req, res, next) => {
    try {

      const { otp, txnId, mobileNo }  = req.body

      const accessToken = req.token

      logStream("debug", 'Calling API to Get Public Key', 'Enroll By Aadhar');

      const publicKey = await this.getPublicKey(accessToken);

      logStream("debug", 'Got Public Key', 'Get OTP');

    
      const encryptedText = this.getRSAText(publicKey, otp);

      logStream("debug", 'Encrypted Text', 'Enroll By Aadhar');

      const payload = {
        "authData": {
            "authMethods": [
                "otp"
            ],
            "otp": {
                "txnId": txnId,
                "otpValue": encryptedText,
                "timeStamp": this.getTimestamp(),
                "mobile": mobileNo
            }
        },
        "consent": {
            "code": "abha-enrollment",
            "version": "1.4"
        }
      }

      logStream("debug", JSON.stringify(payload), 'Enroll By Aadhar');

      logStream("debug", 'Calling API to Enroll By Aadhar Response', 'Enroll By Aadhar');


      const apiResponse = await axiosInstance.post(
        process.env.ENROLL_AADHAR_BY_URL, 
        payload , 
        {
          headers: {
            ...this.getInitialHeaderrs(accessToken),
            'REQUEST-ID': uuid(),
            'TIMESTAMP': this.getTimestamp(),
            'TRANSACTION_ID': uuid(),
          }
        }
      );
      
      logStream("debug", 'Got Profile Response', 'Enroll By Aadhar');

      return res.json(apiResponse.data)
    
    } catch (error) {
        logStream("error", error.message);
        next(error);
    }
  };

  /**
   * Get Abha Address
   * @param {req} object
   * @param {res} object
   * @param {next} function
   */
  this.getEnrollSuggestion = async (req, res, next) => {
    try {

      const { txnId } = req.body;

      const accessToken = req.token

      logStream("debug", 'Calling API to Get Enroll Suggestions', 'Get Enroll Suggestions');

      const apiResponse = await axiosInstance.get(
        process.env.ENROLL_SUGGESION_URL, 
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'REQUEST-ID': uuid(),
            'TIMESTAMP': this.getTimestamp(),
            'TRANSACTION_ID': txnId,
            'Accept-Language': 'en-us'
          }
        }
      );
      
      logStream("debug", 'Got Address Address', 'Get Enroll Suggestions');

      return res.json(apiResponse.data)
    
    } catch (error) {
        next(error);
    }
  };

  /**
   * Set Preferred Abha Address
   * @param {req} object
   * @param {res} object
   * @param {next} function
   */
  this.setPreferredAddress = async (req, res, next) => {
    try {
      
      const { txnId, abhaAddress } = req.body;

      const accessToken = req.token

      const payload = {
        "txnId" : txnId,
        "abhaAddress": abhaAddress,
        "preferred" : 1 
      }

      logStream("debug", 'Calling API to Set Prefer Address', 'Set Prefer Address');

      const apiResponse = await axiosInstance.post(
        process.env.SET_PREFERED_ADDRESS_URL,
        payload, 
        {
          headers: {
            ...this.getInitialHeaderrs(accessToken),
            'REQUEST-ID': uuid(),
            'TIMESTAMP': this.getTimestamp()
          }
        }
      );

      logStream("debug", 'Set Prefer Address Response', 'Set Prefer Address');

      return res.json(apiResponse.data)
    
    } catch (error) {
        logStream("error", error.message);
        next(error);
    }
  };

  /**
 * Get OTP
 * @param {req} object
 * @param {res} object
 * @param {next} function
 */
  this.getOTPByMobile = async (req, res, next) => {
    try {
    
      const { mobile } = req.body;

      const accessToken = req.token

      console.log(accessToken)

      logStream("debug", 'Calling API to Get Public Key', 'Get OTP BY MOBILE');

      const publicKey = await this.getPublicKey(accessToken);

      logStream("debug", 'Got Public Key', 'Get OTP BY MOBILE');

      console.log(mobile)

      const encryptedText = this.getRSAText(publicKey, mobile);

      logStream("debug", 'Aadhar Encrypted', 'Get OTP BY MOBILE');
      
      const payload = {
          "scope": [
              "abha-login",
              "mobile-verify"
          ],
          "loginHint": "mobile",
          "loginId": encryptedText,
          "otpSystem": "abdm"
      }

      logStream("debug", JSON.stringify(payload), 'Get OTP BY MOBILE');

      logStream("debug", 'Calling API to get otp', 'Get OTP BY MOBILE');

      const apiResponse = await axiosInstance.post(
        process.env.MOBILE_OTP_URL, 
        payload , 
        {
          headers: {
            ...this.getInitialHeaderrs(accessToken),
            'REQUEST-ID': uuid(),
            'TIMESTAMP': this.getTimestamp(),
          }
        }
      );

      logStream("debug", 'OTP Response Recieved', 'Get OTP');


      return res.json({
        ...apiResponse.data,
      })
    
    } catch (error) {
        logStream("error", error.message);
        next(error);
    }
  };

  /**
   * Get ABHA Detail
   * @param {req} object
   * @param {res} object
   * @param {next} function
   */
  this.getDetails = async (req, res, next) => {
    try {

      const { otp, txnId }  = req.body

      const accessToken = req.token

      logStream("debug", 'Calling API to Get Public Key', 'Get Details');

      const publicKey = await this.getPublicKey(accessToken);

      logStream("debug", 'Got Public Key', 'Get Details');

    
      const encryptedText = this.getRSAText(publicKey, otp);

      logStream("debug", 'Encrypted Text', 'Get Details');

      const payload = { 
          "scope": [
              "abha-login",
              "mobile-verify"
          ],
          "authData": {
              "authMethods": [
                  "otp"
              ],
              "otp": {
                  "txnId": txnId,
                  "otpValue": encryptedText
              }
          }
      }

      logStream("debug", JSON.stringify(payload), 'Get Details');

      logStream("debug", 'Calling API to Get Details', 'Get Details');

      const apiResponse = await axiosInstance.post(
        process.env.LOGIN_VERIFY_URL, 
        payload, 
        {
          headers: {
            ...this.getInitialHeaderrs(accessToken),
            'REQUEST-ID': uuid(),
            'TIMESTAMP': this.getTimestamp(),
          }
        }
      );
      
      logStream("debug", 'Got Profile Response', 'Enroll By Aadhar');

      return res.json(apiResponse.data)
    
    } catch (error) {
        logStream("error", error.message);
        next(error);
    }
  };

  return this;
})();
