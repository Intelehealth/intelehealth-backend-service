const { OBSERVATION_TYPE, VISIT_TYPES, RELATIONS } = require("../constants/abha.constants");
const { uuid } = require('uuidv4');
const { logStream } = require("../logger");
const { downloadPrescription } = require("./pdfHelper");

function convertDateToDDMMYYYY(inputFormat) {
    if (!inputFormat) return undefined
    function pad(s) { return (s < 10) ? '0' + s : s; }
    var d = new Date(inputFormat)
    return [pad(d.getDate()), pad(d.getMonth() + 1), d.getFullYear()].join('/')
}

function convertDataToISO(input) {
    try {
        const date = new Date(input)
        return date?.toISOString()
    } catch (e) {
        return input
    }
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

function handleError(error) {
    if (error?.data?.message) {
        return error.data;
    } else if ((error?.data?.error && typeof error?.data?.error === 'string')) {
        return { message: error.data.error }
    } else if (error?.data?.error && typeof error?.data?.error !== 'string') {
        return error.data.error;
    } else if (error?.response?.data?.error && typeof error?.response?.data?.error != 'string') {
        return error.response.data.error;
    } else if (error?.response?.data) {
        return (typeof error?.response?.data == 'string') ? { message: error.response.data } : error.response.data;
    } else if (error?.message) {
        return { message: error.message }
    }
    return new Error('Something went wrong!');
}

// Get the doctor details
function getDoctorDetail(encounters) {
    const encounter = encounters?.find((encounter) => ["Visit Complete", "Visit Note"].includes(encounter?.encounterType?.display));
    const doctor = encounter?.encounterProviders?.[0]?.provider;
    if (!doctor) return;
    
    return {
        "encounterDatetime": encounter?.encounterDatetime,
        "name": doctor?.person?.display ?? '',
        "gender": getGender(doctor?.person?.gender),
        "practitioner_id": doctor?.uuid ?? '',
        "person_uuid": doctor?.person?.uuid ?? '',
        "typeOfProfession": doctor?.typeOfProfession,
        "telecom": getAttributeByName(doctor?.attributes, 'phoneNumber')?.value ?? '',
        "dateUpdated": doctor?.person?.dateUpdated ?? doctor?.person?.dateCreated,
        "registrationNumber": getAttributeByName(doctor?.attributes, 'registrationNumber')?.value ?? '',
        "signature": getAttributeByName(doctor?.attributes, 'signature')?.value ?? ''
    }
}

// Cheif Complaints
function cheifComplaintStructure(obs, cheifComplaints, practitioner, patient) {
    const currentComplaint = getData(obs)?.value.split('<b>');
    if (!currentComplaint.length) return;
    const complaints = []
    for (let i = 0; i < currentComplaint.length; i++) {
        if (currentComplaint[i] && currentComplaint[i].length > 1) {
            const obs1 = currentComplaint[i].split('<');
            if (!obs1[0].match(VISIT_TYPES.ASSOCIATED_SYMPTOMS)) {
                cheifComplaints.section.entry.push({
                    "reference": `Condition/${obs.uuid}`
                })
                complaints.push(obs1[0]);
            }
            const splitByBr = currentComplaint[i].split('<br/>');
            if (splitByBr[0].includes(VISIT_TYPES.ASSOCIATED_SYMPTOMS)) {
                for (let j = 1; j < splitByBr.length; j = j + 2) {
                    if (splitByBr[j].trim() && splitByBr[j].trim().length > 1) {
                        const key = splitByBr[j].replace('• ', '').replace(' -', '');
                        const value = splitByBr[j + 1];
                        const title = VISIT_TYPES.ASSOCIATED_SYMPTOMS;
                        complaints.push(`${title} ${key} ${value}`);
                    }
                }
            } else {
                for (let k = 1; k < splitByBr.length; k++) {
                    if (splitByBr[k].trim() && splitByBr[k].trim().length > 1) {
                        const splitByDash = splitByBr[k].split('-');
                        const key = splitByDash[0].replace('• ', '');
                        const value = splitByDash.slice(1, splitByDash.length).join('-');
                        const title = splitByBr[0].replace('</b>:', '');
                        complaints.push(`${title} ${key} ${value}`);
                    }
                }
            }
        }
    }
    cheifComplaints?.conditions.push({
        "resource": {
            "code": {
                "text": complaints.join(', ')
            },
            "onsetPeriod": {
                "start": convertDataToISO(obs.obsDatetime)
            },
            "subject": {
                "reference": `Patient/${patient?.uuid}`
            },
            "recordedDate": convertDataToISO(obs.obsDatetime),
            "id": obs.uuid,
            "clinicalStatus": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                        "code": "active",
                        "display": "active"
                    }
                ],
                "text": "COMPLAIN"
            },
            "category": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/condition-category",
                            "code": "problem-list-item",
                            "display": "Problem List Item"
                        }
                    ],
                    "text": "problem list"
                }
            ],
            "resourceType": "Condition"
        },
        "fullUrl": `Condition/${obs.uuid}`
    })
}

