const openMrsDB = require("../public/javascripts/mysql/mysqlOpenMrs");
const {
  getVisitCountQueryForGp,
  getVisitCountQuery,
  locationQuery,
  doctorsQuery,
  getDoctorVisitsData,
  BaselineSurveyPatientsQuery,
} = require("./queries");
const { _getStatuses } = require("../services/user.service");
const {
  _getAwaitingVisits,
  _getPriorityVisits,
  _getInProgressVisits,
  _getCompletedVisits,
  setLocationTree,
} = require("../services/openmrs.service");

/**
 * To return the visit counts from the openmrs db using custom query
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
const getVisitCounts = async (req, res, next) => {
  const speciality = req.query.speciality;
  const query = getVisitCountQueryForGp();
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
    let states = setLocationTree(data);
    res.json({
      states,
      message: "Locations fetched successfully",
    });
  } catch (error) {
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};

const getStatus = (statuses = [], userUuid) => {
  let status = "Inactive";
  statuses.forEach((sts) => {
    if (
      sts.userUuid === userUuid &&
      ["active", "Active"].includes(sts.status)
    ) {
      status = "Active";
    }
  });
  return status;
};

const getDoctorVisits = async (req, res, next) => {
  try {
    const rawData = await new Promise((resolve, reject) => {
      openMrsDB.query(getDoctorVisitsData(), (err, results, fields) => {
        if (err) reject(err);
        resolve(results);
      });
    }).catch((err) => {
      throw err;
    });

    res.json({
      rawData,
      success: true,
    });
  } catch (error) {
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};

const getDoctorDetails = async (req, res, next) => {
  try {
    const rawData = await new Promise((resolve, reject) => {
      openMrsDB.query(doctorsQuery(), (err, results, fields) => {
        if (err) reject(err);
        resolve(results);
      });
    }).catch((err) => {
      throw err;
    });
    const statuses = await _getStatuses();
    let doctors = {};
    rawData.forEach((rData) => {
      if (!doctors[rData.person_id]) doctors[rData.person_id] = {};
      doctors[rData.person_id].person_id = rData.person_id;
      doctors[rData.person_id].givenName = rData.givenName;
      doctors[rData.person_id].gender = rData.gender;
      doctors[rData.person_id].uuid = rData.uuid;
      doctors[rData.person_id].userUuid = rData.userUuid;
      doctors[rData.person_id].status = getStatus(statuses, rData.userUuid);
      if (!doctors[rData.person_id].attributes)
        doctors[rData.person_id].attributes = {};
      if (rData.attrTypeName) {
        if (rData.attrTypeName === "timings") {
          const [startTime, endTime] = rData.value_reference.split(" - ");
          doctors[rData.person_id].attributes.startTime = startTime;
          doctors[rData.person_id].attributes.endTime = endTime;
        }
        doctors[rData.person_id].attributes[rData.attrTypeName] =
          rData.value_reference;
      }
    });
    const processedData = [];
    for (const i in doctors) {
      if (Object.hasOwnProperty.call(doctors, i)) {
        processedData.push(doctors[i]);
      }
    }
    res.json({
      success: true,
      count: processedData.length,
      data: processedData,
    });
  } catch (error) {
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};

const getBaselineSurveyPatients = async (req, res, next) => {
  try {
    if (validateParams(req.params, [{ key: "location_id", type: "string" }])) {
      const location_id = req.params.location_id;
      const data = await new Promise((resolve, reject) => {
        openMrsDB.query(
          BaselineSurveyPatientsQuery(location_id),
          (err, results, fields) => {
            if (err) reject(err);
            resolve(results);
          }
        );
      }).catch((err) => {
        throw err;
      });
      res.json({
        data,
        success: true,
      });
    }
  } catch (error) {
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};

const getAwaitingVisits = async (req, res, next) => {
  try {
    const data = await _getAwaitingVisits(
      req.query.state,
      req.query.speciality,
      req.query.page
    );
    res.json({
      count: data.length,
      data,
      success: true,
    });
  } catch (error) {
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};

const getPriorityVisits = async (req, res, next) => {
  try {
    const data = await _getPriorityVisits(
      req.query.state,
      req.query.speciality,
      req.query.page
    );
    res.json({
      count: data.length,
      data,
      success: true,
    });
  } catch (error) {
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};

const getInProgressVisits = async (req, res, next) => {
  try {
    const data = await _getInProgressVisits(
      req.query.state,
      req.query.speciality,
      req.query.page
    );
    res.json({
      count: data.length,
      data,
      success: true,
    });
  } catch (error) {
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};

const getCompletedVisits = async (req, res, next) => {
  try {
    const data = await _getCompletedVisits(
      req.query.state,
      req.query.speciality,
      req.query.page
    );
    res.json({
      count: data.length,
      data,
      success: true,
    });
  } catch (error) {
    res.statusCode = 422;
    res.json({ status: false, message: error.message });
  }
};

module.exports = {
  getVisitCounts,
  getLocations,
  getDoctorDetails,
  getDoctorVisits,
  getBaselineSurveyPatients,
  getAwaitingVisits,
  getPriorityVisits,
  getInProgressVisits,
  getCompletedVisits,
};