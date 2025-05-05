const { OBSERVATION_TYPE, VISIT_TYPES, RELATIONS, FHIR_BASE_URL } = require("../constants/abha.constants");
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
    // Check for the error message in various possible locations
    if (error?.data?.message) {
        return error.data;
    }

    if (error?.data?.error) {
        if (typeof error?.data?.error === 'string') {
            return { message: error.data.error };
        }

        return error.data.error;
    }

    if (error?.response?.data?.error) {
        // Check for error inside response and if it's a string or object
        if (typeof error.response.data.error === 'string') {
            return { message: error.response.data.error };
        }
        return error.response.data.error;
    }

    if (error?.data?.errors?.[0]?.error?.message) {
        return error.data.errors[0].error;
    }

    if (error?.response?.data) {
        // Return the data as message or as-is depending on its type
        if (typeof error.response.data === 'string') {
            return { message: error.response.data };
        }
        return error.response.data;
    }

    if (error?.message) {
        return { message: error.message };
    }

    // Default error handling
    return new Error('Something went wrong!');
}


// Get the doctor details
function getDoctorDetail(encounters) {
    const encounter = encounters?.find((encounter) => ["Visit Complete", "Visit Note"].includes(encounter?.encounterType?.display));
    const doctor = encounter?.encounterProviders?.[0]?.provider;
    if (!doctor) return;

    return {
        encounterDatetime: encounter?.encounterDatetime,
        name: doctor?.person?.display ?? '',
        gender: getGender(doctor?.person?.gender),
        practitioner_id: doctor?.uuid ?? '',
        person_uuid: doctor?.person?.uuid ?? '',
        typeOfProfession: doctor?.typeOfProfession,
        telecom: getAttributeByName(doctor?.attributes, 'phoneNumber')?.value ?? '',
        dateUpdated: doctor?.person?.dateUpdated ?? doctor?.person?.dateCreated,
        registrationNumber: getAttributeByName(doctor?.attributes, 'registrationNumber')?.value ?? '',
        signature: getAttributeByName(doctor?.attributes, 'signature')?.value ?? ''
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
    cheifComplaints?.conditions.push(createFHIRResource({
        code: {
            text: complaints.join(', ')
        },
        onsetPeriod: {
            start: convertDataToISO(obs.obsDatetime)
        },
        subject: {
            reference: `Patient/${patient?.uuid}`
        },
        recordedDate: convertDataToISO(obs.obsDatetime),
        id: obs.uuid,
        clinicalStatus: {
            coding: [
                {
                    system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
                    "code": "active",
                    "display": "active"
                }
            ],
            text: "COMPLAIN"
        },
        category: [
            {
                coding: [
                    {
                        system: "http://terminology.hl7.org/CodeSystem/condition-category",
                        code: "problem-list-item",
                        display: "Problem List Item"
                    }
                ],
                text: "problem list"
            }
        ],
        resourceType: "Condition"
    })
    )
}

// Vitals
function physicalExaminationVitalStructure(obs, physicalExaminationData, practitioner, patient) {
    const valueQuantity = {
        unit: OBSERVATION_TYPE[obs.concept?.display]?.unit,
        value: obs.value
    }
    const observationId = `${OBSERVATION_TYPE[obs.concept?.display]?.type}${obs.uuid}`
    const observationText = OBSERVATION_TYPE[obs.concept?.display]?.name ?? obs.concept?.display

    physicalExaminationData.section.entry.push({
        reference: `Observation/${observationId}`
    });
    physicalExaminationData.observations.push(
        createFHIRResource({
            code: {
                text: observationText
            },
            effectiveDateTime: convertDataToISO(obs.obsDatetime),
            id: observationId,
            resourceType: "Observation",
            status: "final",
            valueQuantity: valueQuantity,
            subject: {
                reference: `Patient/${patient?.uuid}`,
                display: patient?.person?.display
            },
            performer: [{
                reference: `Practitioner/${practitioner?.practitioner_id}`,
                display: practitioner?.name
            }],
            text: {
                status: "generated",
                div: `<div xmlns="http://www.w3.org/1999/xhtml">${observationText}: ${valueQuantity.value} ${valueQuantity.unit}</div>`
            },
        })
    )
    return physicalExaminationData
}

// Physical Examination of others
function physicalExaminationStructure(obs, physicalExaminationData, practitioner, patient) {
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

    const observationText = pyshicalExaminate.join(', ')
    physicalExaminationData.section.entry.push({
        reference: `Observation/${obs.uuid}`
    });
    physicalExaminationData.observations.push(
        createFHIRResource({
            code: {
                text: observationText
            },
            effectiveDateTime: convertDataToISO(obs.obsDatetime),
            id: `${obs.uuid}`,
            resourceType: "Observation",
            status: "final",
            subject: {
                reference: `Patient/${patient?.uuid}`,
                display: patient?.person?.display
            },
            performer: [{
                reference: `Practitioner/${practitioner?.practitioner_id}`,
                display: practitioner?.name
            }],
            text: {
                status: "generated",
                div: `<div xmlns="http://www.w3.org/1999/xhtml">${observationText}</div>`
            },
        })
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
        reference: `Condition/${obs.uuid}`
    })

    medicalHistoryData.conditions.push(createFHIRResource({
        code: {
            text: history.join(', ')
        },
        onsetPeriod: {
            start: convertDataToISO(obs.obsDatetime)
        },
        subject: {
            reference: `Patient/${patient?.uuid}`
        },
        recordedDate: convertDataToISO(obs.obsDatetime),
        id: obs.uuid,
        clinicalStatus: {
            coding: [
                {
                    system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
                    code: "active",
                    display: "active"
                }
            ],
            text: "HISTORY"
        },
        category: [
            {
                coding: [
                    {
                        system: "http://terminology.hl7.org/CodeSystem/condition-category",
                        code: "problem-list-item",
                        display: "Problem List Item"
                    }
                ],
                text: "problem list"
            }
        ],
        resourceType: "Condition"
    })
    )
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
            "fullUrl": `${FHIR_BASE_URL}/FamilyMemberHistory/${uniquId}`
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
            "fullUrl": `${FHIR_BASE_URL}/Appointment/${obs.uuid}`
        });
    } catch (err) {
        logStream("error", err?.message);
    }
}