// Vitals
function physicalExaminationVitalStructure(obs, physicalExaminationData) {
    physicalExaminationData.section.entry.push({
        "reference": `Observation/${OBSERVATION_TYPE[obs.concept?.display]?.type}${obs.uuid}`
    });
    physicalExaminationData.observations.push(
        {
            "resource": {
                "code": {
                    "text": OBSERVATION_TYPE[obs.concept?.display]?.name ?? obs.concept?.display
                },
                "effectiveDateTime": convertDataToISO(obs.obsDatetime),
                "id": `${OBSERVATION_TYPE[obs.concept?.display]?.type}${obs.uuid}`,
                "resourceType": "Observation",
                "status": "final",
                "valueQuantity": {
                    "unit": OBSERVATION_TYPE[obs.concept?.display]?.unit,
                    "value": obs.value
                }
            },
            "fullUrl": `Observation/${OBSERVATION_TYPE[obs.concept?.display]?.type}${obs.uuid}`
        },
    )
    return physicalExaminationData
}

// Physical Examination of others
function physicalExaminationStructure(obs, physicalExaminationData) {
    const physicalExam = getData(obs)?.value.replace(new RegExp('<br/>►', 'g'), '').split('<b>');
    if (!physicalExam.length) return;
    const pyshicalExaminate = []
    for (let i = 0; i < physicalExam.length; i++) {
        if (physicalExam[i]) {
            const splitByBr = physicalExam[i].split('<br/>');
            const title = splitByBr[0].replace('</b>', '').replace(':', '').trim();
            if (splitByBr[0].includes('Abdomen')) {
                for (let k = 1; k < splitByBr.length; k++) {
                    if (splitByBr[k].trim()) {
                        const key = splitByBr[k].replace('• ', '');
                        pyshicalExaminate.push(`${title} ${key}`);
                    }
                }
            } else {
                for (let k = 1; k < splitByBr.length; k++) {
                    if (splitByBr[k].trim()) {
                        const splitByDash = splitByBr[k].split('-');
                        const key = splitByDash[0].replace('• ', '');
                        const value = splitByDash.slice(1, splitByDash.length).join('-');
                        pyshicalExaminate.push(`${title} ${key} ${value}`);
                    }
                }
            }
        }
    }
    physicalExaminationData.section.entry.push({
        "reference": `Observation/${obs.uuid}`
    });
    physicalExaminationData.observations.push(
        {
            "resource": {
                "code": {
                    "text": pyshicalExaminate.join(', ')
                },
                "effectiveDateTime": convertDataToISO(obs.obsDatetime),
                "id": `${obs.uuid}`,
                "resourceType": "Observation",
                "status": "final"
            },
            "fullUrl": `Observation/${obs.uuid}`
        },
    )
    return physicalExaminationData
}

