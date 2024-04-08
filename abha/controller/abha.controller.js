const { token } = require("morgan");
const { axiosInstance } = require("../handlers/helper");

const EncryptRsa = require('encrypt-rsa').default;

const { logStream } = require("./../logger/index");

const encryptRsa = new EncryptRsa();

const { uuid } = require('uuidv4');
const openmrsService = require("../services/openmrs.service");


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
  this.getEnrollOTPReq = async (req, res, next) => {
    try {

      const { aadhar } = req.body;

      const accessToken = req.token

      logStream("debug", 'Calling API to Get Public Key', 'Enroll OTP Req');

      const publicKey = await this.getPublicKey(accessToken);

      logStream("debug", 'Got Public Key', 'Enroll OTP Req');

      const encryptedText = this.getRSAText(publicKey, aadhar);

      logStream("debug", 'Aadhar Encrypted', 'Enroll OTP Req');


      const payload = {
        "txnId": "",
        "scope": ["abha-enrol"],
        "loginHint": "aadhaar",
        "otpSystem": "aadhaar",
        "loginId": encryptedText
      }

      logStream("debug", JSON.stringify(payload), 'Enroll OTP Req');

      logStream("debug", 'Calling API to get otp', 'Enroll OTP Req');

      const apiResponse = await axiosInstance.post(
        process.env.REQ_OTP_URL,
        payload,
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

      const { otp, txnId, mobileNo } = req.body

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
        payload,
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
        "txnId": txnId,
        "abhaAddress": abhaAddress,
        "preferred": 1
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
  this.getLoginOTPReq = async (req, res, next) => {
    try {

      const { value, scope } = req.body;

      const accessToken = req.token


      logStream("debug", 'Calling API to Get Public Key', 'GET Login OTP Req');

      const publicKey = await this.getPublicKey(accessToken);

      logStream("debug", 'Got Public Key', 'GET Login OTP Req');


      const encryptedText = this.getRSAText(publicKey, value);

      logStream("debug", 'Aadhar Encrypted', 'GET Login OTP Req');


      let payload = {
        "scope": [
          "abha-login",
          "mobile-verify"
        ],
        "loginHint": "mobile",
        "loginId": encryptedText,
        "otpSystem": "abdm"
      }

      if (scope === 'aadhar') {
        payload = {
          "scope": [
            "abha-login",
            "aadhaar-verify"
          ],
          "loginHint": "aadhaar",
          "loginId": encryptedText,
          "otpSystem": "aadhaar"
        }
      }

      logStream("debug", JSON.stringify(payload), 'GET Login OTP Req');

      logStream("debug", 'Calling API to get otp', 'GET Login OTP Req');

      const apiResponse = await axiosInstance.post(
        process.env.MOBILE_OTP_URL,
        payload,
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
  this.getLoginOTPVerify = async (req, res, next) => {
    try {

      const { otp, txnId, scope } = req.body

      const accessToken = req.token

      logStream("debug", 'Calling API to Get Public Key', 'Get Login OTP Verify');

      const publicKey = await this.getPublicKey(accessToken);

      logStream("debug", 'Got Public Key', 'Get Login OTP Verify');


      const encryptedText = this.getRSAText(publicKey, otp);

      logStream("debug", 'Encrypted Text', 'Get Login OTP Verify');

      let payload = {
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

      if (scope === 'aadhar') {
        payload = {
          "scope": [
            "abha-login",
            "aadhaar-verify"
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
      }

      console.log(payload)

      logStream("debug", JSON.stringify(payload), 'Get Login OTP Verify');

      logStream("debug", 'Calling API to Get Login OTP Verify', 'Get Login OTP Verify');

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

  /**
   * Get Profile
   * @param {req} object
   * @param {res} object
   * @param {next} function
   */
  this.getProfile = async (req, res, next) => {
    try {

      const xToken = req.xtoken

      const { txnId, abhaNumber } = req.body;

      const accessToken = req.token;

      logStream("debug", 'Calling API to Login Verify User', 'Get Profile');

      const loginVerifyRes = await axiosInstance.post(
        process.env.LOGIN_VERIFY_USER_URL,
        {
          "ABHANumber": abhaNumber,
          "txnId": txnId
        },
        {
          headers: {
            ...this.getInitialHeaderrs(accessToken),
            'REQUEST-ID': uuid(),
            'TIMESTAMP': this.getTimestamp(),
            'T-Token': `Bearer ${xToken}`
          }
        }
      );

      logStream("debug", 'Calling API to Login Verify User - Token Received', 'Get Profile');

      logStream("debug", 'Calling API to Get Profile', 'Get Profile');

      const apiResponse = await axiosInstance.get(
        process.env.ACCOUNT_VERIFY_USER_URL,
        {
          headers: {
            ...this.getInitialHeaderrs(accessToken),
            'REQUEST-ID': uuid(),
            'TIMESTAMP': this.getTimestamp(),
            'X-Token': `Bearer ${loginVerifyRes.data.token}`
          }
        }
      );

      logStream("debug", 'Calling API to Get Profile', 'Get Profile');


      return res.json(apiResponse.data)

    } catch (error) {
      logStream("error", error.message);
      next(error);
    }
  };

  this.getBase64 = (url) => {
    return axios
      .get(url, {
        responseType: 'arraybuffer'
      })
      .then(response => Buffer.from(response.data, 'binary').toString('base64'))
  }
  /**
   * Get Card
   * @param {req} object
   * @param {res} object
   * @param {next} function
   */
  this.getCard = async (req, res, next) => {
    try {

      const xToken = req.xtoken

      const accessToken = req.token;

      logStream("debug", 'Calling API to Get Card', 'Get Card');

      const apiResponse = await axiosInstance.get(
        process.env.GET_CARD_URL,
        {
          responseType: 'arraybuffer',
          headers: {
            ...this.getInitialHeaderrs(accessToken),
            'REQUEST-ID': uuid(),
            'TIMESTAMP': this.getTimestamp(),
            'X-Token': `Bearer ${xToken}`
          }
        }
      ).then(response => Buffer.from(response.data, 'binary').toString('base64'))

      logStream("debug", 'Got API Response', 'Get Card');

      res.json({
        image: apiResponse
      });

    } catch (error) {
      logStream("error", error.message);
      next(error);
    }
  };

  /**
   * Generate Linking Token
   * @param {req} object
   * @param {res} object
   * @param {next} function
   */
  this.generateLinkToken = async (req, res, next) => {
    try {
      const {
        abhaAddress,
        name,
        gender,
        yearOfBirth,
        visitUUID,
        abhaNumber
      } = req.body
      logStream("debug", 'Calling Post API to GenerateLinkToken', 'GenerateLinkToken');

      const { accessToken } = await this.getAccessToken();
      if (!accessToken) {
        throw new Error('Fail to generate access token');
      }

      const requestObj = {
        name,
        gender,
        yearOfBirth,
      };

      if (abhaAddress) {
        requestObj.abhaAddress = abhaAddress;
      }

      if (abhaNumber) {
        requestObj.abhaNumber = abhaNumber;
      }

      await axiosInstance.post(
        process.env.POST_GENERATE_TOKEN_URL,
        requestObj,
        {
          headers: {
            ...this.getInitialHeaderrs(accessToken),
            "X-CM-ID": "SBX",
            'REQUEST-ID': visitUUID,
            'TIMESTAMP': this.getTimestamp(),
            'X-HIP-ID': 'INTL-001'
          },
        }
      );
      logStream("debug", 'Got API Response', 'GenerateLinkToken');

      res.json({ success: true });
      return;
    } catch (error) {
      logStream("error", error);
      return res.status(500).json({
        "success": false,
        "code": "ERR_BAD_REQUEST",
        "message": error.message,
      });
    }
  }

  /**
  * Linking Care Context to ABDM portal
  * @param {req} object
  * @param {res} object
  * @param {next} function
  */
  this.shareCareContext = async (req, res, next) => {
    try {
      const {
        linkToken,
        visitUUID,
        msgFromAbha
      } = req.body

      logStream("debug", 'Calling Post API to Share Care Context to Abha', 'shareCareContext');

      if (msgFromAbha !== "Ok") {
        logStream("debug", 'msgFromAbha Response recevied from abha is not okay!', 'shareCareContext');
        res.json({ success: true, data: null, message: "Message from abha is not okay!" });
        return;
      }

      const response = await openmrsService.getVisitByUUID(visitUUID);
      if (!response.success) {
        throw new Error(response.message);
      }
      const visit = response.data;
      const abhaNumber = visit?.patient?.identifiers.find((v) => v.identifierType?.display?.toLowerCase() === 'abha number')?.identifier
      const abhaAddress = visit?.patient?.identifiers.find((v) => v.identifierType?.display?.toLowerCase() === 'abha address')?.identifier
      const encounter = visit?.encounters?.find((v) => v.encounterType?.display === 'Visit Complete');
      const requestParam = {
        "abhaNumber": abhaNumber,
        "abhaAddress": abhaAddress,
        "patient": [
          {
            "referenceNumber": visit?.uuid,
            "display": `OpConsult:${visit?.patient?.person?.display}:${new Date(visit?.startDatetime ?? new Date()).toLocaleString()}`,
            "careContexts": [
              {
                "referenceNumber": encounter?.uuid,
                "display": "OpConsult-1"
              }
            ],
            "hiType": "OPConsultation",
            "count": 1
          }
        ]
      }
      const { accessToken } = await this.getAccessToken();
      if (!accessToken) {
        throw new Error('Fail to generate access token');
      }

      const abdmResponse = await axiosInstance.post(
        process.env.POST_CARE_CONTEXT_URL,
        requestParam,
        {
          headers: {
            ...this.getInitialHeaderrs(accessToken),
            "X-CM-ID": "SBX",
            'REQUEST-ID': visitUUID,
            'TIMESTAMP': this.getTimestamp(),
            'X-HIP-ID': 'INTL-001',
            'X-LINK-TOKEN': linkToken
          },
        }
      );
      logStream("debug", 'Got API Response', 'shareCareContext');

      res.json({ success: true, data: abdmResponse?.data, message: "Care context shared successfully!" });
      return;
    } catch (error) {
      logStream("error", error.message);
      return res.status(500).json({
        "success": false,
        "code": "ERR_BAD_REQUEST",
        "message": error.message,
      });
    }
  }

  /**
   * Update the isABDMLinked attribute by visitUUID
   * @param {req} object
   * @param {res} object
   * @param {next} function
   */
  this.updateVisitAttribute = async (req, res, next) => {
    try {
      const { visitUUID } = req.body
      logStream("debug", 'Calling Post API to update the visit attributes isABDMLinked', 'updateVisitAttribute');

      const response = await openmrsService.postAttribute(visitUUID,
        {
          attributeType: '8ac6b1c7-c781-494a-b4ef-fb7d7632874f', /** Visit Attribute Type for isABDMLinked */
          value: true
        }
      );

      if (!response.success) {
        throw new Error(response.message);
      }
      logStream("debug", 'Got API Response', 'updateVisitAttribute');

      res.json(response);
      return;
    } catch (error) {
      logStream("error", error.message);
      return res.status(500).json({
        "success": false,
        "code": "ERR_BAD_REQUEST",
        "message": error.message,
      });
    }
  }

  /**
  * Linking Care Context to ABDM portal
  * @param {req} object
  * @param {res} object
  * @param {next} function
  */
  this.postLinkCareContext = async (req, res, next) => {
    try {
      const {
        visitUUID,
        abhaAddress,
        abhaNumber,
        personDisplay,
        startDatetime,
        encounterUUID
      } = req.body

      logStream("debug", 'Calling Post API to Post Link Care Context to Abha', 'postLinkCareContext');

      const requestParam = {
        'requestId': visitUUID,
        'requesterId': 'IN2710001275',
        "abhaNumber": abhaNumber,
        "abhaAddress": abhaAddress,
        'authMode': 'DEMOGRAPHICS',
        "patient": [
          {
            "referenceNumber": visitUUID,
            "display": `OpConsult:${personDisplay}`,
            "careContexts": [
              {
                "referenceNumber": encounterUUID,
                "display": `OpConsult-1:${personDisplay}:${new Date(startDatetime ?? new Date()).toLocaleString()}`
              }
            ],
            "hiType": "OPConsultation",
            "count": 1
          }
        ]
      }
      // const { accessToken } = await this.getAccessToken();
      // if (!accessToken) {
      //   throw new Error('Fail to generate access token');
      // }

      const abdmResponse = await axiosInstance.post(
        process.env.POST_LINK_CARE_CONTEXT_URL ?? 'http://localhost:8082/v1/link-carecontexts',
        requestParam,
        {
          headers: {
            // ...this.getInitialHeaderrs(accessToken),
            "X-CM-ID": "SBX",
            'TIMESTAMP': this.getTimestamp(),
            'X-HIP-ID': 'INTL-001',
          },
        }
      );
      logStream("debug", 'Got API Response From Link care context', 'axiosInstance.post');

      logStream("debug", 'Calling Get API to check link status of care context', 'axiosInstance.get');
      const careContexts = await axiosInstance.get(
        (process.env.POST_LINK_CARE_CONTEXT_STATUS_URL ?? 'http://localhost:8082/v1/link-status') + '/' + visitUUID, {
        headers: {
          'TIMESTAMP': this.getTimestamp(),
          'X-HIP-ID': 'INTL-001',
        },
      }
      );

      logStream("debug", 'Got API Response', 'postLinkCareContext');

      res.json({ success: true, data: { abdmResponse: abdmResponse, careContexts: careContexts }, message: "Care context shared successfully!" });
      return;
    } catch (error) {
      console.log("error", error)
      logStream("error", error);
      return res.status(500).json({
        "success": false,
        "code": "ERR_BAD_REQUEST",
        "message": error,
      });
    }
  }
  return this;
})();