const openMrsDB = require("../public/javascripts/mysql/mysqlOpenMrs");
const { logStream } = require("../logger/index");

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


const getLocationQuery = () => {
  return `SELECT
  ltm.location_id as id,
  ltm.location_tag_id as tagId,
  l.name as name,
  l.description as description, 
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

/**
 * To return the visit counts from the openmrs db using custom query
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
 const getLocations = async (req, res, next) => {
  try {
    logStream('debug', 'API call', 'Get Locations');
    const data = await new Promise((resolve, reject) => {
      openMrsDB.query(getLocationQuery(), (err, results, fields) => {
        if (err) reject(err);
        resolve(results);
      });
    }).catch((err) => {
      logStream("error", err.message);
      throw err;
    });
    const sortedResult = data.sort((a,b)=> { return a.description?.localeCompare(b.description, 'ar')});
    let states = sortedResult.filter((d) => d.tag === "State");
    if (states.length) {
      states = states.map((s) => {
        let districts = data.filter(
          (d) => (d.parent === s.id || (d.parent === null && d.id === s.id)) && d.tag === "District"
        );
        if (districts.length) {
          districts = districts.map((d) => {
            let child = {};
            const sanchs = data.filter(
              (s) => s.parent === d.id && s.tag === "Sanch"
            );
            const tehsils = data.filter(
              (t) => t.parent === d.id && t.tag === "Tehsil"
            );
            if (sanchs.length) {
              child.sanchs = sanchs.map((s) => {
                const villages = data
                  .filter((v) => v.parent === s.id && v.tag === "Village")
                  .map(({ name, uuid, id }) => ({ name, uuid, id }));

                return { name: s.name, uuid: s.uuid, id: s.id, villages };
              });
            } else if (tehsils.length) {
              child.tehsils = tehsils.map((t) => {
                const villages = data
                  .filter((v) => v.parent === t.id && v.tag === "Village")
                  .map(({ name, uuid, id }) => ({ name, uuid, id }));

                return { name: s.name, uuid: s.uuid, id: s.id, villages };
              });
            } else {
              child.villages = data
                .filter((v) => v.parent === d.id && v.tag === "Village")
                .map(({ name, uuid, id }) => ({ name, uuid, id }));
            }
            return {
              name: d.name,
              uuid: d.uuid,
              id: d.id,
              ...child,
            };
          });
        }

        return {
          name: s.name,
          id: s.id,
          uuid: s.uuid,
          districts,
        };
      });
    }
    logStream('debug', 'Success', 'Get Locations');
    res.json({
      states,
      message: "Locations fetched successfully",
    });
  } catch (error) {
    logStream("error", error.message);
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};

module.exports = {
  getVisitCounts,
  getLocations
};
