const openMrsDB = require("../public/javascripts/mysql/mysqlOpenMrs");

const getVisitCountQuery = ({ speciality = "General Physician" }) => {
  return `select count(tbl.patient_id) as Total,
    case
         when  (encounter_type = 14 or encounter_type = 12 or com_enc = 1) then "Completed Visit"
         when  (encounter_type = 9 ) then "Visit In Progress"
         when (encounter_type) = 15 then "Priority"
         when  ((encounter_type = 1 or encounter_type = 6) )  then "Awaiting Consult"
      end as "Status"
from encounter,
(select t1.*
from
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
     and va.voided = 0
     and va.attribute_type_id in (5,6)
     and va.visit_id = v.visit_id
     and e.voided = 0
     and e.visit_id = v.visit_id
     group by 	v.visit_id,
                 v.patient_id
     having max(case
                 when attribute_type_id = 5 then value_reference else null end) = "${speciality}") as t1
     left outer join
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
     and va.voided = 0
     and va.attribute_type_id in (5,6)
     and va.visit_id = v.visit_id
     and e.voided = 0
     and e.visit_id = v.visit_id
     group by 	v.visit_id,
                 v.patient_id
     having max(case
                 when attribute_type_id = 5 then value_reference else null end) = "General Physician") as t2
on (t1.patient_id = t2.patient_id and t1.visit_id < t2.visit_id)
where t2.patient_id is null
order by patient_id                   ) as tbl
where encounter_id = max_enc
group by case
         when  (encounter_type = 14 or encounter_type = 12  or com_enc = 1) then "Completed Visit"
         when  (encounter_type = 9 ) then "Visit In Progress"
         when (encounter_type) = 15 then "Priority"
         when  ((encounter_type = 1 or encounter_type = 6) )  then "Awaiting Consult"
      end;`;
};

/**
 * To return the visit counts from the openmrs db using custom query
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
const getVisitCounts = async (req, res, next) => {
  const speciality = req.query.speciality
    ? req.query.speciality
    : "General Physician";
  const query = getVisitCountQuery({ speciality });

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
    res.json({ status: false, message: err.message });
  }
};

module.exports = {
  getVisitCounts,
};
