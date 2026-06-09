/**
 * Parses drug history text and extracts medication information
 * @param {string} drugHistoryText - The drug history text to parse
 * @returns {Array} Array of parsed medication objects
 */
function parseDrugHistory(drugHistoryText) {
    if (!drugHistoryText || typeof drugHistoryText !== 'string') {
        console.warn('Invalid drug history text provided to parseDrugHistory');
        return [];
    }

    const medications = [];
    
    try {
        // Extract adherence (shared across all medications)
        const adherenceMatch = drugHistoryText.match(/Medication Adherence\s*-\s*([^.]+)/i);
        const adherence = adherenceMatch ? adherenceMatch[1].trim() : '';
        
        // Find all medication patterns (Medication name 1, Medication name 2, etc.)
        const medicationPattern = /Medication name\s+(\d+)\s*-\s*Medication Name\s*-\s*([^.]+?)\s*\.\s*From\s*-\s*([^.]+?)\s*\.\s*To\s*-\s*([^.]+?)\s*\./gi;
        
        let match;
        while ((match = medicationPattern.exec(drugHistoryText)) !== null) {
            const [, medicationNumber, medicationName, fromDate, toDate] = match;
            
            // Validate parsed data
            if (!medicationName || !fromDate || !toDate) {
                console.warn('Incomplete medication data found:', { medicationName, fromDate, toDate });
                continue;
            }
            
            medications.push({
                number: parseInt(medicationNumber) || medications.length + 1,
                name: medicationName.trim(),
                fromDate: fromDate.trim(),
                toDate: toDate.trim(),
                adherence: adherence
            });
        }
    } catch (error) {
        console.error('Error parsing drug history:', error);
    }
    
    return medications;
}


// Helper Functions for Medication Resources

/**
 * Parses medication observation value into structured components
 * @param {string} value - Observation value (format: "medication:dose:duration:frequency:remarks")
 * @returns {Object|null} Parsed medication values or null if invalid
 */
function parseMedicationObservation(value) {
    if (!value) return null;
    const parts = value.split(':');
    if (parts.length < 1) return null;
    
    return {
        name: parts?.[0] ?? '',
        dose: parts?.[1] ?? '',
        duration: parts?.[2] ?? '1',
        frequency: parseFrequencyPattern(parts?.[3]),
        remarks: parts?.[4] ?? ''
    };
}

/**
 * Parses frequency pattern to determine times per day
 * @param {string} frequency - Frequency pattern (e.g., "0-1-0", "1-1-1", "1-1-0")
 * @returns {number} Number of times per day
 */
function parseFrequencyPattern(frequency) {
    if (!frequency) return 1;
    
    // Handle dash-separated patterns (e.g., "0-1-0", "1-1-1")
    if (frequency.includes('-')) {
        const parts = frequency.split('-').map(part => parseInt(part.trim()) || 0);
        return parts.reduce((sum, part) => sum + part, 0);
    }
    
    // Handle simple numeric values
    const numericValue = parseInt(frequency);
    return isNaN(numericValue) ? 1 : numericValue;
}

/**
 * Builds human-readable dosage instruction text
 * @param {Object} parsed - Parsed medication values from parseMedicationObservation
 * @returns {string} Complete dosage instruction text
 */
function buildDosageInstruction(parsed) {
    if (!parsed) return '';
    
    let instruction = '';
    if (parsed.dose) instruction += parsed.dose;
    if (parsed.frequency) instruction += ` (${parsed.frequency}) times a Day`;
    if (parsed.duration) instruction += ` (Duration:${parsed.duration})`;
    if (parsed.remarks) instruction += ` Remark: ${parsed.remarks}`;
    
    return instruction;
}

/**
 * Builds FHIR R5 compliant dosage structure
 * @param {Object} parsed - Parsed medication values
 * @param {string} dosageText - Human-readable dosage instruction
 * @returns {Object} FHIR R5 Dosage structure
 */
