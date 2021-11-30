const openMrsDB = require("../public/javascripts/mysql/mysqlOpenMrs");
const { getVisitCountQueryForGp, getVisitCountQuery } = require("./queries");

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
            const villages = data.filter(
              (v) => v.parent === d.id && v.tag === "Village"
            );
            return { name: d.name, villages: villages.map((v) => v.name) };
          });
        }

        return {
          name: s.name,
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