// Patient Medical History
function medicalHistoryStructure(obs, medicalHistoryData, practitioner, patient) {
    const medicalHistory = getData(obs)?.value.split('<br/>');
    if (!medicalHistory.length) return;
    const history = [];
    for (let i = 0; i < medicalHistory.length; i++) {
        if (medicalHistory[i]) {
            const splitByDash = medicalHistory[i].split('-');
            const key = splitByDash[0].replace('• ', '').trim();
            const value = splitByDash.slice(1, splitByDash.length).join('-').trim();
            history.push(`${key}:${value}`);
        }
    }
    medicalHistoryData.section.entry.push({
        "reference": `Condition/${obs.uuid}`
    })

    medicalHistoryData.conditions.push({
        "resource": {
            "code": {
                "text": history.join(', ')
            },
            "onsetPeriod": {
                "start": convertDataToISO(obs.obsDatetime)
            },
            "subject": {
                "reference": `Patient/${patient?.uuid}`
            },
            "recordedDate": convertDataToISO(obs.obsDatetime),
            "id": obs.uuid,
            "clinicalStatus": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                        "code": "active",
                        "display": "active"
                    }
                ],
                "text": "HISTORY"
            },
            "category": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/condition-category",
                            "code": "problem-list-item",
                            "display": "Problem List Item"
                        }
                    ],
                    "text": "problem list"
                }
            ],
            "resourceType": "Condition"
        },
        "fullUrl": `Condition/${obs.uuid}`
    })
}

// Family Member medical history
function medicalFamilyHistoryStructure(obs, familyHistoryData, practitioner, patient) {
    const familyHistory = getData(obs)?.value.split('<br/>');
    if (!familyHistory.length) return;
    const relationMap = {};
    for (let i = 0; i < familyHistory.length; i++) {
        if (familyHistory[i] && familyHistory[i].includes(':')) {
            const splitByColon = familyHistory[i].split(':');
            const splitByDot = splitByColon[1].trim().split("•");
            splitByDot.forEach(element => {
                if (element.trim() && !element.includes('None.')) {
                    const splitByComma = element.split(',');
                    const key = splitByComma.shift().trim();
                    if (splitByComma?.length) {
                        for (const value of splitByComma) {
                            const relation = value?.replace(/[^a-zA-Z]/g, '')?.trim()?.toLowerCase();

                            if (!RELATIONS[relation]) continue;

                            if (!relationMap[relation]) {
                                relationMap[relation] = key
                            } else {
                                relationMap[relation] += `, ${key}`;
                            }
                        }
                    }
                }
            });
        } else if (familyHistory[i]) {
            // console.log("er", familyHistory)
            // const key = familyHistory[i].replace('•', '').trim();
        }
    }

    const relations = Object.keys(relationMap);

    if (!relations?.length) return;

    for (const key of relations) {
        const uniquId = uuid()
        familyHistoryData.section.entry.push({
            "reference": `FamilyMemberHistory/${uniquId}`
        })
        familyHistoryData.conditions.push({
            "resource": {
                "text": {
                    "status": "generated",
                    "div": `<div xmlns=\"http://www.w3.org/1999/xhtml\">${RELATIONS[key].name} is having ${relationMap[key]}.</div>`
                },
                "patient": {
                    "reference": `Patient/${patient?.uuid}`,
                    "display": patient?.person?.display
                },
                "status": "completed",
                "id": uniquId,
                "relationship": {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                            "code": RELATIONS[key].code,
                            "display": key
                        }
                    ]
                },
                "condition": [
                    {
                        "code": {
                            "coding": [
                                {
                                    "system": "http://snomed.info/sct",
                                    "code": "261665006",
                                    "display": "Unknown"
                                }
                            ],
                            "text": relationMap[key]
                        },
                        // "contributedToDeath": true,
                        // "onsetAge": {
                        //     "value": 84,
                        //     "unit": "yr",
                        //     "system": "http://unitsofmeasure.org",
                        //     "code": "a"
                        // }
                    }
                ],
                "meta": {
                    "profile": [
                        "https://nrces.in/ndhm/fhir/r4/StructureDefinition/FamilyMemberHistory"
                    ]
                },
                "resourceType": "FamilyMemberHistory"
            },
            "fullUrl": `FamilyMemberHistory/${uniquId}`
        })
    }
}

