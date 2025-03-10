
const moment = require("moment");
const pdfMake = require("pdfmake/build/pdfmake");
const pdfFonts = require('pdfmake/build/vfs_fonts');
const { VISIT_TYPES } = require("../constants/abha.constants");
const { logo, precription, visitImage } = require("./images");
const { logStream } = require("../logger");

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

/**
 * Prepare the cheif complaint section with obs value
 * @param {*} complaints 
 * @param {*} obs 
 */
function getCheckUpReason(complaints, obs) {
    try {
        const currentComplaint = getData(obs)?.value.split('<b>');

        for (let i = 0; i < currentComplaint.length; i++) {
            if (currentComplaint[i] && currentComplaint[i].length > 1) {
                const obs1 = currentComplaint[i].split('<');
                if (!obs1[0].match(VISIT_TYPES.ASSOCIATED_SYMPTOMS)) {
                    complaints.cheifComplaint.push({ text: [{ text: obs1[0], bold: true }, ``], margin: [0, 5, 0, 5] })
                }
                const splitByBr = currentComplaint[i].split('<br/>');
                if (splitByBr[0].includes(VISIT_TYPES.ASSOCIATED_SYMPTOMS)) {
                    for (let j = 1; j < splitByBr.length; j = j + 2) {
                        if (splitByBr[j].trim() && splitByBr[j].trim().length > 1) {
                            complaints.associated_symptoms.push({
                                text: [
                                    { text: `${splitByBr[j].replace('• ', '').replace(' -', '')} :`, bold: true },
                                    { text: splitByBr[j + 1] ? splitByBr[j + 1] : 'None' }
                                ],
                                margin: [0, 5, 0, 5]
                            })
                        }
                    }
                } else {
                    // let ckr_data = {
                    //     colSpan: 2,
                    //     ul: []
                    // };
                    // complaints.symptoms.push([{ text: splitByBr[0].replace('</b>:', ''), style: 'subSectionheader', colSpan: 2  }])
                    // for (let k = 1; k < splitByBr.length; k++) {
                    //     if (splitByBr[k].trim() && splitByBr[k].trim().length > 1) {
                    //         const splitByDash = splitByBr[k].split('-');
                    //         const value = splitByDash.slice(1, splitByDash.length).join('-') ?? ''
                    //         ckr_data.ul.push({
                    //             text: [
                    //                 { text: `${splitByDash[0].replace('• ', '')} :`, bold: true },
                    //                 { text: value? value : 'None' }
                    //             ],
                    //             margin: [0, 5, 0, 5]
                    //         })
                    //     }
                    // }
                    // complaints.symptoms.push([ckr_data])
                }
            }
        }
    } catch (err) {
        console.log("ERR", err)
    }
}

/**
 * Get patint full gender based on sort name
 * @param {*} gender 
 * @returns 
 */
function getGender(gender) {
    if (gender === 'M') return "Male";
    if (gender === 'F') return "Female";
    return 'Other'
}

/**
 * Get patient identifier from identifiers array using name
 * @param {*} identifiers 
 * @param {*} name 
 * @returns 
 */
function getIdentifierByName(identifiers = [], name) {
    return identifiers?.find((identifier) => identifier?.identifierType?.name === name)?.identifier
}

/**
 * Get patient attribute from attributes array using name
 * @param {*} attributes 
 * @param {*} name 
 * @returns 
 */
function getAttributeByName(attributes = [], name) {
    return attributes?.find((attribute) => attribute?.attributeType?.display === name)?.value
}

/**
 * Get patient values by field name and patient object
 * @param {*} patient 
 * @param {*} fieldName 
 * @returns 
 */
function getPatientRegField(patient, fieldName) {
    let value = 'N/A'
    switch (fieldName) {
        case 'Gender':
            value = getGender(patient?.person.gender);
            break;
        case 'Age':
            value = patient?.person.age + ' years';
            break;
        case 'Date of Birth':
            value = patient?.person?.birthdate ? new Date(patient?.person?.birthdate).toDateString() : '';
            break;
        case 'Phone Number':
            value = getAttributeByName(patient?.person?.attributes, 'Telephone Number');
            break;
        case 'Guardian Type':
            value = getAttributeByName(patient?.person?.attributes, 'Guardian Type');
            break;
        case 'Guardian Name':
            value = getAttributeByName(patient?.person?.attributes, 'Guardian Name');
            break;
        case 'Emergency Contact Name':
            value = getAttributeByName(patient?.person?.attributes, 'Emergency Contact Name');
            break;
        case 'Emergency Contact Number':
            value = getAttributeByName(patient?.person?.attributes, 'Emergency Contact Number');
            break;
        case 'Contact Type':
            value = getAttributeByName(patient?.person?.attributes, 'Contact Type');
            break;
        case 'Occupation':
            value = getAttributeByName(patient?.person?.attributes, 'occupation');
            break;
        case 'Education':
            value = getAttributeByName(patient?.person?.attributes, 'Education Level');
            break;
        case 'National ID':
            value = getAttributeByName(patient?.person?.attributes, 'NationalID');
            break;
        case 'Economic Category':
            value = getAttributeByName(patient?.person?.attributes, 'Economic Status');
            break;
        case 'Social Category':
            value = getAttributeByName(patient?.person?.attributes, 'Caste');
            break;
        case 'ABHA Address': 
            value = getIdentifierByName(patient?.identifiers, 'Abha Address') ?? getIdentifierByName(patient?.identifiers, 'Abha Number');
            if(value && !value.includes('@') && !value.includes(process.env.ABHA_ADDRESS_SUFFIX)) {
                value = `${value}${process.env.ABHA_ADDRESS_SUFFIX}`
            }
            break;
        case 'ABHA Number': 
            value = getIdentifierByName(patient?.identifiers, 'Abha Number');
            break;
        case 'Corresponding Address 1':
            value = patient?.person?.preferredAddress?.address1;
            break;
        case 'Corresponding Address 2':
            value = patient?.person?.preferredAddress?.address2;
            break;
        case 'Village/Town/City':
            value = patient?.person?.preferredAddress?.cityVillage;
            break;
        case 'District':
            value = patient?.person?.preferredAddress?.countyDistrict;
            break;
        case 'State':
            value = patient?.person?.preferredAddress?.stateProvince;
            break;
        case 'Country':
            value = patient?.person?.preferredAddress?.country;
            break;
        case 'Postal Code':
            value = patient?.person?.preferredAddress?.postalCode;
            break;
        default:
            break;
    }
    return value;
}


