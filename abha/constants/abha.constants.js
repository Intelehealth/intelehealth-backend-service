const OBSERVATION_TYPE = {
    'SYSTOLIC BLOOD PRESSURE': {
        type: 'sbp',
        unit: 'mmHg',
        name: 'SYSTOLIC BLOOD PRESSURE'
    },
    'BLOOD OXYGEN SATURATION': {
        type: 'bos',
        unit: 'mmHg',
        name: 'BLOOD OXYGEN SATURATION'
    },
    'Weight (kg)': {
        type: 'weight',
        unit: 'Kg',
        name: 'Weight'
    },
    'Height (cm)': {
        type: 'height',
        unit: 'CM',
        name: 'Height'
    },
    'DIASTOLIC BLOOD PRESSURE': {
        type: 'dbp',
        unit: 'mmHg',
        name: 'DIASTOLIC BLOOD PRESSURE'
    },
    'Pulse': {
        type: 'pulse',
        unit: 'BPM',
    },
    'BMI': {
        type: 'bmi',
        unit: 'kg/m2'
    },
    'TEMPERATURE (C)': {
        type: 'temperature',
        unit: '°C',
        name: 'TEMPERATURE'
    },
    'Respiratory rate': {
        type: 'rr',
        unit: 'RPM',
        name: 'Respiratory rate'
    },
    "FBS (mg/dl)": {
        type: 'FBS',
        unit: 'mg/dl',
        name: 'FBS'
    }
}
const VISIT_TYPES = {
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
    MEDICATIONS: 'MEDICATIONS',
    MEDICAL_ADVICE: 'MEDICAL ADVICE',
    REFERRAL: 'Referral',
    REQUESTED_TESTS: 'REQUESTED TESTS',
    ADDITIONAL_COMMENTS: 'Additional Comments',
    FOLLOW_UP_VISIT: 'Follow up visit',
    ATTACHMENT_UPLOAD: 'Attachment Upload',
    COMPLEX_IMAGE: "Complex Image"
};

module.exports = {
    VISIT_TYPES,
    OBSERVATION_TYPE
}