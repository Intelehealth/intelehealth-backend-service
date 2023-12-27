const { MESSAGE } = require("../constants/messages");
const openMrsDB = require("../handlers/mysql/mysqlOpenMrs");
const { sendOtp, resetPassword } = require("../services/openmrs.service");
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
  const speciality = req.query.speciality;
  const query =
    speciality === "General Physician"
      ? getVisitCountQueryForGp()
      : getVisitCountQuery({ speciality });

  try {
    const data = await new Promise((resolve, reject) => {
      openMrsDB.query(query, (err, results, fields) => {
        if (err) reject(err);
        resolve(results);
      });
    }).catch((err) => {
      throw err;
    });
    res.json({
      data,
      message: MESSAGE.OPENMRS.VISIT_COUNT_FETCHED_SUCCESSFULLY,
    });
  } catch (error) {
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
  const providerId = req.params.providerId;
  const query = getFollowUpVisitOfDr(providerId);
  try {
    const data = await new Promise((resolve, reject) => {
      openMrsDB.query(query, (err, results, fields) => {
        if (err) reject(err);
        resolve(results);
      });
    }).catch((err) => {
      throw err;
    });
    res.json(
      data
    );
  } catch (error) {
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
    const data = await sendOtp(req.body.userName, req.body.phoneNumber);

    res.json(data);
  } catch (error) {
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};

const forgetPasswordResetPassword = async (req, res, next) => {
  try {
    const userUuid = req.params.userUuid;
    const newPassword = req.body.newPassword;
    const otp = req.body.otp;

    const data = await resetPassword(userUuid, otp, newPassword);

    res.json(data);
  } catch (error) {
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};

const getAwaitingVisits = async (req, res, next) => {
  try {
    const data = await _getAwaitingVisits(
      req.query.speciality,
      req.query.page
    );
    res.json({
      count: data.currentCount,
      totalCount: data.totalCount,
      data: data.visits,
      success: true,
    });
  } catch (error) {
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};

const getPriorityVisits = async (req, res, next) => {
  try {
    const data = await _getPriorityVisits(
      req.query.speciality,
      req.query.page
    );
    res.json({
      count: data.currentCount,
      totalCount: data.totalCount,
      data: data.visits,
      success: true,
    });
  } catch (error) {
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};

const getInProgressVisits = async (req, res, next) => {
  try {
    const data = await _getInProgressVisits(
      req.query.speciality,
      req.query.page
    );
    res.json({
      count: data.currentCount,
      totalCount: data.totalCount,
      data: data.visits,
      success: true,
    });
  } catch (error) {
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};

const getCompletedVisits = async (req, res, next) => {
  try {
    const data = await _getCompletedVisits(
      req.query.speciality,
      req.query.page
    );
    res.json({
      count: data.currentCount,
      totalCount: data.totalCount,
      data: data.visits,
      success: true,
    });
  } catch (error) {
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};

const getEndedVisits = async (req, res, next) => {
  try {
    const data = await _getEndedVisits(
      req.query.speciality,
      req.query.page
    );
    res.json({
      count: data.currentCount,
      totalCount: data.totalCount,
      data: data.visits,
      success: true,
    });
  } catch (error) {
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
  getEndedVisits
};
