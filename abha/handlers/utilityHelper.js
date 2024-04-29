function convertDateToDDMMYYYY(inputFormat) {
    if (!inputFormat) return undefined
    function pad(s) { return (s < 10) ? '0' + s : s; }
    var d = new Date(inputFormat)
    return [pad(d.getDate()), pad(d.getMonth() + 1), d.getFullYear()].join('/')
}

function convertDateToYYYYMMDD(inputFormat) {
    if (!inputFormat) return undefined
    function pad(s) { return (s < 10) ? '0' + s : s; }
    var d = new Date(inputFormat)
    return [d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate())].join('-')
}

/**
  * Parse observation data
  * @param {any} data - Observation data
  * @return {any} - Observation data with parsed value
  */
function getData(data) {
    if (data?.value?.toString().startsWith("{")) {
        let value = JSON.parse(data.value.toString());
        data.value = value["en"];
    }
    return data;
}

function getIdentifierByName(identifiers = [], name) {
    return identifiers?.find((identifier) => identifier?.identifierType?.name === name)
}

function getAttributeByName(attributes = [], name) {
    return attributes?.find((attribute) => attribute?.attributeType?.display === name)
}

function getGender(gender) {
    if (gender === 'M') return "Male";
    if (gender === 'F') return "Female";
    return ''
}

function appendStr(existStr, newStr) {
    if (!existStr) return newStr;
    return existStr += `\n${newStr}`;
}

