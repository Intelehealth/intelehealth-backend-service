const { where, Op } = require("sequelize");
const { PagerdutyTickets } = require("../models");
const { raw } = require("body-parser");
const { Sequelize } = require("../models");
const { sequelize } = require("../handlers/mysql/mysqlOpenMrs");
const fs = require("fs");
const emailHelper = require("../handlers/email-helper");

const createTicketDatabase = async (incident, user_id, priority) => {
    try {
        await PagerdutyTickets.create({
            user_id,
            incident_id: incident.id,
            jira_ticket_id: incident.external_references[0]?.external_id ?? null,
            incident_key: incident.incident_key,
            title: incident.title,
            priority,
            urgency: incident.urgency,
            status: incident.status,
            resolvedAt: incident.resolvedAt
        });
    } catch (error) {
        throw error;
    }
};

const updateTicketStatusDatabase = async (event) => {
    try {
        if (
            event?.resource_type !== 'incident' 
            || event?.data?.type !== 'incident'
            || !['triggered','acknowledged','resolved'].includes(event?.data?.status)) {
            return;
        }
        const incident = event?.data
        const ticketDetails = await getUserTicketByincidentIdDatabase(incident?.id);
        if(ticketDetails){
            await PagerdutyTickets.update({ status: incident.status }, {
                where: {
                    incident_id: incident?.id
                }
            });
            if(['resolved'].includes(incident.status)){
                const statusArr = { resolved : "Resolved" };
                await sendEmail(ticketDetails.user_id,ticketDetails.title, statusArr[incident.status]);
            }
        }
    } catch (error) {
        return null;
    }
};

const getUserTicketsDatabase = async (user_id, limit, offset, search="") => {
    try {
        const tickets = await PagerdutyTickets.findAndCountAll({
            where: {
                user_id,
                title: {
                    [Op.like]: `%${search}%`,
                }
            },
            limit,
            offset,
            raw: true
        });
        return tickets;
    } catch (error) {
        throw error;
    }
};

const getUserTicketByincidentIdDatabase = async (incident_id) => {
    try {
        const tickets = await PagerdutyTickets.findOne({
            where: {
                incident_id: incident_id
            },
            raw: true
        });;
        return tickets;
    } catch (error) {
        throw error;
    }
};

const sendEmail = async (user_id, ticket_title, ticket_status) =>{
    try {
        let userData = await sequelize.query(`SELECT MAX(pa.value_reference) AS email FROM provider_attribute pa JOIN provider_attribute_type pat ON pa.attribute_type_id = pat.provider_attribute_type_id AND pat.name = "emailId" JOIN provider p ON p.provider_id = pa.provider_id JOIN users u ON u.person_id = p.person_id WHERE u.uuid = '${user_id}'`);
    
        if(userData){
            const email = userData.pop().pop().email;
            const ticketTemplate = fs
            .readFileSync("./common/emailtemplates/ticketTemplate.html", "utf8")
            .toString();

            const replacedTemplate = ticketTemplate
            .replaceAll("$ticket_status", ticket_status)
            .replaceAll("$ticket_title", ticket_title)
            
            const subject = "Ticket Updates";

            return await emailHelper.sendEmail(
                email,
                subject,
                replacedTemplate
                ).catch((error) => { throw error });
        }
    } catch(e){
        console.error(e);
    }
    
}


module.exports = {
    createTicketDatabase,
    getUserTicketsDatabase,
    updateTicketStatusDatabase,
    getUserTicketByincidentIdDatabase
}