// Followup Structure
function followUPStructure(obs, folloupVisit, practitioner, patient) {
    if (!obs.value || obs.value?.toLowerCase() === 'no') return;
    try {
        const [date, time, remark = 'N/A'] = obs.value.split(',');
        const startDate = new Date(date + " " + time.replace('Time:', '').trim());
        folloupVisit.section.entry.push({
            "reference": `Appointment/${obs.uuid}`
        });
        folloupVisit.followUp.push({
            "resource": {
                "resourceType": "Appointment",
                "id": obs.uuid,
                "meta": {
                    "profile": [
                        "https://nrces.in/ndhm/fhir/r4/StructureDefinition/Appointment"
                    ]
                },
                "text": {
                    "status": "generated",
                    "div": `<div xmlns=\"http://www.w3.org/1999/xhtml\">Follow up for further consultation</div>`
                },
                "status": "booked",
                "serviceCategory": [
                    {
                        "coding": [
                            {
                                "system": "http://snomed.info/sct",
                                "code": "408443003",
                                "display": "General medical practice"
                            }
                        ]
                    }
                ],
                "serviceType": [
                    {
                        "coding": [
                            {
                                "system": "http://snomed.info/sct",
                                "code": "11429006",
                                "display": "Consultation"
                            }
                        ]
                    }
                ],
                "appointmentType": {
                    "coding": [
                        {
                            "system": "http://snomed.info/sct",
                            "code": "185389009",
                            "display": "Follow-up visit"
                        }
                    ]
                },
                "description": remark?.trim(),
                "start": startDate,
                "end": startDate,
                "created": convertDataToISO(obs.obsDatetime),
                "participant": [
                    {
                        "actor": {
                            "reference": `Patient/${patient.uuid}`
                        },
                        "status": "accepted"
                    },
                    {
                        "actor": {
                            "reference": `Practitioner/${practitioner.practitioner_id}`
                        },
                        "status": "accepted"
                    }
                ]
            },
            "fullUrl": `Appointment/${obs.uuid}`
        });
    } catch (err) {
        logStream("error", err?.message);
    }
}

// Medications
function medicationStructure(obs, medications, practitioner, patient) {
    const obsValue = obs.value?.split(':');
    let dosageInstruction = '';
    if (obsValue?.[1]) dosageInstruction += obsValue?.[1];
    if (obsValue?.[3]) dosageInstruction += ` (${obsValue?.[3]}) Aa Day`;
    if (obsValue?.[2]) dosageInstruction += ` (Duration:${obsValue?.[2]})`;
    if (obsValue?.[4]) dosageInstruction += ` Remark: ${obsValue?.[4]}`;

    medications.section.entry.push({
        "reference": `MedicationRequest/${obs.uuid}`
    })

    medications.medicationRequest.push({
        "resource": {
            "requester": {
                "reference": `Practitioner/${practitioner?.practitioner_id}`
            },
            "medicationCodeableConcept": {
                "text": obsValue?.[0]
            },
            "authoredOn": convertDataToISO(obs.obsDatetime),
            "dosageInstruction": [
                {
                    "text": dosageInstruction != '' ? dosageInstruction : 'N/A'
                }
            ],
            "subject": {
                "reference": `Patient/${patient?.uuid}`
            },
            "id": obs.uuid,
            "intent": "order",
            "resourceType": "MedicationRequest",
            "status": "active"
        },
        "fullUrl": `MedicationRequest/${obs.uuid}`
    })
}

// Investigation Advice
function investigationAdviceStructure(obs, serviceRequest, practitioner, patient) {
    serviceRequest.section.entry.push({
        "reference": `ServiceRequest/${obs.uuid}`
    })
    serviceRequest.requests.push({
        "resource": {
            "requester": {
                "reference": `Practitioner/${practitioner?.practitioner_id}`
            },
            "code": {
                "text": obs.value
            },
            "authoredOn": convertDataToISO(obs.obsDatetime),
            "subject": {
                "reference": `Patient/${patient?.uuid}`
            },
            "id": obs.uuid,
            "category": [
                {
                    "coding": [
                        {
                            "system": "http://snomed.info/sct",
                            "code": "721963009",
                            "display": "Order document"
                        }
                    ]
                }
            ],
            "intent": "order",
            "resourceType": "ServiceRequest",
            "status": "active"
        },
        "fullUrl": `ServiceRequest/${obs.uuid}`
    })
}