// Medications
function medicationStructure(obs, medications, practitioner, patient, prescriptionMedications) {
    const obsValue = obs.value?.split(':');
    let dosageInstruction = '';
    if (obsValue?.[1]) dosageInstruction += obsValue?.[1];
    if (obsValue?.[3]) dosageInstruction += ` (${obsValue?.[3]}) Aa Day`;
    if (obsValue?.[2]) dosageInstruction += ` (Duration:${obsValue?.[2]})`;
    if (obsValue?.[4]) dosageInstruction += ` Remark: ${obsValue?.[4]}`;

    const resource = {
        "resource": {
            "requester": {
                "reference": `Practitioner/${practitioner?.practitioner_id}`,
                "display": practitioner?.name
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
                "reference": `Patient/${patient?.uuid}`,
                "display": patient?.person?.display
            },
            "id": obs.uuid,
            "intent": "order",
            "resourceType": "MedicationRequest",
            "status": "active"
        },
        "fullUrl": `${FHIR_BASE_URL}/MedicationRequest/${obs.uuid}`
    }

    medications.section.entry.push({
        "reference": `MedicationRequest/${obs.uuid}`
    })

    medications.medicationRequest.push(resource)

    if (prescriptionMedications) {
        prescriptionMedications.section.entry.push({
            "reference": `MedicationRequest/prescription-${obs.uuid}`,
            "type": "MedicationRequest"
        })

        prescriptionMedications.medicationRequest.push({
            resource: {
                ...resource?.resource,
                "id": `prescription-${obs.uuid}`,
            },
            "fullUrl": `${FHIR_BASE_URL}/MedicationRequest/prescription-${obs.uuid}`
        })
    }
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
        "fullUrl": `${FHIR_BASE_URL}/ServiceRequest/${obs.uuid}`
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
        "fullUrl": `${FHIR_BASE_URL}/ServiceRequest/${obs.uuid}`
    })
}

