const openMrsDB = require("../public/javascripts/mysql/mysqlOpenMrs");

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

const getAllCasesCount = (speciality = "Doctor not needed") => {
  return `SELECT
  count(distinct v.patient_id) as Total
FROM
  visit v
  LEFT JOIN encounter e using (visit_id)
  LEFT JOIN visit_attribute va using (visit_id)
where
  v.voided = 0
  and e.voided = 0
  and va.value_reference = '${speciality}';`;
};

/**
 * To return the visit counts from the openmrs db using custom query
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
const getVisitCounts = async (req, res, next) => {
  const speciality = req.query.speciality;
  const query = getAllCasesCount(speciality);
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
      message: "Visit count fetched successfully",
    });
  } catch (error) {
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};

module.exports = {
  getVisitCounts,
};
