"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class temp_storage extends Model {
    static associate(models) {
      // define association here
    }
  }
  temp_storage.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      resource_type: {
        type: DataTypes.ENUM("patient", "visit", "asset"),
        allowNull: false,
      },
      resource_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      parent_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      parent_type: {
        type: DataTypes.ENUM("patient", "visit", "asset"),
        allowNull: true,
      },
      data: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
        get() {
          const raw = this.getDataValue("data");
          try {
            return raw ? JSON.parse(raw) : null;
          } catch {
            return raw;
          }
        },
        set(value) {
          this.setDataValue("data", value ? JSON.stringify(value) : null);
        },
      },
      file_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      sync_status: {
        type: DataTypes.ENUM("pending", "synced"),
        allowNull: false,
        defaultValue: "pending",
      },
      synced_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      created_by: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "temp_storage",
      tableName: "temp_storage",
      underscored: false,
    }
  );
  return temp_storage;
};
