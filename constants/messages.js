const MESSAGE = {
    COMMON: {
        BAD_REQUEST: "Bad request! Invalid arguments.",
        USER_NOT_EXIST: "No such user exists",
        INVALID_LINK: "Invalid link!",
        FILE_MUST_BE_PASSED: "File must be passed!",
        UPDATED_SUCCESSFULLY: "Updated successfully!",
        IMAGE_UPDATED: "Image updated",
        ADDED_SUCCESSFULLY: "Addedd successfully!",
        IMAGE_UPLOADED: "Image uploaded",
        SUCCESS: "Success"
    },
    AUTH: {
        BAD_REQUEST_ATTRIBUTE_SHOULD_BE_EMAILID_PHONE_NUMBER: "Bad request! Attribute type should be emailId/phoneNumber."
    },
    NOTIFICATION: {
        NOTIFICATION_SNOOZED_SUCCESSFULLY: "Notification snoozed successfully!",
        SNOOZED_SUCCESSFULLY: "Snoozed successfully!",
        SETTINGS_RECEVIED_SUCCESSFULLY: "Settings recevied successfully.",
        PLEASE_PASS_CORRECT_USER_UUID: "Please pass correct user uuid!",
        SETTINGS_SAVED_SUCCESSFULLY: "Settings saved successfully.",
        DATA_NOT_FOUND_WITH_THIS_USER_UUID: "Data not found with this user uuid.",
        NOTIFICATION_STATUS_CHANGED_SUCCESSFULLY: "Notification status changed successfully!"
    },
    APPOINTMENT: {
        APPOINTMENT_PUSH_SUCCESSFULLY: "Appointment push successfully!"
    },
    LINK: {
        PLEASE_PASS_LINK: "Please pass link"
    },
    MINDMAP:{
        PLEASE_ENTER_A_LICENCE_KEY : "Please enter a licence key",
        MINDMAP_UPDATED_SUCCESSFULLY: "Mindmap updated successfully!",
        MINDMAP_ADDED_SUCCESSFULLY: "Mindmap added successfully!",
        PLEASE_ENTER_A_MINDMAP_KEY: "Please enter a mindmap key",
        PLEASE_PASS_A_MINDMAP_NAME: "Please pass a mindmapName",
        MINDMAP_DELETED_SUCCESSFULLY: "Mindmap deleted successfully!",
        PLEASE_PASS_A_LICENCE_KEY: "Please pass a licence key",
        LICENCE_KEY_DIDNOT_FOUND_IN_THE_DATABASE: "Licence key didn't found in the database",
        ACTIVE_STATUS_UPDATED_SUCCESSFULLY: "Active status updated successfully!",
        MINDMAP_NOT_FOUND: "Mindmap not found",
        LICENCE_KEY_EXPIRED: "Licence key expired"
    },
    OPENMRS: {
        VISIT_COUNT_FETCHED_SUCCESSFULLY: "Visit count fetched successfully"
    },
    SIGNATURE: {
        SIGNATURE_CREATED_SUCCESSFULLY: "Signature created successfully!",
        SIGNATURE_UPLOADED_SUCCESSFULLY: "Signature uploaded successfully!"
    },
    SUPPORT: {
        HEY_YOU_GOT_NEW_CHAT_MESSAGE_FROM_SUPPORT: 'Hey! You got new chat message from support'
    }
}

module.exports = {
    MESSAGE
}