/**
 * Get patient personal information
 * @param {*} patient 
 * @returns
 */
function getPersonalInfo(patient) {
    const data = {
        colSpan: 4,
        layout: 'noBorders',
        table: {
            widths: ['*', '*', '*', '*'],
            body: [
                [
                    {
                        colSpan: 4,
                        text: `Personal Information`,
                        style: 'subheader'
                    },
                    '',
                    '',
                    ''
                ]
            ]
        }
    };
    const other = [{
        stack: [
            { text: 'Name', style: 'subsubheader' },
            { text: patient?.person?.display ?? 'NA', style: 'pval' }
        ]
    }];

    [
        'Gender',
        'Date of Birth',
        'Age',
        'Phone Number'
    ].forEach((v) => {
        const value = getPatientRegField(patient, v);
        if (value !== 'NA' && value) {
            other.push({
                stack: [
                    { text: v, style: 'subsubheader' },
                    { text: value, style: 'pval' }
                ]
            });
        }
    })

    const chunkSize = 4;
    for (let i = 0; i < other.length; i += chunkSize) {
        const chunk = other.slice(i, i + chunkSize);
        if (chunk.length == chunkSize) {
            data.table.body.push([...chunk]);
        } else {
            for (let x = chunk.length; x < chunkSize; x++) {
                chunk[x] = '';
            }
            data.table.body.push([...chunk]);
        }
    }

    return data;
}

/**
 * Get patient Address Information
 * @param {*} patient 
 * @returns
 */
function getAddress(patient) {
    const data = {
        colSpan: 4,
        layout: 'noBorders',
        table: {
            widths: ['*', '*', '*', '*'],
            body: []
        }
    };
    data.table.body.push([
        {
            colSpan: 4,
            text: `Address`,
            style: 'subheader'
        },
        '',
        '',
        ''
    ]);
    const other = [];
    [
        'Corresponding Address 1',
        'Corresponding Address 2',
        'Village/Town/City',
        'District',
        'State',
        'Country',
        'Postal Code'
    ].forEach((v) => {
        const value = getPatientRegField(patient, v);
        if (value) {
            other.push({
                stack: [
                    { text: v, style: 'subsubheader' },
                    { text: value, style: 'pval' }
                ]
            });
        }
    })


    const chunkSize = 4;
    for (let i = 0; i < other.length; i += chunkSize) {
        const chunk = other.slice(i, i + chunkSize);
        if (chunk.length == chunkSize) {
            data.table.body.push([...chunk]);
        } else {
            for (let x = chunk.length; x < chunkSize; x++) {
                chunk[x] = '';
            }
            data.table.body.push([...chunk]);
        }
    }
    return data;
}

/**
 * Get patient other Information
 * @param {*} patient 
 * @returns
 */
function getOtherInfo(patient) {
    const data = {
        colSpan: 4,
        layout: 'noBorders',
        table: {
            widths: ['*', '*', '*', '*'],
            body: []
        }
    };
    data.table.body.push([
        {
            colSpan: 4,
            text: `Other Information`,
            style: 'subheader'
        },
        '',
        '',
        ''
    ]);
    let other = [];
    [
        'Occupation',
        'Education',
        'National ID',
        'Economic Category',
        'Social Category',
        'ABHA Address',
        'ABHA Number'
    ].forEach((v) => {
        const value = getPatientRegField(patient, v)
        if (value != 'NA' && value) {
            other.push({
                stack: [
                    { text: v, style: 'subsubheader' },
                    { text: value, style: 'pval' }
                ]
            });
        }
    })

    const chunkSize = 4;
    for (let i = 0; i < other.length; i += chunkSize) {
        const chunk = other.slice(i, i + chunkSize);
        if (chunk.length == chunkSize) {
            data.table.body.push([...chunk]);
        } else {
            for (let x = chunk.length; x < chunkSize; x++) {
                chunk[x] = '';
            }
            data.table.body.push([...chunk]);
        }
    }
    return data;
}

