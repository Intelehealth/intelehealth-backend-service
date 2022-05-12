module.exports = (function () {
  this.getVisitCountQuery = ({ speciality = "General Physician" }) => {
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

  this.getVisitCountQueryForGp = () => {
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

  this.getDoctorVisitsData =  () => {
    return `SELECT
    v.visit_id AS visit_id,
    p.patient_id AS patient_id,
    v.date_created AS Visit_Creation_Date,
    v.date_started AS Visit_Started_Date,
    v.date_stopped AS Visit_Ended_Date,
    v.creator AS Creator_Id,
    CONCAT(pnu.given_name, ' ', pnu.family_name) AS CHW_Name,
    v.date_created AS Time_of_upload,
    MAX(CASE
    WHEN e.encounter_type = 9 THEN e.encounter_datetime
    ELSE NULL
    END) AS Consultation_Start_time,
    MAX(CASE
    WHEN e.encounter_type = 14 THEN e.creator
    ELSE NULL
    END) AS Doctor_Id,
    MAX(CASE
    WHEN e.encounter_type = 14 THEN w.uuid
    ELSE NULL
    END) AS Doctor_uuid,
    MAX(CASE WHEN e.encounter_type = 14 THEN CONCAT(pnd.given_name, ' ', pnd.family_name)
    END) AS Doctor_Name,
   HOUR(TIMEDIFF(MAX(CASE WHEN e.encounter_type = 14 THEN e.encounter_datetime
   ELSE NULL END),v.date_created))*3600 +
   (MINUTE(TIMEDIFF(MAX(CASE WHEN e.encounter_type = 14 THEN e.encounter_datetime
   ELSE NULL END),v.date_created))*60) +
   (SECOND(TIMEDIFF(MAX(CASE WHEN e.encounter_type = 14 THEN e.encounter_datetime
   ELSE NULL END),v.date_created))) as Doctor_TAT_Secs,
    MAX(CASE
    WHEN e.encounter_type = 14 THEN e.encounter_datetime
    ELSE NULL
    END) AS Sign_Submit_time
    FROM
    visit v
    LEFT JOIN
    encounter e ON (v.visit_id = e.visit_id AND e.voided = 0)
    LEFT JOIN
    obs o ON (e.encounter_id = o.encounter_id
    AND o.voided = 0)
    LEFT JOIN
    patient p ON (v.patient_id = p.patient_id
    AND p.voided = 0)
    LEFT JOIN
    patient_identifier pi ON (p.patient_id = pi.patient_id
    AND pi.voided = 0)
    LEFT JOIN
    person pe ON (p.patient_id = pe.person_id
    AND pe.voided = 0)
    LEFT JOIN
    person_address padd ON (pe.person_id = padd.person_id
    AND padd.voided = 0
    AND padd.preferred = 1)
    LEFT JOIN
    person_name pn ON (pe.person_id = pn.person_id
    AND pn.voided = 0
    AND pn.preferred = 1)
    LEFT JOIN
    person_attribute pet ON (pe.person_id = pet.person_id
    AND pet.voided = 0
    AND pet.person_attribute_type_id IN (8 , 12))
    LEFT JOIN
    location l ON (v.location_id = l.location_id
    AND l.retired = 0)
   LEFT JOIN
   users u ON (v.creator = u.user_id AND u.retired = 0)
   LEFT JOIN
   person_name pnu ON (u.person_id = pnu.person_id AND pnu.voided = 0)
   LEFT JOIN
   users w ON (e.creator = w.user_id AND w.retired = 0)
   LEFT JOIN
   person_name pnd ON (w.person_id = pnd.person_id AND pnd.voided = 0)
    WHERE
    v.voided = 0
    GROUP BY v.visit_id , p.patient_id ,
    v.date_started , v.date_stopped , v.creator , u.username , v.date_created, CONCAT(pnu.given_name, ' ', pnu.family_name)
    ORDER BY v.date_started ;`;
  };

  this.locationQuery = () => `SELECT
  ltm.location_id as id,
  ltm.location_tag_id as tagId,
  l.name as name,
  l.parent_location as parent,
  lt.name as tag,
  l.uuid as uuid
from
  location_tag_map ltm
  LEFT JOIN location l ON l.location_id = ltm.location_id
  LEFT JOIN location_tag lt ON lt.location_tag_id = ltm.location_tag_id
where
  lt.name NOT IN (
      'Login Location',
      'Admission Location',
      'Visit Location',
      'Transfer Location'
  )
order by
  l.name`;

  this.doctorsQuery = () => `SELECT
  distinct pa.value_reference,
  pn.given_name as givenName,
  p.person_id,
  p.gender,
  p.uuid,
  ur.role,
  u.username as userName,
  u.uuid as userUuid,
  pat.name as attrTypeName
FROM
  users u
  LEFT JOIN user_role ur ON ur.user_id = u.user_id
  LEFT JOIN person p ON p.person_id = u.person_id
  LEFT JOIN person_name pn ON pn.person_id = p.person_id
  LEFT JOIN provider pdr ON pdr.person_id = p.person_id
  LEFT JOIN provider_attribute pa ON pdr.provider_id = pa.provider_id
  LEFT JOIN provider_attribute_type pat ON pat.provider_attribute_type_id = pa.attribute_type_id
WHERE 
ur.role like '%Doctor%';`;

  return this;
})();