// Vital Sign For Wellness records
function vitalWellnessRecordStructure(obs, wellnessRecordVitals, practitioner, patient) {
    const vitalId = `vital-signs-${OBSERVATION_TYPE[obs.concept?.display]?.type}-${obs.uuid}`;
    wellnessRecordVitals.entry.push({
        reference: `Observation/${vitalId}`,
        display: OBSERVATION_TYPE[obs.concept?.display]?.name ?? obs.concept?.display
    });
    wellnessRecordVitals.observations.push(
        createFHIRResource({
            resourceType: "Observation",
            id: vitalId,
            meta: {
                profile: [
                    "https://nrces.in/ndhm/fhir/r4/StructureDefinition/ObservationVitalSigns"
                ]
            },
            status: "final",
            category: [
                {
                    coding: [
                        {
                            system: "http://terminology.hl7.org/CodeSystem/observation-category",
                            code: "vital-signs",
                            display: "Vital Signs"
                        }
                    ],
                    text: "Vital Signs"
                }
            ],
            code: {
                text: OBSERVATION_TYPE[obs.concept?.display]?.name ?? obs.concept?.display
            },
            subject: {
                reference: `Patient/${patient?.uuid}`,
                display: patient?.person?.display
            },
            effectiveDateTime: convertDataToISO(obs.obsDatetime),
            performer: [
                {
                    reference: `Practitioner/${practitioner?.practitioner_id}`,
                    display: practitioner?.name
                }
            ],
            valueQuantity: {
                unit: OBSERVATION_TYPE[obs.concept?.display]?.unit,
                value: obs.value
            }
        })
    )
    return wellnessRecordVitals
}

/**
 * Initialize FHIR section data structures
 * @returns {Object} Initialized FHIR section data structures
 */
const initializeFHIRSections = () => ({
    cheifComplaints: {
        section: createFHIRSection({
            code: {
                code: "422843007",
                display: "Chief complaint section"
            },
            title: "Chief Complaints"
        }),
        conditions: []
    },
    physicalExaminationData: {
        section: createFHIRSection({
            code: {
                code: "425044008",
                display: "Physical exam section"
            },
            title: "Physical Examination"
        }),
        observations: []
    },
    medicalHistoryData: {
        section: createFHIRSection({
            code: {
                code: "417662000",
                display: "Past medical history"
            },
            title: "Medical History"
        }),
        conditions: []
    },
    familyHistoryData: {
        section: createFHIRSection({
            code: {
                code: "422432008",
                display: "Family history section"
            },
            title: "Family History"
        }),
        conditions: []
    },
    medications: {
        section: createFHIRSection({
            code: {
                code: "721912009",
                display: "Medication summary document"
            },
            title: "Medications"
        }),
        medicationRequest: []
    },
    serviceRequest: {
        section: createFHIRSection({
            code: {
                code: "261665006",
                display: "Unknown"
            },
            title: "Investigation Advice"
        }),
        requests: []
    },
    folloupVisit: {
        section: createFHIRSection({
            code: {
                code: "390906007",
                display: "Follow-up encounter"
            },
            title: "Follow Up"
        }),
        followUp: []
    },
    referrals: {
        section: createFHIRSection({
            code: {
                code: "306206005",
                display: "Referral to service"
            },
            title: "Referral"
        }),
        requests: []
    },
    wellnessRecord: {
        vitalSigns: {
            title: "Vital Signs",
            entry: [],
            observations: []
        }
    },
    prescriptionRecord: {
        medications: {
            section: createFHIRSection({
                code: {
                    code: "721912009",
                    display: "Medication summary document"
                },
                title: "Medications"
            }),
            medicationRequest: []
        }
    }
});

/**
 * Process observation based on concept display
 * @param {Object} obs - Observation object
 * @param {Object} sections - FHIR section data structures
 * @param {Object} practitioner - Practitioner data
 * @param {Object} patient - Patient data
 */