function getEncounters(encounters) {
    const visitTypes = {
        ASSOCIATED_SYMPTOMS: 'Associated symptoms',
        ADULTINITIAL: 'ADULTINITIAL',
        CURRENT_COMPLAINT: 'CURRENT COMPLAINT',
        FLAGGED: 'Flagged',
        VITALS: 'Vitals',
        VISIT_NOTE: 'Visit Note',
        MEDICAL_HISTORY: 'MEDICAL HISTORY',
        FAMILY_HISTORY: 'FAMILY HISTORY',
        PHYSICAL_EXAMINATION: 'PHYSICAL EXAMINATION',
        TELEMEDICINE_DIAGNOSIS: 'TELEMEDICINE DIAGNOSIS',
        JSV_MEDICATIONS: 'JSV MEDICATIONS',
        MEDICAL_ADVICE: 'MEDICAL ADVICE',
        REFERRAL: 'Referral',
        REQUESTED_TESTS: 'REQUESTED TESTS',
        ADDITIONAL_COMMENTS: 'Additional Comments',
        FOLLOW_UP_VISIT: 'Follow up visit',
        ATTACHMENT_UPLOAD: 'Attachment Upload',
        COMPLEX_IMAGE: "Complex Image"
    }
    let cheifComplaints = [],
        checkUpReasonData = [],
        physicalExaminationData = [],
        medicalHistoryData = [],
        familyHistoryData = [],
        medications, // JSV MEDICATIONS
        diagnosis, // TELEMEDICINE DIAGNOSIS
        investigationAdvice, // MEDICAL ADVICE
        referrals, // Referrals
        procedures, // REQUESTED TESTS
        otherObservations, // vitals
        documentReferences, // ATTACHMENT_UPLOAD
        folloupVisit;

    encounters?.forEach((enc) => {
        if (enc.encounterType.display === visitTypes.ADULTINITIAL) {
            enc.obs.forEach((obs) => {
                if (obs.concept.display === visitTypes.CURRENT_COMPLAINT) {
                    const currentComplaint = getData(obs)?.value.split('<b>');
                    for (let i = 0; i < currentComplaint.length; i++) {
                        if (currentComplaint[i] && currentComplaint[i].length > 1) {
                            const obs1 = currentComplaint[i].split('<');
                            if (!obs1[0].match(visitTypes.ASSOCIATED_SYMPTOMS)) {
                                cheifComplaints.push(obs1[0]);
                            }
                            const splitByBr = currentComplaint[i].split('<br/>');
                            if (splitByBr[0].includes(visitTypes.ASSOCIATED_SYMPTOMS)) {
                                for (let j = 1; j < splitByBr.length; j = j + 2) {
                                    if (splitByBr[j].trim() && splitByBr[j].trim().length > 1) {
                                        const key = splitByBr[j].replace('• ', '').replace(' -', '');
                                        const value = splitByBr[j + 1];
                                        const title = visitTypes.ASSOCIATED_SYMPTOMS;
                                        checkUpReasonData.push(`${title}:${key}:${value}`);
                                    }
                                }
                            } else {
                                for (let k = 1; k < splitByBr.length; k++) {
                                    if (splitByBr[k].trim() && splitByBr[k].trim().length > 1) {
                                        const splitByDash = splitByBr[k].split('-');
                                        const key = splitByDash[0].replace('• ', '');
                                        const value = splitByDash.slice(1, splitByDash.length).join('-');
                                        const title = splitByBr[0].replace('</b>:', '');
                                        checkUpReasonData.push(`${title}:${key}:${value}`);
                                    }
                                }
                            }
                        }
                    }
                } else if (obs.concept.display === visitTypes.PHYSICAL_EXAMINATION) {
                    const physicalExam = getData(obs)?.value.replace(new RegExp('<br/>►', 'g'), '').split('<b>');
                    for (let i = 0; i < physicalExam.length; i++) {
                        if (physicalExam[i]) {
                            const splitByBr = physicalExam[i].split('<br/>');
                            const title = splitByBr[0].replace('</b>', '').replace(':', '').trim();
                            if (splitByBr[0].includes('Abdomen')) {
                                for (let k = 1; k < splitByBr.length; k++) {
                                    if (splitByBr[k].trim()) {
                                        const key = splitByBr[k].replace('• ', '');
                                        physicalExaminationData.push(`${title}:${key}`);
                                    }
                                }
                            } else {
                                for (let k = 1; k < splitByBr.length; k++) {
                                    if (splitByBr[k].trim()) {
                                        const splitByDash = splitByBr[k].split('-');
                                        const key = splitByDash[0].replace('• ', '');
                                        const value = splitByDash.slice(1, splitByDash.length).join('-');
                                        physicalExaminationData.push(`${title}:${key}:${value}`);
                                    }
                                }
                            }
                        }
                    }
                } else if (obs.concept.display === visitTypes.MEDICAL_HISTORY) {
                    const medicalHistory = getData(obs)?.value.split('<br/>');
                    for (let i = 0; i < medicalHistory.length; i++) {
                        if (medicalHistory[i]) {
                            const splitByDash = medicalHistory[i].split('-');
                            const key = splitByDash[0].replace('• ', '').trim();
                            const value = splitByDash.slice(1, splitByDash.length).join('-').trim();
                            medicalHistoryData.push(`${key}:${value}`);
                        }
                    }
                } else if (obs.concept.display === visitTypes.FAMILY_HISTORY) {
                    const familyHistory = getData(obs)?.value.split('<br/>');
                    for (let i = 0; i < familyHistory.length; i++) {
                        if (familyHistory[i]) {
                            if (familyHistory[i].includes(':')) {
                                const splitByColon = familyHistory[i].split(':');
                                const splitByDot = splitByColon[1].trim().split("•");
                                splitByDot.forEach(element => {
                                    if (element.trim()) {
                                        const splitByComma = element.split(',');
                                        const key = splitByComma.shift().trim();
                                        const value = splitByComma.length ? splitByComma.toString().trim() : " ";
                                        medicalHistoryData.push(`${key}:${value}`);
                                    }
                                });
                            } else {
                                const key = familyHistory[i].replace('•', '').trim();
                                medicalHistoryData.push(`${key}`);
                            }
                        }
                    }
                } else if (obs.concept.display === visitTypes.COMPLEX_IMAGE) {
                    documentReferences = appendStr(documentReferences, `https://${process.env.DOMAIN}/openmrs/ws/rest/v1/obs/${obs.uuid}/value`)
                }
            });
        } else if (enc.encounterType.display === visitTypes.VITALS) {
            enc.obs.forEach((obs) => {
                otherObservations = appendStr(otherObservations, obs.display);
            });
        } else if (enc.encounterType.display === visitTypes.VISIT_NOTE) {
            enc.obs.forEach((obs) => {
                if (obs.concept.display === visitTypes.FOLLOW_UP_VISIT) {
                    folloupVisit = obs.value;
                } else if (obs.concept.display === visitTypes.JSV_MEDICATIONS) {
                    medications = appendStr(medications, obs.value);
                } else if (obs.concept.display === visitTypes.REFERRAL) {
                    referrals = appendStr(referrals, obs.value);
                } else if (obs.concept.display === visitTypes.TELEMEDICINE_DIAGNOSIS) {
                    diagnosis = appendStr(diagnosis, obs.value);
                } else if (obs.concept.display === visitTypes.MEDICAL_ADVICE) {
                    investigationAdvice = appendStr(investigationAdvice, obs.value);
                } else if (obs.concept.display === visitTypes.REQUESTED_TESTS) {
                    procedures = appendStr(procedures, obs.value);
                }
            })
        } else if (enc.encounterType.display === visitTypes.ATTACHMENT_UPLOAD) {
            enc.obs.forEach((obs) => {
                documentReferences = appendStr(documentReferences, `https://${process.env.DOMAIN}/openmrs/ws/rest/v1/obs/${obs.uuid}/value`)
            })
        }
    });

    let Procedure = diagnosis ?? procedures ?? undefined;
    if (diagnosis && procedures) Procedure = `${diagnosis}\n${procedures}`;
    const ChiefComplaints = [...cheifComplaints, ...checkUpReasonData];
    return {
        ChiefComplaints: ChiefComplaints.length ? ChiefComplaints?.join('\n') : undefined,
        PhysicalExamination: physicalExaminationData?.length ? physicalExaminationData.join('\n') : undefined,
        MedicalHistory: medicalHistoryData?.length ? medicalHistoryData.join('\n') : undefined,
        FamilyHistory: familyHistoryData?.length ? familyHistoryData.join('\n') : undefined,
        Medications: medications ?? undefined,
        InvestigationAdvice: investigationAdvice ?? undefined,
        Referral: referrals ?? undefined,
        Procedure: Procedure,
        OtherObservations: otherObservations ?? undefined,
        DocumentReference: documentReferences ?? undefined,
        FollowUp: folloupVisit,
        Allergies: undefined,
    }
}

