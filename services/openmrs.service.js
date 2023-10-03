const { QueryTypes } = require("sequelize");
const { getVisitCountV3, getVisitScore } = require("../controllers/queries");
const {
    visit,
    encounter,
    patient_identifier,
    person_name,
    encounter_type,
    encounter_provider,
    person,
    provider,
    visit_attribute,
    visit_attribute_type,
    obs,
    concept,
    concept_name,
    Sequelize,
    sequelize
} = require("../openmrs_models");
const { forEach } = require("lodash");
const Op = Sequelize.Op;
const openMrsDB = require("../public/javascripts/mysql/mysqlOpenMrs");
module.exports = (function () {

    this.getVisits = async (type, limit, offset) => {
        if (!type) {
            return [];
        } else {
            // let visits = await sequelize.query(getVisitCountV3(), {
            //     type: QueryTypes.SELECT,
            // });
            let query = getVisitCountV3();
            let visits = await new Promise((resolve, reject) => {
                openMrsDB.query(query, (err, results, fields) => {
                    if (err) reject(err);
                    resolve(results);
                });
            }).catch((err) => {
                throw err;
            });
            let filteredVisits = Array.isArray(visits) ? visits.filter((v) => v?.Status === (type === 'Priority'? 'Visit In Progress': type)) : [];
            
            if (Array.isArray(filteredVisits)) {
                for (let i = 0; i < filteredVisits.length; i++) {
                    // const obs = await sequelize.query(getVisitScore(filteredVisits[i].max_enc), {
                    //     type: QueryTypes.SELECT,
                    // });
                    let query2 = getVisitScore(filteredVisits[i].max_enc);
                    const obs = await new Promise((resolve, reject) => {
                        openMrsDB.query(query2, (err, results, fields) => {
                            if (err) reject(err);
                            resolve(results);
                        });
                    }).catch((err) => {
                        throw err;
                    });
                    filteredVisits[i].score = obs.length ? obs[0].total_score : 0;
                }
            }
            if (type === "Priority" || type === "Visit In Progress") {
                if (type === "Priority") {
                    return Array.isArray(filteredVisits) ? filteredVisits.filter((v) => v.score > 22).map((v) => { return { visit_id: v?.visit_id, score: v?.score } }) : [];
                }
                if (type === "Visit In Progress") {
                    return Array.isArray(filteredVisits) ? filteredVisits.filter((v) => v.score <= 22).map((v) => { return { visit_id: v?.visit_id, score: v?.score } }) : [];
                }
            } else {
                return Array.isArray(filteredVisits) ? filteredVisits.map((v) => { return { visit_id: v?.visit_id, score: v?.score } }) : [];
            }
        }
    };

    this.getCompVisits = async (limit, offset) => {
        // let visits = await sequelize.query(getVisitCountV3(), {
        //     type: QueryTypes.SELECT,
        // });
        let query = getVisitCountV3();
        let visits = await new Promise((resolve, reject) => {
            openMrsDB.query(query, (err, results, fields) => {
                if (err) reject(err);
                resolve(results);
            });
        }).catch((err) => {
            throw err;
        });
        let filteredVisits = Array.isArray(visits) ? visits.filter((v) => v?.Status === 'Completed Visit') : [];
        let currentPageVisits = [...filteredVisits.slice(offset, offset + limit)];
        if (Array.isArray(currentPageVisits)) {
            for (let i = 0; i < currentPageVisits.length; i++) {
                // const obs = await sequelize.query(getVisitScore(currentPageVisits[i].max_enc), {
                //     type: QueryTypes.SELECT,
                // });
                let query2 = getVisitScore(filteredVisits[i].max_enc);
                const obs = await new Promise((resolve, reject) => {
                    openMrsDB.query(query2, (err, results, fields) => {
                        if (err) reject(err);
                        resolve(results);
                    });
                }).catch((err) => {
                    throw err;
                });
                currentPageVisits[i].score = obs.length ? obs[0].total_score : 0;
            }
        }
        return Array.isArray(currentPageVisits) ? { visits: [...currentPageVisits.map((v) => { return { visit_id: v?.visit_id, score: v?.score } })], totalCount: filteredVisits.length } : { visits: [], totalCount: filteredVisits.length };
    };

    /**
     * Encounter type
     * 1 - ADULTINITIAL
     * 6 - Vitals
     * 9 - Visit Note
     * 12 - Patient Exit Survey
     * 14 - Visit Complete
     * 15 - Flagged
     * 100 -159 Stage Encounters
     */
    this.getVisitsByType = async (
        type,
        page = 1,
        limit = 1000
    ) => {
        try {
            let offset = limit * (page - 1);

            if (limit > 5000) limit = 5000;
            const visitIds = await this.getVisits(type, limit, offset);
            
            let visits = await visit.findAll({
                attributes: ["uuid", "date_stopped", "date_started", "voided"],
                where: {
                    visit_id: { [Op.in]: visitIds.map((v) => v?.visit_id) },
                },
                include: [
                    {
                        model: encounter,
                        as: "encounters",
                        attributes: ["encounter_datetime","uuid","voided"],
                        order: [["encounter_id","DESC"]],
                        include: [
                            {
                                model: obs,
                                as: "obs",
                                attributes: ["value_text", "value_numeric", "comments","uuid","voided"],
                                include: [
                                    {
                                        model: concept,
                                        as: "concept",
                                        attributes: ["uuid"],
                                        include: [
                                            {
                                                model: concept_name,
                                                as: "concept_name",
                                                attributes: ["name","voided"]
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                model: encounter_type,
                                as: "type",
                                attributes: ["name"],
                            },
                            {
                                model: encounter_provider,
                                as: "encounter_provider",
                                attributes: ["uuid","voided"],
                                include: [
                                    {
                                        model: provider,
                                        as: "provider",
                                        attributes: ["identifier", "uuid"],
                                        include: [
                                            {
                                                model: person,
                                                as: "person",
                                                attributes: ["gender"],
                                                include: [
                                                    {
                                                        model: person_name,
                                                        as: "person_name",
                                                        attributes: ["given_name", "family_name"],
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                    {
                      model: visit_attribute,
                      as: "attributes",
                      attributes: ["value_reference","uuid","voided"],
                      include: [
                        {
                            model: visit_attribute_type,
                            as: "attribute_type",
                            attributes: ["name","uuid"]
                        }
                      ]
                    },
                    {
                        model: patient_identifier,
                        as: "patient",
                        attributes: ["identifier"],
                    },
                    {
                        model: person_name,
                        as: "patient_name",
                        attributes: ["given_name", "family_name"],
                    },
                    {
                        model: person,
                        as: "person",
                        attributes: ["uuid", "gender", "birthdate"],
                    }
                ],
                order: [["visit_id", "DESC"]],
                limit,
                offset
            });
            const currentPageVisitIds = visitIds.slice(offset, offset+limit).map(o => { return { score: o.score } });
            const visitsData = visits.map((v) => v.get({ plain: true })); 
            const finalarr = visitsData.map((item, i) => Object.assign({}, item, currentPageVisitIds[i]));
            return { totalCount: visitIds.length, currentCount: visits.length, visits: finalarr };
        } catch (error) {
            throw error;
        }
    };

    this.getCompletedTypeVisits = async (
        page = 1,
        limit = 1000
    ) => {
        try {
            let offset = limit * (page - 1);

            if (limit > 5000) limit = 5000;
            const compVisits = await this.getCompVisits(limit, offset);
            const visitIds = compVisits.visits;
            const totalCount = compVisits.totalCount;
            let visits = await visit.findAll({
                attributes: ["uuid", "date_stopped", "date_started", "voided"],
                where: {
                    visit_id: { [Op.in]: [...visitIds.map((v) => v?.visit_id)] },
                },
                include: [
                    {
                        model: encounter,
                        as: "encounters",
                        attributes: ["encounter_datetime","uuid","voided"],
                        order: [["encounter_id","DESC"]],
                        include: [
                            {
                                model: obs,
                                as: "obs",
                                attributes: ["value_text", "value_numeric", "comments","uuid","voided"],
                                include: [
                                    {
                                        model: concept,
                                        as: "concept",
                                        attributes: ["uuid"],
                                        include: [
                                            {
                                                model: concept_name,
                                                as: "concept_name",
                                                attributes: ["name","voided"]
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                model: encounter_type,
                                as: "type",
                                attributes: ["name"],
                            },
                            {
                                model: encounter_provider,
                                as: "encounter_provider",
                                attributes: ["uuid","voided"],
                                include: [
                                    {
                                        model: provider,
                                        as: "provider",
                                        attributes: ["identifier", "uuid"],
                                        include: [
                                            {
                                                model: person,
                                                as: "person",
                                                attributes: ["gender"],
                                                include: [
                                                    {
                                                        model: person_name,
                                                        as: "person_name",
                                                        attributes: ["given_name", "family_name"],
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                    {
                      model: visit_attribute,
                      as: "attributes",
                      attributes: ["value_reference","uuid","voided"],
                      include: [
                        {
                            model: visit_attribute_type,
                            as: "attribute_type",
                            attributes: ["name","uuid"]
                        }
                      ]
                    },
                    {
                        model: patient_identifier,
                        as: "patient",
                        attributes: ["identifier"],
                    },
                    {
                        model: person_name,
                        as: "patient_name",
                        attributes: ["given_name", "family_name"],
                    },
                    {
                        model: person,
                        as: "person",
                        attributes: ["uuid", "gender", "birthdate"],
                    }
                ],
                order: [["visit_id", "DESC"]]
            });

            const visitsData = visits.map((v) => v.get({ plain: true })); 
            const finalarr = visitsData.map((item, i) => Object.assign({}, item, visitIds[i]));
            return { totalCount: totalCount, currentCount: visits.length, visits: finalarr };
        } catch (error) {
            throw error;
        }
    };

    this._getPriorityVisits = async (
        page = 1,
        limit = 1000
    ) => {
        try {
            return await this.getVisitsByType(
                "Priority",
                page,
                limit
            );
        } catch (error) {
            throw error;
        }
    };

    this._getInProgressVisits = async (
        page = 1,
        limit = 1000
    ) => {
        try {
            return await this.getVisitsByType(
                "Visit In Progress",
                page,
                limit
            );
        } catch (error) {
            throw error;
        }
    };

    this._getCompletedVisits = async (
        page = 1,
        limit = 1000
    ) => {
        try {
            return await this.getCompletedTypeVisits(
                page,
                limit
            );
        } catch (error) {
            throw error;
        }
    };

    return this;
})();