function buildFHIRDosage(parsed, dosageText) {
    const dosage = { 
        text: dosageText,
        route: {
            coding: [
                {
                    system: "http://snomed.info/sct",
                    code: "26643006",
                    display: "Oral Route"
                }
            ]
        },
        method: {
            coding: [
                {
                    system: "http://snomed.info/sct",
                    code: "738995006",
                    display: "Swallow"
                }
            ]
        } 
    };
    
    // Add timing if frequency is specified
    if (parsed.frequency) {
        dosage.timing = {
            repeat: {
                frequency: parseInt(parsed.frequency),
                period: 1,
                periodUnit: "d"
            }
        };
    }

    dosage.additionalInstruction = [{
        coding: [
            {
                system: "http://snomed.info/sct",
                code: "311504000",
                display: "With or after food"
            }
        ],
        text: parsed.remarks ?? 'Other Instructions'
    }];

    dosage.patientInstruction = parsed.remarks ?? 'Other Instructions';
    
    // Add dose if specified
    if (parsed.dose) {
        // Parse dose to extract value and unit if possible
        const doseMatch = parsed.dose.match(/^([0-9.]+)\s*(.*)$/);
        let doseValue, doseUnit;
        
        if (doseMatch) {
            doseValue = parseFloat(doseMatch?.[1] ?? 1);
            doseUnit = doseMatch?.[2]?.trim() || 'unit';
        } else {
            doseValue = 1;
            doseUnit = 'unit';
        }
        
        dosage.doseAndRate = [
            {
                type: {
                    coding: [
                        {
                            system: "http://terminology.hl7.org/CodeSystem/dose-rate-type",
                            code: "ordered",
                            display: "Ordered"
                        }
                    ]
                },
                doseQuantity: {
                    value: doseValue,
                    unit: doseUnit
                }
            }
        ];
    }
    
    return dosage;
}

/**
 * Builds FHIR R5 dispenseRequest structure
 * @param {Object} parsed - Parsed medication values
 * @param {string} obsDatetime - Observation datetime in ISO format
 * @returns {Object} FHIR R5 dispenseRequest or empty object
 */
function buildDispenseRequest(parsed, obsDatetime) {
    const dispenseRequest = {};
    
    if (!parsed.duration) return dispenseRequest;
    
    // Parse duration (e.g., "7 days", "2 weeks", etc.)
    const durationMatch = String(parsed.duration).match(/(\d+)\s*(day|days|week|weeks|month|months)/i);
    if (!durationMatch) return dispenseRequest;
    
    const durationValue = parseInt(durationMatch[1]);
    const durationUnit = durationMatch[2].toLowerCase();
    
    // Map unit to UCUM code
    const unitMap = {
        'day': 'd', 'days': 'd',
        'week': 'wk', 'weeks': 'wk',
        'month': 'mo', 'months': 'mo'
    };
    const ucumUnit = unitMap[durationUnit] || 'd';
    
    // Build expectedSupplyDuration
    dispenseRequest.expectedSupplyDuration = {
        value: durationValue,
        unit: durationUnit,
        code: ucumUnit,
        system: "http://unitsofmeasure.org"
    };
    
    // Calculate validity period
    const startDate = new Date(obsDatetime);
    const endDate = new Date(startDate);
    const daysToAdd = ucumUnit === 'd' ? durationValue : 
                     ucumUnit === 'wk' ? durationValue * 7 : 
                     ucumUnit === 'mo' ? durationValue * 30 : durationValue;
    endDate.setDate(endDate.getDate() + daysToAdd);
    
    dispenseRequest.validityPeriod = {
        start: startDate.toISOString(),
        end: endDate.toISOString()
    };
    
    return dispenseRequest;
}


// Chief Complaints
/**
 * Helper function to clean and validate complaint text
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text
 */
const cleanComplaintText = (text) => {
    if (!text || typeof text !== 'string') return '';
    return text.trim().replace(/^•\s*/, '').replace(/\s*-\s*$/, '');
};

/**
 * Helper function to parse associated symptoms from complaint data
 * @param {Array} splitByBr - Array of complaint parts split by <br/>
 * @param {Object} visitType - Visit type object
 * @returns {Array} Array of formatted complaint strings
 */
