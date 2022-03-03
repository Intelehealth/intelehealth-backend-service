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
