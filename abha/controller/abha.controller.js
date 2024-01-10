const { axiosInstance } = require("../handlers/helper");

const EncryptRsa = require('encrypt-rsa').default;

const encryptRsa = new EncryptRsa();

const { uuid } = require('uuidv4');


 module.exports = (function () {
  /**
   * Generate OTP API
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

  this.getPublicKey = async (token) => {
    const resposnse = await axiosInstance.get(
      process.env.PUBLIC_KEY_GEN_URL, {
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept-Language': 'en-us'
      }
    });
    return resposnse.data;
  }

  this.getRSAText = (publicKey, str) => {
    return encryptRsa.encryptStringWithRsaPublicKey({ 
      text: str.toString(),   
      publicKey,
    });
  }

  this.getTimestamp = () => {
    const date = new Date();
    return date.toISOString();
  }

  this.getToken = async (req, res, next) => {
    try {
    
      const accessToken = await this.getAccessToken();

      return res.json({
        ...accessToken
      })
    
    } catch (error) {
        next(error);
    }
  };

  this.getOTP = async (req, res, next) => {
    try {
    
      const { aadhar } = req.body;

      const accessToken = req.token

      const publicKey = await this.getPublicKey(accessToken);

      const encryptedText = this.getRSAText(publicKey, aadhar);

      const payload = {
         "txnId":"",
         "scope":["abha-enrol"],
         "loginHint":"aadhaar",
         "otpSystem":"aadhaar",
         "loginId": encryptedText
      }

      const apiResponse = await axiosInstance.post(
        'https://abhasbx.abdm.gov.in/abha/api/v3/enrollment/request/otp', 
        payload , 
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'REQUEST-ID': uuid(),
            'TIMESTAMP': this.getTimestamp(),
            'Accept-Language': 'en-us'
          }
        }
      );

      return res.json({
        ...apiResponse.data,
      })
    
    } catch (error) {
        next(error);
    }
  };

  this.getProfile = async (req, res, next) => {
    try {

      const { otp, txnId, mobileNo }  = req.body

      const accessToken = req.token

      const publicKey = await this.getPublicKey(accessToken);
    
      const encryptedText = this.getRSAText(publicKey, otp);

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
      
      const apiResponse = await axiosInstance.post(
        process.env.ENROLL_AADHAR_BY_URL, 
        payload , 
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'REQUEST-ID': uuid(),
            'TIMESTAMP': this.getTimestamp(),
            'TRANSACTION_ID': uuid(),
            'Accept-Language': 'en-us'
          }
        }
      );

      return res.json(apiResponse.data)
    
    } catch (error) {
        next(error);
    }
  };

  this.getAddress = async (req, res, next) => {
    try {

      const { txnId } = req.body;

      const accessToken = req.token

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

      return res.json(apiResponse.data)
    
    } catch (error) {
        next(error);
    }
  };

  return this;
})();