/**
 * Get consultant doctor details from encounter and it's provider
 * @param {*} enc 
 * @returns 
 */
function getDoctorDetail(enc) {
    let consultedDoctor = {};
    for (const obs of enc.obs) {
        if (obs.concept.display === VISIT_TYPES.DOCTOR_DETIALS) {
            consultedDoctor = JSON.parse(obs.value)
        }
    }
    const p = enc.encounterProviders?.[0]?.provider;
    consultedDoctor.encounterDatetime = enc?.encounterDatetime
    consultedDoctor.gender = getGender(p?.provider?.person?.gender);
    consultedDoctor.person_uuid = p?.provider?.person?.uuid;
    consultedDoctor.signature = p?.provider?.attributes?.find(a => a?.attributeType?.display === 'signature')?.value ?? '';
    return consultedDoctor;
}

/**
  * Get rows for make pdf doc defination for a given type
  * @param {string} type - row type
  * @return {any} - Rows
  */
function getRecords(encountersRecords, type) {
    let records = []
    switch (type) {
        case 'diagnosis':
            if (encountersRecords[VISIT_TYPES.TELEMEDICINE_DIAGNOSIS].length) {
                records = encountersRecords[VISIT_TYPES.TELEMEDICINE_DIAGNOSIS];
            } else {
                records.push([{ text: 'No diagnosis added', colSpan: 3, alignment: 'center' }]);
            }
            break;
        case 'medication':
            if (encountersRecords[VISIT_TYPES.MEDICATIONS].length) {
                records = encountersRecords[VISIT_TYPES.MEDICATIONS];
            } else {
                records.push([{ text: 'No medicines added', colSpan: 5, alignment: 'center' }]);
            }
            break;
        case 'additionalInstruction':
            if (encountersRecords[VISIT_TYPES.ADDITIONAL_INSTURCTION].length) {
                records = encountersRecords[VISIT_TYPES.ADDITIONAL_INSTURCTION]
            } else {
                records.push([{ text: 'No additional instructions added' }]);
            }
            break;
        case 'medical_history':
            if (encountersRecords[VISIT_TYPES.MEDICAL_HISTORY].length) {
                records = encountersRecords[VISIT_TYPES.MEDICAL_HISTORY]
            } else {
                records.push([{ text: 'No medical history', colSpan: 2, alignment: 'center' }]);
            }
            break;
        case 'advice':
            if (encountersRecords[VISIT_TYPES.MEDICAL_ADVICE].length) {
                records = encountersRecords[VISIT_TYPES.MEDICAL_ADVICE];
            } else {
                records.push([{ text: 'No advices added' }]);
            }
            break;
        case 'test':
            if (encountersRecords[VISIT_TYPES.REQUESTED_TESTS].length) {
                records = encountersRecords[VISIT_TYPES.REQUESTED_TESTS];
            } else {
                records.push([{ text: 'No tests added' }]);
            }
            break;
        case 'referral':
            if (encountersRecords[VISIT_TYPES.REFERRAL].length) {
                encountersRecords[VISIT_TYPES.REFERRAL].forEach(([
                    speciality = '-', facility = '-', priority = '-', reason = '-']) => {
                    records.push([speciality, facility, priority, reason]);
                });
            } else {
                records.push([{ text: 'No referrals added', colSpan: 4, alignment: 'center' }]);
            }
            break;
        case 'followUp':
            if (encountersRecords[VISIT_TYPES.FOLLOW_UP_VISIT]) {
                records.push(encountersRecords[VISIT_TYPES.FOLLOW_UP_VISIT])
            } else {
                records.push([{ text: 'No followup added', colSpan: 4, alignment: 'center' }]);
            }
            break;
        case 'cheifComplaint':
            if (encountersRecords[VISIT_TYPES.CURRENT_COMPLAINT].cheifComplaint.length) {
                records = encountersRecords[VISIT_TYPES.CURRENT_COMPLAINT].cheifComplaint;
            }
            break;
        case 'associated_symptoms':
            if (encountersRecords[VISIT_TYPES.CURRENT_COMPLAINT].associated_symptoms.length) {
                records.push([{ text: 'Associated symptoms', style: 'subSectionheader', bold: true, colSpan: 2 }, ''])
                records.push([
                    {
                        colSpan: 2,
                        ul: [
                            ...encountersRecords[VISIT_TYPES.CURRENT_COMPLAINT].associated_symptoms
                        ]
                    }
                ]);
            }
            break;
        case 'physical_examination':
            if (encountersRecords[VISIT_TYPES.PHYSICAL_EXAMINATION].length) {
                records.push([
                    {
                        colSpan: 2,
                        ul: [
                            ...encountersRecords[VISIT_TYPES.PHYSICAL_EXAMINATION]
                        ]
                    }
                ]);
            }
            break;
        case 'abdomen_examination':
            if (encountersRecords[VISIT_TYPES.ABDOMEN_EXAMINATION].length) {
                // records.push([{ text: 'Abdomen', style: 'subSectionheader', bold: true, colSpan: 2 }, ''])
                records.push([
                    {
                        colSpan: 2,
                        ul: [
                            ...encountersRecords[VISIT_TYPES.ABDOMEN_EXAMINATION]
                        ]
                    }
                ]);
            }
            break;
        case VISIT_TYPES.VITALS:
            records = encountersRecords[VISIT_TYPES.VITALS];
            break;
    }
    return records;
}

