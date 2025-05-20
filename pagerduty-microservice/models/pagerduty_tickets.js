"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
    class PagerdutyTickets extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
        }
    }
    PagerdutyTickets.init({
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER,
        },
        user_id: {
            allowNull: false,
            type: DataTypes.STRING
        },
        incident_id: {
            allowNull: false,
            unique: true,
            type: DataTypes.STRING
        },
        jira_ticket_id: {
            allowNull: true,
            unique: true,
            type: DataTypes.STRING
        },
        incident_key: {
            allowNull: true,
            type: DataTypes.STRING
        },
        title: {
            allowNull: false,
            type: DataTypes.TEXT
        },
        priority: {
            allowNull: false,
            type: DataTypes.ENUM(['high', 'low', 'medium']),
            defaultValue: 'low'
        },
        urgency: {
            allowNull: false,
            type: DataTypes.ENUM(['high', 'low']),
            defaultValue: 'low'
        },
        status: {
            allowNull: false,
            type: DataTypes.ENUM(['triggered', 'acknowledged', 'resolved']),
            defaultValue: 'triggered'
        },
        createdAt: {
            allowNull: false,
            type: DataTypes.DATE
        },
        resolvedAt: {
            allowNull: true,
            type: DataTypes.DATE
        },
        updatedAt: {
            allowNull: false,
            type: DataTypes.DATE
        }
    },
    {
        sequelize,
        timestamps: true,
        tableName: "pagerduty_tickets"
    });
    return PagerdutyTickets;
};
