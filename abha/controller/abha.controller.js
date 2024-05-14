const { token } = require("morgan");
const { axiosInstance } = require("../handlers/axiosHelper");

const EncryptRsa = require('encrypt-rsa').default;

const { logStream } = require("./../logger/index");

const encryptRsa = new EncryptRsa();

const { uuid } = require('uuidv4');
const openmrsService = require("../services/openmrs.service");
const { convertDateToDDMMYYYY, formatCareContextResponse, handleError } = require("../handlers/utilityHelper");
const { abdm_visit_status } = require("../models");


module.exports = (function () {

  /**
   * Get Initial Header
   * @param {token} string
   */
  this.getInitialHeaderrs = (token = null) => {
    const headers = {
      'Content-Type': 'application/json',
      'Accept-Language': 'en-us'
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
      }, url = process.env.MOBILE_OTP_URL

      if (scope === 'aadhar' || scope === 'abha-number') {
        payload = {
          "scope": [
            "abha-login",
            "aadhaar-verify"
          ],
          "loginHint": scope === "abha-number" ? "abha-number" : "aadhaar",
          "loginId": encryptedText,
          "otpSystem": "aadhaar"
        }
      }

      if(scope === 'abha-address') {
        url = process.env.ABHA_ADDRESS_OTP_URL;
        payload = {
          authMethod: 'AADHAAR_OTP',
          healthid: value
        }
      }

      logStream("debug", JSON.stringify(payload), 'GET Login OTP Req');

      logStream("debug", 'Calling API to get otp', 'GET Login OTP Req');

      const apiResponse = await axiosInstance.post(url,
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
        message: "OTP successfully sent to the registered mobile number.",
        ...apiResponse.data,
      })

    } catch (error) {
      logStream("error", error);
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
        ]
      }, url = process.env.LOGIN_VERIFY_URL

      if (scope === 'aadhar' || scope === 'abha-number') {
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
        }
      }

      if (scope === 'abha-address') {
        url = process.env.ABHA_ADDRESS_OTP_VERIFY;
        payload = {
          "txnId": txnId,
          "otp": otp
        }
      }

      console.log(payload)

      logStream("debug", JSON.stringify(payload), 'Get Login OTP Verify');

      logStream("debug", 'Calling API to Get Login OTP Verify', 'Get Login OTP Verify');

      const apiResponse = await axiosInstance.post(url,
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

      let xToken = req.xtoken

      const { txnId, abhaNumber, scope = '' } = req.body;

      const accessToken = req.token;

      if(!['abha-address', 'abha-number'].includes(scope)) {
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
        xToken = loginVerifyRes.data.token;
        logStream("debug", 'Calling API to Login Verify User - Token Received', 'Get Profile');
      }

      logStream("debug", 'Calling API to Get Profile', 'Get Profile');

      const apiResponse = await axiosInstance.get(
        scope == 'abha-address' ? process.env.ACCOUNT_VERIFY_ABHA_USER_URL : process.env.ACCOUNT_VERIFY_USER_URL,
        {
          headers: {
            ...this.getInitialHeaderrs(accessToken),
            'REQUEST-ID': uuid(),
            'TIMESTAMP': this.getTimestamp(),
            'X-Token': `Bearer ${xToken}`
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
        'requestId': uniquId,
        'requesterId': process.env.ABDM_INTELEHEALTH_ID,
        "abhaNumber": abhaNumber,
        "abhaAddress": abhaAddress,
        'authMode': 'DEMOGRAPHICS',
        "patient": {
          "referenceNumber": openMRSID,
          "display": `OpConsult:${personDisplay}`,
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

      logStream("debug", JSON.stringify(requestObj), `URL: ${process.env.POST_LINK_CARE_CONTEXT_URL} -> Calling the Link care context API -> linkCareContextByAbhaDetail`);

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

      // Call get request to verify the care context link status
      const careContexts = await axiosInstance.get(
        process.env.POST_LINK_CARE_CONTEXT_STATUS_URL + '/' + uniquId, {
        headers: {
          ...this.getInitialHeaderrs(),
        },
      }).catch((err) => {
        logStream("debug", err, `URL: ${process.env.POST_LINK_CARE_CONTEXT_STATUS_URL + '/' + uniquId} linkCareContextByAbhaDetail -> axiosInstance.get -> error`);
        return err;
      });

      // Update the abdmVisitStatus table after getting response/error from link care context status
      if (careContexts?.data?.error === null && careContexts?.data?.status) {
        abdmVisitStatus.isLinked = true;
        abdmVisitStatus.link_status_response = careContexts?.data;

        logStream("debug", careContexts?.data, `URL: ${process.env.POST_LINK_CARE_CONTEXT_STATUS_URL + '/' + uniquId} Response from linkCareContextByAbhaDetail -> axiosInstance.get`);

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

      logStream("error", error, "linkCareContextByAbhaDetail");
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
      logStream("debug", 'Calling /v1/sms/verify request to abdm', 'axiosInstance.post');

      const abdmResponse = await axiosInstance.post(
        process.env.POST_SMS_NOTIFY_URL,
        requestParam,
        {
          headers: {
            ...this.getInitialHeaderrs(),
          },
        }
      );

      logStream("debug", 'Got API Response From SMS verify', 'axiosInstance.post');
      if (abdmResponse?.data?.httpStatusCode !== 'ACCEPTED') {
        throw abdmResponse?.data?.error ?? abdmResponse?.data ?? new Error('Something went wrong!');
      }

      return { success: true, data: abdmResponse?.data, message: "Care context sms notified successfully." }
    } catch (error) {
      logStream("error", error, "smsNotifyCareContext");
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

      logStream("debug", 'Calling Post API to Post Link Care Context to Abha', 'postLinkCareContext');
      let response = { success: false, status: 500, message: "Something went wrong!" };
      if (Boolean(abhaAddress) || Boolean(abhaNumber)) {
        response = await this.linkCareContextByAbhaDetail(req.body);
      } else if (Boolean(mobileNumber)) {
        response = await this.smsNotifyCareContext(req.body);
      }
      if (!response?.success) {
        throw response;
      }
      logStream("debug", 'Got API Response', 'postLinkCareContext');
      return res.json(response);
    } catch (error) {
      logStream("error", error);
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
      logStream("error", error);
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
      res.json(formatCareContextResponse(response?.data));
      return;
    } catch (error) {
      logStream("error", error);
      if (!error.code) error.code = 500
      return next(error);
    }
  }

  return this;
})();
