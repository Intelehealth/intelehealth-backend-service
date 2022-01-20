const openMrsDB = require("../public/javascripts/mysql/mysqlOpenMrs");
const {
  getVisitCountQueryForGp,
  getVisitCountQuery,
  locationQuery,
} = require("./queries");

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
      message: "Visit count fetched successfully",
    });
  } catch (error) {
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
    const data = await new Promise((resolve, reject) => {
      openMrsDB.query(locationQuery(), (err, results, fields) => {
        if (err) reject(err);
        resolve(results);
      });
    }).catch((err) => {
      throw err;
    });
    let states = data.filter((d) => d.tag === "State");
    if (states.length) {
      states = states.map((s) => {
        let districts = data.filter(
          (d) => d.parent === s.id && d.tag === "District"
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
    res.json({
      states,
      message: "Locations fetched successfully",
    });
  } catch (error) {
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};

module.exports = {
  getVisitCounts,
  getLocations,
};