const processObservation = (obs, sections, practitioner, patient) => {
    const {
        cheifComplaints,
        physicalExaminationData,
        medicalHistoryData,
        familyHistoryData,
        medications,
        serviceRequest,
        folloupVisit,
        prescriptionRecord
    } = sections;

    switch (obs.concept.display) {
        case VISIT_TYPES.CURRENT_COMPLAINT:
            cheifComplaintStructure(obs, cheifComplaints, practitioner, patient);
            break;
        case VISIT_TYPES.PHYSICAL_EXAMINATION:
            physicalExaminationStructure(obs, physicalExaminationData, practitioner, patient);
            break;
        case VISIT_TYPES.MEDICAL_HISTORY:
            medicalHistoryStructure(obs, medicalHistoryData, practitioner, patient);
            break;
        case VISIT_TYPES.FAMILY_HISTORY:
            medicalFamilyHistoryStructure(obs, familyHistoryData, practitioner, patient);
            break;
        case VISIT_TYPES.FOLLOW_UP_VISIT:
            followUPStructure(obs, folloupVisit, practitioner, patient);
            break;
        case VISIT_TYPES.JSV_MEDICATIONS:
        case VISIT_TYPES.MEDICATIONS:
            medicationStructure(obs, medications, practitioner, patient, prescriptionRecord?.medications);
            break;
        case VISIT_TYPES.TELEMEDICINE_DIAGNOSIS:
            physicalExaminationData?.section.entry.push({
                "reference": `Observation/${obs.uuid}`
            });
            physicalExaminationData?.observations.push({
                "resource": {
                    "code": { "text": "DIAGNOSIS" },
                    "valueString": obs.value,
                    "effectiveDateTime": convertDataToISO(obs.obsDatetime),
                    "id": obs.uuid,
                    "resourceType": "Observation",
                    "status": "final"
                },
                "fullUrl": `${FHIR_BASE_URL}/Observation/${obs.uuid}`
            });
            break;
        case VISIT_TYPES.MEDICAL_ADVICE:
        case VISIT_TYPES.REQUESTED_TESTS:
            investigationAdviceStructure(obs, serviceRequest, practitioner, patient);
            break;
        case VISIT_TYPES.REFERRAL:
            referalStructure(obs, serviceRequest, practitioner, patient);
            break;
    }
};

/**
 * Process observations for a specific encounter type
 * @param {Object} encounter - Encounter object
 * @param {Object} sections - FHIR section data structures
 * @param {Object} practitioner - Practitioner data
 * @param {Object} patient - Patient data
 */
const processEncounterObservations = (encounter, sections, practitioner, patient) => {
    try {
        if (encounter.encounterType.display === VISIT_TYPES.ADULTINITIAL) {
            encounter.obs.forEach(obs => processObservation(obs, sections, practitioner, patient));
        } else if (encounter.encounterType.display === VISIT_TYPES.VITALS) {
            encounter.obs.forEach(obs => {
                physicalExaminationVitalStructure(obs, sections.physicalExaminationData, practitioner, patient)
                vitalWellnessRecordStructure(obs, sections.wellnessRecord.vitalSigns, practitioner, patient)
            });
        } else if (encounter.encounterType.display === VISIT_TYPES.VISIT_NOTE) {
            encounter.obs.forEach(obs => processObservation(obs, sections, practitioner, patient));
        }
    } catch (error) {
        logStream("error", `Error processing encounter observations: ${error.message}`);
    }
};

/**
 * Get encounters FHIR bundle
 * @param {Array} encounters - Array of encounters
 * @param {Object} practitioner - Practitioner data
 * @param {Object} patient - Patient data
 * @returns {Object} Processed FHIR bundle data
 */
function getEncountersFHIBundle(encounters, practitioner, patient) {
    try {
        const sections = initializeFHIRSections();

        encounters.forEach(encounter =>
            processEncounterObservations(encounter, sections, practitioner, patient)
        );

        return {
            cheifComplaints: sections.cheifComplaints?.conditions?.length ? sections.cheifComplaints : {},
            physicalExamination: sections.physicalExaminationData?.observations.length ? sections.physicalExaminationData : {},
            medicalHistory: sections.medicalHistoryData?.conditions?.length ? sections.medicalHistoryData : {},
            familyHistory: sections.familyHistoryData?.conditions?.length ? sections.familyHistoryData : {},
            medications: sections.medications?.medicationRequest.length ? sections.medications : {},
            serviceRequest: sections.serviceRequest?.requests.length ? sections.serviceRequest : {},
            followUp: sections.folloupVisit?.followUp?.length ? sections.folloupVisit : {},
            referrals: sections.referrals?.requests?.length ? sections.referrals : {},
            wellnessRecord: sections.wellnessRecord,
            prescriptionRecord: sections.prescriptionRecord
        };
    } catch (error) {
        logStream("error", `Error in getEncountersFHIBundle: ${error.message}`);
        throw error;
    }
}