// Investigation Advice
function referalStructure(obs, serviceRequest, practitioner, patient) {
    serviceRequest.section.entry.push({
        "reference": `ServiceRequest/${obs.uuid}`
    })
    const [referTo = '', referFacility = '', referPriority = '', referReason = ''] = obs.value?.split(':');
    serviceRequest.requests.push({
        "resource": {
            "requester": {
                "reference": `Practitioner/${practitioner?.practitioner_id}`
            },
            "code": {
                "text": `Referral to: ${referTo}, Referral facility: ${referFacility}, Priority of Referral: ${referPriority}, Referral for (Reason): ${referReason}`
            },
            "authoredOn": convertDataToISO(obs.obsDatetime),
            "subject": {
                "reference": `Patient/${patient?.uuid}`
            },
            "id": obs.uuid,
            "category": [
                {
                    "coding": [
                        {
                            "system": "http://snomed.info/sct",
                            "code": "306206005",
                            "display": "Referral to service"
                        },
                    ]
                }
            ],
            "intent": "order",
            "resourceType": "ServiceRequest",
            "status": "active"
        },
        "fullUrl": `ServiceRequest/${obs.uuid}`
    })
}

function getEncountersFHIBundle(encounters, practitioner, patient) {

    let cheifComplaints = {
        section: {
            "entry": [],
            "code": {
                "coding": [
                    {
                        "system": "http://snomed.info/sct",
                        "code": "422843007",
                        "display": "Chief complaint section"
                    }
                ]
            },
            "title": "Chief Complaints"
        },
        conditions: []
    },
        physicalExaminationData = {
            section: {
                "entry": [],
                "code": {
                    "coding": [
                        {
                            "system": "http://snomed.info/sct",
                            "code": "425044008",
                            "display": "Physical exam section"
                        }
                    ]
                },
                "title": "Physical Examination"
            },
            observations: [] // TELEMEDICINE DIAGNOSIS, VITALS
        },
        medicalHistoryData = {
            section: {
                "entry": [],
                "code": {
                    "coding": [
                        {
                            "system": "http://snomed.info/sct",
                            "code": "417662000",
                            "display": "Past medical history"
                        }
                    ]
                },
                "title": "Medical History"
            },
            conditions: []
        },
        familyHistoryData = {
            section: {
                "entry": [],
                "code": {
                    "coding": [
                        {
                            "system": "http://snomed.info/sct",
                            "code": "422432008",
                            "display": "Family history section"
                        }
                    ]
                },
                "title": "Family History"
            },
            conditions: []
        },
        medications = {
            section: {
                "entry": [],
                "code": {
                    "coding": [
                        {
                            "system": "http://snomed.info/sct",
                            "code": "721912009",
                            "display": "Medication summary document"
                        }
                    ]
                },
                "title": "Medications"
            },
            medicationRequest: []
        }, // JSV MEDICATIONS
        serviceRequest = {
            section: {
                "entry": [
                ],
                "code": {
                    "coding": [
                        {
                            "system": "http://snomed.info/sct",
                            "code": "261665006",
                            "display": "Unknown"
                        },
                    ]
                },
                "title": "Investigation Advice"
            },
            requests: [] // REQUESTED TESTS, MEDICAL ADVICE
        },
        folloupVisit = {
            section: {
                "entry": [
                ],
                "code": {
                    "coding": [
                        {
                            "system": "http://snomed.info/sct",
                            "code": "390906007",
                            "display": "Follow-up encounter"
                        },
                    ]
                },
                "title": "Follow Up"
            },
            followUp: [] // REQUESTED TESTS, MEDICAL ADVICE
        },
        referrals = {
            section: {
                "entry": [
                ],
                "code": {
                    "coding": [
                        {
                            "system": "http://snomed.info/sct",
                            "code": "306206005",
                            "display": "Referral to service"
                        },
                    ]
                },
                "title": "Referral"
            },
            requests: []
        };

    for (const enc of encounters) {
        if (enc.encounterType.display === VISIT_TYPES.ADULTINITIAL) {
            for (const obs of enc.obs) {
                if (obs.concept.display === VISIT_TYPES.CURRENT_COMPLAINT) {
                    cheifComplaintStructure(obs, cheifComplaints, practitioner, patient)
                } else if (obs.concept.display === VISIT_TYPES.PHYSICAL_EXAMINATION) {
                    physicalExaminationStructure(obs, physicalExaminationData)
                } else if (obs.concept.display === VISIT_TYPES.MEDICAL_HISTORY) {
                    medicalHistoryStructure(obs, medicalHistoryData, practitioner, patient)
                } else if (obs.concept.display === VISIT_TYPES.FAMILY_HISTORY) {
                    medicalFamilyHistoryStructure(obs, familyHistoryData, practitioner, patient)
                }
            };
        } else if (enc.encounterType.display === VISIT_TYPES.VITALS) {
            for (const obs of enc.obs) {
                physicalExaminationVitalStructure(obs, physicalExaminationData)
            }
        } else if (enc.encounterType.display === VISIT_TYPES.VISIT_NOTE) {
            for (const obs of enc.obs) {
                if (obs.concept.display === VISIT_TYPES.FOLLOW_UP_VISIT) {
                    followUPStructure(obs, folloupVisit, practitioner, patient)
                } else if (obs.concept.display === VISIT_TYPES.JSV_MEDICATIONS || obs.concept.display === VISIT_TYPES.MEDICATIONS) {
                    medicationStructure(obs, medications, practitioner, patient)
                } else if (obs.concept.display === VISIT_TYPES.TELEMEDICINE_DIAGNOSIS) {
                    physicalExaminationData?.section.entry.push({
                        "reference": `Observation/${obs.uuid}`
                    });
                    physicalExaminationData?.observations.push({
                        "resource": {
                            "code": {
                                "text": "DIAGNOSIS"
                            },
                            "valueString": obs.value,
                            "effectiveDateTime": convertDataToISO(obs.obsDatetime),
                            "id": obs.uuid,
                            "resourceType": "Observation",
                            "status": "final"
                        },
                        "fullUrl": `Observation/${obs.uuid}`
                    })
                } else if (obs.concept.display === VISIT_TYPES.MEDICAL_ADVICE || obs.concept.display === VISIT_TYPES.REQUESTED_TESTS) {
                    investigationAdviceStructure(obs, serviceRequest, practitioner, patient)
                } else if (obs.concept.display === VISIT_TYPES.REFERRAL) {
                    referalStructure(obs, serviceRequest, practitioner, patient)
                }
            }
        }
    };

    return {
        cheifComplaints: cheifComplaints?.conditions?.length ? cheifComplaints : {},
        physicalExamination: physicalExaminationData?.observations.length ? physicalExaminationData : {},
        medicalHistory: medicalHistoryData?.conditions?.length ? medicalHistoryData : {},
        familyHistory: familyHistoryData?.conditions?.length ? familyHistoryData : {},
        medications: medications?.medicationRequest.length ? medications : {},
        serviceRequest: serviceRequest?.requests.length ? serviceRequest : {},
        followUp: folloupVisit?.followUp?.length ? folloupVisit : {},
        referrals: referrals?.requests?.length ? referrals : {}
    }
}


