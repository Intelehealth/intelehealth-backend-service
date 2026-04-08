const openMrsDB = require("../public/javascripts/mysql/mysqlOpenMrs");

const getFollowUpVisitOfDr = (providerId) => {
  return `select v.uuid as visit_id,
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

const getFollowUpVisit = async (req, res, next) => {
  const { providerId } = req.params;
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
    res.json(data);
  } catch (error) {
    res.status(422).json({ status: false, message: error.message });
  }
};

module.exports = {
  getFollowUpVisit,
};
