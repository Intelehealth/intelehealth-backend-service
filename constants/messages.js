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
        BAD_REQUEST_ATTRIBUTE_SHOULD_BE_EMAILID_PHONE_NUMBER: "Bad request! Attribute type should be emailId/phoneNumber.",
        OTP_SENT_SUCCESSFULLY: "Otp sent successfully!",
        OTP_VERIFIED_SUCCESSFULLY: "Otp verified successfully!",
        OTP_EXPIRED: "Otp expired!",
        OTP_INCORRECT: "Otp incorrect!",
        VERIFICATION_CODE_FOR_FORGOT_PASSWORD: "Verification code for forgot password",
        VERIFICATION_CODE_FOR_SIGN_IN: "Verification code for sign in",
        YOUR_ACCOUNT_CREDENTIALS_AT_INTELEHEALTH: "Your account credentials at Intelehealth",
        PASSWORD_RESET_SUCCESSFUL: "Password reset successful.",
        NO_PHONENUMBER_EMAIL_UPDATED_FOR_THIS_USERNAME: "No phoneNumber/email updated for this username.",
        NO_USER_EXISTS_WITH_THIS_PHONE_NUMBER_EMAIL_USERNAME: "No user exists with this phone number/email/username."
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
        APPOINTMENT_PUSH_SUCCESSFULLY: "Appointment push successfully!",
        SCHEDULE_UPDATED_SUCCESSFULLY: "Schedule updated successfully",
        SCHEDULE_CREATED_SUCCESSFULLY: "Schedule created successfully",
        APPOINTMENT_UPDATED_SUCCESSFULLY:"Appointment updated successfully",
        APPOINTMENT_CREATED_SUCCESSFULLY:"Appointment created successfully",
        APPOINTMENT_NOT_FOUND: "Appointment not found!",
        APPOINTMENT_COMPLETED_SUCCESSFULLY:  "Appointment completed successfully!",
        APPOINTMENT_CANCELLED_SUCCESSFULLY: "Appointment cancelled successfully!",
        APPOINTMENT_FOR_THIS_VISIT_IS_ALREADY_PRESENT: "Appointment for this visit is already present.",
        APPOINTMENT_NOT_AVAILABLE_ITS_ALREADY_BOOKED: "Appointment not available, it's already booked.",
        INCORRECT_DATE_RANGE_FROMDATE_SHOULD_BE_GREATER_OR_EQUAL_TO_TODATE_DAY: "Incorrect date range - fromDate should be greater or equal to toDate day",
        ANOTHER_APPOINTMENT_HAS_ALREADY_BEEN_BOOKED_FOR_THIS_TIME_SLOT: "Another appointment has already been booked for this time slot."
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
        VISIT_COUNT_FETCHED_SUCCESSFULLY: "Visit count fetched successfully",
        INVALID_USERNAME: "Invalid username!",
        INVALID_PHONENUMBER: "Invalid phoneNumber!",
        REQUEST_OTP_FIRST: "Request OTP first!",
        OTP_SENT_SUCCESSFULLY: "Otp sent successfully!",
        OTP_EXPIRED_REQUEST_A_NEW_OTP: "OTP expired, request a new OTP!",
        INVALID_OTP: "Invalid OTP!",
        PASSWORD_RESET_SUCCESSFULLY: "Password reset successfully!",
        NO_ACTIVE_USED_FOUND_WITH_THE_PASSED_PHONENUMBER: `No Active used found with the passed phoneNumber!`
    },
    OPEN_AI: {
        CHAT_COMPLETION_CREATED_SUCCESSFULLY: "Chat completion created successfully!",
        GPT_MODEL_DELETED_SUCCESSFULLY: "GPT model deleted successfully!",
        GPT_MODEL_SET_AS_DEFAULT_SUCCESSFULLY: "GPT model set as default successfully!",
        CHAT_COMPLETION_CREATED_SUCCESSFULLY: "Chat completion created successfully!",
        LIST_OF_GPT_INPUTS_RETREIVED_SUCCESSFULLY: "List of GPT Inputs retreived successfully!",
        GPT_INPUT_ADDED_SUCCESSFULLY: "GPT Input added successfully!",
        GPT_INPUT_SET_AS_DEFAULT_SUCCESSFULLY: "GPT Input set as default successfully!",
        GPT_INPUT_DELETED_SUCCESSFULLY: "GPT Input deleted successfully!",
        GPT_MODEL_ADDED_SUCCESSFULLY: "GPT model added successfully!",
        CANT_DELETE_DEFAULT_GPT_INPUT_NO_GPT_INPUT_WITH_SUCH_ID_EXISTS: "Can't delete default GPT Input/No GPT Input with such id exists!"
    },
    SIGNATURE: {
        SIGNATURE_CREATED_SUCCESSFULLY: "Signature created successfully!",
        SIGNATURE_UPLOADED_SUCCESSFULLY: "Signature uploaded successfully!"
    },
    SUPPORT: {
        HEY_YOU_GOT_NEW_CHAT_MESSAGE_FROM_SUPPORT: 'Hey! You got new chat message from support'
    },
    PRESCRIPTION: {
        INVALID_LINK: "Invalid link!",
        INVALID_OTP: "Invalid OTP!"
    }
}

module.exports = {
    MESSAGE
}