/**
 * Create FHIR section with common fields
 * @param {Object} params - Section parameters
 * @returns {Object} FHIR section
 */
const createFHIRSection = ({ code, title, entries = [] }) => ({
    entry: entries,
    code: {
        coding: [
            {
                system: "http://snomed.info/sct",
                code: code.code,
                display: code.display
            }
        ]
    },
    title
});

/**
 * Create FHIR resource with common fields
 * @param {Object} params - Resource parameters
 * @returns {Object} FHIR resource
 */
const createFHIRResource = ({ id, resourceType, meta, timestamp, ...otherFields }) => ({
    resource: {
        id,
        resourceType,
        ...(meta ? {
            meta: {
                lastUpdated: convertDataToISO(timestamp),
                versionId: "1",
                security: [
                    {
                        system: "http://terminology.hl7.org/CodeSystem/v3-Confidentiality",
                        code: "V",
                        display: "very restricted"
                    }
                ],
                ...meta
            }
        } : {}),
        ...otherFields
    },
    fullUrl: `${FHIR_BASE_URL}/${resourceType}/${id}`
});

/**
 * Create FHIR bundle with common fields
 * @param {Object} params - Bundle parameters
 * @returns {Object} FHIR bundle
 */
const createFHIRBundle = ({ id, type, entries, timestamp, meta = {}, identifier, ...otherFields }) => ({
    identifier,
    entry: entries,
    meta: {
        lastUpdated: convertDataToISO(timestamp),
        versionId: "1",
        security: [
            {
                system: "http://terminology.hl7.org/CodeSystem/v3-Confidentiality",
                code: "V",
                display: "very restricted"
            }
        ],
        ...meta
    },
    id,
    type,
    resourceType: "Bundle",
    timestamp: convertDataToISO(timestamp),
    ...otherFields
});

/**
 * Create patient resource structure for FHIR bundle
 * @param {Object} patientData - Patient data from OpenMRS
 * @returns {Object} Patient resource object
 */
const createPatientResource = (patientData) => {
    const patientTelecom = getAttributeByName(patientData?.attributes, 'Telephone Number');
    const openMRSID = getIdentifierByName(patientData?.identifiers, 'OpenMRS ID')?.identifier;
    const abhaNumber = getIdentifierByName(patientData?.identifiers, 'Abha Number')?.identifier;
    const abhaAddress = getIdentifierByName(patientData?.identifiers, 'Abha Address')?.identifier;

    return createFHIRResource({
        id: patientData?.uuid,
        resourceType: "Patient",
        meta: {
            profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient"]
        },
        identifier: [{
            system: "https://healthid.ndhm.gov.in",
            type: {
                coding: [{
                    system: "http://terminology.hl7.org/CodeSystem/v2-0203",
                    code: "MR",
                    display: "Medical record number"
                }]
            },
            value: abhaNumber ?? abhaAddress ?? openMRSID
        }],
        gender: getGender(patientData?.person?.gender)?.toLowerCase(),
        name: [{ text: patientData?.person?.display }],
        contact: [{
            telecom: [{
                system: "phone",
                use: "home",
                value: patientTelecom?.value ?? 'N/A'
            }]
        }],
        birthDate: patientData?.person?.birthdate ? patientData?.person?.birthdate?.slice(0, 10) : null
    });
};

/**
 * Create organization resource structure for FHIR bundle
 * @returns {Object} Organization resource object
 */
