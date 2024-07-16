const { where } = require("sequelize");
const { PagerdutyTickets } = require("../models");
const { raw } = require("body-parser");
const { Sequelize } = require("../models");
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
        await PagerdutyTickets.update({ status: incident.status }, {
            where: {
                incident_id: incident?.id
            }
        });
    } catch (error) {
        return null;
    }
};

const getUserTicketsDatabase = async (user_id, limit, offset) => {
    try {
        const tickets = await PagerdutyTickets.findAndCountAll({
            where: {
                user_id
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


module.exports = {
    createTicketDatabase,
    getUserTicketsDatabase,
    updateTicketStatusDatabase,
    getUserTicketByincidentIdDatabase
}