/**
 * Convert date to DD/MM/YYYY format
 * @param {string|Date} inputFormat - Input date in any valid date format
 * @returns {string|undefined} Date in DD/MM/YYYY format or undefined if input is invalid
 */
function convertDateToDDMMYYYY(inputFormat) {
    if (!inputFormat) return undefined
    function pad(s) { return (s < 10) ? '0' + s : s; }
    var d = new Date(inputFormat)
    return [pad(d.getDate()), pad(d.getMonth() + 1), d.getFullYear()].join('/')
}

/**
 * Convert date to ISO format
 * @param {string|Date} input - Input date in any valid date format
 * @returns {string} Date in ISO format or original input if conversion fails
 */
function convertDataToISO(input) {
    try {
        const date = new Date(input)
        return date?.toISOString()
    } catch (e) {
        return input
    }
}

/**
 * Parse observation data and handle JSON string values
 * @param {Object} data - Observation data object
 * @param {any} data.value - Value to be parsed if it's a JSON string
 * @returns {Object} Observation data with parsed value
 */
function getData(data) {
    if (data?.value?.toString().startsWith("{")) {
        let value = JSON.parse(data.value.toString());
        data.value = value["en"];
    }
    return data;
}

/**
 * Find identifier by name from an array of identifiers
 * @param {Array<Object>} identifiers - Array of identifier objects
 * @param {string} name - Name of the identifier to find
 * @returns {Object|undefined} Found identifier object or undefined
 */
function getIdentifierByName(identifiers = [], name) {
    return identifiers?.find((identifier) => identifier?.identifierType?.name === name)
}

/**
 * Find attribute by name from an array of attributes
 * @param {Array<Object>} attributes - Array of attribute objects
 * @param {string} name - Name of the attribute to find
 * @returns {Object|undefined} Found attribute object or undefined
 */
function getAttributeByName(attributes = [], name) {
    return attributes?.find((attribute) => attribute?.attributeType?.display === name)
}

/**
 * Convert gender code to full text
 * @param {string} gender - Gender code ('M' or 'F')
 * @returns {string} Full gender text ('Male' or 'Female') or empty string
 */
function getGender(gender) {
    if (gender === 'M') return "Male";
    if (gender === 'F') return "Female";
    return ''
}

/**
 * Handle and format error responses from various sources
 * @param {Error|Object} error - Error object or response object
 * @returns {Object} Formatted error object with message
 */
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

/**
 * Extract doctor details from encounters
 * @param {Array<Object>} encounters - Array of encounter objects
 * @returns {Object|undefined} Doctor details object or undefined
 * @property {string} encounterDatetime - Date and time of the encounter
 * @property {string} name - Doctor's name
 * @property {string} gender - Doctor's gender
 * @property {string} practitioner_id - Doctor's UUID
 * @property {string} person_uuid - Doctor's person UUID
 * @property {string} typeOfProfession - Doctor's profession type
 * @property {string} telecom - Doctor's contact number
 * @property {string} dateUpdated - Last update date
 * @property {string} registrationNumber - Doctor's registration number
 * @property {string} signature - Doctor's signature
 */
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

/**
 * Convert file response to data URL base64 format
 * @param {string} base64Data - Base64 encoded data
 * @param {string} mimeType - MIME type of the file (default: application/pdf)
 * @returns {string} Data URL in base64 format
 */
function convertToDataURL(base64Data, mimeType = 'application/pdf') {
    try {
        if (!base64Data) return '';
        return `data:${mimeType};base64,${base64Data}`;
    } catch (error) {
        console.error('Error converting to data URL:', error);
        return '';
    }
}

/**
 * Convert data to base64
 * @param {string|Object} data - Data to convert
 * @returns {string} Base64 encoded string
 */
function convertToBase64(response) {
    try {
        if (typeof response === 'string' && response?.data?.startsWith('data:')) {
            // If already a data URL, extract the base64 part
            return {
                data: response?.data,
                contentType: response?.headers['content-type']
            }
        }
        const contentType = response.headers['content-type'];
        const base64 = Buffer.from(response.data, 'binary').toString('base64');
        return {
            data: `data:${contentType};base64,${base64}`,
            contentType: contentType
        };
    } catch (error) {
        console.error('Error converting to base64:', error);
        return '';
    }
}

module.exports = {
    convertDateToDDMMYYYY,
    handleError,
    getDoctorDetail,
    convertDataToISO,
    getData,
    getIdentifierByName,
    getAttributeByName,
    getGender,
    convertToBase64,
    convertToDataURL
}