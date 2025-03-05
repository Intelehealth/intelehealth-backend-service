const { token } = require("morgan");
const { axiosInstance } = require("../handlers/axiosHelper");

const { logStream } = require("./../logger/index");

const { uuid } = require('uuidv4');
const openmrsService = require("../services/openmrs.service");
const { convertDateToDDMMYYYY, handleError, formatCareContextFHIBundle } = require("../handlers/utilityHelper");
const { abdm_visit_status } = require("../models");

module.exports = (function () {

  /**
   * Get Initial Header
   * @param {token} string
   */
  this.getInitialHeaderrs = (token = null) => {
    const headers = {
      'Content-Type': 'application/json',
      'Accept-Language': 'en-us',
      'X-CM-ID': process.env.X_CM_ID,
      'TIMESTAMP': this.getTimestamp(),
      'REQUEST-ID': uuid()
    }

    if (token) headers['Authorization'] = `Bearer ${token}`
    return headers
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
      "clientSecret": process.env.CLIENT_SECRET,
      "grantType": "client_credentials"
    }, {
      headers: this.getInitialHeaderrs()
    });
    return resposnse.data;
  }

  /**
   * Get Public Key
   * @param {token} string
   */
  this.getPublicKey = async (token) => {
    logStream("debug", process.env.PUBLIC_KEY_GEN_URL, 'Get Public Key - URL');
    const resposnse = await axiosInstance.get(
      process.env.PUBLIC_KEY_GEN_URL, {
      headers: this.getInitialHeaderrs(token)
    });
    logStream("debug", resposnse?.data, 'Get Public Key - Response');
    return resposnse?.data;
  }

  /**
   * Get Encrypted Text
   * @param {publicKey} string
   * @param {str} string
   */
  this.getRSAText = async (cypherType = 'RSA/ECB/OAEPWithSHA-1AndMGF1Padding', publicKey, str) => {
    const response = await axiosInstance.post(
      process.env.ENCYPTED_DATA_URL, {
      "textToEncrypt": str?.toString(),
      "publicKey": publicKey,
      "privateKey": publicKey,
      "keyType": "publicKeyForEncryption",
      "cipherType": cypherType
    });
    return response?.data?.encryptedOutput;
  }

  /**
   * @param {string} token
   * @param {string} value
   * @returns {string} encryptedText
   */

  this.getEncryptedData = async (accessToken, value, methodName) => {
    try {
      logStream("debug", 'Calling API to Get Public Key', methodName);

      const publicKeyResponse = await this.getPublicKey(accessToken);

      logStream("debug", 'Got Public Key', methodName);
      if (!publicKeyResponse) throw new Error('Public Key not generated');

      const encryptedText = await this.getRSAText(publicKeyResponse?.encryptionAlgorithm, publicKeyResponse?.publicKey, value);

      return Promise.resolve(encryptedText)
    } catch (err) {
      return Promise.reject(err?.message)
    }
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
      logStream("error", JSON.stringify(error));
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

      const { value, txnId = "", scope = "aadhar" } = req.body;

      const accessToken = req.token

      const encryptedText = await this.getEncryptedData(accessToken, value, 'Enroll OTP Req');

      logStream("debug", 'Scope:' + scope + ' \n value: ' + value + ' Encrypted', 'Enroll OTP Req');

      let payload = {
        "txnId": "",
        "scope": ["abha-enrol"],
        "loginHint": "aadhaar",
        "otpSystem": "aadhaar",
        "loginId": encryptedText
      }

      if (scope === 'mobile') {
        payload = {
          "txnId": txnId,
          "scope": [
            "abha-enrol",
            "mobile-verify"
          ],
          "loginHint": "mobile",
          "otpSystem": "abdm",
          "loginId": encryptedText
        }
      }

      logStream("debug", process.env.REQ_OTP_URL, 'Enroll OTP Req - URL');
      logStream("debug", payload, 'Enroll OTP Req - Payload');

      const apiResponse = await axiosInstance.post(
        process.env.REQ_OTP_URL,
        payload,
        {
          headers: this.getInitialHeaderrs(accessToken)
        }
      );

      logStream("debug", apiResponse.data, 'Enroll OTP Req - Response');

      return res.json({
        ...apiResponse.data,
      })

    } catch (error) {
      logStream("error", JSON.stringify(error));
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
      const encryptedText = await this.getEncryptedData(accessToken, otp, 'Enroll By Aadhar');

      logStream("debug", 'mobileNo:' + mobileNo + ' \n value: ' + otp + ' Encrypted', 'Enroll By Aadhar');

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

      logStream("debug", process.env.ENROLL_AADHAR_BY_URL, 'Enroll By Aadhar - URL');
      logStream("debug", payload, 'Enroll By Aadhar - Payload');

      const apiResponse = await axiosInstance.post(
        process.env.ENROLL_AADHAR_BY_URL,
        payload,
        {
          headers: {
            ...this.getInitialHeaderrs(accessToken),
            'TRANSACTION_ID': uuid(),
          }
        }
      );

      logStream("debug", apiResponse.data, 'Enroll By Aadhar - Response');

      return res.json(apiResponse.data)

    } catch (error) {
      if (error?.response?.data?.otpValue) {
        error.message = error?.response?.data?.otpValue
      }
      logStream("error", JSON.stringify(error));
      next(error);
    }
  };

  /**
   * Get ABHA Profile
   * @param {req} object
   * @param {res} object
   * @param {next} function
   */
  this.enrollByAbdm = async (req, res, next) => {
    try {

      const { otp, txnId } = req.body

      const accessToken = req.token

      const encryptedText = await this.getEncryptedData(accessToken, otp, 'Enroll By Abdm');

      logStream("debug", 'txnId:' + txnId + ' \n value: ' + otp + ' Encrypted', 'Enroll By Aadhar');

      const payload = {
        "scope": [
          "abha-enrol",
          "mobile-verify"
        ],
        "authData": {
          "authMethods": [
            "otp"
          ],
          "otp": {
            "txnId": txnId,
            "otpValue": encryptedText,
            "timeStamp": this.getTimestamp()
          }
        }
      }

      logStream("debug", process.env.ENROLL_BY_ABDM_URL, 'Enroll By Abdm - URL');
      logStream("debug", payload, 'Enroll By Abdm - Payload');

      const apiResponse = await axiosInstance.post(
        process.env.ENROLL_BY_ABDM_URL,
        payload,
        {
          headers: {
            ...this.getInitialHeaderrs(accessToken),
            'TRANSACTION_ID': uuid(),
          }
        }
      );

      logStream("debug", apiResponse.data, 'Enroll By ABDM - Response');

      return res.json(apiResponse.data)

    } catch (error) {
      if (error?.response?.data?.otpValue) {
        error.message = error?.response?.data?.otpValue
      }
      logStream("error", JSON.stringify(error));
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

      logStream("debug", process.env.ENROLL_SUGGESION_URL, 'Get Enroll Suggestions - URL');
      logStream("debug", req.body, 'Get Enroll Suggestions - Payload');

      const apiResponse = await axiosInstance.get(
        process.env.ENROLL_SUGGESION_URL,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'REQUEST-ID': uuid(),
            'TRANSACTION_ID': txnId,
            'Accept-Language': 'en-us',
            'TIMESTAMP': this.getTimestamp(),
          }
        }
      );

      logStream("debug", apiResponse.data, 'Get Enroll Suggestions - Response');

      return res.json(apiResponse.data)

    } catch (error) {
      logStream("error", JSON.stringify(error));
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

      logStream("debug", process.env.ENROLL_SUGGESION_URL, 'Set Prefer Address - URL');
      logStream("debug", payload, 'Set Prefer Address - Payload');

      const apiResponse = await axiosInstance.post(
        process.env.SET_PREFERED_ADDRESS_URL,
        payload, {
        headers: this.getInitialHeaderrs(accessToken)
      }
      );

      logStream("debug", apiResponse.data, 'Set Prefer Address - Response ');

      return res.json(apiResponse.data)

    } catch (error) {
      logStream("error", JSON.stringify(error));
      next(error);
    }
  };

  /**
   * Search Abha Profile By Mobile Number
   * @param {req} object
   * @param {res} object
   * @param {next} function
   */
  this.searchAbhaProfiles = async (req, res, next) => {
    try {

      const { value, scope = "search" } = req.body;

      const accessToken = req.token

      const encryptedText = await this.getEncryptedData(accessToken, value, 'Search Abha Profile Req');

      logStream("debug", 'Scope:' + scope + ' \n value: ' + value + ' Encrypted', 'Search Abha Profile Req');

      const payload = {
        "scope": ["search-abha"],
        "mobile": encryptedText
      }
      
      logStream("debug", process.env.SEARCH_ABHA_NUMBER_BY_MOBILE, 'Search Abha Profile - URL');
      logStream("debug", payload, 'Search Abha Profile - Payload');

      const apiResponse = await axiosInstance.post(
        process.env.SEARCH_ABHA_NUMBER_BY_MOBILE,
        payload,
        {
          headers: this.getInitialHeaderrs(accessToken)
        }
      );

      logStream("debug", apiResponse.data, 'Search Abha Profile - Response');

      return res.json({
        ...apiResponse.data,
      })

    } catch (error) {
      logStream("error", JSON.stringify(error));
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

      const { value, scope, authMethod = 'AADHAAR_OTP', txnId='' } = req.body;

      const accessToken = req.token

      const encryptedText = await this.getEncryptedData(accessToken, value, 'GET Login OTP Req');

      logStream("debug", 'Scope:' + scope + ' \n value: ' + value + ' \n authMethod:' + authMethod + ' Encrypted', 'GET Login OTP Req');

      let payload = {
        "scope": [
          "abha-profile",
          "delete"
        ],
        "loginHint": "abha-number",
        "loginId": encryptedText,
        "otpSystem": "abdm"
      }, url = process.env.MOBILE_OTP_URL

      if (scope === 'index') {
        payload.scope = [
          "abha-login",
          "search-abha",
        ];
        payload.loginHint = "index";
        payload.txnId = txnId;
      }

      if (scope === 'aadhar') {
        payload.scope = [
          "abha-login",
          "aadhaar-verify"
        ];
        payload.loginHint = "aadhaar";
        payload.otpSystem = "aadhaar"
      }

      if (scope === 'abha-number') {
        payload.scope = [
          "abha-login",
        ];
        payload.loginHint = "abha-number";
      }

      if (scope === 'abha-address') {
        url = process.env.ABHA_ADDRESS_OTP_URL;
        payload.scope = ["abha-address-login"];
        payload.loginHint = scope;
      }

      if(['abha-address', 'abha-number', 'index'].includes(scope)) {
        payload.otpSystem = authMethod == 'AADHAAR_OTP' ? "aadhaar" : "abdm"
        payload.scope.push(authMethod == 'AADHAAR_OTP' ? "aadhaar-verify" : "mobile-verify")
      }

      logStream("debug", url, 'GET Login OTP Req - URL');
      logStream("debug", payload, 'GET Login OTP Req - Payload');

      const apiResponse = await axiosInstance.post(url,
        payload,
        {
          headers: this.getInitialHeaderrs(accessToken)
        }
      );

      logStream("debug", apiResponse.data, 'GET Login OTP - Response');

      return res.json({
        message: "OTP successfully sent to the registered mobile number.",
        ...apiResponse.data,
      })

    } catch (error) {
      logStream("error", JSON.stringify(error));
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

      const { otp, txnId, scope, authMethod = "AADHAAR_OTP", abhaNumber, password } = req.body

      const accessToken = req.token
      const plainText = password ?? otp;

      const encryptedText = await this.getEncryptedData(accessToken, plainText, 'Get Login OTP Verify');

      logStream("debug", 'Scope:' + scope + ' \n txnId: ' + txnId + ' \n value: ' + plainText + ' \n authMethod:' + authMethod + ' Encrypted', 'Get Login OTP Verify');

      let payload = {
        "scope": [
          "abha-profile",
          "delete"
        ]
      }, url = process.env.LOGIN_VERIFY_URL

      if ((scope === 'aadhar' || scope === 'abha-number') && authMethod == 'AADHAAR_OTP') {
        payload = {
          "scope": [
            "abha-login",
            "aadhaar-verify"
          ]
        }
      }

      payload = {
        ...payload,
        "authData": {
          "authMethods": [
            "otp"
          ],
          "otp": {
            "txnId": txnId,
            "otpValue": encryptedText
          }
        },
        "reasons": ["asdla"]
      }

      if (scope === 'abha-address') {
        url = process.env.ABHA_ADDRESS_OTP_VERIFY;
        payload = {
          "scope": [
            "abha-address-login",
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
      }

      if (scope === 'password') {
        payload = {
          "scope": [
            "abha-login",
            "password-verify"
          ],
          "authData": {
            "authMethods": [
              "password"
            ],
            "password": {
              "ABHANumber": abhaNumber,
              "password": encryptedText
            }
          }
        }
      }

      logStream("debug", url, 'Get Login OTP Verify - URL');
      logStream("debug", payload, 'Get Login OTP Verify - Payload');

      const apiResponse = await axiosInstance.post(url,
        payload,
        {
          headers: this.getInitialHeaderrs(accessToken)
        }
      );
      logStream("debug", apiResponse.data, 'Enroll By Aadhar - Response');
      if(apiResponse?.data?.tokens?.token) {
        const tokenData = apiResponse.data.tokens;
        delete apiResponse.data.tokens;
        apiResponse.data = {
          ...apiResponse.data,
          ...tokenData
        }
      }
      return res.json(apiResponse.data)

    } catch (error) {
      if (error?.response?.data?.otpValue) {
        error.message = error?.response?.data?.otpValue
      }
      logStream("error", JSON.stringify(error));
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

      let xToken = req.xtoken
      let loginVerifyRes = {};

      const { txnId, abhaNumber, scope = '' } = req.body;

      const accessToken = req.token;

      if (!['abha-address', 'abha-number', 'aadhar'].includes(scope)) {
        logStream("debug", process.env.LOGIN_VERIFY_USER_URL, 'Get Profile - Login Verify User - URL');
        logStream("debug", req.body, 'Get Profile - Login Verify User - Payload');

        loginVerifyRes = await axiosInstance.post(
          process.env.LOGIN_VERIFY_USER_URL,
          {
            "ABHANumber": abhaNumber,
            "txnId": txnId
          },
          {
            headers: {
              ...this.getInitialHeaderrs(accessToken),
              'T-Token': `Bearer ${xToken}`
            }
          }
        );
        xToken = loginVerifyRes.data.token;
        logStream("debug", loginVerifyRes.data, 'Get Profile - Login Verify User - Response');
      }

      const url = scope == 'abha-address' ? process.env.ACCOUNT_VERIFY_ABHA_USER_URL : process.env.ACCOUNT_VERIFY_USER_URL;

      logStream("debug", 'Calling API to Get Profile', 'Get Profile');
      logStream("debug", url, 'Get Profile - URL');

      const apiResponse = await axiosInstance.get(url,
        {
          headers: {
            ...this.getInitialHeaderrs(accessToken),
            'X-Token': `Bearer ${xToken}`
          }
        }
      );

      logStream("debug", apiResponse.data, 'Get Profile - Response');

      return res.json({
        ...(loginVerifyRes?.data ?? {}),
        ...(apiResponse?.data ?? {})
      })

    } catch (error) {
      logStream("error", JSON.stringify(error));
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

      let xToken = req.xtoken

      const accessToken = req.token;

      const scope = req.query.scope;

      const url = ['mobile', 'abha-address'].includes(scope) ? process.env.ABHA_ADDRESS_GET_CARD_URL : process.env.GET_CARD_URL

      logStream("debug", 'Calling API to Get Card', 'Get Card');
      logStream("debug", url, 'Get Card - URL');

      const apiResponse = await axiosInstance.get(url,
        {
          responseType: 'arraybuffer',
          headers: {
            ...this.getInitialHeaderrs(accessToken),
            'X-Token': `Bearer ${xToken}`
          }
        }
      ).then(response => Buffer.from(response.data, 'binary').toString('base64'))

      logStream("debug", 'Got API Response', 'Get Card');

      res.json({
        image: apiResponse
      });

    } catch (error) {
      logStream("error", JSON.stringify(error));
      next(error);
    }
  };

  /**
   * Post care context to abdm which patient having abha details
   * @param {Object} reqParams 
   * @returns 
   */
  this.linkCareContextByAbhaDetail = async (reqParams) => {
    try {
      const {
        visitUUID,
        abhaAddress,
        abhaNumber,
        personDisplay,
        startDateTime,
        openMRSID,
      } = reqParams;

      const uniquId = uuid();
      const requestObj = {
        'requestId': visitUUID,
        'requesterId': process.env.ABDM_INTELEHEALTH_ID,
        "abhaNumber": abhaNumber,
        "abhaAddress": abhaAddress,
        'authMode': 'DEMOGRAPHICS',
        "patient": {
          "referenceNumber": openMRSID,
          "display": `${personDisplay}`,
          "careContexts": [
            {
              "referenceNumber": visitUUID,
              "display": `${personDisplay} OpConsult-1 on ${convertDateToDDMMYYYY(startDateTime)}`
            }
          ],
          "hiType": "OPConsultation",
          "count": 1
        }
      }
      const isRecordExist = await abdm_visit_status.findOne({ where: { visitUuid: visitUUID } });
      if (isRecordExist) {
        return { success: true, data: null, message: `Care context already requested for ${visitUUID}!` };
      }

      logStream("debug", process.env.POST_LINK_CARE_CONTEXT_URL, 'Calling the Link care context API -> linkCareContextByAbhaDetail - URL');
      logStream("debug", requestObj, `Calling the Link care context API -> linkCareContextByAbhaDetail - Payload`);

      // Create the table entry to store from ABDM post care context
      const abdmVisitStatus = await abdm_visit_status.create({
        requestData: requestObj,
        requestId: uniquId,
        visitUuid: visitUUID
      });

      // Call the post request to link carecontext to abdm
      const abdmResponse = await axiosInstance.post(
        process.env.POST_LINK_CARE_CONTEXT_URL,
        requestObj,
        {
          headers: {
            ...this.getInitialHeaderrs(),
          },
        }
      ).catch((err) => {
        logStream("error", JSON.stringify(err));
        return err;
      });

      // Store the error of getting from link care context API call to abdmVisitStatus table
      if (abdmResponse?.data?.code !== 202) {
        const error = handleError(abdmResponse)
        abdmVisitStatus.error = error;
        abdmVisitStatus.isInvalid = true;
        await abdmVisitStatus.save();
        throw {
          status: abdmResponse?.response?.status,
          message: abdmResponse?.message ?? error?.message ?? error
        };
      }

      // Store the response getting from link care context API call to abdmVisitStatus table
      abdmVisitStatus.response = abdmResponse?.response?.data ?? abdmResponse?.data;

      logStream("debug", process.env.POST_LINK_CARE_CONTEXT_STATUS_URL + '/' + visitUUID, 'Verify the link care context status - URL');

      // Call get request to verify the care context link status
      const careContexts = await axiosInstance.get(
        process.env.POST_LINK_CARE_CONTEXT_STATUS_URL + '/' + visitUUID, {
        headers: {
          ...this.getInitialHeaderrs(),
        },
      }).catch((err) => {
        logStream("error", JSON.stringify(err));
        return err;
      });

      // Update the abdmVisitStatus table after getting response/error from link care context status
      if (careContexts?.data?.error === null && careContexts?.data?.status) {
        abdmVisitStatus.isLinked = true;
        abdmVisitStatus.link_status_response = careContexts?.data;

        logStream("debug", careContexts?.data, `Verify the link care context status - Response`);

        // Call the post request to update the isABDMLinked attribute to true.
        await openmrsService.postAttribute(visitUUID,
          {
            attributeType: '8ac6b1c7-c781-494a-b4ef-fb7d7632874f', /** Visit Attribute Type for isABDMLinked */
            value: true
          }
        ).catch((err) => {
          abdmVisitStatus.isLinked = false;
          abdmVisitStatus.link_status_error = err;
        });

      } else {
        const error = handleError(careContexts)
        abdmVisitStatus.link_status_error = error;
        abdmVisitStatus.isLinked = error?.message?.includes('Duplicate HIP link request') ?? false;
        abdmVisitStatus.isInvalid = abdmVisitStatus.isLinked;
      }

      await abdmVisitStatus.save()

      return { success: true, data: null, message: "Care context shared successfully!" };

    } catch (error) {
      logStream("error", JSON.stringify(error));
      return { success: false, status: error.status ?? 500, data: null, message: error?.message ?? error }

    }
  }

  /**
   * Post SMS Notify to abdm which patient does not having abha details
   * @param {Object} reqParams 
   * @returns 
   */
  this.smsNotifyCareContext = async (reqParams) => {
    try {
      const uniquId = uuid();
      const requestParam = {
        'requestId': uniquId,
        "timestamp": this.getTimestamp(),
        "notification": {
          "phoneNo": reqParams?.mobileNumber,
          "hip": {
            "name": "Intelehealth Telemedicine",
            "id": process.env.ABDM_INTELEHEALTH_ID
          }
        }
      }
      logStream("debug", process.env.POST_SMS_NOTIFY_URL, 'smsNotifyCareContext - URL');
      logStream("debug", requestParam, 'smsNotifyCareContext - Payload');

      const abdmResponse = await axiosInstance.post(
        process.env.POST_SMS_NOTIFY_URL,
        requestParam,
        {
          headers: {
            ...this.getInitialHeaderrs(),
          },
        }
      );

      if (abdmResponse?.data?.httpStatusCode !== 'ACCEPTED') {
        throw abdmResponse?.data?.error ?? abdmResponse?.data ?? new Error('Something went wrong!');
      }

      logStream("debug", abdmResponse?.data, 'smsNotifyCareContext - Response');

      return { success: true, data: abdmResponse?.data, message: "Care context sms notified successfully." }
    } catch (error) {
      logStream("error", JSON.stringify(error));
      return { success: false, status: error.status ?? 500, data: null, message: error?.data?.message ?? error?.message ?? error }
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
        abhaAddress,
        abhaNumber,
        mobileNumber
      } = req.body;

      let response = { success: false, status: 500, message: "Something went wrong!" };
      if (Boolean(abhaAddress) || Boolean(abhaNumber)) {
        response = await this.linkCareContextByAbhaDetail(req.body);
      } else if (Boolean(mobileNumber)) {
        response = await this.smsNotifyCareContext(req.body);
      }
      if (!response?.success) {
        throw response;
      }
      return res.json(response);
    } catch (error) {
      logStream("error", JSON.stringify(error));
      return res.status(error?.status ?? 500).json({
        "success": false,
        "code": "ERR_BAD_REQUEST",
        "message": error?.message,
      });
    }
  }

  /**
   * Patient Discover from ABDM Portal
   * @param {req} object
   * @param {res} object
   * @param {next} function
   */
  this.patientDiscover = async (req, res, next) => {
    try {
      logStream("debug", `Got Post Request - ${JSON.stringify(req.body)}`, 'patientDiscover');

      if (!req.body?.patient) {
        return res.status(422).json({
          "success": false,
          "code": "ERR_UNPROCESSABLE_ENTITY",
          "message": "Requested parameter is missing!",
        });
      }

      const patientInfo = await openmrsService.getVisitBySearch(req.body.patient)
      logStream("debug", 'Got Response of patient info', 'openmrsService.getVisitBySearch');
      if (patientInfo?.hasMultiplePatient) {
        throw {
          "code": "ERR_MULTIPLE_PATIENT_FOUND",
          "message": patientInfo?.message,
        }
      }

      if (!patientInfo) {
        return res.status(404).json({
          "success": false,
          "code": "ERR_DATA_NOT_FOUND",
          "message": 'Care context information is not found with provided details!.',
        });
      }

      logStream("debug", 'Got Response of patient info', 'patientDiscover');
      res.json(patientInfo);
      return;
    } catch (error) {
      logStream("error", JSON.stringify(error));
      return res.status(error?.status ?? error?.response?.status ?? 500).json({
        "success": false,
        "code": error?.code ?? "ERR_BAD_REQUEST",
        "message": error?.message,
      });
    }
  }

  /**
   * Return Visit care context to ABDM portal
   */
  this.getVisitCareContext = async (req, res, next) => {
    try {
      logStream("debug", 'Got Get Request to fetch visit detail by visit Id', 'getVisitCareContext');
      const visitUUID = req.body.visitUUID ?? req.params.visitUUID;
      const response = await openmrsService.getVisitByUUID(visitUUID);
      if (!response.success) throw response;
      const formattedResponse = await formatCareContextFHIBundle(response?.data);
      if (!formattedResponse) throw new Error('Visit is not shared the prescription yet!')
      res.json(formattedResponse);
      return;
    } catch (error) {
      logStream("error", JSON.stringify(error));
      if (!error.code) error.code = 500
      return next(error);
    }
  }

  return this;
})();
