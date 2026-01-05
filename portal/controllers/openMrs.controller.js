const { MESSAGE } = require("../constants/messages");
const openMrsDB = require("../handlers/mysql/mysqlOpenMrs");
const { sendOtp, resetPassword, _getFollowUpVisits } = require("../services/openmrs.service");
const { logStream } = require("../logger/index");
const {
  _getAwaitingVisits,
  _getPriorityVisits,
  _getInProgressVisits,
  _getCompletedVisits,
  _getEndedVisits
} = require("../services/openmrs.service");

const getVisitCountQuery = ({ speciality = "General Physician" }) => {
  return `select count(t1.visit_id) as Total,
  /*speciality,
      state,*/
     case
    when  (encounter_type = 14 or encounter_type = 12 or com_enc = 1) then "Completed Visit"
          when  (encounter_type = 9 ) then "Visit In Progress"
          when (encounter_type) = 15 then "Priority"
          when  ((encounter_type = 1 or encounter_type = 6) )  then "Awaiting Consult"
       end as "Status"
from encounter,
(select 	v.visit_id,
    v.patient_id,
    max(case
      when attribute_type_id = 5 then value_reference else null end) as "speciality",
    max(case
      when attribute_type_id = 6 then value_reference else null end) as "state"    ,
    max(encounter_id) max_enc,
          max(case when encounter_type = 14 then 1 else 0 end) as com_enc
  from 	visit v,
      visit_attribute va,
      encounter e
  where v.voided = 0
      and	v.date_stopped is null
  and va.voided = 0
  and va.attribute_type_id in (5,6)
  and va.visit_id = v.visit_id
  and e.voided = 0
  and e.visit_id = v.visit_id
  group by 	v.visit_id,
        v.patient_id
  having max(case
        when attribute_type_id = 5 then value_reference else null end) = "${speciality}") as t1
where encounter_id = max_enc
group by case
    when  (encounter_type = 14 or encounter_type = 12 or com_enc = 1) then "Completed Visit"
          when  (encounter_type = 9 ) then "Visit In Progress"
          when (encounter_type) = 15 then "Priority"
          when  ((encounter_type = 1 or encounter_type = 6) )  then "Awaiting Consult"
       end;`;
};

const getVisitCountQueryForGp = () => {
  return `select count(t1.patient_id) as Total,
  case
    when  (encounter_type = 14 or encounter_type = 12 or com_enc = 1) then "Completed Visit"
          when  (encounter_type = 9 ) then "Visit In Progress"
          when (encounter_type) = 15 then "Priority"
          when  ((encounter_type = 1 or encounter_type = 6) )  then "Awaiting Consult"
       end as "Status"
from encounter,
(select 	v.visit_id,
  v.patient_id,
      max(encounter_id) as max_enc,
      max(case when encounter_type in (12,14) then 1 else 0 end) as com_enc,
      max(case
      when attribute_type_id = 5 then value_reference else null end) as "speciality"
from visit v
LEFT JOIN encounter e
  using (visit_id)
LEFT JOIN visit_attribute va
  using (visit_id)
where v.voided = 0
and date_stopped is null
and e.voided = 0
group by  v.visit_id,
  v.patient_id) as t1
where encounter_id = max_enc
and (speciality  is null or speciality = 'General Physician')
group by case
    when  (encounter_type = 14 or encounter_type = 12  or com_enc = 1) then "Completed Visit"
          when  (encounter_type = 9 ) then "Visit In Progress"
          when (encounter_type) = 15 then "Priority"
          when  ((encounter_type = 1 or encounter_type = 6) )  then "Awaiting Consult"
       end;`;
};

const getFollowUpVisitOfDr = (providerId) => {
  return `select 	v.uuid as visit_id,
  v.patient_id,
      max(e.encounter_id) as visit_note_encounter,
      max(e.creator) as doctor_id,
      max(ep.provider_id) as provider_id,
      max(p.uuid) as provider_uuid,
      max(value_text) as followup_text
from 	visit v,
  encounter e,
      encounter_provider ep,
      provider p,
      obs o
where	v.voided = 0
and		e.visit_id = v.visit_id
and   p.uuid ='${providerId}'
and		e.encounter_type = 9
and		e.voided = 0
and		ep.encounter_id = e.encounter_id
and		p.provider_id = ep.provider_id
and		o.encounter_id = e.encounter_id
and		o.concept_id = 163345
group by 	v.visit_id,
    v.patient_id
order by 4 ;`;
};