const createOrganizationResource = () => {
    return createFHIRResource({
        id: "10371",
        resourceType: "Organization",
        meta: {
            profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/Organization"]
        },
        identifier: [{
            system: "https://facility.ndhm.gov.in",
            type: {
                coding: [{
                    system: "http://terminology.hl7.org/CodeSystem/v2-0203",
                    code: "PRN",
                    display: "Provider number"
                }]
            },
            value: "IN2710001275"
        }],
        name: "Intelehealth Telemedicine, Maharashtra",
        contact: [{
            telecom: [
                {
                    system: "phone",
                    use: "work",
                    value: "+91 8657621331"
                },
                {
                    system: "email",
                    use: "work",
                    value: "support@intelehealth.org"
                }
            ]
        }]
    });
};

/**
 * Create practitioner resource structure for FHIR bundle
 * @param {Object} practitioner - Practitioner data
 * @returns {Object} Practitioner resource object
 */
const createPractitionerResource = (practitioner) => {
    return createFHIRResource({
        id: practitioner?.practitioner_id,
        resourceType: "Practitioner",
        meta: {
            lastUpdated: convertDataToISO(practitioner?.dateUpdated),
            profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/Practitioner"]
        },
        identifier: [{
            system: "https://doctor.ndhm.gov.in",
            type: {
                coding: [{
                    system: "http://terminology.hl7.org/CodeSystem/v2-0203",
                    code: "MD",
                    display: "Medical License number"
                }]
            },
            value: practitioner?.registrationNumber
        }],
        name: [{ text: practitioner?.name }],
        telecom: [{
            system: "phone",
            use: "home",
            value: practitioner?.telecom ?? 'N/A'
        }]
    });
};

/**
 * Create OP consultation resource structure for FHIR bundle
 * @param {Object} response - Response data
 * @param {Object} patient - Patient data
 * @param {Object} practitioner - Practitioner data
 * @param {Array} sections - Sections data
**/
const createOpConsultationResource = (response, patient, practitioner, sections) => {
    return createFHIRResource({
        id: response?.uuid,
        resourceType: "Composition",
        date: convertDataToISO(response?.startDatetime),
        custodian: {
            reference: `Organization/10371`,
            display: 'Intelehealth Telemedicine'
        },
        meta: {
            lastUpdated: convertDataToISO(response?.encounters[0]?.encounterDatetime ?? response?.startDatetime),
            versionId: "1",
            profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/OPConsultRecord"]
        },
        subject: {
            reference: `Patient/${patient?.uuid}`,
            display: patient?.person?.display
        },
        author: [{
            reference: `Practitioner/${practitioner?.practitioner_id}`,
            display: practitioner?.name
        }],
        section: sections,
        encounter: {
            reference: `Encounter/${response?.encounters[0]?.uuid}`
        },
        type: {
            coding: [{
                system: "http://snomed.info/sct",
                code: "371530004",
                display: "Clinical consultation report"
            }],
            text: "Clinical Consultation report"
        },
        title: "Consultation Report",
        status: "final"
    })
}

/**
 * Create encounter resource structure for FHIR bundle
 * @param {Object} encounter - Encounter data
 * @param {string} patientId - Patient ID
 * @returns {Object} Encounter resource object
 */
const createEncounterResource = (encounter, patientId) => {
    return createFHIRResource({
        id: encounter?.uuid,
        resourceType: "Encounter",
        text: {
            status: "generated",
            div: `<div xmlns="http://www.w3.org/1999/xhtml">Encounter for patient ${patientId}</div>`
        },
        meta: {
            lastUpdated: convertDataToISO(encounter?.encounterDatetime),
            profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/Encounter"]
        },
        identifier: [{
            system: "https://ndhm.in",
            value: "S100"
        }],
        subject: {
            reference: `Patient/${patientId}`
        },
        class: {
            system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            code: "AMB",
            display: "ambulatory"
        },
        status: "finished"
    });
};

/**
 * Create prescription document reference structure for FHIR bundle
 * @param {Object} response - Response data
 * @param {Object} doctorDetail - Doctor detail
 * @returns {Object} Prescription document reference object
 */
