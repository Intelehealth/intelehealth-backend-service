const openMrsDB = require("../public/javascripts/mysql/mysqlOpenMrs");
const { logStream } = require("../logger/index");

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

const getFollowupVisitsQuery = () => {
  return `select
  pi.identifier as "patientID" ,
  concat(pn.given_name," ", pn.middle_name, " ", pn.family_name ) as "patientName",
      case when pa.person_attribute_type_id = 8 then pa.value else null end as "phoneNo",
      pe.gender as "gender",
  floor(datediff(curdate(),pe.birthdate)/365) as "age",
      l.name as "visitLocation",
      CONCAT(pnd.given_name, ' ', pnd.family_name) AS provider,
  e.encounter_datetime as "lastSeen",
  group_concat(distinct case when o.concept_id = 163219
  then o.value_text else null end) as "diagnosis" ,
  max(case when o.concept_id = 163345
  then STR_TO_DATE(SUBSTRING_INDEX(o.value_text,",",1),'%d-%m-%Y') else null end) as "followUpDate" ,
  pe.uuid as patientId,
  va.uuid as visitId
from
(select v.patient_id , max(v.visit_id) as visit_id
  from visit v
  left join encounter e on (e.visit_id = v.visit_id and e.encounter_type = 14 and e.voided = 0 )
  where v.date_started >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 2 MONTH), '%Y-%m-01')
  AND v.date_started < DATE_ADD(CURDATE(), INTERVAL 1 DAY) and v.voided =0
  group by  v.patient_id) t
left join patient_identifier pi
on (pi.patient_id = t.patient_id and pi.voided =0 and pi.preferred = 1)
left join person_name pn
on (pn.person_id = t.patient_id and pn.voided =0 and pn.preferred = 1)
left join person_attribute pa
on (pa.person_id = t.patient_id and pa.voided =0 and pa.person_attribute_type_id =8)
left join person pe
on (pe.person_id = t.patient_id and pe.voided =0 )
left join  visit va
on (t.visit_id = va.visit_id and va.voided =0 )
left join location l
on (l.location_id = va.location_id)
left join  encounter e
on (t.visit_id = e.visit_id and e.voided =0 and e.encounter_type in ( 9))
left join obs o
on (o.encounter_id = e.encounter_id and o.voided =0 and o.concept_id in (163219,163345))
left join users u
on (u.user_id = e.creator )
left join person_name pnd
ON (u.person_id = pnd.person_id AND pnd.voided = 0)
group by 	t.patient_id,
    pi.identifier,
    concat(pn.given_name," ", pn.middle_name, " ", pn.family_name ) ,
    case when pa.person_attribute_type_id = 8 then pa.value else null end ,
    pe.gender ,
    floor(datediff(curdate(),pe.birthdate)/365) ,
    CONCAT(pnd.given_name, ' ', pnd.family_name),
    e.encounter_datetime,
    pi.uuid,
    va.uuid
having followUpDate is not null
order by followUpDate desc;`;
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
    logStream('debug', 'API call', 'Get Visit Counts');
    const data = await new Promise((resolve, reject) => {
      openMrsDB.query(query, (err, results, fields) => {
        if (err) reject(err);
        resolve(results);
      });
    }).catch((err) => {
      logStream("error", err.message);
      throw err;
    });
    logStream('debug', 'Success', 'Get Visit Counts');
    res.json({
      data,
      message: "Visit count fetched successfully",
    });
  } catch (error) {
    logStream("error", error.message);
    res.statusCode = 422;
    res.json({ status: false, message: err.message });
  }
};

const getFollowupVisits = async (req, res, next) => {
  const query = getFollowupVisitsQuery();
  try {
    logStream('debug', 'API call', 'Get FollowUp Visit');
    const data = await new Promise((resolve, reject) => {
      openMrsDB.query(query, (err, results, fields) => {
        if (err) reject(err);
        resolve(results);
      });
    }).catch((err) => {
      logStream("error", err.message);
      throw err;
    });
    logStream('debug', 'Success', 'Get FollowUp Visit');
    res.json({
      data,
      message: "Followup Visits fetched successfully",
    });
  } catch (error) {
    logStream("error", error.message);
    res.statusCode = 422;
    res.json({ status: false, message: err.message });
  }
};

module.exports = {
  getVisitCounts,
  getFollowupVisits
};