/**
 * To return the visit counts from the openmrs db using custom query
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
const getVisitCounts = async (req, res, next) => {
  const { speciality } = req.query;
  const query =
    speciality === "General Physician"
      ? getVisitCountQueryForGp()
      : getVisitCountQuery({ speciality });

  try {
    logStream('debug', 'API call', 'Get Visit Counts');
    const data = await new Promise((resolve, reject) => {
      openMrsDB.query(query, (err, results, fields) => {
        if (err) reject(err);
        resolve(results);
      });
    }).catch((err) => {
      throw err;
    });
    logStream('debug', 'Success', 'Get Visit Counts');
    res.json({
      data,
      message: MESSAGE.OPENMRS.VISIT_COUNT_FETCHED_SUCCESSFULLY,
    });
  } catch (error) {
    logStream("error", error.message);
    res.statusCode = 422;
    res.json({ status: false, message: err.message });
  }
};

/**
 * To return the FollowUp Visits from the openmrs db using custom query
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
const getFollowUpVisit = async (req, res, next) => {
  const { providerId } = req.params;
  const query = getFollowUpVisitOfDr(providerId);
  try {
    logStream('debug', 'API call', 'Get FollowUp Visit');
    const data = await new Promise((resolve, reject) => {
      openMrsDB.query(query, (err, results, fields) => {
        if (err) reject(err);
        resolve(results);
      });
    }).catch((err) => {
      throw err;
    });
    logStream('debug', 'Success', 'Get FollowUp Visit');
    res.json(
      data
    );
  } catch (error) {
    logStream("error", error.message);
    res.statusCode = 422;
    res.json({ status: false, message: err.message });
  }
};

/**
 * IDA4 - forget password send OTP API
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
const forgetPasswordSendOtp = async (req, res, next) => {
  try {
    logStream('debug', 'API call', 'Forget Password Send Otp');
    const { userName, phoneNumber } = req.body;
    const data = await sendOtp(userName, phoneNumber);
    logStream('debug', 'Success', 'Forget Password Send Otp');
    res.json(data);
  } catch (error) {
    logStream("error", error.message);
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};

/**
 * Request for reset the password of user.
 * @param {request} req
 * @param {response} res
 * @returns 
 */
const forgetPasswordResetPassword = async (req, res, next) => {
  try {
    logStream('debug', 'API call', 'Forget Password Reset Password');
    const { userUuid } = req.params;
    const { newPassword, otp } = req.body;

    const data = await resetPassword(userUuid, otp, newPassword);
    logStream('debug', 'Success', 'Forget Password Reset Password');
    res.json(data);
  } catch (error) {
    logStream("error", error.message);
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};

/**
 * Get awaiting visit.
 * @param {request} req
 * @param {response} res
 * @returns visits
 */
const getAwaitingVisits = async (req, res, next) => {
  try {
    logStream('debug', 'API call', 'Get Awaiting Visits');
    const { speciality, page, limit } = req.query;
    const data = await _getAwaitingVisits(speciality, page, limit);
    logStream('debug', 'Success', 'Get Awaiting Visits');
    res.json({
      count: data.currentCount,
      totalCount: data.totalCount,
      data: data.visits,
      success: true,
    });
  } catch (error) {
    logStream("error", error.message);
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};
/**
 * Get priorities visit.
 * @param {request} req
 * @param {response} res
 * @returns visits
 */
const getPriorityVisits = async (req, res, next) => {
  try {
    logStream('debug', 'API call', 'Get Priority Visits');
    const { speciality, page, limit } = req.query;
    const data = await _getPriorityVisits(speciality, page, limit);
    logStream('debug', 'Success', 'Get Priority Visits');
    res.json({
      count: data.currentCount,
      totalCount: data.totalCount,
      data: data.visits,
      success: true,
    });
  } catch (error) {
    logStream("error", error.message);
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};
/**
 * Get in progress visit.
 * @param {request} req
 * @param {response} res
 * @returns visits
 */
const getInProgressVisits = async (req, res, next) => {
  try {
    logStream('debug', 'API call', 'Get In Progress Visits');
    const { speciality, page, limit } = req.query;
    const data = await _getInProgressVisits(speciality, page, limit);
    logStream('debug', 'Success', 'Get In Progress Visits');
    res.json({
      count: data.currentCount,
      totalCount: data.totalCount,
      data: data.visits,
      success: true,
    });
  } catch (error) {
    logStream("error", error.message);
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};

/**
 * Get completed visit.
 * @param {request} req
 * @param {response} res
 * @returns visits
 */
const getCompletedVisits = async (req, res, next) => {
  try {
    logStream('debug', 'API call', 'Get Completed Visits');
    const { speciality, page, countOnly, limit } = req.query;
    const data = await _getCompletedVisits(speciality, page, limit, countOnly === 'true');
    logStream('debug', 'Success', 'Get Completed Visits');
    res.json({
      count: data.currentCount,
      totalCount: data.totalCount,
      data: data.visits,
      success: true,
    });
  } catch (error) {
    logStream("error", error.message);
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};

/**
 * Get follow-up visits.
 * @param {request} req
 * @param {response} res
 * @returns visits
 */
const getFollowUpVisits = async (req, res, next) => {
  try {
    logStream('debug', 'API call', 'Get Follow-Up Visits');
    const { speciality, page, countOnly, limit } = req.query;
    const data = await _getFollowUpVisits(speciality, page, limit, countOnly === 'true');
    logStream('debug', 'Success', 'Get Follow-Up Visits');
    res.json({
      count: data.currentCount,
      totalCount: data.totalCount,
      data: data.visits,
      success: true,
    });
  } catch (error) {
    logStream("error", error.message);
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};


/**
 * Get ended visit.
 * @param {request} req
 * @param {response} res
 * @returns visits
 */
const getEndedVisits = async (req, res, next) => {
  try {
    logStream('debug', 'API call', 'Get Ended Visits');
    const { speciality, page, limit } = req.query;
    const data = await _getEndedVisits(speciality, page, limit);
    logStream('debug', 'Success', 'Get Ended Visits');
    res.json({
      count: data.currentCount,
      totalCount: data.totalCount,
      data: data.visits,
      success: true,
    });
  } catch (error) {
    logStream("error", error.message);
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};

module.exports = {
  getVisitCounts,
  getFollowUpVisit,
  forgetPasswordSendOtp,
  forgetPasswordResetPassword,
  getAwaitingVisits,
  getPriorityVisits,
  getInProgressVisits,
  getCompletedVisits,
  getEndedVisits,
  getFollowUpVisits
};