async function prescriptionDocumentReferenceStructure(response, doctorDetail, prescriptionRecord) {
    const result = await downloadPrescription(response, doctorDetail);
    if (!result?.success || !result?.content) return null;

    const uniqueId = uuid();
    
    return {
        section: createFHIRSection({
            code: {
                code: "371530004",
                display: "Clinical consultation report"
            },
            title: "Clinical consultation report",
            entries: [{
                reference: `DocumentReference/${uniqueId}`
            }]
        }),
        content: createFHIRResource({
            resourceType: "DocumentReference",
            id: uniqueId,
            meta: {
                profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentReference"]
            },
            text: {
                status: "generated",
                div: "<div xmlns=\"http://www.w3.org/1999/xhtml\"><p><b>Generated Narrative: DocumentReference</b></p></div>"
            },
            status: "current",
            docStatus: "final",
            type: {
                coding: [{
                    system: "http://snomed.info/sct",
                    code: "371530004",
                    display: "Clinical consultation report"
                }],
                text: "Clinical consultation report"
            },
            subject: {
                reference: `Patient/${response?.patient?.uuid}`,
                display: "Patient"
            },
            content: [{
                attachment: {
                    contentType: "application/pdf",
                    language: "en-IN",
                    data: result.content,
                    title: "OP Record",
                    creation: convertDataToISO(response?.startDatetime)
                }
            }]
        })
    };
}

async function prescriptionRecordBinaryStructure(pdfContent, prescriptionRecord) {
    if(!pdfContent) return prescriptionRecord;
    const uniqueIdBinary = uuid();
   
    // Create Binary resource
    const binaryResource = {
        resourceType: "Binary",
        id: uniqueIdBinary,
        meta: {
            profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/Binary"]
        },
        contentType: "application/pdf",
        data: pdfContent
    };

    // Add Binary reference to prescription record section
    if (prescriptionRecord?.medications?.section?.entry) {
        prescriptionRecord.medications.section.entry.push({
            reference: `Binary/${uniqueIdBinary}`,
            type: "Binary"
        });
    }

    // Add Binary resource to prescription record
    if (prescriptionRecord?.medications?.medicationRequest) {
        prescriptionRecord.medications.medicationRequest.push({
            fullUrl: `${FHIR_BASE_URL}/Binary/${uniqueIdBinary}`,
            resource: binaryResource
        });
    }
    return prescriptionRecord;
}


/**
 * Format care context FHIR bundle
 * @param {Object} response - Visit data
 * @returns {Object} Formatted FHIR bundle
 */
async function formatCareContextFHIBundle(response) {
    try {
        const practitioner = getDoctorDetail(response?.encounters);
        if (!practitioner) return null;

        const patient = response?.patient;
        const {
            medications,
            cheifComplaints,
            medicalHistory,
            familyHistory,
            physicalExamination,
            serviceRequest,
            followUp,
            referrals,
            prescriptionRecord,
            wellnessRecord
        } = getEncountersFHIBundle(response?.encounters, practitioner, patient, response?.startDatetime);
        const prescriptionDocumentReference = await prescriptionDocumentReferenceStructure(response, practitioner, prescriptionRecord);
        await prescriptionRecordBinaryStructure(prescriptionDocumentReference?.content?.resource?.content?.[0]?.attachment?.data, prescriptionRecord);

        // Collect all sections
        const sections = [
            medications?.section,
            cheifComplaints?.section,
            medicalHistory?.section,
            familyHistory?.section,
            physicalExamination?.section,
            serviceRequest?.section,
            followUp?.section,
            referrals?.section,
            prescriptionDocumentReference?.section
        ].filter(Boolean);

        // Collect all entries
        const entries = [
            createOpConsultationResource(response, patient, practitioner, sections),
            createPractitionerResource(practitioner),
            createOrganizationResource(),
            createPatientResource(patient),
            ...(medications?.medicationRequest ?? []),
            ...(cheifComplaints?.conditions ?? []),
            ...(medicalHistory?.conditions ?? []),
            ...(familyHistory?.conditions ?? []),
            ...(physicalExamination?.observations ?? []),
            ...(serviceRequest?.requests ?? []),
            ...(followUp?.followUp ?? []),
            ...(referrals?.requests ?? []),
            createEncounterResource(response?.encounters[0], patient?.uuid),
            prescriptionDocumentReference?.content,
            ...formatPrescriptionFHIBundle(prescriptionRecord, response, patient, practitioner),
            ...formatWellnessFHIBundle(wellnessRecord, patient, practitioner, response?.startDatetime)
        ].filter(Boolean);

        return createFHIRBundle({
            id: response?.uuid,
            type: "document",
            entries,
            timestamp: response?.encounters[0]?.encounterDatetime ?? response?.startDatetime,
            meta: {
                profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle"]
            },
            identifier: {
                system: FHIR_BASE_URL,
                value: response?.uuid
            },
        });

    } catch (error) {
        logStream("error", `Error formatting care context FHIR bundle: ${JSON.stringify(error)}`);
        throw error;
    }
}

