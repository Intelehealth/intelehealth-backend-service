const openMrsDB = require("../public/javascripts/mysql/mysqlOpenMrs");

const getVisitCountQuery = () => {
  return `select
  count(t1.visit_id) as Total,
  case
  when (
          sas_enc = 1
      ) then "Completed Visit"
      when (
          encounter_type = 12
          or com_enc = 1
      ) then "ended_visits"
      when (encounter_type = 9) then "Visit In Progress"
      when (encounter_type) = 15 then "Priority"
      when (
          (
              encounter_type = 1
              or encounter_type = 6
          )
      ) then "Awaiting Consult"
  end as "Status",
  case
	when SUBSTRING_INDEX(SUBSTRING(LEFT(value_text,80),5),'</b>',1) in ('Follow up visit','Follow up in person','Follow up over telephone')
    then 'Followup case'
    else 'Non Followup case'
    end as followup_status
from
  encounter e,
  (
      select
          v.visit_id,
          v.patient_id,
          max(encounter_id) as max_enc,
          max(case when encounter_type = 1 then encounter_id else null end) as adi_enc,
          max(
              case
                  when (encounter_type in (12, 14) or v.date_stopped is not null) then 1
                  else 0
              end
          ) as com_enc,
          max(
              case
                  when (encounter_type in (14) ) then 1
                  else 0
              end
          ) as sas_enc,
          max(
              case
                  when attribute_type_id = 5 then value_reference
                  else null
              end
          ) as "speciality"
      from
          visit v
          LEFT JOIN encounter e using (visit_id)
          LEFT JOIN visit_attribute va on (va.visit_id= v.visit_id and va.voided = 0 and va.attribute_type_id = 5)
      where
          v.voided = 0
          -- and date_stopped is null
          and e.voided = 0
      group by
          v.visit_id,
          v.patient_id
  ) as t1,
  obs o
where
  e.encounter_id = max_enc
  /*and (
      speciality is null
      or speciality = 'General Physician'
      or speciality = 'Pediatrician'
  )*/
and o.encounter_id = t1.adi_enc
and o.concept_id = 163212
and o.voided = 0
group by case
  when (
          sas_enc = 1
      ) then "Completed Visit"
      when (
          encounter_type = 12
          or com_enc = 1
      ) then "ended_visits"
      when (encounter_type = 9) then "Visit In Progress"
      when (encounter_type) = 15 then "Priority"
      when (
          (
              encounter_type = 1
              or encounter_type = 6
          )
      ) then "Awaiting Consult"
  end,
  case
	when SUBSTRING_INDEX(SUBSTRING(LEFT(value_text,80),5),'</b>',1) in ('Follow up visit','Follow up in person','Follow up over telephone')
    then 'Followup case'
    else 'Non Followup case'
    end
order by 2;`;
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

/**
 * To return the visit counts from the openmrs db using custom query
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
const getVisitCounts = async (req, res, next) => {
  const speciality = req.query.speciality;
  const query = getVisitCountQuery();

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
