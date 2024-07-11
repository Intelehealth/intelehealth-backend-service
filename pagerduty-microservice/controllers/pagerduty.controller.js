const { api } = require('@pagerduty/pdjs');
const pd = api({ token: process.env.PAGERDUTY_API_TOKEN });
const {
    createTicketDatabase,
    getUserTicketsDatabase
} = require("../services/pagerduty.service");

const getPriorities = async (req, res, next) => {
    try {
        const priorities = await pd.get('/priorities');
        return res.status(200).json(priorities.data);
    } catch (error) {
        next(error);
    }
};

const getEscalationPolicies = async (req, res, next) => {
    try {
        const policies = await pd.get('/escalation_policies');
        return res.status(200).json(policies.data);
    } catch (error) {
        next(error);
    }
};

const getPriorityId = (priority) => {
    let id;
    switch (priority) {
        case 'high':
            id = process.env.HIGH_PRIORITY_ID;
            break;
        case 'medium':
            id = process.env.MEDIUM_PRIORITY_ID;
            break;
        case 'low':
            id = process.env.LOW_PRIORITY_ID;
            break;
        default:
            id = process.env.LOW_PRIORITY_ID;
            break;
    }
    return id;
};

const getPriorityFromId = (id) => {
    let priority;
    switch (id) {
        case process.env.HIGH_PRIORITY_ID:
            priority = 'high';
            break;
        case process.env.MEDIUM_PRIORITY_ID:
            priority = 'medium';
            break;
        case process.env.LOW_PRIORITY_ID:
            priority = 'low';
            break;
    }
    return priority;
};

const createTicket = async (req, res, next) => {
    try {
        const { title, description, priority = 'low' } = req.body;
        const { userId } = req.user?.data;
        const incident = await pd.post('/incidents', {
            data: {
                incident: {
                    type: "incident",
                    title,
                    service: {
                        id: process.env.PAGERDUTY_JIRA_SERVICE_ID,
                        type: "service_reference"
                    },
                    priority: {
                        id: getPriorityId(priority),
                        type: "priority"
                    },
                    urgency: "low",
                    body: {
                        type: "incident_body",
                        details: description
                    },
                    escalation_policy: {
                        id: process.env.PAGERDUTY_ESCALATION_POLICY_ID,
                        type: "escalation_policy"
                    }
                }
            }
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        const incident_data = await pd.get(`/incidents/${incident.resource.id}?include[]=external_references&include[]=body`);
        await createTicketDatabase(incident_data.data.incident, userId, getPriorityFromId(incident_data.data?.incident?.priority?.id));
        res.status(200).json(incident_data.data);
    } catch (error) {
        next(error);
    }
};

const getTicket = async (req, res, next) => {
    try {
        const { id } = req.params;
        const incident = await pd.get(`/incidents/${id}?include[]=external_references&include[]=body`);
        return res.status(200).json(incident.data);
    } catch (error) {
        next(error);
    }
};

const getPagingData = (data, page, limit) => {
    const { count: totalItems, rows: tickets } = data;
    const currentPage = page ? +page : 0;
    const totalPages = Math.ceil(totalItems / limit);
    return { totalItems, tickets, totalPages, currentPage };
};

const getUserTickets = async (req, res, next) => {
    try {
        const { page, size } = req.query;
        const { userId } = req.user?.data;
        const offset = (page - 1) * size;
        const data = await getUserTicketsDatabase(userId, +size, offset);
        return res.status(200).json(getPagingData(data, page, size));
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getPriorities,
    getEscalationPolicies,
    createTicket,
    getTicket,
    getUserTickets
};