function formatPrescriptionFHIBundle({medications}, response, patient, practitioner) {
    if (!medications) return [];
    const sharedPrescription = response?.encounters?.find(encounter => encounter.encounterType.display === 'Visit Complete');
    if (!sharedPrescription) return [];
    return [
        createFHIRResource({
            id: uuid(),
            date: convertDataToISO(sharedPrescription?.encounterDatetime),
            custodian: {
                reference: "Organization/10371",
                display: "Intelehealth Telemedicine"
            },
            meta: {
                lastUpdated: convertDataToISO(sharedPrescription?.encounterDatetime),
                versionId: "1",
                profile: [
                    "https://nrces.in/ndhm/fhir/r4/StructureDefinition/PrescriptionRecord"
                ]
            },
            subject: {
                reference: "Patient/" + patient?.uuid,
                display: patient?.person?.display
            },
            author: [{
                reference: "Practitioner/" + practitioner?.practitioner_id,
                display: practitioner?.name
            }],
            section: [
                createFHIRSection({
                    entries: medications?.section?.entry,
                    code: {
                        code: "440545006",
                        display: "Prescription record"
                    },
                    title: "Prescription"
                })
            ],
            encounter: {
                reference: "Encounter/" + sharedPrescription?.uuid
            },
            type: {
                coding: [
                    {
                        system: "http://snomed.info/sct",
                        code: "440545006",
                        display: "Prescription record"
                    }
                ],
                text: "Prescription record"
            },
            title: "Prescription",
            resourceType: "Composition",
            status: "final"
        }),
        ...(medications?.medicationRequest ?? [])
    ];
}



/**
 * Create wellness record resource structure for FHIR bundle
 * @param {Object} wellnessRecord - Wellness record data
 * @param {Object} patient - Patient data
 * @param {Object} practitioner - Practitioner data
 * @param {string} startDatetime - Start datetime
 * @returns {Object} Wellness record resource object
 */
const createWellnessRecordResource = (wellnessRecord, patient, practitioner, startDatetime) => {
    const uniqueId = uuid();
    return createFHIRResource({
        resourceType: "Composition",
        id: uniqueId,
        meta: {
            profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/WellnessRecord"]
        },
        language: "en-IN",
        identifier: {
            system: "https://ndhm.in/phr",
            value: uniqueId
        },
        status: "final",
        type: {
            coding: [{
                system: "http://loinc.org",
                code: "11502-2",
                display: "Laboratory report"
            }],
            text: "Wellness Record"
        },
        subject: {
            reference: `Patient/${patient?.uuid}`,
            display: patient?.person?.display
        },
        author: [{
            reference: `Practitioner/${practitioner?.practitioner_id}`,
            display: practitioner?.name
        }],
        date: convertDataToISO(startDatetime),
        title: "Wellness Record",
        section: [
            {
                title: wellnessRecord?.vitalSigns?.title,
                entry: wellnessRecord?.vitalSigns?.entry
            }
        ]
    })
}

function formatWellnessFHIBundle(wellnessRecord, patient, practitioner, startDatetime) {
    const { vitalSigns } = wellnessRecord
    if (!vitalSigns?.entry?.length) return [];
    return [
        createWellnessRecordResource(wellnessRecord, patient, practitioner, startDatetime),
        ...vitalSigns?.observations
    ]
}

module.exports = {
    convertDateToDDMMYYYY,
    handleError,
    formatCareContextFHIBundle
}