function getEncountersRecords(encounters = [], doctorDetail = null) {
    const encounterType = {
        [VISIT_TYPES.VITALS]: [],
        [VISIT_TYPES.TELEMEDICINE_DIAGNOSIS]: [],
        [VISIT_TYPES.CURRENT_COMPLAINT]: {
            "cheifComplaint": [],
            "symptoms": [],
            "associated_symptoms": []
        },
        [VISIT_TYPES.PHYSICAL_EXAMINATION]: [],
        [VISIT_TYPES.ABDOMEN_EXAMINATION]: [],
        [VISIT_TYPES.MEDICAL_HISTORY]: [],
        [VISIT_TYPES.VISIT_NOTE]: [],
        [VISIT_TYPES.REFERRAL]: [],
        [VISIT_TYPES.MEDICAL_ADVICE]: [],
        [VISIT_TYPES.MEDICATIONS]: [],
        [VISIT_TYPES.ADDITIONAL_INSTURCTION]: [],
        [VISIT_TYPES.REQUESTED_TESTS]: [],
        [VISIT_TYPES.DOCTOR_DETIALS]: null,
        [VISIT_TYPES.FOLLOW_UP_VISIT]: null
    }
    for (const enc of encounters) {
        if (enc.encounterType.display === VISIT_TYPES.ADULTINITIAL) {
            for (const obs of enc.obs) {

                if (obs.concept.display === VISIT_TYPES.CURRENT_COMPLAINT) {
                    getCheckUpReason(encounterType[VISIT_TYPES.CURRENT_COMPLAINT], obs)
                }

                if (obs.concept.display === VISIT_TYPES.PHYSICAL_EXAMINATION) {
                    const physicalExam = getData(obs)?.value.replace(new RegExp('<br/>►', 'g'), '').split('<b>');

                    for (let i = 0; i < physicalExam.length; i++) {
                        if (physicalExam[i]) {
                            const splitByBr = physicalExam[i].split('<br/>');
                            if (splitByBr[0].includes('Abdomen')) {
                                encounterType[VISIT_TYPES.ABDOMEN_EXAMINATION].push([{ text: splitByBr[0].replace('</b>', '').replace(':', '').trim(), style: 'subSectionheader', colSpan: 2 }]);
                                const ph_data = {
                                    colSpan: 2,
                                    ul: []
                                };
                                for (let k = 1; k < splitByBr.length; k++) {
                                    if (splitByBr[k].trim()) {
                                        ph_data.ul.push({ text: [{ text: `${splitByBr[k].replace('• ', '')} : `, bold: true }, `None`], margin: [0, 5, 0, 5] });
                                    }
                                }
                                encounterType[VISIT_TYPES.ABDOMEN_EXAMINATION].push([ph_data])
                            } else {
                                const ph_data = {
                                    colSpan: 2,
                                    ul: []
                                };
                                encounterType[VISIT_TYPES.PHYSICAL_EXAMINATION].push([{ text: splitByBr[0].replace('</b>', '').replace(':', '').trim(), style: 'subSectionheader', colSpan: 2 }]);
                                for (let k = 1; k < splitByBr.length; k++) {
                                    if (splitByBr[k].trim()) {
                                        const splitByDash = splitByBr[k].split('-');
                                        ph_data.ul.push({ text: [{ text: `${splitByDash[0].replace('• ', '')} : `, bold: true }, splitByDash.slice(1, splitByDash.length).join('-')], margin: [0, 5, 0, 5] });
                                    }
                                }
                                encounterType[VISIT_TYPES.PHYSICAL_EXAMINATION].push([ph_data])
                            }
                        }
                    }
                }

                if (obs.concept.display === VISIT_TYPES.MEDICAL_HISTORY) {
                    const ph_data = {
                        colSpan: 2,
                        ul: []
                    };
                    const medicalHistory = getData(obs)?.value.split('<br/>');
                    encounterType[VISIT_TYPES.MEDICAL_HISTORY].push([{ text: `Patient history`, style: 'subSectionheader', colSpan: 2 }])
                    for (let i = 0; i < medicalHistory.length; i++) {
                        if (medicalHistory[i]) {
                            const splitByDash = medicalHistory[i]?.split('-') ?? [];
                            const value = splitByDash?.slice(1, splitByDash.length)?.join('-')?.trim();
                            const label = splitByDash[0]?.replace('• ', '')?.trim() ?? ''
                            ph_data.ul.push({ text: [{ text: `${label} : `, bold: true }, `${value ? value : 'None'}`], margin: [0, 5, 0, 5] });
                        }
                    }
                    encounterType[VISIT_TYPES.MEDICAL_HISTORY].push([ph_data]);

                }

                if (obs.concept.display === VISIT_TYPES.FAMILY_HISTORY) {
                    const ph_data = {
                        colSpan: 2,
                        ul: []
                    };
                    const medicalHistory = getData(obs)?.value.split('<br/>');
                    encounterType[VISIT_TYPES.MEDICAL_HISTORY].push([{ text: `Family history`, style: 'subSectionheader', colSpan: 2 }])
                    for (let i = 0; i < medicalHistory.length; i++) {
                        if (medicalHistory[i]) {
                            if (medicalHistory[i].includes(':')) {
                                const splitByColon = medicalHistory[i]?.split(':') ?? [];
                                const splitByDot = splitByColon[1]?.trim()?.split("•") ?? [];
                                splitByDot.forEach(element => {
                                    if (element.trim()) {
                                        const splitByComma = element.split(',');
                                        ph_data.ul.push({ text: [{ text: `${splitByComma?.shift()?.trim()} ${splitByComma.length ? ':' : ''} `, bold: true }, `${splitByComma.length ? splitByComma.toString().trim() : ""}`], margin: [0, 5, 0, 5] });
                                    }
                                })
                            } else {
                                const label = medicalHistory[i]?.replace('•', '')?.trim() ?? ''
                                ph_data.ul.push({ text: [{ text: `${label}`, bold: true }], margin: [0, 5, 0, 5] });
                            }

                        }
                    }
                    encounterType[VISIT_TYPES.MEDICAL_HISTORY].push([ph_data]);
                }
            };
        }

        if (enc.encounterType.display === VISIT_TYPES.VITALS) {
            for (const obs of enc.obs) {
                encounterType[VISIT_TYPES.VITALS].push({ text: [{ text: `${obs?.concept?.display} : `, bold: true }, `${obs.uuid && obs.value ? obs.value : `No information`}`], margin: [0, 5, 0, 5] })
            }
        }

        if (enc.encounterType.display === VISIT_TYPES.VISIT_NOTE) {
            for (const obs of enc.obs) {

                if (obs.concept.display === VISIT_TYPES.FOLLOW_UP_VISIT) {
                    let followUpDate, followUpTime, followUpReason, wantFollowUp;
                    if (obs?.value?.includes('Time:')) {
                        followUpDate = (obs.value.includes('Time:')) ? moment(obs.value.split(', Time: ')[0]).format('DD MMM YYYY') : moment(obs.value.split(', Remark: ')[0]).format('DD MMM YYYY');
                        followUpTime = (obs.value.includes('Time:')) ? obs.value.split(', Time: ')[1].split(', Remark: ')[0] : null;
                        followUpReason = (obs.value.split(', Remark: ')[1]) ? obs.value.split(', Remark: ')[1] : null;
                        wantFollowUp = 'Yes';
                    } else {
                        wantFollowUp = 'No';
                    }
                    encounterType[VISIT_TYPES.FOLLOW_UP_VISIT] = [
                        wantFollowUp,
                        followUpDate ?? '-',
                        followUpTime ?? '-',
                        followUpReason ?? '-'
                    ];
                }

                if (obs.concept.display === VISIT_TYPES.JSV_MEDICATIONS || obs.concept.display === VISIT_TYPES.MEDICATIONS) {
                    if (obs.value.includes(':')) {
                        const [one = '', two = '', three = '', four = '', five = ''] = obs?.value?.split(':');
                        encounterType[VISIT_TYPES.MEDICATIONS].push([one, two, three, four, five]);
                    } else if (obs.value) {
                        encounterType[VISIT_TYPES.ADDITIONAL_INSTURCTION].push({ text: obs.value, margin: [0, 5, 0, 5] })
                    }
                }

                if (obs.concept.display === VISIT_TYPES.TELEMEDICINE_DIAGNOSIS) {
                    const diagnosis = obs.value.split(':');
                    if (diagnosis) {
                        const [one = '', two = ''] = diagnosis;
                        const [three = '', four = ''] = two.split('&');
                        encounterType[VISIT_TYPES.TELEMEDICINE_DIAGNOSIS].push([one.trim(), three?.trim(), four?.trim()])
                    }
                }

                if (obs.concept.display === VISIT_TYPES.MEDICAL_ADVICE) {
                    encounterType[VISIT_TYPES.MEDICAL_ADVICE].push({ text: obs.value, margin: [0, 5, 0, 5] })
                }

                if (obs.concept.display === VISIT_TYPES.REQUESTED_TESTS) {
                    encounterType[VISIT_TYPES.REQUESTED_TESTS].push({ text: obs.value, margin: [0, 5, 0, 5] })
                }

                if (obs.concept.display === VISIT_TYPES.REFERRAL) {
                    const obs_values = obs?.value?.split(':');
                    if (obs_values?.length) {
                        encounterType[VISIT_TYPES.REFERRAL].push([obs_values[0].trim(), obs_values[1]?.trim(), obs_values[2]?.trim(), obs_values[3]?.trim() ? obs_values[3]?.trim() : '-'])
                    }
                }

                if (obs.concept.display === VISIT_TYPES.DOCTOR_DETIALS && !doctorDetail) {
                    encounterType[VISIT_TYPES.DOCTOR_DETIALS] = getDoctorDetail(enc);
                }
            }
        }

        if (enc.encounterType.display === VISIT_TYPES.VISIT_COMPLETE && !doctorDetail) {
            encounterType[VISIT_TYPES.DOCTOR_DETIALS] = getDoctorDetail(enc);
        }
    };
    return encounterType;
}