function parseAssociatedSymptoms(splitByBr, visitType) {
    const complaints = [];
    const title = visitType.ASSOCIATED_SYMPTOMS;
    
    for (let j = 1; j < splitByBr.length; j += 2) {
        const key = cleanComplaintText(splitByBr[j]);
        const value = splitByBr[j + 1]?.trim();
        
        if (key && key.length > 1 && value) {
            complaints.push(`${title} - ${key} ${value}`);
        }
    }
    
    return complaints;
};

/**
 * Helper function to parse regular complaint data
 * @param {Array} splitByBr - Array of complaint parts split by <br/>
 * @returns {Array} Array of formatted complaint strings
 */
function parseRegularComplaints(splitByBr) {
    const complaints = [];
    const title = splitByBr[0]?.replace('</b>:', '') || '';
    
    for (let k = 1; k < splitByBr.length; k++) {
        const complaintText = splitByBr[k]?.trim();
        
        if (complaintText && complaintText.length > 1) {
            const splitByDash = complaintText.split('-');
            const key = cleanComplaintText(splitByDash[0]);
            const value = splitByDash.slice(1).join('-').trim();
            
            if (key && value) {
                complaints.push(`${title} - ${key} ${value}`);
            }
        }
    }
    
    return complaints;
};



/**
 * Categorizes medical history entries into history and allergies
 * @param {Array} medicalHistory - Array of medical history lines
 * @param {number} drugHistoryIndex - Index to exclude from processing
 * @returns {Object} Object containing categorized history and allergies arrays
 */
function categorizeMedicalHistoryEntries(medicalHistory, drugHistoryIndex = -1) {
    const history = [];
    const allergies = [];
    const lifestyle = [];
    const physicalActivity = [];
    const womenHealth = [];
    const generalAssessment = [];

    const isLifestyleKey = (text = '') => {
        const t = text.toLowerCase();
        return (
            t.includes('smok') ||
            t.includes('tobacco') ||
            t.includes('alcohol') ||
            t.includes('drink') ||
            t.includes('diet')
        );
    };

    const isPhysicalActivity = (text = '') => {
        const t = text.toLowerCase();
        return (
            t.includes('physical activity') ||
            t.includes('steps count') ||
            t.includes('slept daily') ||
            t.includes('calories')
        );
    };

    const isWomenHealth = (text = '') => {
        const t = text.toLowerCase();
        return (
            t.includes('pregnancy') ||
            t.includes('menopause') ||
            t.includes('menarche')
        );
    };

    const isGeneralAssessment = (text = '') => {
        const t = text.toLowerCase();
        return (
            t.includes('fluid intake') ||
            t.includes('blood glucose') ||
            t.includes('general wellness') ||
            t.includes('mental status')
        );
    };

    for (let i = 0; i < medicalHistory.length; i++) {
        if (medicalHistory[i] && i !== drugHistoryIndex) {
            const splitByDash = medicalHistory[i].split('-');
            const key = splitByDash[0].replace('• ', '').trim();
            const value = splitByDash.slice(1, splitByDash.length).join('-').trim();

            if (!key) continue;

            // Extract lifestyle (smoking/alcohol) separately and do not include in medical history
            if (isLifestyleKey(key)) {
                lifestyle.push({ key, value: value ?? 'None' });
                continue;
            }

            if (isPhysicalActivity(key)) {
                physicalActivity.push({ key, value: value ?? 'None' });
                continue;
            }

            if (isWomenHealth(key)) {
                womenHealth.push({ key, value: value ?? 'None' });
                continue;
            }

            if (isGeneralAssessment(key)) {
                generalAssessment.push({ key, value: value ?? 'None' });
                continue;
            }

            // Check if this is an allergy entry
            if (key.toLowerCase().includes('allerg')) {
                allergies.push(`${key}:${value ?? 'None'}`);
            } else {
                history.push(`${key}:${value ?? 'None'}`);
            }
        }
    }

    return { history, allergies, lifestyle, physicalActivity, womenHealth, generalAssessment };
}

module.exports = {
    parseDrugHistory,
    parseMedicationObservation,
    buildDosageInstruction,
    buildFHIRDosage,
    buildDispenseRequest,
    parseAssociatedSymptoms,
    parseRegularComplaints,
    categorizeMedicalHistoryEntries
}