function getDoctorDetail(encounters) {
    const encounter = encounters?.find((encounter) => ["Visit Complete", "Visit Note"].includes(encounter?.encounterType?.display));
    const doctor = encounter?.encounterProviders?.[0]?.provider;
    return {
        "name": doctor?.person?.display ?? '',
        "gender": getGender(doctor?.person?.gender),
        "practitioner_id": doctor?.uuid ?? '',
        "telecom": getAttributeByName(doctor?.attributes, 'phoneNumber')?.value ?? '',
    }
}

function formatCareContextResponse(response) {
    const patientTelecom = getAttributeByName(response?.patient?.attributes, 'Telephone Number');
    const formattedResponse = {
        "patient": {
            "name": response?.patient?.person?.display,
            "gender": getGender(response?.patient?.person?.gender),
            "patient_id": getIdentifierByName(response?.patient?.identifiers, 'OpenMRS ID')?.identifier,
            "telecom": patientTelecom?.value === 'NA' ? null : patientTelecom?.value,
        },
        "practitioner": getDoctorDetail(response?.encounters),
        "date": convertDateToYYYYMMDD(response?.startDatetime),
        ...getEncounters(response?.encounters)
    };

    return formattedResponse;
}

module.exports = {
    convertDateToDDMMYYYY,
    formatCareContextResponse
}