async function downloadPrescription(visit, doctorDetail = null) {
    return new Promise((resolve, reject) => {
        try {
            pdfMake.vfs = pdfFonts.pdfMake.vfs
            const encountersRecords = getEncountersRecords(visit?.encounters, doctorDetail);
            const consultedDoctor = doctorDetail ? doctorDetail : encountersRecords[VISIT_TYPES.DOCTOR_DETIALS];

            const pdfObj = {
                pageSize: 'A4',
                pageOrientation: 'portrait',
                pageMargins: [20, 50, 20, 40],
                watermark: { text: 'INTELEHEALTH', color: '#cdcdcd', opacity: 0.1, bold: true, italics: false, angle: 0, fontSize: 50 },
                header: {
                    columns: [
                        { text: '' },
                        { image: logo.logo }
                    ]
                },
                footer: (currentPage, pageCount) => {
                    return {
                        columns: [
                            [{ text: (pageCount === currentPage ? '*The diagnosis and prescription is through telemedicine consultation conducted as per applicable telemedicine guideline\n\n' : '\n\n'), bold: true, fontSize: 9, margin: [10, 0, 0, 0] }, { text: 'Copyright ©2023 Intelehealth, a 501 (c)(3) & Section 8 non-profit organisation', fontSize: 8, margin: [5, 0, 0, 0] }],
                            { text: '\n\n' + currentPage.toString() + ' of ' + pageCount, width: "7%", fontSize: 8, margin: [5, 5, 5, 5], alignment: 'right' }
                        ]
                    };
                },
                content: [
                    {
                        style: 'tableExample',
                        table: {
                            widths: ['25%', '30%', '22%', '23%'],
                            body: [
                                [
                                    {
                                        colSpan: 4,
                                        fillColor: '#E6FFF3',
                                        text: 'Intelehealth e-Prescription',
                                        alignment: 'center',
                                        style: 'header'
                                    },
                                    '',
                                    '',
                                    ''
                                ],
                                [
                                    getPersonalInfo(visit?.patient)
                                ],
                                [
                                    getAddress(visit?.patient)
                                ],
                                [
                                    getOtherInfo(visit?.patient)
                                ],
                                [
                                    {
                                        colSpan: 4,
                                        table: {
                                            widths: [30, '*'],
                                            headerRows: 1,
                                            body: [
                                                [{ image: 'consultation', width: 25, height: 25, border: [false, false, false, true] }, { text: 'Consultation details', style: 'sectionheader', border: [false, false, false, true] }],
                                                [
                                                    {
                                                        colSpan: 2,
                                                        ul: [
                                                            { text: [{ text: 'Patient ID:', bold: true }, ` ${getIdentifierByName(visit?.patient?.identifiers, 'OpenMRS ID')}`], margin: [0, 5, 0, 5] },
                                                            { text: [{ text: 'Visit Start Date:', bold: true }, ` ${moment(visit?.startDatetime).format('DD MMM yyyy')}`], margin: [0, 5, 0, 5] },
                                                            { text: [{ text: 'Date of Consultation:', bold: true }, ` ${moment(consultedDoctor?.encounterDatetime).format('DD MMM yyyy')}`], margin: [0, 5, 0, 5] },
                                                            { text: [{ text: 'Clinic Name:', bold: true }, 'Intelehealth Telemedicine, Maharashtra'], margin: [0, 5, 0, 5] },
                                                        ]
                                                    }
                                                ]
                                            ]
                                        },
                                        layout: {
                                            defaultBorder: false
                                        }
                                    },
                                    '',
                                    '',
                                    ''
                                ],
                                [
                                    {
                                        colSpan: 4,
                                        sectionName: 'vitals',
                                        table: {
                                            widths: [30, '*'],
                                            headerRows: 1,
                                            body: [
                                                [{ image: 'vitals', width: 25, height: 25, border: [false, false, false, true] }, { text: 'Vitals', style: 'sectionheader', border: [false, false, false, true] }],
                                                [
                                                    {
                                                        colSpan: 2,
                                                        ul: [
                                                            ...getRecords(encountersRecords, 'Vitals')
                                                        ]
                                                    }
                                                ]
                                            ]
                                        },
                                        layout: {
                                            defaultBorder: false
                                        }
                                    },
                                    '',
                                    '',
                                    ''
                                ],
                                [
                                    {
                                        colSpan: 4,
                                        table: {
                                            widths: [30, '*'],
                                            headerRows: 1,
                                            body: [
                                                [{ image: 'cheifComplaint', width: 25, height: 25, border: [false, false, false, true] }, { text: 'Chief complaint', style: 'sectionheader', border: [false, false, false, true] }],
                                                [
                                                    {
                                                        colSpan: 2,
                                                        ul: [
                                                            ...getRecords(encountersRecords, 'cheifComplaint')
                                                        ]
                                                    }
                                                ],
                                                ...getRecords(encountersRecords, 'associated_symptoms')
                                            ]
                                        },
                                        layout: {
                                            defaultBorder: false
                                        }
                                    },
                                    '',
                                    '',
                                    ''
                                ],
                                [
                                    {
                                        colSpan: 4,
                                        table: {
                                            widths: [30, '*'],
                                            headerRows: 1,
                                            body: [
                                                [{ image: 'physicalExamination', width: 25, height: 25, border: [false, false, false, true] }, { text: 'Physical examination', style: 'sectionheader', border: [false, false, false, true] }],
                                                ...getRecords(encountersRecords, 'physical_examination'),
                                                ...getRecords(encountersRecords, 'abdomen_examination')
                                            ]
                                        },
                                        layout: {
                                            defaultBorder: false
                                        }
                                    },
                                    '',
                                    '',
                                    ''
                                ],
                                [
                                    {
                                        colSpan: 4,
                                        table: {
                                            widths: [30, '*'],
                                            headerRows: 1,
                                            body: [
                                                [{ image: 'medicalHistory', width: 25, height: 25, border: [false, false, false, true] }, { text: 'Medical history', style: 'sectionheader', border: [false, false, false, true] }],
                                                ...getRecords(encountersRecords, 'medical_history')
                                            ]
                                        },
                                        layout: {
                                            defaultBorder: false
                                        }
                                    },
                                    '',
                                    '',
                                    ''
                                ],
                                [
                                    {
                                        colSpan: 4,
                                        table: {
                                            widths: [30, '*'],
                                            headerRows: 1,
                                            body: [
                                                [{ image: 'diagnosis', width: 25, height: 25, border: [false, false, false, true] }, { text: 'Diagnosis', style: 'sectionheader', border: [false, false, false, true] }],
                                                [
                                                    {
                                                        colSpan: 2,
                                                        table: {
                                                            widths: ['*', '*', '*'],
                                                            headerRows: 1,
                                                            body: [
                                                                [{ text: 'Diagnosis', style: 'tableHeader' }, { text: 'Type', style: 'tableHeader' }, { text: 'Status', style: 'tableHeader' }],
                                                                ...getRecords(encountersRecords, 'diagnosis')
                                                            ]
                                                        },
                                                        layout: 'lightHorizontalLines'
                                                    }
                                                ]
                                            ]
                                        },
                                        layout: {
                                            defaultBorder: false
                                        }
                                    },
                                    '',
                                    '',
                                    ''
                                ],
                                [
                                    {
                                        colSpan: 4,
                                        table: {
                                            widths: [30, '*'],
                                            headerRows: 1,
                                            body: [
                                                [{ image: 'medication', width: 25, height: 25, border: [false, false, false, true] }, { text: 'Medication', style: 'sectionheader', border: [false, false, false, true] }],
                                                [
                                                    {
                                                        colSpan: 2,
                                                        table: {
                                                            widths: ['*', 'auto', 'auto', 'auto', 'auto'],
                                                            headerRows: 1,
                                                            body: [
                                                                [{ text: 'Drug name', style: 'tableHeader' }, { text: 'Strength', style: 'tableHeader' }, { text: 'No. of days', style: 'tableHeader' }, { text: 'Timing', style: 'tableHeader' }, { text: 'Remarks', style: 'tableHeader' }],
                                                                ...getRecords(encountersRecords, 'medication')
                                                            ]
                                                        },
                                                        layout: 'lightHorizontalLines'
                                                    }
                                                ],
                                                [{ text: 'Additional Instructions:', style: 'sectionheader', colSpan: 2 }, ''],
                                                [
                                                    {
                                                        colSpan: 2,
                                                        ul: [
                                                            ...getRecords(encountersRecords, 'additionalInstruction')
                                                        ]
                                                    }
                                                ]
                                            ]
                                        },
                                        layout: {
                                            defaultBorder: false
                                        }
                                    },
                                    '',
                                    '',
                                    ''
                                ],
                                [
                                    {
                                        colSpan: 4,
                                        table: {
                                            widths: [30, '*'],
                                            headerRows: 1,
                                            body: [
                                                [{ image: 'advice', width: 25, height: 25, border: [false, false, false, true] }, { text: 'Advice', style: 'sectionheader', border: [false, false, false, true] }],
                                                [
                                                    {
                                                        colSpan: 2,
                                                        ul: [
                                                            ...getRecords(encountersRecords, 'advice')
                                                        ]
                                                    }
                                                ]
                                            ]
                                        },
                                        layout: {
                                            defaultBorder: false
                                        }
                                    },
                                    '',
                                    '',
                                    ''
                                ],
                                [
                                    {
                                        colSpan: 4,
                                        table: {
                                            widths: [30, '*'],
                                            headerRows: 1,
                                            body: [
                                                [{ image: 'test', width: 25, height: 25, border: [false, false, false, true] }, { text: 'Test', style: 'sectionheader', border: [false, false, false, true] }],
                                                [
                                                    {
                                                        colSpan: 2,
                                                        ul: [
                                                            ...getRecords(encountersRecords, 'test')
                                                        ]
                                                    }
                                                ]
                                            ]
                                        },
                                        layout: {
                                            defaultBorder: false
                                        }
                                    },
                                    '',
                                    '',
                                    ''
                                ],
                                [
                                    {
                                        colSpan: 4,
                                        table: {
                                            widths: [30, '*'],
                                            headerRows: 1,
                                            body: [
                                                [{ image: 'referral', width: 25, height: 25, border: [false, false, false, true] }, { text: 'Referral Out', style: 'sectionheader', border: [false, false, false, true] }],
                                                [
                                                    {
                                                        colSpan: 2,
                                                        table: {
                                                            widths: ['30%', '30%', '10%', '30%'],
                                                            headerRows: 1,
                                                            body: [
                                                                [{ text: 'Referral to', style: 'tableHeader' }, { text: 'Referral facility', style: 'tableHeader' }, { text: 'Priority', style: 'tableHeader' }, { text: 'Referral for (Reason)', style: 'tableHeader' }],
                                                                ...getRecords(encountersRecords, 'referral')
                                                            ]
                                                        },
                                                        layout: 'lightHorizontalLines'
                                                    }
                                                ]
                                            ]
                                        },
                                        layout: {
                                            defaultBorder: false
                                        }
                                    },
                                    '',
                                    '',
                                    ''
                                ],
                                [
                                    {
                                        colSpan: 4,
                                        table: {
                                            widths: [30, '*'],
                                            headerRows: 1,
                                            body: [
                                                [{ image: 'followUp', width: 25, height: 25, border: [false, false, false, true] }, { text: 'Follow-up', style: 'sectionheader', border: [false, false, false, true] }],
                                                [
                                                    {
                                                        colSpan: 2,
                                                        table: {
                                                            widths: ['30%', '30%', '10%', '30%'],
                                                            headerRows: 1,
                                                            body: [
                                                                [{ text: 'Follow-up Requested', style: 'tableHeader' }, { text: 'Date', style: 'tableHeader' }, { text: 'Time', style: 'tableHeader' }, { text: 'Reason', style: 'tableHeader' }],
                                                                ...getRecords(encountersRecords, 'followUp')
                                                            ]
                                                        },
                                                        layout: 'lightHorizontalLines'
                                                    }
                                                ]
                                            ]
                                        },
                                        layout: {
                                            defaultBorder: false
                                        }
                                    },
                                    '',
                                    '',
                                    ''
                                ],
                                [
                                    {
                                        colSpan: 4,
                                        alignment: 'right',
                                        stack: [
                                            consultedDoctor?.signature ? { image: `${consultedDoctor.signature}`, width: 100, height: 100, margin: [0, 5, 0, 5] } : { text: ``, margin: [0, 5, 0, 5] },
                                            consultedDoctor?.name ? { text: `Dr. ${consultedDoctor?.name}`, margin: [0, -30, 0, 0] } : { text: ``, margin: [0, 5, 0, 5] },
                                            consultedDoctor?.typeOfProfession ? { text: `${consultedDoctor?.typeOfProfession}` } : { text: ``, margin: [0, 5, 0, 5] },
                                            consultedDoctor?.registrationNumber ? { text: `Registration No. ${consultedDoctor?.registrationNumber}` } : { text: ``, margin: [0, 5, 0, 5] },
                                        ]
                                    },
                                    '',
                                    '',
                                    ''
                                ]
                            ]
                        },
                        layout: 'noBorders'
                    }
                ],
                images: { ...precription, ...visitImage, ...logo },
                styles: {
                    header: {
                        fontSize: 14,
                        bold: true,
                        margin: [0, 10, 0, 10]
                    },
                    subheader: {
                        fontSize: 12,
                        bold: true,
                        margin: [0, 2, 0, 2],
                    },
                    subsubheader: {
                        fontSize: 10,
                        bold: true,
                        margin: [0, 2, 0, 2]
                    },
                    pval: {
                        fontSize: 10,
                        margin: [0, 2, 0, 2]
                    },
                    tableExample: {
                        margin: [0, 5, 0, 5],
                        fontSize: 12
                    },
                    tableHeader: {
                        bold: true,
                        fontSize: 12,
                        color: 'black'
                    },
                    sectionheader: {
                        fontSize: 12,
                        bold: true,
                        margin: [0, 5, 0, 10]
                    }
                }
            };
            pdfMake.createPdf(pdfObj).getBase64((result) => {
                resolve({ success: true, content: result })
            })
        } catch (err) {
            logStream("error", err)
            resolve({ success: false, content: null, error: err })
        }
    })
}
module.exports = {
    downloadPrescription
}