async function prescriptionDocumentReferenceStructure(response, doctorDetail) {
    const result = await downloadPrescription(response, doctorDetail);
    if(!result || !result?.success || !result?.content) return null;
    const uniquId = uuid();
    return {
        "fullUrl": uniquId,
        "resource": {
            "resourceType": "DocumentReference",
            "id": uniquId,
            "meta": {
                "profile": [
                    "https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentReference"
                ]
            },
            "text": {
                "status": "generated",
                "div": "<div xmlns=\"http://www.w3.org/1999/xhtml\"><p><b>Generated Narrative: DocumentReference</b></p></div>"
            },
            "status": "current",
            "docStatus": "final",
            "type": {
                "coding": [
                    {
                        "system": "http://snomed.info/sct",
                        "code": "4241000179101",
                        "display": "Laboratory report"
                    }
                ],
                "text": "Prescription Report"
            },
            "subject": {
                "reference": `Patient/${response?.patient?.uuid}`,
                "display": "Patient"
            },
            "content": [
                {
                    "attachment": {
                        "contentType": "application/pdf",
                        "language": "en-IN",
                        "data": result?.content,
                        "title": "Prescription Report",
                        "creation": convertDataToISO(response?.startDatetime)
                    }
                }
            ]
        }
    }
}
async function formatCareContextFHIBundle(response) {
    const practitioner = getDoctorDetail(response?.encounters);
    if (!practitioner) return;
    
    const patientTelecom = getAttributeByName(response?.patient?.attributes, 'Telephone Number');
    const openMRSID = getIdentifierByName(response?.patient?.identifiers, 'OpenMRS ID')?.identifier;
    const abhaNumber = getIdentifierByName(response?.patient?.identifiers, 'Abha Number')?.identifier;
    const abhaAddress = getIdentifierByName(response?.patient?.identifiers, 'Abha Address')?.identifier;
    const patient = response?.patient;
    
    const { medications, cheifComplaints, medicalHistory, familyHistory, physicalExamination, serviceRequest, followUp, referrals } = getEncountersFHIBundle(response?.encounters, practitioner, patient, response?.startDatetime);
    const prescriptionDocumentReference = await prescriptionDocumentReferenceStructure(response, practitioner)

    const sections = [];
    if (medications?.section) sections.push(medications?.section)
    if (cheifComplaints?.section) sections.push(cheifComplaints?.section)
    if (medicalHistory?.section) sections.push(medicalHistory?.section)
    if (familyHistory?.section) sections.push(familyHistory?.section)
    if (physicalExamination?.section) sections.push(physicalExamination?.section)
    if (serviceRequest?.section) sections.push(serviceRequest?.section)
    if (followUp?.section) sections.push(followUp?.section)
    if (referrals?.section) sections.push(referrals?.section)

    return {
        "identifier": {
            "system": "http://hip.in",
            "value": response?.uuid
        },
        "entry": [
            {
                "resource": {
                    "date": convertDataToISO(response?.startDatetime),
                    "custodian": {
                        "reference": `Organization/10371`,
                        "display": 'Intelehealth Telemedicine'
                    },
                    "meta": {
                        "lastUpdated": convertDataToISO(response?.encounters[0]?.encounterDatetime ?? response?.startDatetime),
                        "versionId": "1",
                        "profile": [
                            "https://nrces.in/ndhm/fhir/r4/StructureDefinition/OPConsultRecord"
                        ]
                    },
                    "subject": {
                        "reference": `Patient/${patient?.uuid}`,
                        "display": patient?.person?.display
                    },
                    "author": [
                        {
                            "reference": `Practitioner/${practitioner?.practitioner_id}`,
                            "display": practitioner?.name
                        }
                    ],
                    "section": sections,
                    "id": response?.uuid,
                    "encounter": {
                        "reference": `Encounter/${response?.encounters[0]?.uuid}`
                    },
                    "type": {
                        "coding": [
                            {
                                "system": "http://snomed.info/sct",
                                "code": "371530004",
                                "display": "Clinical consultation report"
                            }
                        ],
                        "text": "Clinical Consultation report"
                    },
                    "title": "Consultation Report",
                    "resourceType": "Composition",
                    "status": "final"
                },
                "fullUrl": `Composition/${response?.uuid}`
            },
            {
                "resource": {
                    "identifier": [
                        {
                            "system": "https://doctor.ndhm.gov.in",
                            "type": {
                                "coding": [
                                    {
                                        "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                                        "code": "MD",
                                        "display": "Medical License number"
                                    }
                                ]
                            },
                            "value": practitioner?.registrationNumber
                        }
                    ],
                    "meta": {
                        "lastUpdated": convertDataToISO(practitioner?.dateUpdated),
                        "versionId": "1",
                        "profile": [
                            "https://nrces.in/ndhm/fhir/r4/StructureDefinition/Practitioner"
                        ]
                    },
                    "name": [
                        {
                            "text": practitioner?.name
                        }
                    ],
                    "telecom": [
                        {
                            "system": "phone",
                            "use": "home",
                            "value": practitioner?.telecom ?? 'N/A'
                        }
                    ],
                    "id": practitioner?.practitioner_id,
                    "resourceType": "Practitioner"
                },
                "fullUrl": `Practitioner/${practitioner?.practitioner_id}`
            },
            {
                "resource": {
                    "identifier": [
                        {
                            "system": "https://facility.ndhm.gov.in",
                            "type": {
                                "coding": [
                                    {
                                        "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                                        "code": "PRN",
                                        "display": "Provider number"
                                    }
                                ]
                            },
                            "value": "IN2710001275"
                        }
                    ],
                    "meta": {
                        "profile": [
                            "https://nrces.in/ndhm/fhir/r4/StructureDefinition/Organization"
                        ]
                    },
                    "name": "Intelehealth Telemedicine, Maharashtra",
                    "telecom": [
                        {
                            "system": "phone",
                            "use": "work",
                            "value": "+91 8657621331"
                        },
                        {
                            "system": "email",
                            "use": "work",
                            "value": "support@intelehealth.org"
                        }
                    ],
                    "id": "10371",
                    "resourceType": "Organization"
                },
                "fullUrl": "Organization/10371"
            },
            {
                "resource": {
                    "identifier": [
                        {
                            "system": "https://healthid.ndhm.gov.in",
                            "type": {
                                "coding": [
                                    {
                                        "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                                        "code": "MR",
                                        "display": "Medical record number"
                                    }
                                ]
                            },
                            "value": abhaNumber ?? abhaAddress ?? openMRSID
                        }
                    ],
                    "gender": getGender(patient?.person?.gender)?.toLowerCase(),
                    "meta": {
                        "lastUpdated": convertDataToISO(patient?.dateUpdated ?? patient?.dateCreated),
                        "versionId": "1",
                        "profile": [
                            "https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient"
                        ]
                    },
                    "name": [
                        {
                            "text": patient?.person?.display
                        }
                    ],
                    "telecom": [
                        {
                            "system": "phone",
                            "use": "home",
                            "value": patientTelecom?.value ?? 'N/A'
                        }
                    ],
                    "id": patient?.uuid,
                    "birthDate": patient?.person?.birthdate ? new Date(patient?.person?.birthdate).toISOString().slice(0, 10) : null,
                    "resourceType": "Patient"
                },
                "fullUrl": `Patient/${patient?.uuid}`
            },
            ...(medications?.medications ?? []),
            ...(medications?.medicationRequest ?? []),
            ...(cheifComplaints?.conditions ?? []),
            ...(medicalHistory?.conditions ?? []),
            ...(familyHistory?.conditions ?? []),
            ...(physicalExamination?.observations ?? []),
            ...(serviceRequest?.requests ?? []),
            ...(followUp?.followUp ?? []),
            ...(referrals?.requests ?? []),
            {
                "resource": {
                    "identifier": [
                        {
                            "system": "https://ndhm.in",
                            "value": "S100"
                        }
                    ],
                    "meta": {
                        "lastUpdated": convertDataToISO(response?.encounters[0]?.encounterDatetime),
                        "profile": [
                            "https://nrces.in/ndhm/fhir/r4/StructureDefinition/Encounter"
                        ]
                    },
                    "subject": {
                        "reference": `Patient/${patient?.uuid}`
                    },
                    "id": response?.encounters[0]?.uuid,
                    "class": {
                        "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                        "code": "AMB",
                        "display": "ambulatory"
                    },
                    "resourceType": "Encounter",
                    "status": "finished"
                },
                "fullUrl": `Encounter/${response?.encounters[0]?.uuid}`
            },
            prescriptionDocumentReference
        ],
        "meta": {
            "lastUpdated": convertDataToISO(response?.encounters[0]?.encounterDatetime ?? response?.startDatetime),
            "versionId": "1",
            "security": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/v3-Confidentiality",
                    "code": "V",
                    "display": "very restricted"
                }
            ],
            "profile": [
                "https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle"
            ]
        },
        "id": response?.uuid,
        "type": "document",
        "resourceType": "Bundle",
        "timestamp": convertDataToISO(response?.encounters[0]?.encounterDatetime ?? response?.startDatetime),
    }
}

module.exports = {
    convertDateToDDMMYYYY,
    handleError,
    formatCareContextFHIBundle
}